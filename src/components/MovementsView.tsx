import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, Search, X } from 'lucide-react';
import type { Distributor, Language, Product, StockMovement } from '../types/stock';

interface MovementsViewProps {
  language: Language;
  movements: StockMovement[];
  products: Product[];
  distributors: Distributor[];
}

export const MovementsView: React.FC<MovementsViewProps> = ({
  movements,
  products,
  distributors,
}) => {
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [distributorFilter, setDistributorFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((m) => {
      if (productFilter !== 'ALL' && m.productId !== productFilter) return false;
      if (typeFilter !== 'ALL' && m.operationType !== typeFilter) return false;
      if (distributorFilter !== 'ALL') {
        const dist = distributors.find((d) => d.id === distributorFilter);
        const matchId = m.distributorId === distributorFilter;
        const matchName = dist && (m.partyName ?? '').toLowerCase() === dist.fullName.toLowerCase();
        if (!matchId && !matchName) return false;
      }
      if (dateFrom && m.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && m.createdAt.slice(0, 10) > dateTo) return false;
      if (!q) return true;
      return (
        m.productName.toLowerCase().includes(q) ||
        m.productReference.toLowerCase().includes(q) ||
        (m.documentNumber ?? '').toLowerCase().includes(q) ||
        (m.partyName ?? '').toLowerCase().includes(q) ||
        m.userName.toLowerCase().includes(q)
      );
    });
  }, [movements, search, productFilter, typeFilter, distributorFilter, dateFrom, dateTo, distributors]);

  return (
    <div className="space-y-5">
      {/* Multi-Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Produit, N° bon, tiers, agent..."
            aria-label="Rechercher mouvement"
            className="w-full ps-9 pe-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>

        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          aria-label="Filtrer par produit"
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">Tous les produits</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.reference} — {p.name}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filtrer par type d'opération"
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">Toutes opérations</option>
          <option value="ENTREE">Entrée (Réception)</option>
          <option value="SORTIE">Sortie (Livraison)</option>
          <option value="AJUSTEMENT">Ajustement</option>
          <option value="INVENTAIRE">Inventaire</option>
        </select>

        <select
          value={distributorFilter}
          onChange={(e) => setDistributorFilter(e.target.value)}
          aria-label="Filtrer par distributeur"
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">Tous distributeurs</option>
          {distributors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.fullName}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Date début"
            className="w-1/2 px-2 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Date fin"
            className="w-1/2 px-2 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* Chronological Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-900">
            Journal Chronologique des Mouvements ({filtered.length})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Date & Heure</th>
                <th className="py-3 px-4 font-semibold">Produit</th>
                <th className="py-3 px-4 font-semibold">Opération</th>
                <th className="py-3 px-4 font-semibold text-right">Quantité</th>
                <th className="py-3 px-4 font-semibold text-right">Avant → Après</th>
                <th className="py-3 px-4 font-semibold">Réf Bon</th>
                <th className="py-3 px-4 font-semibold">Fournisseur / Distributeur</th>
                <th className="py-3 px-4 font-semibold">Responsable</th>
                <th className="py-3 px-4 font-semibold text-right">Justificatif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Aucun mouvement correspondant aux filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {m.createdAt.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{m.productName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{m.productReference}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      <span
                        className={
                          m.operationType === 'ENTREE'
                            ? 'text-[#16A34A]'
                            : m.operationType === 'SORTIE'
                            ? 'text-[#004B93]'
                            : 'text-amber-700'
                        }
                      >
                        {m.operationType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {m.previousStock} → <strong className="text-slate-900">{m.newStock}</strong>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#004B93]">
                      {m.documentNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{m.partyName || m.reason || '—'}</td>
                    <td className="py-3 px-4 text-slate-600">{m.userName}</td>
                    <td className="py-3 px-4 text-right">
                      {m.documentImageUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(m.documentImageUrl!)}
                          aria-label="Voir photo justificatif"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-[#004B93] border border-slate-200 rounded-md hover:bg-[#EEF5FC]"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          Photo
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Photo Lightbox */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Document Justificatif</span>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                aria-label="Fermer aperçu"
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-100">
              <img
                src={previewUrl}
                alt="Document justificatif"
                referrerPolicy="no-referrer"
                className="w-full max-h-[75vh] object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
