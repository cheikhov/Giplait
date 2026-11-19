import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNewStock,
  consolidateColdRoomCounts,
  computeInventorySummary,
  isDuplicateDocNumber,
  matchCatalogProduct,
} from './stockEngine';
import { createInitialWorkspaceSeed } from '../data/catalog';

test('calculateNewStock applies Current = Previous + Incoming - Outgoing accurately', () => {
  const afterEntry = calculateNewStock(1000, 'ENTREE', 500);
  assert.equal(afterEntry.newStock, 1500);
  assert.equal(afterEntry.delta, 500);

  const afterExit = calculateNewStock(1500, 'SORTIE', 350);
  assert.equal(afterExit.newStock, 1150);
  assert.equal(afterExit.delta, -350);
});

test('calculateNewStock blocks negative stock unless explicit authorized adjustment is allowed', () => {
  assert.throws(
    () => calculateNewStock(100, 'SORTIE', 150),
    /Stock insuffisant/
  );

  assert.throws(
    () => calculateNewStock(100, 'AJUSTEMENT', -120, false),
    /Stock insuffisant/
  );

  const forced = calculateNewStock(100, 'AJUSTEMENT', -120, true);
  assert.equal(forced.newStock, 0);
  assert.equal(forced.delta, -120);
});

test('isDuplicateDocNumber blocks duplicate BR and BL numbers case-insensitively', () => {
  const docs = [
    { docNumber: 'BR-2026-0142', docType: 'RECEPTION' as const },
    { docNumber: 'BL-2026-0091', docType: 'LIVRAISON' as const },
  ];

  assert.equal(isDuplicateDocNumber(docs, ' br-2026-0142 ', 'RECEPTION'), true);
  assert.equal(isDuplicateDocNumber(docs, 'BR-2026-0142', 'LIVRAISON'), false);
  assert.equal(isDuplicateDocNumber(docs, 'BL-2026-0092', 'LIVRAISON'), false);
});

test('consolidateColdRoomCounts combines quantities across all cold rooms into one total', () => {
  // User example: Room 1: 2,000 + Room 2: 3,000 + Room 3: 1,500 = 6,500
  const total = consolidateColdRoomCounts({
    'Chambre Froide 1': 2000,
    'Chambre Froide 2': 3000,
    'Chambre Froide 3': 1500,
  });
  assert.equal(total, 6500);
});

test('createInitialWorkspaceSeed initializes 69 products at 0 stock with empty operations', () => {
  const seed = createInitialWorkspaceSeed('user-abc');
  assert.equal(seed.products.length, 69);
  assert.ok(seed.products.every((p) => p.currentStock === 0 && p.totalIn === 0 && p.totalOut === 0));
  assert.ok(seed.products.every((p) => p.workspaceId === 'user-abc'));
  assert.equal(seed.distributors.length, 0);
  assert.equal(seed.documents.length, 0);
  assert.equal(seed.movements.length, 0);
  assert.equal(seed.inventories.length, 0);
  assert.equal(seed.auditLogs.length, 0);
});

test('computeInventorySummary calculates theoretical, consolidated physical, and discrepancies', () => {
  const seed = createInitialWorkspaceSeed();
  const sampleProducts = [
    { ...seed.products[0], currentStock: 6500 },
    { ...seed.products[1], currentStock: 4200 },
  ];

  const summary = computeInventorySummary(sampleProducts, {
    'prod-001': {
      'Chambre Froide 1': 2000,
      'Chambre Froide 2': 3000,
      'Chambre Froide 3': 1500,
    },
    'prod-002': {
      'Chambre Froide 1': 4000,
      'Chambre Froide 2': 100,
    },
  });

  assert.equal(summary.lines[0].physicalQty, 6500);
  assert.equal(summary.lines[0].discrepancy, 0);
  assert.equal(summary.lines[1].physicalQty, 4100);
  assert.equal(summary.lines[1].discrepancy, -100);
  assert.equal(summary.totalTheoretical, 10700);
  assert.equal(summary.totalPhysical, 10600);
  assert.equal(summary.totalDiscrepancy, -100);
  assert.equal(summary.negativeCount, 1);
});

test('matchCatalogProduct matches by barcode, reference, and fuzzy French name', () => {
  const seed = createInitialWorkspaceSeed();
  assert.equal(seed.products.length, 69);

  const byBarcode = matchCatalogProduct('Inconnu', undefined, '6130001000475', seed.products);
  assert.equal(byBarcode?.id, 'prod-047');

  const byRef = matchCatalogProduct('Autre', 'GPL-FR-032', undefined, seed.products);
  assert.equal(byRef?.name, 'Camembert 250 g');

  const byName = matchCatalogProduct('Beurre pasteurisé 500 g', undefined, undefined, seed.products);
  assert.equal(byName?.reference, 'GPL-GR-067');
});
