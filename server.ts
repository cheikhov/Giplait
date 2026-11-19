import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  UPLOADS_DIR,
  addProductInStore,
  adjustStockInStore,
  confirmDocumentInStore,
  deleteDistributorInStore,
  deleteProductInStore,
  loadWorkspaceStore,
  saveWorkspaceStore,
  updateColdRoomsInStore,
  updateProductInStore,
  upsertDistributorInStore,
  validateGlobalInventoryInStore,
} from './src/server/workspaceStore';
import { createInitialWorkspaceSeed } from './src/data/catalog';
import { matchCatalogProduct } from './src/utils/stockEngine';

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('Clé GEMINI_API_KEY non configurée sur le serveur.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Format de média base64 invalide.');
  }
  return { mimeType: match[1], base64Data: match[2] };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '30mb' }));

  // Serve persisted captured photos & cold-room videos
  loadWorkspaceStore();
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'chef-de-quai-api' });
  });

  // Upload media (image or video) to disk so large files stay out of Firestore/JSON docs
  app.post('/api/media/upload', (req, res) => {
    try {
      const { dataUrl, prefix = 'media' } = req.body as { dataUrl?: string; prefix?: string };
      if (!dataUrl) {
        return res.status(400).json({ error: 'Aucune donnée média fournie.' });
      }
      const { mimeType, base64Data } = parseDataUrl(dataUrl);
      const ext = mimeType.includes('webm')
        ? 'webm'
        : mimeType.includes('mp4')
        ? 'mp4'
        : mimeType.includes('png')
        ? 'png'
        : 'jpg';
      const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      res.json({ url: `/uploads/${filename}`, filename, mimeType });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Erreur upload média.' });
    }
  });

  // Gemini AI OCR for Bon de Réception / Bon de Livraison
  app.post('/api/ocr/document', async (req, res) => {
    try {
      const { imageDataUrl, expectedType, catalogHints } = req.body as {
        imageDataUrl?: string;
        expectedType?: 'RECEPTION' | 'LIVRAISON';
        catalogHints?: Array<{ id: string; name: string; reference: string; barcode: string }>;
      };

      if (!imageDataUrl) {
        return res.status(400).json({ error: 'Image du document manquante.' });
      }

      const ai = getGeminiClient();
      const { mimeType, base64Data } = parseDataUrl(imageDataUrl);
      const store = loadWorkspaceStore();
      const products = store.products;

      const hintsText = (catalogHints?.length ? catalogHints : products)
        .slice(0, 75)
        .map((p) => `${p.reference} | ${p.barcode} | ${p.name}`)
        .join('\n');

      const prompt = `Tu es un système OCR industriel spécialisé pour un Chef de Quai d'une laiterie algérienne (GIPLAIT).
Analyse l'image du document physique (${expectedType === 'LIVRAISON' ? 'Bon de Livraison' : 'Bon de Réception'}).
Extrais avec précision :
- docNumber : le numéro du bon (ex: BR-2026-0155 ou BL-2026-0412). Si illisible, mets "".
- docTypeDetected : "RECEPTION" ou "LIVRAISON".
- docDate : date et heure visibles (format YYYY-MM-DD HH:mm si possible).
- partyName : nom du fournisseur (si réception) ou du distributeur/client destinataire (si livraison).
- aiNotes : remarques sur la lisibilité, cachets, signatures ou zones incertaines.
- items : tableau des lignes produits extraites avec :
  - rawName : nom du produit lu sur le document
  - reference : référence produit si visible
  - barcode : code-barres si visible
  - packaging : conditionnement lu (caisse, carton, plateau, fardeau...)
  - quantity : quantité numérique entière (si incertaine, mets ta meilleure estimation et passe confidence à "low" ou "medium")
  - confidence : "high" | "medium" | "low"
  - uncertainReason : raison si confidence != "high"

Catalogue de référence officiel (Référence | Code-barres | Nom) :
${hintsText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              docNumber: { type: Type.STRING },
              docTypeDetected: { type: Type.STRING },
              docDate: { type: Type.STRING },
              partyName: { type: Type.STRING },
              aiNotes: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rawName: { type: Type.STRING },
                    reference: { type: Type.STRING },
                    barcode: { type: Type.STRING },
                    packaging: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    confidence: { type: Type.STRING },
                    uncertainReason: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as {
        docNumber?: string;
        docTypeDetected?: string;
        docDate?: string;
        partyName?: string;
        aiNotes?: string;
        items?: Array<{
          rawName?: string;
          reference?: string;
          barcode?: string;
          packaging?: string;
          quantity?: number;
          confidence?: string;
          uncertainReason?: string;
        }>;
      };

      const enrichedItems = (parsed.items ?? []).map((item) => {
        const matched = matchCatalogProduct(
          item.rawName ?? '',
          item.reference,
          item.barcode,
          products
        );
        const conf =
          item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low'
            ? item.confidence
            : matched
            ? 'medium'
            : 'low';
        return {
          rawName: item.rawName ?? '',
          matchedProductId: matched?.id ?? null,
          reference: matched?.reference ?? item.reference ?? '',
          barcode: matched?.barcode ?? item.barcode ?? '',
          packaging: item.packaging ?? matched?.packagingType ?? '',
          quantity: Number.isFinite(item.quantity) && (item.quantity ?? 0) > 0 ? Number(item.quantity) : 0,
          confidence: matched ? conf : 'low',
          uncertainReason:
            item.uncertainReason ||
            (!matched ? 'Produit non identifié automatiquement — sélection manuelle requise.' : ''),
        };
      });

      res.json({
        docNumber: parsed.docNumber ?? '',
        docTypeDetected:
          parsed.docTypeDetected === 'LIVRAISON' || parsed.docTypeDetected === 'RECEPTION'
            ? parsed.docTypeDetected
            : expectedType ?? 'RECEPTION',
        docDate: parsed.docDate ?? new Date().toISOString().slice(0, 16).replace('T', ' '),
        partyName: parsed.partyName ?? '',
        aiNotes: parsed.aiNotes ?? '',
        items: enrichedItems,
      });
    } catch (error) {
      console.error('OCR Error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Échec de l'analyse OCR Gemini.",
      });
    }
  });

  // Gemini Vision assistant for Global Inventory cold storage room photos/videos
  // Identifies visible dairy products WITHOUT inventing hidden quantities
  app.post('/api/inventory/analyze-media', async (req, res) => {
    try {
      const { imageDataUrl, roomLabel } = req.body as {
        imageDataUrl?: string;
        roomLabel?: string;
      };
      if (!imageDataUrl) {
        return res.status(400).json({ error: 'Média manquant.' });
      }
      const ai = getGeminiClient();
      const { mimeType, base64Data } = parseDataUrl(imageDataUrl);
      const store = loadWorkspaceStore();
      const catalogNames = store.products.map((p) => `${p.reference}: ${p.name}`).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            {
              text: `Tu assistes un Chef de Quai lors de l'inventaire physique dans "${roomLabel ?? 'Chambre Froide'}".
Identifie uniquement les familles ou produits laitiers visibles sur cette image/capture.
RÈGLE STRICTE : N'invente JAMAIS de quantités cachées ou empilées derrière d'autres palettes. Décris l'état visuel (palettes, caisses, yaourts, sachets de lait, fromages, beurre) pour aider l'opérateur qui saisit manuellement les quantités.
Catalogue de référence :
${catalogNames}`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              recognizedProducts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        summary?: string;
        recognizedProducts?: string[];
      };

      res.json({
        summary: parsed.summary ?? 'Analyse visuelle terminée. Veuillez saisir les quantités physiques exactes.',
        recognizedProducts: parsed.recognizedProducts ?? [],
      });
    } catch (error) {
      console.error('Vision Inventory Error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Échec analyse vision inventaire.',
      });
    }
  });

  // --- Server-backed Persistent Workspace API (Poste de Quai Local / Multi-terminal) ---
  app.get('/api/workspace', (_req, res) => {
    res.json(loadWorkspaceStore());
  });

  app.post('/api/workspace/products', (req, res) => {
    try {
      const { product, userName, userRole } = req.body;
      const created = addProductInStore(product, userName || 'Chef de Quai', userRole || 'chef_de_quai');
      res.json(created);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur création produit.' });
    }
  });

  app.put('/api/workspace/products/:id', (req, res) => {
    try {
      const { updates, userUid, userName, userRole } = req.body;
      const updated = updateProductInStore(
        req.params.id,
        updates,
        userUid || 'chef-quai-local',
        userName || 'Chef de Quai',
        userRole || 'chef_de_quai'
      );
      res.json(updated);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur mise à jour produit.' });
    }
  });

  app.delete('/api/workspace/products/:id', (req, res) => {
    try {
      const { userUid, userName, userRole } = req.body ?? {};
      deleteProductInStore(
        req.params.id,
        userUid || 'chef-quai-local',
        userName || 'Chef de Quai',
        userRole || 'admin'
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur suppression produit.' });
    }
  });

  app.post('/api/workspace/stock/adjust', (req, res) => {
    try {
      const updated = adjustStockInStore(req.body);
      res.json(updated);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur ajustement stock.' });
    }
  });

  app.post('/api/workspace/documents/confirm', (req, res) => {
    try {
      const created = confirmDocumentInStore(req.body);
      res.json(created);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur confirmation document.' });
    }
  });

  app.post('/api/workspace/inventories/validate', (req, res) => {
    try {
      const created = validateGlobalInventoryInStore(req.body);
      res.json(created);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur validation inventaire.' });
    }
  });

  app.post('/api/workspace/distributors', (req, res) => {
    try {
      const { distributor, userUid, userName, userRole } = req.body;
      const saved = upsertDistributorInStore(
        distributor,
        userUid || 'chef-quai-local',
        userName || 'Chef de Quai',
        userRole || 'chef_de_quai'
      );
      res.json(saved);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur distributeur.' });
    }
  });

  app.delete('/api/workspace/distributors/:id', (req, res) => {
    try {
      const { userUid, userName, userRole } = req.body ?? {};
      deleteDistributorInStore(
        req.params.id,
        userUid || 'chef-quai-local',
        userName || 'Chef de Quai',
        userRole || 'admin'
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur suppression distributeur.' });
    }
  });

  app.put('/api/workspace/cold-rooms', (req, res) => {
    try {
      const { coldRooms, userUid, userName, userRole } = req.body;
      const updated = updateColdRoomsInStore(
        coldRooms,
        userUid || 'chef-quai-local',
        userName || 'Chef de Quai',
        userRole || 'admin'
      );
      res.json({ coldRooms: updated });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur configuration chambres froides.' });
    }
  });

  app.post('/api/workspace/reset', (req, res) => {
    try {
      const { userUid } = req.body ?? {};
      const fresh = createInitialWorkspaceSeed(userUid || 'chef-quai-local');
      saveWorkspaceStore(fresh);
      res.json(fresh);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur réinitialisation.' });
    }
  });

  // Vite dev middleware or static production files
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
