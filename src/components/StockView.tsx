import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Search, SlidersHorizontal, X } from 'lucide-react';
import { TRANSLATIONS } from '../i18n/translations';
import { adjustProductStock } from '../services/dataService';
import type { Language, Product, UserProfile } from '../types/stock';

interface StockViewProps {
  language: Language;
  user: UserProfile;
  products: Product[];
  onRefresh: () => Promise<void>;
}

export const StockView: React.FC<StockViewProps> = ({
  language,
  user,
  products,
  onRefresh,
}) => {
  const t = TRANSLATIONS[language];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'NORMAL'>('ALL');
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [deltaStr, setDeltaStr] = useState('0');
  const [reason, setReason] = useState('');
  const [allowNegative, setAllowNegative] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canAdjust = user.role === 'admin' || user.role === 'chef_de_quai';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const isOut = p.currentStock <= 0;
      const isLow = p.currentStock > 0 && p.currentStock <= p.minThreshold;
      if (statusFilter === 'OUT' && !isOut) return false;
      if (statusFilter === 'LOW' && !isLow) return false;
      if (statusFilter === 'NORMAL' && (isOut || isLow)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.barcode.includes(q)
      );
    });
  }, [products, search, statusFilter]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    const delta = Number(deltaStr);
    if (!Number.isFinite(delta) || delta === 0) {
      setErrorMsg('Saisissez une variation non nulle (ex: +50 ou -20).');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Le motif de l’ajustement est obligatoire.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await adjustProductStock(user, {
        productId: adjustTarget.id,
        deltaQuantity: delta,
        reason: reason.trim(),
        allowNegative,
      });
      await onRefresh();
      setAdjustTarget(null);
      setReason('');
      setDeltaStr('0');
      setAllowNegative(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de l’ajustement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Formula & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer par produit, référence ou code-barres..."
              aria-label="Filtrer les stocks"
              className="w-full ps-9 pe-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004B93]"
            />
          </div>
          <div className="inline-flex bg-slate-100 p-1 rounded-lg">
            {(['ALL', 'NORMAL', 'LOW', 'OUT'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-[#004B93] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL'
                  ? 'Tous'
                  : st === 'NORMAL'
                  ? t.status.normal
                  : st === 'LOW'
                  ? t.status.low
                  : t.status.out}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          Stock Actuel = Précédent + Entrées − Sorties
        </div>
      </div>

      {/* Real-time Stock Balances Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Référence</th>
                <th className="py-3 px-4 font-semibold">Produit</th>
                <th className="py-3 px-4 font-semibold text-right">Entrées cumulées</th>
                <th className="py-3 px-4 font-semibold text-right">Sorties cumulées</th>
                <th className="py-3 px-4 font-semibold text-right">Seuil Min</th>
                <th className="py-3 px-4 font-semibold text-right">Stock Actuel</th>
                <th className="py-3 px-4 font-semibold">État</th>
                {canAdjust && <th className="py-3 px-4 font-semibold text-right">Ajustement</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const isOut = p.currentStock <= 0;
                const isLow = p.currentStock > 0 && p.currentStock <= p.minThreshold;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{p.reference}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {p.category} · {p.unit}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#16A34A]">
                      +{p.totalIn.toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#004B93]">
                      -{p.totalOut.toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                      {p.minThreshold.toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                      {p.currentStock.toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {t.status.out}
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {t.status.low}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#16A34A] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t.status.normal}
                        </span>
                      )}
                    </td>
                    {canAdjust && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustTarget(p);
                            setDeltaStr('0');
                            setReason('');
                            setAllowNegative(false);
                            setErrorMsg(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#004B93] border border-slate-200 rounded-lg hover:bg-[#EEF5FC]"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Ajuster
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Authorized Manual Stock Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Ajustement de Stock Autorisé</h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                aria-label="Fermer"
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="font-bold text-slate-900">{adjustTarget.name}</div>
                <div className="text-slate-600">
                  Réf {adjustTarget.reference} · Solde actuel :{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {adjustTarget.currentStock} {adjustTarget.unit}
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              <div>
                <label htmlFor="adj-delta" className="block text-xs font-semibold text-slate-700 mb-1">
                  Variation (+ entrée / − sortie ou casse)
                </label>
                <input
                  id="adj-delta"
                  type="number"
                  value={deltaStr}
                  onChange={(e) => setDeltaStr(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="adj-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                  Motif justificatif *
                </label>
                <input
                  id="adj-reason"
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Casse quai chambre froide / Retour client..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {user.role === 'admin' && (
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={allowNegative}
                    onChange={(e) => setAllowNegative(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Autorisation exceptionnelle (ramener à 0 si dépassement)
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#004B93] hover:bg-[#00356B] rounded-lg disabled:opacity-60"
                >
                  {submitting ? 'Validation...' : 'Valider l’ajustement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
