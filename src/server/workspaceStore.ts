import fs from 'fs';
import path from 'path';
import { createInitialWorkspaceSeed } from '../data/catalog';
import type {
  AuditLog,
  ColdRoomCountMap,
  DeliveryDocument,
  Distributor,
  DocumentLineItem,
  DocumentType,
  GlobalInventory,
  MediaEvidence,
  Product,
  StockMovement,
  WorkspaceState,
} from '../types/stock';
import {
  calculateNewStock,
  computeInventorySummary,
  isDuplicateDocNumber,
} from '../utils/stockEngine';

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'giplait-data')
  : path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'quai_store.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function loadWorkspaceStore(): WorkspaceState {
  ensureDirs();
  if (!fs.existsSync(STORE_PATH)) {
    const seeded = createInitialWorkspaceSeed('chef-quai-local');
    saveWorkspaceStore(seeded);
    return seeded;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as WorkspaceState;
    if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
      const seeded = createInitialWorkspaceSeed('chef-quai-local');
      saveWorkspaceStore(seeded);
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = createInitialWorkspaceSeed('chef-quai-local');
    saveWorkspaceStore(seeded);
    return seeded;
  }
}

export function saveWorkspaceStore(state: WorkspaceState): void {
  ensureDirs();
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function appendAudit(
  state: WorkspaceState,
  action: string,
  targetType: string,
  targetId: string,
  details: string,
  userUid: string,
  userName: string,
  userRole: string
) {
  const entry: AuditLog = {
    id: makeId('audit'),
    workspaceId: 'giplait-main',
    action,
    targetType,
    targetId,
    details,
    userUid,
    userName,
    userRole,
    createdAt: new Date().toISOString(),
  };
  state.auditLogs = [entry, ...state.auditLogs].slice(0, 500);
}

export function addProductInStore(
  input: Omit<Product, 'id' | 'workspaceId' | 'totalIn' | 'totalOut' | 'createdAt' | 'updatedAt'>,
  userName: string,
  userRole: string
): Product {
  const state = loadWorkspaceStore();
  if (state.products.some((p) => p.reference.toLowerCase() === input.reference.trim().toLowerCase())) {
    throw new Error(`La référence "${input.reference}" existe déjà.`);
  }
  if (state.products.some((p) => p.barcode.trim() === input.barcode.trim())) {
    throw new Error(`Le code-barres "${input.barcode}" existe déjà.`);
  }
  const now = new Date().toISOString();
  const product: Product = {
    ...input,
    id: makeId('prod'),
    workspaceId: 'giplait-main',
    totalIn: input.currentStock,
    totalOut: 0,
    createdAt: now,
    updatedAt: now,
  };
  state.products.push(product);
  if (product.currentStock > 0) {
    state.movements.unshift({
      id: makeId('mov'),
      workspaceId: 'giplait-main',
      productId: product.id,
      productName: product.name,
      productReference: product.reference,
      operationType: 'ENTREE',
      quantity: product.currentStock,
      previousStock: 0,
      newStock: product.currentStock,
      reason: 'Création produit avec stock initial',
      userUid: input.createdByUid,
      userName,
      createdAt: now,
    });
  }
  appendAudit(
    state,
    'AJOUT_PRODUIT',
    'PRODUCT',
    product.id,
    `Ajout du produit ${product.name} (${product.reference})`,
    input.createdByUid,
    userName,
    userRole
  );
  saveWorkspaceStore(state);
  return product;
}

export function updateProductInStore(
  productId: string,
  updates: Partial<Product>,
  userUid: string,
  userName: string,
  userRole: string
): Product {
  const state = loadWorkspaceStore();
  const idx = state.products.findIndex((p) => p.id === productId);
  if (idx === -1) throw new Error('Produit introuvable.');
  const existing = state.products[idx];

  if (
    updates.reference &&
    state.products.some(
      (p) => p.id !== productId && p.reference.toLowerCase() === updates.reference!.trim().toLowerCase()
    )
  ) {
    throw new Error(`La référence "${updates.reference}" est déjà utilisée.`);
  }
  if (
    updates.barcode &&
    state.products.some((p) => p.id !== productId && p.barcode.trim() === updates.barcode!.trim())
  ) {
    throw new Error(`Le code-barres "${updates.barcode}" est déjà utilisé.`);
  }

  const updated: Product = {
    ...existing,
    ...updates,
    id: existing.id,
    workspaceId: 'giplait-main',
    updatedAt: new Date().toISOString(),
  };
  state.products[idx] = updated;
  appendAudit(
    state,
    'MODIFICATION_PRODUIT',
    'PRODUCT',
    productId,
    `Mise à jour fiche ${updated.name} (${updated.reference})`,
    userUid,
    userName,
    userRole
  );
  saveWorkspaceStore(state);
  return updated;
}

export function deleteProductInStore(
  productId: string,
  userUid: string,
  userName: string,
  userRole: string
): void {
  const state = loadWorkspaceStore();
  const target = state.products.find((p) => p.id === productId);
  if (!target) throw new Error('Produit introuvable.');
  state.products = state.products.filter((p) => p.id !== productId);
  appendAudit(
    state,
    'SUPPRESSION_PRODUIT',
    'PRODUCT',
    productId,
    `Suppression du produit ${target.name} (${target.reference})`,
    userUid,
    userName,
    userRole
  );
  saveWorkspaceStore(state);
}

export function adjustStockInStore(params: {
  productId: string;
  deltaQuantity: number;
  reason: string;
  allowNegative: boolean;
  userUid: string;
  userName: string;
  userRole: string;
}): Product {
  const state = loadWorkspaceStore();
  const idx = state.products.findIndex((p) => p.id === params.productId);
  if (idx === -1) throw new Error('Produit introuvable.');
  const product = state.products[idx];

  const { newStock, delta } = calculateNewStock(
    product.currentStock,
    'AJUSTEMENT',
    params.deltaQuantity,
    params.allowNegative
  );

  const now = new Date().toISOString();
  const updated: Product = {
    ...product,
    currentStock: newStock,
    totalIn: delta > 0 ? product.totalIn + delta : product.totalIn,
    totalOut: delta < 0 ? product.totalOut + Math.abs(delta) : product.totalOut,
    updatedAt: now,
  };
  state.products[idx] = updated;

  const movement: StockMovement = {
    id: makeId('mov'),
    workspaceId: 'giplait-main',
    productId: product.id,
    productName: product.name,
    productReference: product.reference,
    operationType: 'AJUSTEMENT',
    quantity: delta,
    previousStock: product.currentStock,
    newStock,
    reason: params.reason,
    userUid: params.userUid,
    userName: params.userName,
    createdAt: now,
  };
  state.movements.unshift(movement);
  appendAudit(
    state,
    'AJUSTEMENT_STOCK',
    'PRODUCT',
    product.id,
    `Ajustement ${delta >= 0 ? '+' : ''}${delta} sur ${product.name} (${params.reason})`,
    params.userUid,
    params.userName,
    params.userRole
  );
  saveWorkspaceStore(state);
  return updated;
}

export function confirmDocumentInStore(params: {
  docNumber: string;
  docType: DocumentType;
  docDate: string;
  partyName: string;
  distributorId?: string;
  imageUrl?: string;
  aiNotes?: string;
  items: DocumentLineItem[];
  userUid: string;
  userName: string;
  userRole: string;
}): DeliveryDocument {
  const state = loadWorkspaceStore();

  if (!params.docNumber.trim()) {
    throw new Error('Le numéro du bon est obligatoire.');
  }
  if (isDuplicateDocNumber(state.documents, params.docNumber, params.docType)) {
    throw new Error(
      `Doublon détecté : le ${params.docType === 'RECEPTION' ? 'Bon de Réception' : 'Bon de Livraison'} N° "${params.docNumber}" a déjà été traité.`
    );
  }
  if (!params.items.length) {
    throw new Error('Le document doit contenir au moins une ligne de produit valide.');
  }

  const now = new Date().toISOString();
  const docId = makeId('doc');
  const nextProducts = [...state.products];
  const newMovements: StockMovement[] = [];

  for (const item of params.items) {
    if (!item.productId || item.quantity <= 0) {
      throw new Error(`Ligne invalide pour "${item.productName}" (produit non lié ou quantité <= 0).`);
    }
    const pIdx = nextProducts.findIndex((p) => p.id === item.productId);
    if (pIdx === -1) {
      throw new Error(`Produit introuvable dans le catalogue : ${item.productName}`);
    }
    const product = nextProducts[pIdx];
    const opType = params.docType === 'RECEPTION' ? 'ENTREE' : 'SORTIE';
    const { newStock, delta } = calculateNewStock(product.currentStock, opType, item.quantity, false);

    nextProducts[pIdx] = {
      ...product,
      currentStock: newStock,
      totalIn: opType === 'ENTREE' ? product.totalIn + item.quantity : product.totalIn,
      totalOut: opType === 'SORTIE' ? product.totalOut + item.quantity : product.totalOut,
      updatedAt: now,
    };

    newMovements.push({
      id: makeId('mov'),
      workspaceId: 'giplait-main',
      productId: product.id,
      productName: product.name,
      productReference: product.reference,
      operationType: opType,
      quantity: delta,
      previousStock: product.currentStock,
      newStock,
      documentId: docId,
      documentNumber: params.docNumber.trim(),
      documentImageUrl: params.imageUrl,
      partyName: params.partyName.trim(),
      distributorId: params.distributorId,
      reason:
        params.docType === 'RECEPTION'
          ? `Bon de Réception ${params.docNumber.trim()}`
          : `Bon de Livraison ${params.docNumber.trim()}`,
      userUid: params.userUid,
      userName: params.userName,
      createdAt: now,
    });
  }

  const newDoc: DeliveryDocument = {
    id: docId,
    workspaceId: 'giplait-main',
    docNumber: params.docNumber.trim(),
    docType: params.docType,
    docDate: params.docDate,
    partyName: params.partyName.trim(),
    distributorId: params.distributorId,
    status: 'CONFIRMED',
    imageUrl: params.imageUrl,
    items: params.items,
    aiNotes: params.aiNotes,
    createdByUid: params.userUid,
    createdByName: params.userName,
    createdAt: now,
  };

  state.products = nextProducts;
  state.documents.unshift(newDoc);
  state.movements = [...newMovements, ...state.movements];

  appendAudit(
    state,
    params.docType === 'RECEPTION' ? 'CONFIRMATION_BON_RECEPTION' : 'CONFIRMATION_BON_LIVRAISON',
    'DOCUMENT',
    docId,
    `${params.docType} N° ${newDoc.docNumber} confirmé (${params.items.length} lignes, tiers: ${newDoc.partyName || 'N/A'})`,
    params.userUid,
    params.userName,
    params.userRole
  );

  saveWorkspaceStore(state);
  return newDoc;
}

export function validateGlobalInventoryInStore(params: {
  roomCountsByProduct: Record<string, ColdRoomCountMap>;
  mediaItems: MediaEvidence[];
  notes?: string;
  userUid: string;
  userName: string;
  userRole: string;
}): GlobalInventory {
  const state = loadWorkspaceStore();
  const now = new Date().toISOString();
  const summary = computeInventorySummary(state.products, params.roomCountsByProduct);
  const invId = makeId('inv');
  const sessionCode = `INV-${now.slice(0, 10).replace(/-/g, '')}-${String(state.inventories.length + 1).padStart(3, '0')}`;

  const nextProducts = state.products.map((product) => {
    const line = summary.lines.find((l) => l.productId === product.id);
    if (!line || line.discrepancy === 0) return product;
    return {
      ...product,
      currentStock: line.physicalQty,
      updatedAt: now,
    };
  });

  const newMovements: StockMovement[] = [];
  for (const line of summary.lines) {
    if (line.discrepancy !== 0) {
      newMovements.push({
        id: makeId('mov'),
        workspaceId: 'giplait-main',
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
        userUid: params.userUid,
        userName: params.userName,
        createdAt: now,
      });
    }
  }

  const inventory: GlobalInventory = {
    id: invId,
    workspaceId: 'giplait-main',
    sessionCode,
    status: 'VALIDEE',
    totalTheoretical: summary.totalTheoretical,
    totalPhysical: summary.totalPhysical,
    totalDiscrepancy: summary.totalDiscrepancy,
    linesCount: summary.lines.length,
    lines: summary.lines,
    mediaItems: params.mediaItems,
    notes: params.notes,
    userUid: params.userUid,
    userName: params.userName,
    createdAt: now,
  };

  state.products = nextProducts;
  state.inventories.unshift(inventory);
  state.movements = [...newMovements, ...state.movements];

  appendAudit(
    state,
    'VALIDATION_INVENTAIRE_GENERAL',
    'INVENTORY',
    invId,
    `Inventaire ${sessionCode} validé : Théorique ${summary.totalTheoretical}, Physique ${summary.totalPhysical}, Écart ${summary.totalDiscrepancy}`,
    params.userUid,
    params.userName,
    params.userRole
  );

  saveWorkspaceStore(state);
  return inventory;
}

export function upsertDistributorInStore(
  input: Partial<Distributor> & { fullName: string; referenceCode: string },
  userUid: string,
  userName: string,
  userRole: string
): Distributor {
  const state = loadWorkspaceStore();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = state.distributors.findIndex((d) => d.id === input.id);
    if (idx === -1) throw new Error('Distributeur introuvable.');
    const updated: Distributor = {
      ...state.distributors[idx],
      fullName: input.fullName.trim(),
      referenceCode: input.referenceCode.trim(),
      phone: input.phone?.trim(),
      zone: input.zone?.trim(),
      updatedAt: now,
    };
    state.distributors[idx] = updated;
    appendAudit(state, 'MODIFICATION_DISTRIBUTEUR', 'DISTRIBUTOR', updated.id, updated.fullName, userUid, userName, userRole);
    saveWorkspaceStore(state);
    return updated;
  }

  const created: Distributor = {
    id: makeId('dist'),
    workspaceId: 'giplait-main',
    fullName: input.fullName.trim(),
    referenceCode: input.referenceCode.trim(),
    phone: input.phone?.trim(),
    zone: input.zone?.trim(),
    createdByUid: userUid,
    createdAt: now,
    updatedAt: now,
  };
  state.distributors.push(created);
  appendAudit(state, 'AJOUT_DISTRIBUTEUR', 'DISTRIBUTOR', created.id, created.fullName, userUid, userName, userRole);
  saveWorkspaceStore(state);
  return created;
}

export function deleteDistributorInStore(
  distributorId: string,
  userUid: string,
  userName: string,
  userRole: string
): void {
  const state = loadWorkspaceStore();
  const found = state.distributors.find((d) => d.id === distributorId);
  if (!found) throw new Error('Distributeur introuvable.');
  state.distributors = state.distributors.filter((d) => d.id !== distributorId);
  appendAudit(state, 'SUPPRESSION_DISTRIBUTEUR', 'DISTRIBUTOR', distributorId, found.fullName, userUid, userName, userRole);
  saveWorkspaceStore(state);
}

export function updateColdRoomsInStore(
  coldRooms: string[],
  userUid: string,
  userName: string,
  userRole: string
): string[] {
  const state = loadWorkspaceStore();
  const cleaned = coldRooms.map((r) => r.trim()).filter(Boolean);
  if (!cleaned.length) throw new Error('Au moins une chambre froide est requise.');
  state.coldRooms = cleaned;
  appendAudit(state, 'CONFIG_CHAMBRES_FROIDES', 'SETTINGS', 'cold-rooms', cleaned.join(', '), userUid, userName, userRole);
  saveWorkspaceStore(state);
  return state.coldRooms;
}
