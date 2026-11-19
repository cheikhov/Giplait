import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { createInitialWorkspaceSeed, DEFAULT_COLD_ROOMS } from '../data/catalog';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AuditLog,
  ColdRoomCountMap,
  DeliveryDocument,
  Distributor,
  DocumentLineItem,
  DocumentType,
  GlobalInventory,
  MediaEvidence,
  OcrExtractionResponse,
  Product,
  StockMovement,
  UserProfile,
  UserRole,
  WorkspaceState,
} from '../types/stock';
import {
  calculateNewStock,
  computeInventorySummary,
  isDuplicateDocNumber,
} from '../utils/stockEngine';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function uploadMediaFile(dataUrl: string, prefix: string): Promise<string> {
  const res = await fetch('/api/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, prefix }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Échec du téléversement du média.');
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function runDocumentOcr(params: {
  imageDataUrl: string;
  expectedType: DocumentType;
  products: Product[];
}): Promise<OcrExtractionResponse> {
  const res = await fetch('/api/ocr/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl: params.imageDataUrl,
      expectedType: params.expectedType,
      catalogHints: params.products.map((p) => ({
        id: p.id,
        name: p.name,
        reference: p.reference,
        barcode: p.barcode,
      })),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Erreur lors de la lecture OCR du document.");
  }
  return data as OcrExtractionResponse;
}

export async function analyzeColdRoomMedia(
  imageDataUrl: string,
  roomLabel: string
): Promise<{ summary: string; recognizedProducts: string[] }> {
  const res = await fetch('/api/inventory/analyze-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, roomLabel }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Échec de l'analyse visuelle.");
  }
  return data as { summary: string; recognizedProducts: string[] };
}

// --- Local Server-Backed Workspace API ---
export async function fetchLocalWorkspace(): Promise<WorkspaceState> {
  const res = await fetch('/api/workspace');
  if (!res.ok) throw new Error('Impossible de charger les données du poste.');
  return (await res.json()) as WorkspaceState;
}

// --- Firebase Firestore User Profile & Seed ---
export async function ensureFirebaseUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<UserProfile> {
  const userPath = `users/${params.uid}`;
  try {
    const ref = doc(db, 'users', params.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      return {
        uid: d.uid,
        email: d.email,
        displayName: d.displayName,
        role: d.role as UserRole,
        active: Boolean(d.active),
        authMode: 'firebase',
        createdAt: toIsoString(d.createdAt),
        updatedAt: toIsoString(d.updatedAt),
      };
    }

    const initialRole: UserRole =
      params.email.toLowerCase() === 'dzdzsafer@gmail.com' ? 'admin' : 'chef_de_quai';
    const payload = {
      uid: params.uid,
      email: params.email,
      displayName: params.displayName || params.email.split('@')[0],
      role: initialRole,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return {
      uid: params.uid,
      email: params.email,
      displayName: payload.displayName,
      role: initialRole,
      active: true,
      authMode: 'firebase',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function seedFirestoreIfEmpty(user: UserProfile): Promise<void> {
  try {
    const prodQ = query(collection(db, 'products'), where('workspaceId', '==', user.uid));
    const existing = await getDocs(prodQ);
    if (!existing.empty) return;

    const seed = createInitialWorkspaceSeed(user.uid);
    const batch = writeBatch(db);

    for (const p of seed.products) {
      const scopedProdId = `${user.uid}_${p.id}`;
      batch.set(doc(db, 'products', scopedProdId), {
        id: scopedProdId,
        workspaceId: user.uid,
        name: p.name,
        reference: p.reference,
        barcode: p.barcode,
        category: p.category,
        unit: p.unit,
        packagingType: p.packagingType,
        unitsPerCarton: p.unitsPerCarton,
        minThreshold: p.minThreshold,
        currentStock: 0,
        totalIn: 0,
        totalOut: 0,
        imageUrl: p.imageUrl ?? '',
        description: p.description ?? '',
        createdByUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'products');
  }
}

export function subscribeFirestoreWorkspace(
  workspaceId: string,
  onUpdate: (partial: Partial<WorkspaceState>) => void
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const subCol = <T,>(
    colName: string,
    mapper: (id: string, data: Record<string, unknown>) => T,
    key: keyof WorkspaceState
  ) => {
    const q = query(collection(db, colName), where('workspaceId', '==', workspaceId));
    const u = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => mapper(d.id, d.data() as Record<string, unknown>));
        if (key === 'movements' || key === 'documents' || key === 'inventories' || key === 'auditLogs') {
          items.sort((a: unknown, b: unknown) => {
            const ca = (a as { createdAt: string }).createdAt;
            const cb = (b as { createdAt: string }).createdAt;
            return cb.localeCompare(ca);
          });
        }
        onUpdate({ [key]: items } as Partial<WorkspaceState>);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, colName);
      }
    );
    unsubs.push(u);
  };

  subCol<Product>(
    'products',
    (id, d) => ({
      id,
      workspaceId,
      name: String(d.name ?? ''),
      reference: String(d.reference ?? ''),
      barcode: String(d.barcode ?? ''),
      category: String(d.category ?? ''),
      groupCategory: inferGroupCategory(String(d.category ?? '')),
      unit: String(d.unit ?? 'Unité'),
      packagingType: String(d.packagingType ?? 'Carton'),
      unitsPerCarton: Number(d.unitsPerCarton ?? 1),
      minThreshold: Number(d.minThreshold ?? 0),
      currentStock: Number(d.currentStock ?? 0),
      totalIn: Number(d.totalIn ?? 0),
      totalOut: Number(d.totalOut ?? 0),
      imageUrl: d.imageUrl ? String(d.imageUrl) : undefined,
      description: d.description ? String(d.description) : undefined,
      createdByUid: String(d.createdByUid ?? ''),
      createdAt: toIsoString(d.createdAt),
      updatedAt: toIsoString(d.updatedAt),
    }),
    'products'
  );

  subCol<Distributor>(
    'distributors',
    (id, d) => ({
      id,
      workspaceId,
      fullName: String(d.fullName ?? ''),
      referenceCode: String(d.referenceCode ?? ''),
      phone: d.phone ? String(d.phone) : undefined,
      zone: d.zone ? String(d.zone) : undefined,
      createdByUid: String(d.createdByUid ?? ''),
      createdAt: toIsoString(d.createdAt),
      updatedAt: toIsoString(d.updatedAt),
    }),
    'distributors'
  );

  subCol<DeliveryDocument>(
    'documents',
    (id, d) => ({
      id,
      workspaceId,
      docNumber: String(d.docNumber ?? ''),
      docType: (d.docType as DocumentType) ?? 'RECEPTION',
      docDate: String(d.docDate ?? ''),
      partyName: String(d.partyName ?? ''),
      distributorId: d.distributorId ? String(d.distributorId) : undefined,
      status: 'CONFIRMED',
      imageUrl: d.imageUrl ? String(d.imageUrl) : undefined,
      items: (d.items as DocumentLineItem[]) ?? [],
      aiNotes: d.aiNotes ? String(d.aiNotes) : undefined,
      createdByUid: String(d.createdByUid ?? ''),
      createdByName: String(d.createdByName ?? ''),
      createdAt: toIsoString(d.createdAt),
    }),
    'documents'
  );

  subCol<StockMovement>(
    'movements',
    (id, d) => ({
      id,
      workspaceId,
      productId: String(d.productId ?? ''),
      productName: String(d.productName ?? ''),
      productReference: String(d.productReference ?? ''),
      operationType: (d.operationType as StockMovement['operationType']) ?? 'ENTREE',
      quantity: Number(d.quantity ?? 0),
      previousStock: Number(d.previousStock ?? 0),
      newStock: Number(d.newStock ?? 0),
      documentId: d.documentId ? String(d.documentId) : undefined,
      documentNumber: d.documentNumber ? String(d.documentNumber) : undefined,
      documentImageUrl: d.documentImageUrl ? String(d.documentImageUrl) : undefined,
      partyName: d.partyName ? String(d.partyName) : undefined,
      distributorId: d.distributorId ? String(d.distributorId) : undefined,
      reason: d.reason ? String(d.reason) : undefined,
      userUid: String(d.userUid ?? ''),
      userName: String(d.userName ?? ''),
      createdAt: toIsoString(d.createdAt),
    }),
    'movements'
  );

  subCol<GlobalInventory>(
    'inventories',
    (id, d) => ({
      id,
      workspaceId,
      sessionCode: String(d.sessionCode ?? ''),
      status: 'VALIDEE',
      totalTheoretical: Number(d.totalTheoretical ?? 0),
      totalPhysical: Number(d.totalPhysical ?? 0),
      totalDiscrepancy: Number(d.totalDiscrepancy ?? 0),
      linesCount: Number(d.linesCount ?? 0),
      lines: (d.lines as GlobalInventory['lines']) ?? [],
      mediaItems: (d.mediaItems as GlobalInventory['mediaItems']) ?? [],
      notes: d.notes ? String(d.notes) : undefined,
      userUid: String(d.userUid ?? ''),
      userName: String(d.userName ?? ''),
      createdAt: toIsoString(d.createdAt),
    }),
    'inventories'
  );

  subCol<AuditLog>(
    'audit_logs',
    (id, d) => ({
      id,
      workspaceId,
      action: String(d.action ?? ''),
      targetType: String(d.targetType ?? ''),
      targetId: d.targetId ? String(d.targetId) : undefined,
      details: String(d.details ?? ''),
      userUid: String(d.userUid ?? ''),
      userName: String(d.userName ?? ''),
      userRole: d.userRole ? String(d.userRole) : undefined,
      createdAt: toIsoString(d.createdAt),
    }),
    'auditLogs'
  );

  onUpdate({ coldRooms: DEFAULT_COLD_ROOMS });

  return () => {
    unsubs.forEach((u) => u());
  };
}

function inferGroupCategory(cat: string): Product['groupCategory'] {
  const lower = cat.toLowerCase();
  if (lower.includes('lait sub') || lower.includes('lait non')) return 'Lait';
  if (lower.includes('fromage')) return 'Fromages';
  if (lower.includes('yaourt')) return 'Yaourt';
  if (lower.includes('graisse') || lower.includes('beurre')) return 'Beurre';
  if (lower.includes('boisson')) return 'Autres produits';
  return 'Dérivés laitiers';
}

// --- Unified Mutations (Firebase or Local Server) ---
export async function saveProduct(
  user: UserProfile,
  productInput: Omit<Product, 'id' | 'workspaceId' | 'totalIn' | 'totalOut' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<void> {
  if (user.authMode === 'local') {
    const url = existingId ? `/api/workspace/products/${existingId}` : '/api/workspace/products';
    const method = existingId ? 'PUT' : 'POST';
    const body = existingId
      ? { updates: productInput, userUid: user.uid, userName: user.displayName, userRole: user.role }
      : { product: { ...productInput, createdByUid: user.uid }, userName: user.displayName, userRole: user.role };
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur enregistrement produit.');
    return;
  }

  const id = existingId || makeId('prod');
  const path = `products/${id}`;
  try {
    if (existingId) {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'products', id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Produit introuvable.');
        const prev = snap.data();
        tx.update(ref, {
          name: productInput.name.slice(0, 200),
          reference: productInput.reference.slice(0, 64),
          barcode: productInput.barcode.slice(0, 64),
          category: productInput.category.slice(0, 80),
          unit: productInput.unit.slice(0, 40),
          packagingType: productInput.packagingType.slice(0, 80),
          unitsPerCarton: Math.max(1, Math.round(productInput.unitsPerCarton)),
          minThreshold: Math.max(0, Math.round(productInput.minThreshold)),
          imageUrl: (productInput.imageUrl ?? '').slice(0, 500),
          description: (productInput.description ?? '').slice(0, 1000),
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, 'audit_logs', makeId('audit')), {
          id: makeId('audit'),
          workspaceId: user.uid,
          action: 'MODIFICATION_PRODUIT',
          targetType: 'PRODUCT',
          targetId: id,
          details: `Mise à jour ${productInput.name} (${prev.reference} -> ${productInput.reference})`,
          userUid: user.uid,
          userName: user.displayName,
          userRole: user.role,
          createdAt: serverTimestamp(),
        });
      });
    } else {
      await setDoc(doc(db, 'products', id), {
        id,
        workspaceId: user.uid,
        name: productInput.name.slice(0, 200),
        reference: productInput.reference.slice(0, 64),
        barcode: productInput.barcode.slice(0, 64),
        category: productInput.category.slice(0, 80),
        unit: productInput.unit.slice(0, 40),
        packagingType: productInput.packagingType.slice(0, 80),
        unitsPerCarton: Math.max(1, Math.round(productInput.unitsPerCarton)),
        minThreshold: Math.max(0, Math.round(productInput.minThreshold)),
        currentStock: Math.max(0, productInput.currentStock),
        totalIn: Math.max(0, productInput.currentStock),
        totalOut: 0,
        imageUrl: (productInput.imageUrl ?? '').slice(0, 500),
        description: (productInput.description ?? '').slice(0, 1000),
        createdByUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeProduct(user: UserProfile, productId: string): Promise<void> {
  if (user.authMode === 'local') {
    const res = await fetch(`/api/workspace/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userUid: user.uid, userName: user.displayName, userRole: user.role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur suppression produit.');
    return;
  }

  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
}

export async function adjustProductStock(
  user: UserProfile,
  params: { productId: string; deltaQuantity: number; reason: string; allowNegative: boolean }
): Promise<void> {
  if (user.authMode === 'local') {
    const res = await fetch('/api/workspace/stock/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        userUid: user.uid,
        userName: user.displayName,
        userRole: user.role,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur ajustement stock.');
    return;
  }

  try {
    await runTransaction(db, async (tx) => {
      const pRef = doc(db, 'products', params.productId);
      const pSnap = await tx.get(pRef);
      if (!pSnap.exists()) throw new Error('Produit introuvable.');
      const p = pSnap.data();
      const prevStock = Number(p.currentStock ?? 0);
      const { newStock, delta } = calculateNewStock(prevStock, 'AJUSTEMENT', params.deltaQuantity, params.allowNegative);

      tx.update(pRef, {
        currentStock: newStock,
        totalIn: delta > 0 ? Number(p.totalIn ?? 0) + delta : Number(p.totalIn ?? 0),
        totalOut: delta < 0 ? Number(p.totalOut ?? 0) + Math.abs(delta) : Number(p.totalOut ?? 0),
        updatedAt: serverTimestamp(),
      });

      const movId = makeId('mov');
      tx.set(doc(db, 'movements', movId), {
        id: movId,
        workspaceId: user.uid,
        productId: params.productId,
        productName: String(p.name),
        productReference: String(p.reference),
        operationType: 'AJUSTEMENT',
        quantity: delta,
        previousStock: prevStock,
        newStock,
        reason: params.reason.slice(0, 400),
        userUid: user.uid,
        userName: user.displayName,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Stock insuffisant')) throw error;
    handleFirestoreError(error, OperationType.WRITE, `products/${params.productId}`);
  }
}

export async function confirmDeliveryDocument(
  user: UserProfile,
  existingDocs: DeliveryDocument[],
  params: {
    docNumber: string;
    docType: DocumentType;
    docDate: string;
    partyName: string;
    distributorId?: string;
    imageUrl?: string;
    aiNotes?: string;
    items: DocumentLineItem[];
  }
): Promise<DeliveryDocument> {
  if (isDuplicateDocNumber(existingDocs, params.docNumber, params.docType)) {
    throw new Error(
      `Doublon détecté : le ${params.docType === 'RECEPTION' ? 'Bon de Réception' : 'Bon de Livraison'} N° "${params.docNumber}" existe déjà.`
    );
  }

  if (user.authMode === 'local') {
    const res = await fetch('/api/workspace/documents/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        userUid: user.uid,
        userName: user.displayName,
        userRole: user.role,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur confirmation document.');
    return data as DeliveryDocument;
  }

  const docId = makeId('doc');
  try {
    await runTransaction(db, async (tx) => {
      const snaps = await Promise.all(params.items.map((item) => tx.get(doc(db, 'products', item.productId))));
      const opType = params.docType === 'RECEPTION' ? 'ENTREE' : 'SORTIE';

      snaps.forEach((snap, i) => {
        const item = params.items[i];
        if (!snap.exists()) throw new Error(`Produit introuvable : ${item.productName}`);
        const p = snap.data();
        const prevStock = Number(p.currentStock ?? 0);
        const { newStock, delta } = calculateNewStock(prevStock, opType, item.quantity, false);

        tx.update(snap.ref, {
          currentStock: newStock,
          totalIn: opType === 'ENTREE' ? Number(p.totalIn ?? 0) + item.quantity : Number(p.totalIn ?? 0),
          totalOut: opType === 'SORTIE' ? Number(p.totalOut ?? 0) + item.quantity : Number(p.totalOut ?? 0),
          updatedAt: serverTimestamp(),
        });

        const movId = makeId('mov');
        tx.set(doc(db, 'movements', movId), {
          id: movId,
          workspaceId: user.uid,
          productId: item.productId,
          productName: String(p.name),
          productReference: String(p.reference),
          operationType: opType,
          quantity: delta,
          previousStock: prevStock,
          newStock,
          documentId: docId,
          documentNumber: params.docNumber.trim(),
          documentImageUrl: params.imageUrl ?? '',
          partyName: params.partyName.trim(),
          distributorId: params.distributorId ?? '',
          reason: `${params.docType === 'RECEPTION' ? 'Bon de Réception' : 'Bon de Livraison'} ${params.docNumber.trim()}`,
          userUid: user.uid,
          userName: user.displayName,
          createdAt: serverTimestamp(),
        });
      });

      tx.set(doc(db, 'documents', docId), {
        id: docId,
        workspaceId: user.uid,
        docNumber: params.docNumber.trim(),
        docType: params.docType,
        docDate: params.docDate,
        partyName: params.partyName.trim(),
        distributorId: params.distributorId ?? '',
        status: 'CONFIRMED',
        imageUrl: params.imageUrl ?? '',
        items: params.items,
        aiNotes: (params.aiNotes ?? '').slice(0, 1000),
        createdByUid: user.uid,
        createdByName: user.displayName,
        createdAt: serverTimestamp(),
      });
    });

    return {
      id: docId,
      workspaceId: user.uid,
      docNumber: params.docNumber.trim(),
      docType: params.docType,
      docDate: params.docDate,
      partyName: params.partyName.trim(),
      distributorId: params.distributorId,
      status: 'CONFIRMED',
      imageUrl: params.imageUrl,
      items: params.items,
      aiNotes: params.aiNotes,
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Stock insuffisant')) throw error;
    handleFirestoreError(error, OperationType.WRITE, `documents/${docId}`);
  }
}

export async function validateGlobalInventory(
  user: UserProfile,
  products: Product[],
  existingInventoriesCount: number,
  params: {
    roomCountsByProduct: Record<string, ColdRoomCountMap>;
    mediaItems: MediaEvidence[];
    notes?: string;
  }
): Promise<GlobalInventory> {
  if (user.authMode === 'local') {
    const res = await fetch('/api/workspace/inventories/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        userUid: user.uid,
        userName: user.displayName,
        userRole: user.role,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur validation inventaire.');
    return data as GlobalInventory;
  }

  const invId = makeId('inv');
  const nowIso = new Date().toISOString();
  const sessionCode = `INV-${nowIso.slice(0, 10).replace(/-/g, '')}-${String(existingInventoriesCount + 1).padStart(3, '0')}`;
  const summary = computeInventorySummary(products, params.roomCountsByProduct);

  try {
    await runTransaction(db, async (tx) => {
      for (const line of summary.lines) {
        if (line.discrepancy !== 0) {
          tx.update(doc(db, 'products', line.productId), {
            currentStock: line.physicalQty,
            updatedAt: serverTimestamp(),
          });
          const movId = makeId('mov');
          tx.set(doc(db, 'movements', movId), {
            id: movId,
            workspaceId: user.uid,
            productId: line.productId,
            productName: line.productName,
            productReference: line.productReference,
            operationType: 'INVENTAIRE',
            quantity: line.discrepancy,
            previousStock: line.theoreticalQty,
            newStock: line.physicalQty,
            documentId: invId,
            documentNumber: sessionCode,
            reason: `Régularisation Inventaire Général (${line.discrepancy > 0 ? '+' : ''}${line.discrepancy})`,
            userUid: user.uid,
            userName: user.displayName,
            createdAt: serverTimestamp(),
          });
        }
      }

      tx.set(doc(db, 'inventories', invId), {
        id: invId,
        workspaceId: user.uid,
        sessionCode,
        status: 'VALIDEE',
        totalTheoretical: summary.totalTheoretical,
        totalPhysical: summary.totalPhysical,
        totalDiscrepancy: summary.totalDiscrepancy,
        linesCount: summary.lines.length,
        lines: summary.lines.slice(0, 150),
        mediaItems: params.mediaItems.slice(0, 20),
        notes: (params.notes ?? '').slice(0, 1000),
        userUid: user.uid,
        userName: user.displayName,
        createdAt: serverTimestamp(),
      });
    });

    return {
      id: invId,
      workspaceId: user.uid,
      sessionCode,
      status: 'VALIDEE',
      totalTheoretical: summary.totalTheoretical,
      totalPhysical: summary.totalPhysical,
      totalDiscrepancy: summary.totalDiscrepancy,
      linesCount: summary.lines.length,
      lines: summary.lines,
      mediaItems: params.mediaItems,
      notes: params.notes,
      userUid: user.uid,
      userName: user.displayName,
      createdAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `inventories/${invId}`);
  }
}

export async function saveDistributor(
  user: UserProfile,
  distributor: Partial<Distributor> & { fullName: string; referenceCode: string }
): Promise<void> {
  if (user.authMode === 'local') {
    const res = await fetch('/api/workspace/distributors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distributor,
        userUid: user.uid,
        userName: user.displayName,
        userRole: user.role,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur distributeur.');
    return;
  }

  const id = distributor.id || makeId('dist');
  try {
    if (distributor.id) {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'distributors', id);
        tx.update(ref, {
          fullName: distributor.fullName.trim().slice(0, 160),
          referenceCode: distributor.referenceCode.trim().slice(0, 64),
          phone: (distributor.phone ?? '').slice(0, 40),
          zone: (distributor.zone ?? '').slice(0, 120),
          updatedAt: serverTimestamp(),
        });
      });
    } else {
      await setDoc(doc(db, 'distributors', id), {
        id,
        workspaceId: user.uid,
        fullName: distributor.fullName.trim().slice(0, 160),
        referenceCode: distributor.referenceCode.trim().slice(0, 64),
        phone: (distributor.phone ?? '').slice(0, 40),
        zone: (distributor.zone ?? '').slice(0, 120),
        createdByUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `distributors/${id}`);
  }
}

export async function removeDistributor(user: UserProfile, distributorId: string): Promise<void> {
  if (user.authMode === 'local') {
    const res = await fetch(`/api/workspace/distributors/${distributorId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userUid: user.uid, userName: user.displayName, userRole: user.role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur suppression distributeur.');
    return;
  }

  try {
    await deleteDoc(doc(db, 'distributors', distributorId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `distributors/${distributorId}`);
  }
}
