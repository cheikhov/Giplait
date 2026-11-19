import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  FilePlus2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { CameraModal } from './CameraModal';
import {
  confirmDeliveryDocument,
  runDocumentOcr,
  uploadMediaFile,
} from '../services/dataService';
import type {
  DeliveryDocument,
  Distributor,
  DocumentLineItem,
  DocumentType,
  Language,
  Product,
  UserProfile,
} from '../types/stock';
import { isDuplicateDocNumber } from '../utils/stockEngine';

interface DocumentOcrViewProps {
  language: Language;
  docType: DocumentType;
  user: UserProfile;
  products: Product[];
  distributors: Distributor[];
  documents: DeliveryDocument[];
  onRefresh: () => Promise<void>;
}

export const DocumentOcrView: React.FC<DocumentOcrViewProps> = ({
  docType,
  user,
  products,
  distributors,
  documents,
  onRefresh,
}) => {
  const isReception = docType === 'RECEPTION';
  const [cameraOpen, setCameraOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 16).replace('T', ' '));
  const [partyName, setPartyName] = useState('');
  const [distributorId, setDistributorId] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [items, setItems] = useState<DocumentLineItem[]>([]);

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [consultDoc, setConsultDoc] = useState<DeliveryDocument | null>(null);

  const filteredDocs = useMemo(
    () => documents.filter((d) => d.docType === docType),
    [documents, docType]
  );

  const duplicateWarning = useMemo(
    () => Boolean(docNumber.trim() && isDuplicateDocNumber(documents, docNumber, docType)),
    [documents, docNumber, docType]
  );

  const handlePhotoCaptured = async (dataUrl: string) => {
    setCameraOpen(false);
    setImagePreview(dataUrl);
    setOcrLoading(true);
    setOcrError(null);
    setConfirmError(null);
    setConfirmSuccess(null);

    try {
      const result = await runDocumentOcr({
        imageDataUrl: dataUrl,
        expectedType: docType,
        products,
      });

      setDocNumber(result.docNumber || '');
      setDocDate(result.docDate || new Date().toISOString().slice(0, 16).replace('T', ' '));
      setPartyName(result.partyName || '');
      setAiNotes(result.aiNotes || '');

      if (!isReception && result.partyName) {
        const matchedDist = distributors.find((d) =>
          d.fullName.toLowerCase().includes(result.partyName.toLowerCase().slice(0, 8))
        );
        if (matchedDist) setDistributorId(matchedDist.id);
      }

      const mappedItems: DocumentLineItem[] = (result.items ?? []).map((it, idx) => {
        const prod = products.find((p) => p.id === it.matchedProductId);
        return {
          id: `line-${Date.now()}-${idx}`,
          productId: prod?.id || '',
          productName: prod?.name || it.rawName,
          productReference: prod?.reference || it.reference || '',
          barcode: prod?.barcode || it.barcode || '',
          packaging: it.packaging || prod?.packagingType || '',
          quantity: it.quantity || 0,
          confidence: it.confidence || 'low',
          uncertainReason: it.uncertainReason,
          rawText: it.rawName,
        };
      });

      setItems(
        mappedItems.length
          ? mappedItems
          : [
              {
                id: `line-${Date.now()}-0`,
                productId: '',
                productName: '',
                productReference: '',
                quantity: 0,
                confidence: 'low',
                uncertainReason: 'Aucune ligne détectée — ajoutez les produits manuellement.',
              },
            ]
      );
    } catch (err) {
      setOcrError(
        err instanceof Error
          ? `${err.message} Vous pouvez néanmoins saisir les lignes manuellement ci-dessous.`
          : 'Erreur OCR.'
      );
      if (items.length === 0) {
        addEmptyLine();
      }
    } finally {
      setOcrLoading(false);
    }
  };

  const addEmptyLine = () => {
    const defaultProd = products[0];
    setItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length}`,
        productId: defaultProd?.id ?? '',
        productName: defaultProd?.name ?? '',
        productReference: defaultProd?.reference ?? '',
        barcode: defaultProd?.barcode ?? '',
        packaging: defaultProd?.packagingType ?? '',
        quantity: 0,
        confidence: 'medium',
      },
    ]);
  };

  const updateLineProduct = (lineId: string, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setItems((prev) =>
      prev.map((item) =>
        item.id === lineId
          ? {
              ...item,
              productId: prod?.id ?? '',
              productName: prod?.name ?? item.productName,
              productReference: prod?.reference ?? '',
              barcode: prod?.barcode ?? '',
              packaging: prod?.packagingType ?? item.packaging,
              confidence: prod ? 'high' : 'low',
              uncertainReason: prod ? undefined : 'Produit requis',
            }
          : item
      )
    );
  };

  const updateLineQty = (lineId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === lineId ? { ...item, quantity: Math.max(0, quantity) } : item
      )
    );
  };

  const removeLine = (lineId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== lineId));
  };

  const handleConfirmDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmError(null);
    setConfirmSuccess(null);

    if (!docNumber.trim()) {
      setConfirmError('Le numéro du document est obligatoire.');
      return;
    }
    if (duplicateWarning) {
      setConfirmError(`Doublon interdit : le numéro "${docNumber}" a déjà été confirmé.`);
      return;
    }
    const validItems = items.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      setConfirmError('Ajoutez au moins une ligne produit valide avec une quantité > 0.');
      return;
    }

    setConfirming(true);
    try {
      let persistedImageUrl = '';
      if (imagePreview) {
        persistedImageUrl = await uploadMediaFile(
          imagePreview,
          isReception ? 'bon-reception' : 'bon-livraison'
        );
      }

      const selectedDist = distributors.find((d) => d.id === distributorId);
      const effectiveParty = selectedDist ? selectedDist.fullName : partyName.trim();

      const saved = await confirmDeliveryDocument(user, documents, {
        docNumber: docNumber.trim(),
        docType,
        docDate: docDate.trim() || new Date().toISOString().slice(0, 16).replace('T', ' '),
        partyName: effectiveParty,
        distributorId: selectedDist?.id,
        imageUrl: persistedImageUrl || undefined,
        aiNotes,
        items: validItems,
      });

      await onRefresh();
      setConfirmSuccess(
        `${isReception ? 'Bon de Réception' : 'Bon de Livraison'} N° ${saved.docNumber} confirmé et archivé. Le stock a été mis à jour.`
      );
      setImagePreview(null);
      setDocNumber('');
      setPartyName('');
      setDistributorId('');
      setAiNotes('');
      setItems([]);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Erreur lors de la confirmation.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">
            {isReception
              ? 'Bon de Réception — Entrée en Stock (OCR IA)'
              : 'Bon de Livraison — Sortie de Stock (OCR IA)'}
          </h2>
          <p className="text-xs text-slate-600">
            {isReception
              ? 'Photographiez le bon physique. Vérifiez le tableau extrait avant confirmation — le stock n’est jamais modifié sans validation.'
              : 'Photographiez le bon de livraison distributeur. Vérifiez les quantités (stock négatif bloqué automatiquement).'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#004B93] hover:bg-[#00356B] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Camera className="w-4 h-4" />
            Photographier / Scanner Bon
          </button>
          <button
            type="button"
            onClick={() => {
              if (items.length === 0) addEmptyLine();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
          >
            <FilePlus2 className="w-4 h-4 text-[#16A34A]" />
            Saisie Manuelle
          </button>
        </div>
      </div>

      {confirmSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
          <span>{confirmSuccess}</span>
        </div>
      )}

      {/* Active OCR Review & Confirmation Form */}
      {(imagePreview || items.length > 0 || ocrLoading) && (
        <form
          onSubmit={handleConfirmDocument}
          className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Sparkles className="w-4 h-4 text-[#004B93]" />
              Vérification & Confirmation Avant Mise à Jour du Stock
            </div>
            {ocrLoading && (
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#004B93]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyse Gemini Vision OCR en cours...
              </div>
            )}
          </div>

          <div className="p-5 space-y-5">
            {ocrError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                {ocrError}
              </div>
            )}

            {confirmError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">
                {confirmError}
              </div>
            )}

            {duplicateWarning && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Attention : ce numéro de document ({docNumber}) a déjà été enregistré ! Traitement en doublon bloqué.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Document Image Preview */}
              {imagePreview && (
                <div className="lg:col-span-4 space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Document Original Photographié</div>
                  <img
                    src={imagePreview}
                    alt="Document scanné"
                    className="w-full max-h-80 object-contain bg-slate-100 border border-slate-200 rounded-lg"
                  />
                </div>
              )}

              {/* Extracted Header Fields */}
              <div className={`${imagePreview ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="ocr-doc-num" className="block text-xs font-semibold text-slate-700 mb-1">
                      N° {isReception ? 'Bon de Réception' : 'Bon de Livraison'} *
                    </label>
                    <input
                      id="ocr-doc-num"
                      type="text"
                      required
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder={isReception ? 'BR-2026-0155' : 'BL-2026-0412'}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="ocr-doc-date" className="block text-xs font-semibold text-slate-700 mb-1">
                      Date & Heure
                    </label>
                    <input
                      id="ocr-doc-date"
                      type="text"
                      value={docDate}
                      onChange={(e) => setDocDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    {isReception ? (
                      <>
                        <label htmlFor="ocr-supplier" className="block text-xs font-semibold text-slate-700 mb-1">
                          Fournisseur / Ligne
                        </label>
                        <input
                          id="ocr-supplier"
                          type="text"
                          value={partyName}
                          onChange={(e) => setPartyName(e.target.value)}
                          placeholder="Ex: Unité Production Alger"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                      </>
                    ) : (
                      <>
                        <label htmlFor="ocr-distributor" className="block text-xs font-semibold text-slate-700 mb-1">
                          Distributeur / Destinataire
                        </label>
                        <select
                          id="ocr-distributor"
                          value={distributorId}
                          onChange={(e) => {
                            setDistributorId(e.target.value);
                            const d = distributors.find((x) => x.id === e.target.value);
                            if (d) setPartyName(d.fullName);
                          }}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="">-- Saisie libre ({partyName || 'Sélectionner'}) --</option>
                          {distributors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.fullName} ({d.referenceCode})
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                </div>

                {!isReception && !distributorId && (
                  <div>
                    <label htmlFor="ocr-party-free" className="block text-xs font-semibold text-slate-700 mb-1">
                      Nom destinataire extrait (si non listé)
                    </label>
                    <input
                      id="ocr-party-free"
                      type="text"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                {aiNotes && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#004B93]">
                    Notes OCR : {aiNotes}
                  </div>
                )}
              </div>
            </div>

            {/* Structured Editable Line Items Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Lignes Extraites ({items.length})
                </span>
                <button
                  type="button"
                  onClick={addEmptyLine}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#004B93] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une ligne
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Produit Catalogue</th>
                      <th className="py-2.5 px-3 font-semibold">Réf / Conditionnement</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Stock Dispo</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Quantité</th>
                      <th className="py-2.5 px-3 font-semibold">Confiance OCR</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const prod = products.find((p) => p.id === item.productId);
                      const insufficient = !isReception && prod && item.quantity > prod.currentStock;
                      return (
                        <tr
                          key={item.id}
                          className={item.confidence === 'low' ? 'bg-amber-50/60' : undefined}
                        >
                          <td className="py-2.5 px-3 min-w-[260px]">
                            <select
                              value={item.productId}
                              onChange={(e) => updateLineProduct(item.id, e.target.value)}
                              aria-label="Sélectionner produit"
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                            >
                              <option value="">-- Sélectionner un produit --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.reference} — {p.name}
                                </option>
                              ))}
                            </select>
                            {item.rawText && item.rawText !== prod?.name && (
                              <div className="text-[11px] text-slate-500 mt-1">
                                Texte lu : « {item.rawText} »
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            <div>{prod?.reference || item.productReference || '—'}</div>
                            <div className="text-[11px] text-slate-400">
                              {item.packaging || prod?.packagingType || ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {prod ? prod.currentStock.toLocaleString('fr-FR') : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={(e) => updateLineQty(item.id, Number(e.target.value))}
                              aria-label="Quantité ligne"
                              className={`w-24 px-2 py-1.5 text-right font-mono text-xs border rounded-md ${
                                insufficient ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-300'
                              }`}
                            />
                            {insufficient && (
                              <div className="text-[10px] text-red-600 mt-0.5">Stock insuffisant</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.confidence === 'high' ? (
                              <span className="text-[#16A34A] font-semibold">Élevée</span>
                            ) : item.confidence === 'medium' ? (
                              <span className="text-amber-700 font-semibold">À vérifier</span>
                            ) : (
                              <span className="text-red-700 font-semibold">
                                Incertaine {item.uncertainReason ? `(${item.uncertainReason})` : ''}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeLine(item.id)}
                              aria-label="Supprimer la ligne"
                              className="p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setItems([]);
                  setDocNumber('');
                  setConfirmError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={confirming || duplicateWarning || ocrLoading}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#16A34A] hover:bg-emerald-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {confirming
                  ? 'Enregistrement...'
                  : isReception
                  ? 'Confirmer l’Entrée en Stock'
                  : 'Confirmer la Sortie de Stock'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* History of Processed Documents */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Historique des {isReception ? 'Bons de Réception' : 'Bons de Livraison'} ({filteredDocs.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">N° Document</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">
                  {isReception ? 'Fournisseur' : 'Distributeur / Destinataire'}
                </th>
                <th className="py-3 px-4 font-semibold text-right">Lignes</th>
                <th className="py-3 px-4 font-semibold text-right">Total Unités</th>
                <th className="py-3 px-4 font-semibold">Responsable</th>
                <th className="py-3 px-4 font-semibold text-right">Consulter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Aucun document traité pour le moment. Photographiez un bon pour démarrer.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const totalUnits = doc.items.reduce((acc, it) => acc + it.quantity, 0);
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-[#004B93]">{doc.docNumber}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{doc.docDate}</td>
                      <td className="py-3 px-4 text-slate-900 font-medium">{doc.partyName || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{doc.items.length}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                        {totalUnits.toLocaleString('fr-FR')}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{doc.createdByName}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setConsultDoc(doc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#004B93] border border-slate-200 rounded-lg hover:bg-[#EEF5FC]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Camera Modal */}
      <CameraModal
        isOpen={cameraOpen}
        mode="photo"
        title={isReception ? 'Scanner un Bon de Réception' : 'Scanner un Bon de Livraison'}
        sampleDocType={docType}
        onClose={() => setCameraOpen(false)}
        onCapturePhoto={handlePhotoCaptured}
      />

      {/* Document Consultation Modal */}
      {consultDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {consultDoc.docType === 'RECEPTION' ? 'Bon de Réception' : 'Bon de Livraison'} N°{' '}
                  {consultDoc.docNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {consultDoc.docDate} · {consultDoc.partyName || 'Tiers non spécifié'} · Validé par{' '}
                  {consultDoc.createdByName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConsultDoc(null)}
                aria-label="Fermer document"
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {consultDoc.imageUrl && (
                <img
                  src={consultDoc.imageUrl}
                  alt={`Document ${consultDoc.docNumber}`}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-72 object-contain bg-slate-100 border border-slate-200 rounded-lg"
                />
              )}
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Référence</th>
                    <th className="py-2 px-3 font-semibold">Produit</th>
                    <th className="py-2 px-3 font-semibold">Conditionnement</th>
                    <th className="py-2 px-3 font-semibold text-right">Quantité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consultDoc.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 font-mono">{it.productReference}</td>
                      <td className="py-2 px-3 font-semibold">{it.productName}</td>
                      <td className="py-2 px-3 text-slate-600">{it.packaging || '—'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                        {it.quantity.toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
