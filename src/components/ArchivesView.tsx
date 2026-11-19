import React, { useMemo, useState } from 'react';
import { Calendar, Eye, FileText, Package, Search, Users, Video, X } from 'lucide-react';
import type { DeliveryDocument, GlobalInventory, Language, WorkspaceState } from '../types/stock';

interface ArchivesViewProps {
  language: Language;
  workspace: WorkspaceState;
}

export const ArchivesView: React.FC<ArchivesViewProps> = ({ language, workspace }) => {
  const isAr = language === 'ar';
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DeliveryDocument | null>(null);
  const [previewInv, setPreviewInv] = useState<GlobalInventory | null>(null);

  const q = query.trim().toLowerCase();

  const matchedProducts = useMemo(() => {
    if (!q && !dateFilter) return [];
    return workspace.products.filter((p) => {
      if (dateFilter && !p.updatedAt.startsWith(dateFilter)) return false;
      return (
        p.name.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      );
    });
  }, [workspace.products, q, dateFilter]);

  const matchedDocs = useMemo(() => {
    return workspace.documents.filter((d) => {
      if (dateFilter && !d.docDate.startsWith(dateFilter) && !d.createdAt.startsWith(dateFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        d.docNumber.toLowerCase().includes(q) ||
        d.partyName.toLowerCase().includes(q) ||
        d.items.some(
          (i) =>
            i.productName.toLowerCase().includes(q) ||
            i.productReference.toLowerCase().includes(q)
        )
      );
    });
  }, [workspace.documents, q, dateFilter]);

  const matchedDistributors = useMemo(() => {
    if (!q) return [];
    return workspace.distributors.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.referenceCode.toLowerCase().includes(q) ||
        (d.zone ?? '').toLowerCase().includes(q)
    );
  }, [workspace.distributors, q]);

  const matchedInventories = useMemo(() => {
    return workspace.inventories.filter((inv) => {
      if (dateFilter && !inv.createdAt.startsWith(dateFilter)) return false;
      if (!q) return true;
      return (
        inv.sessionCode.toLowerCase().includes(q) ||
        inv.userName.toLowerCase().includes(q) ||
        inv.lines.some((l) => l.productName.toLowerCase().includes(q))
      );
    });
  }, [workspace.inventories, q, dateFilter]);

  return (
    <div className="space-y-6">
      {/* Unified Archive Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="text-base font-bold text-slate-900">
          {isAr
            ? 'البحث الشامل وأرشيف الوثائق'
            : 'Recherche Globale & Archives Documentaires'}
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'ابحث عن منتج، مرجع، باركود، رقم وصل استلام/تسليم، موزع، جرد...'
                  : 'Rechercher produit, référence, code-barres, N° BR, N° BL, distributeur, session inventaire...'
              }
              aria-label={isAr ? 'البحث الشامل في الأرشيف' : 'Recherche globale archives'}
              className="w-full ps-9 pe-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004B93]"
            />
          </div>
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label={isAr ? 'تصفية حسب التاريخ' : 'Filtrer par date'}
              className="ps-9 pe-3 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          {(query || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setDateFilter('');
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {isAr ? 'إعادة ضبط' : 'Réinitialiser'}
            </button>
          )}
        </div>
      </div>

      {/* Quick Matches for Products & Distributors when searching */}
      {(matchedProducts.length > 0 || matchedDistributors.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {matchedProducts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#004B93]" />
                Produits correspondants ({matchedProducts.length})
              </div>
              <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                {matchedProducts.slice(0, 15).map((p) => (
                  <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {p.reference} · {p.barcode}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-[#16A34A]">
                      {p.currentStock.toLocaleString('fr-FR')} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchedDistributors.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#16A34A]" />
                Distributeurs correspondants ({matchedDistributors.length})
              </div>
              <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                {matchedDistributors.map((d) => (
                  <div key={d.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{d.fullName}</div>
                      <div className="text-[11px] text-slate-500">{d.zone}</div>
                    </div>
                    <span className="font-mono text-[#004B93] font-semibold">{d.referenceCode}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Archived Documents (BR & BL) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#004B93]" />
          <h3 className="text-sm font-bold text-slate-900">
            Archives des Bons de Réception & Livraison ({matchedDocs.length})
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {matchedDocs.length === 0 ? (
            <div className="col-span-full py-6 text-center text-xs text-slate-500">
              Aucun document archivé correspondant.
            </div>
          ) : (
            matchedDocs.map((doc) => (
              <div
                key={doc.id}
                className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-slate-50"
              >
                {doc.imageUrl ? (
                  <img
                    src={doc.imageUrl}
                    alt={doc.docNumber}
                    referrerPolicy="no-referrer"
                    className="w-full h-36 object-cover bg-slate-200"
                  />
                ) : (
                  <div className="w-full h-36 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                    Document sans aperçu photo
                  </div>
                )}
                <div className="p-3.5 bg-white flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-[#004B93]">{doc.docNumber}</span>
                      <span
                        className={`font-semibold ${
                          doc.docType === 'RECEPTION' ? 'text-[#16A34A]' : 'text-[#004B93]'
                        }`}
                      >
                        {doc.docType}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-900 mt-1">
                      {doc.partyName || 'Tiers non spécifié'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">{doc.docDate}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Consulter Archive
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Archived Inventory Sessions & Media Evidence */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Video className="w-4 h-4 text-[#16A34A]" />
          <h3 className="text-sm font-bold text-slate-900">
            Archives des Inventaires & Preuves Chambres Froides ({matchedInventories.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {matchedInventories.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Aucune session d’inventaire archivée.
            </div>
          ) : (
            matchedInventories.map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-mono font-bold text-sm text-[#004B93]">{inv.sessionCode}</div>
                  <div className="text-xs text-slate-600">
                    {inv.createdAt.slice(0, 16).replace('T', ' ')} · {inv.userName} ·{' '}
                    {inv.mediaItems.length} photo(s)/vidéo(s)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewInv(inv)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-[#004B93] hover:bg-[#EEF5FC]"
                >
                  Ouvrir Dossier
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Document Archive Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Archive {previewDoc.docType} · {previewDoc.docNumber}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label="Fermer"
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {previewDoc.imageUrl && (
                <img
                  src={previewDoc.imageUrl}
                  alt={previewDoc.docNumber}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-72 object-contain bg-slate-100 rounded-lg"
                />
              )}
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Réf</th>
                    <th className="py-2 px-3">Produit</th>
                    <th className="py-2 px-3 text-right">Quantité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewDoc.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 font-mono">{it.productReference}</td>
                      <td className="py-2 px-3">{it.productName}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Media & Report Archive Modal */}
      {previewInv && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Dossier Inventaire · {previewInv.sessionCode}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewInv(null)}
                aria-label="Fermer"
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {previewInv.mediaItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {previewInv.mediaItems.map((m) => (
                    <div key={m.id} className="border border-slate-200 rounded-lg overflow-hidden">
                      {m.type === 'photo' ? (
                        <img src={m.url} alt={m.roomLabel} className="w-full h-40 object-cover" />
                      ) : (
                        <video src={m.url} controls className="w-full h-40 bg-black" />
                      )}
                      <div className="p-2 text-xs text-slate-700 font-semibold">{m.roomLabel}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-slate-700">
                Théorique : <strong className="font-mono">{previewInv.totalTheoretical}</strong> ·
                Physique : <strong className="font-mono">{previewInv.totalPhysical}</strong> ·
                Écart : <strong className="font-mono">{previewInv.totalDiscrepancy}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
