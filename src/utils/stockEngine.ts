import type {
  ColdRoomCountMap,
  DeliveryDocument,
  DocumentType,
  GlobalInventory,
  InventoryLine,
  MovementType,
  Product,
  StockAlert,
  StockMovement,
} from '../types/stock';

/**
 * Computes the next stock balance following:
 * Current Stock = Previous Stock + Incoming - Outgoing
 * Negative stock is strictly blocked unless explicit authorized adjustment is permitted.
 */
export function calculateNewStock(
  previousStock: number,
  operationType: MovementType,
  quantity: number,
  allowNegativeAdjustment = false
): { newStock: number; delta: number } {
  if (!Number.isFinite(quantity)) {
    throw new Error('Quantité invalide.');
  }

  let delta = 0;
  if (operationType === 'ENTREE') {
    if (quantity <= 0) throw new Error('Une entrée doit être strictement positive.');
    delta = quantity;
  } else if (operationType === 'SORTIE') {
    if (quantity <= 0) throw new Error('Une sortie doit être strictement positive.');
    delta = -quantity;
  } else if (operationType === 'AJUSTEMENT') {
    delta = quantity; // can be positive or negative
  } else if (operationType === 'INVENTAIRE') {
    if (quantity < 0) throw new Error('La quantité inventoriée ne peut pas être négative.');
    delta = quantity - previousStock;
  }

  const newStock = previousStock + delta;
  if (newStock < 0 && !(operationType === 'AJUSTEMENT' && allowNegativeAdjustment)) {
    throw new Error(
      `Stock insuffisant (${previousStock} disponibles, variation demandée ${delta}). Stock négatif interdit sans ajustement autorisé.`
    );
  }

  return { newStock: Math.max(0, newStock), delta };
}

/**
 * Prevents duplicate processing of the same Bon de Réception or Bon de Livraison number.
 */
export function isDuplicateDocNumber(
  existingDocs: Pick<DeliveryDocument, 'docNumber' | 'docType'>[],
  docNumber: string,
  docType: DocumentType
): boolean {
  const normalized = docNumber.trim().toLowerCase();
  if (!normalized) return false;
  return existingDocs.some(
    (doc) => doc.docType === docType && doc.docNumber.trim().toLowerCase() === normalized
  );
}

/**
 * Consolidates physical counts of a product across ALL cold storage rooms into ONE total quantity.
 * Example: Room 1 (2,000) + Room 2 (3,000) + Room 3 (1,500) = 6,500 total physical stock.
 */
export function consolidateColdRoomCounts(roomBreakdown: ColdRoomCountMap): number {
  let total = 0;
  for (const val of Object.values(roomBreakdown)) {
    if (Number.isFinite(val) && val > 0) {
      total += val;
    }
  }
  return total;
}

/**
 * Builds consolidated global inventory lines and totals comparing physical vs theoretical stock.
 */
export function computeInventorySummary(
  products: Product[],
  roomCountsByProduct: Record<string, ColdRoomCountMap>
): {
  lines: InventoryLine[];
  totalTheoretical: number;
  totalPhysical: number;
  totalDiscrepancy: number;
  positiveCount: number;
  negativeCount: number;
} {
  let totalTheoretical = 0;
  let totalPhysical = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  const lines: InventoryLine[] = products.map((p) => {
    const breakdown = roomCountsByProduct[p.id] ?? {};
    const hasRoomEntry = Object.keys(breakdown).length > 0;
    const physicalQty = hasRoomEntry ? consolidateColdRoomCounts(breakdown) : p.currentStock;
    const theoreticalQty = p.currentStock;
    const discrepancy = physicalQty - theoreticalQty;

    totalTheoretical += theoreticalQty;
    totalPhysical += physicalQty;
    if (discrepancy > 0) positiveCount += 1;
    if (discrepancy < 0) negativeCount += 1;

    return {
      productId: p.id,
      productName: p.name,
      productReference: p.reference,
      category: p.category,
      unit: p.unit,
      theoreticalQty,
      roomBreakdown: breakdown,
      physicalQty,
      discrepancy,
    };
  });

  return {
    lines,
    totalTheoretical,
    totalPhysical,
    totalDiscrepancy: totalPhysical - totalTheoretical,
    positiveCount,
    negativeCount,
  };
}

/**
 * Generates real-time operational alerts from saved products, documents, movements, and inventories.
 */
export function computeAlerts(
  products: Product[],
  documents: DeliveryDocument[],
  movements: StockMovement[],
  inventories: GlobalInventory[]
): StockAlert[] {
  const alerts: StockAlert[] = [];

  for (const p of products) {
    if (p.currentStock <= 0 && (p.totalIn > 0 || p.totalOut > 0)) {
      alerts.push({
        id: `alert-oos-${p.id}`,
        severity: 'critical',
        type: 'OUT_OF_STOCK',
        title: `Rupture de stock : ${p.name}`,
        message: `Réf ${p.reference} · 0 ${p.unit} en chambre froide (seuil min : ${p.minThreshold}).`,
        productId: p.id,
        createdAt: p.updatedAt,
      });
    } else if (p.currentStock > 0 && p.currentStock <= p.minThreshold) {
      alerts.push({
        id: `alert-low-${p.id}`,
        severity: 'warning',
        type: 'LOW_STOCK',
        title: `Stock bas : ${p.name}`,
        message: `Réf ${p.reference} · ${p.currentStock} restants (seuil : ${p.minThreshold}).`,
        productId: p.id,
        createdAt: p.updatedAt,
      });
    }
  }

  const latestInv = inventories[0];
  if (latestInv) {
    for (const line of latestInv.lines) {
      if (line.discrepancy < 0) {
        alerts.push({
          id: `alert-disc-${latestInv.id}-${line.productId}`,
          severity: 'critical',
          type: 'DISCREPANCY',
          title: `Écart négatif inventaire : ${line.productName}`,
          message: `Session ${latestInv.sessionCode} · Écart de ${line.discrepancy} unités (Théorique ${line.theoreticalQty}, Physique ${line.physicalQty}).`,
          productId: line.productId,
          createdAt: latestInv.createdAt,
        });
      }
    }
  }

  for (const doc of documents.slice(0, 20)) {
    if (!doc.partyName || !doc.partyName.trim() || !doc.docNumber.trim()) {
      alerts.push({
        id: `alert-doc-${doc.id}`,
        severity: 'warning',
        type: 'MISSING_INFO',
        title: `Information manquante sur document ${doc.docNumber || doc.id}`,
        message: `${doc.docType === 'RECEPTION' ? 'Fournisseur' : 'Distributeur'} non renseigné lors de l'enregistrement.`,
        createdAt: doc.createdAt,
      });
    }
  }

  for (const mov of movements.slice(0, 30)) {
    if (
      mov.operationType === 'SORTIE' &&
      mov.previousStock > 0 &&
      Math.abs(mov.quantity) >= mov.previousStock * 0.75 &&
      Math.abs(mov.quantity) >= 500
    ) {
      alerts.push({
        id: `alert-unusual-${mov.id}`,
        severity: 'info',
        type: 'UNUSUAL_MOVEMENT',
        title: `Mouvement important : ${mov.productName}`,
        message: `Sortie de ${Math.abs(mov.quantity)} unités (${mov.documentNumber || 'Opération directe'}) soit >75% du stock disponible.`,
        productId: mov.productId,
        createdAt: mov.createdAt,
      });
    }
  }

  return alerts;
}

/**
 * Computes real-time dashboard metrics purely from persisted state.
 */
export function computeDashboardStats(
  products: Product[],
  documents: DeliveryDocument[],
  movements: StockMovement[],
  inventories: GlobalInventory[]
) {
  const totalCurrentStock = products.reduce((acc, p) => acc + p.currentStock, 0);
  const totalIncoming = products.reduce((acc, p) => acc + p.totalIn, 0);
  const totalOutgoing = products.reduce((acc, p) => acc + p.totalOut, 0);
  const productsInStockCount = products.filter((p) => p.currentStock > 0).length;
  const lowStockCount = products.filter((p) => p.currentStock > 0 && p.currentStock <= p.minThreshold).length;
  const outOfStockCount = products.filter((p) => p.currentStock <= 0).length;
  const processedDocumentsCount = documents.length;

  const latestInventory = inventories[0] ?? null;
  const totalDiscrepancy = latestInventory ? latestInventory.totalDiscrepancy : 0;

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const inventoryDoneToday = inventories.some((inv) => inv.createdAt.startsWith(todayPrefix));

  return {
    totalCurrentStock,
    totalIncoming,
    totalOutgoing,
    productsInStockCount,
    totalProductsCount: products.length,
    lowStockCount,
    outOfStockCount,
    processedDocumentsCount,
    totalDiscrepancy,
    inventoryDoneToday,
    latestInventory,
    recentMovementsCount: movements.length,
  };
}

/**
 * Matches an OCR-extracted line item against the product catalog by barcode, reference, or name similarity.
 */
export function matchCatalogProduct(
  rawName: string,
  rawReference: string | undefined,
  rawBarcode: string | undefined,
  products: Product[]
): Product | null {
  const normBarcode = (rawBarcode ?? '').replace(/\s+/g, '').trim();
  if (normBarcode) {
    const byBarcode = products.find((p) => p.barcode === normBarcode);
    if (byBarcode) return byBarcode;
  }

  const normRef = (rawReference ?? '').trim().toLowerCase();
  if (normRef) {
    const byRef = products.find((p) => p.reference.toLowerCase() === normRef);
    if (byRef) return byRef;
  }

  const normName = rawName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!normName) return null;

  const exactName = products.find(
    (p) =>
      p.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') === normName
  );
  if (exactName) return exactName;

  const tokens = normName.split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
  let bestMatch: Product | null = null;
  let bestScore = 0;

  for (const p of products) {
    const pNorm = p.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    let score = 0;
    for (const token of tokens) {
      if (pNorm.includes(token)) {
        score += token.length;
      }
    }
    if (score > bestScore && score >= 4) {
      bestScore = score;
      bestMatch = p;
    }
  }

  return bestMatch;
}
