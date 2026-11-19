export type Language = 'fr' | 'ar';

export type UserRole = 'admin' | 'chef_de_quai' | 'operateur';

export type MenuId =
  | 'dashboard'
  | 'products'
  | 'stock'
  | 'reception'
  | 'livraison'
  | 'inventory'
  | 'distributors'
  | 'movements'
  | 'reports'
  | 'archives'
  | 'settings';

export type ProductGroupCategory =
  | 'Lait'
  | 'Beurre'
  | 'Yaourt'
  | 'Fromages'
  | 'Dérivés laitiers'
  | 'Autres produits';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  authMode: 'firebase' | 'local';
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  workspaceId: string;
  name: string;
  reference: string;
  barcode: string;
  category: string; // Exact PDF category e.g. 'Lait subventionné', 'Fromages'
  groupCategory: ProductGroupCategory;
  unit: string;
  packagingType: string;
  unitsPerCarton: number;
  minThreshold: number;
  currentStock: number;
  totalIn: number;
  totalOut: number;
  imageUrl?: string;
  description?: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Distributor {
  id: string;
  workspaceId: string;
  fullName: string;
  referenceCode: string;
  phone?: string;
  zone?: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentLineItem {
  id: string;
  productId: string;
  productName: string;
  productReference: string;
  barcode?: string;
  packaging?: string;
  quantity: number;
  confidence: 'high' | 'medium' | 'low';
  uncertainReason?: string;
  rawText?: string;
}

export type DocumentType = 'RECEPTION' | 'LIVRAISON';

export interface DeliveryDocument {
  id: string;
  workspaceId: string;
  docNumber: string;
  docType: DocumentType;
  docDate: string;
  partyName: string; // Supplier for RECEPTION, Distributor/Recipient for LIVRAISON
  distributorId?: string;
  status: 'CONFIRMED';
  imageUrl?: string;
  items: DocumentLineItem[];
  aiNotes?: string;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
}

export type MovementType = 'ENTREE' | 'SORTIE' | 'AJUSTEMENT' | 'INVENTAIRE';

export interface StockMovement {
  id: string;
  workspaceId: string;
  productId: string;
  productName: string;
  productReference: string;
  operationType: MovementType;
  quantity: number; // Positive for ENTREE, negative or delta for SORTIE/AJUSTEMENT/INVENTAIRE
  previousStock: number;
  newStock: number;
  documentId?: string;
  documentNumber?: string;
  documentImageUrl?: string;
  partyName?: string;
  distributorId?: string;
  reason?: string;
  userUid: string;
  userName: string;
  createdAt: string;
}

export interface ColdRoomCountMap {
  [roomName: string]: number;
}

export interface InventoryLine {
  productId: string;
  productName: string;
  productReference: string;
  category: string;
  unit: string;
  theoreticalQty: number;
  roomBreakdown: ColdRoomCountMap;
  physicalQty: number;
  discrepancy: number;
}

export interface MediaEvidence {
  id: string;
  type: 'photo' | 'video';
  url: string;
  roomLabel: string;
  aiSummary?: string;
  recognizedProducts?: string[];
  capturedAt: string;
}

export interface GlobalInventory {
  id: string;
  workspaceId: string;
  sessionCode: string;
  status: 'VALIDEE';
  totalTheoretical: number;
  totalPhysical: number;
  totalDiscrepancy: number;
  linesCount: number;
  lines: InventoryLine[];
  mediaItems: MediaEvidence[];
  notes?: string;
  userUid: string;
  userName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: string;
  userUid: string;
  userName: string;
  userRole?: string;
  createdAt: string;
}

export interface StockAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'DISCREPANCY' | 'MISSING_INFO' | 'UNUSUAL_MOVEMENT';
  title: string;
  message: string;
  productId?: string;
  createdAt: string;
}

export interface OcrExtractionResponse {
  docNumber: string;
  docTypeDetected: DocumentType;
  docDate: string;
  partyName: string;
  aiNotes: string;
  items: Array<{
    rawName: string;
    matchedProductId: string | null;
    reference: string;
    barcode: string;
    packaging: string;
    quantity: number;
    confidence: 'high' | 'medium' | 'low';
    uncertainReason?: string;
  }>;
}

export interface WorkspaceState {
  products: Product[];
  distributors: Distributor[];
  documents: DeliveryDocument[];
  movements: StockMovement[];
  inventories: GlobalInventory[];
  auditLogs: AuditLog[];
  coldRooms: string[];
}
