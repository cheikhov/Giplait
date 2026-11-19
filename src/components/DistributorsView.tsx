import React, { useMemo, useState } from 'react';
import { Edit2, Phone, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { removeDistributor, saveDistributor } from '../services/dataService';
import type {
  DeliveryDocument,
  Distributor,
  Language,
  StockMovement,
  UserProfile,
} from '../types/stock';

interface DistributorsViewProps {
  language: Language;
  user: UserProfile;
  distributors: Distributor[];
  documents: DeliveryDocument[];
  movements: StockMovement[];
  onRefresh: () => Promise<void>;
}

export const DistributorsView: React.FC<DistributorsViewProps> = ({
  user,
  distributors,
  documents,
  movements,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Distributor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [form, setForm] = useState({ fullName: '', referenceCode: '', phone: '', zone: '' });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canEdit = user.role === 'admin' || user.role === 'chef_de_quai';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return distributors;
    return distributors.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.referenceCode.toLowerCase().includes(q) ||
        (d.zone ?? '').toLowerCase().includes(q)
    );
  }, [distributors, search]);

  const getDistributorStats = (dist: Distributor) => {
    const distDocs = documents.filter(
      (doc) =>
        doc.docType === 'LIVRAISON' &&
        (doc.distributorId === dist.id ||
          doc.partyName.toLowerCase() === dist.fullName.toLowerCase())
    );
    const totalDelivered = distDocs.reduce(
      (acc, doc) => acc + doc.items.reduce((s, it) => s + it.quantity, 0),
      0
    );
    const productBreakdown = new Map<string, { name: string; ref: string; qty: number }>();
    for (const doc of distDocs) {
      for (const it of doc.items) {
        const cur = productBreakdown.get(it.productId) || {
          name: it.productName,
          ref: it.productReference,
          qty: 0,
        };
        cur.qty += it.quantity;
        productBreakdown.set(it.productId, cur);
      }
    }
    return {
      distDocs,
      totalDelivered,
      productTotals: Array.from(productBreakdown.values()).sort((a, b) => b.qty - a.qty),
      distMovements: movements.filter(
        (m) =>
          m.distributorId === dist.id ||
          (m.partyName ?? '').toLowerCase() === dist.fullName.toLowerCase()
      ),
    };
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      fullName: '',
      referenceCode: `DIST-${String(distributors.length + 1).padStart(3, '0')}`,
      phone: '',
      zone: '',
    });
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEdit = (d: Distributor) => {
    setEditing(d);
    setForm({
      fullName: d.fullName,
      referenceCode: d.referenceCode,
      phone: d.phone ?? '',
      zone: d.zone ?? '',
    });
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.referenceCode.trim()) {
      setErrorMsg('Nom complet et référence distributeur requis.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await saveDistributor(user, {
        id: editing?.id,
        fullName: form.fullName.trim(),
        referenceCode: form.referenceCode.trim(),
        phone: form.phone.trim(),
        zone: form.zone.trim(),
      });
      await onRefresh();
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur enregistrement distributeur.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Distributor) => {
    if (!window.confirm(`Supprimer le distributeur "${d.fullName}" ?`)) return;
    await removeDistributor(user, d.id);
    if (selected?.id === d.id) setSelected(null);
    await onRefresh();
  };

  const selectedStats = selected ? getDistributorStats(selected) : null;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un distributeur, code ou zone..."
            aria-label="Rechercher distributeur"
            className="w-full ps-9 pe-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#004B93] hover:bg-[#00356B] text-white text-xs font-semibold rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Nouveau Distributeur
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Distributors Directory */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              Base des Distributeurs ({filtered.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map((d) => {
              const st = getDistributorStats(d);
              const isSel = selected?.id === d.id;
              return (
                <div
                  key={d.id}
                  className={`p-4 flex items-center justify-between gap-4 hover:bg-slate-50 ${
                    isSel ? 'bg-[#EEF5FC]/60' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(d)}
                    className="flex-1 text-left space-y-1"
                  >
                    <div className="font-bold text-sm text-slate-900">{d.fullName}</div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[#004B93] font-semibold">
                        {d.referenceCode}
                      </span>
                      {d.zone && <span>· {d.zone}</span>}
                      {d.phone && (
                        <span className="inline-flex items-center gap-1">
                          · <Phone className="w-3 h-3" /> {d.phone}
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                        {st.totalDelivered.toLocaleString('fr-FR')} u.
                      </div>
                      <div className="text-[11px] text-slate-500">{st.distDocs.length} BL</div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(d)}
                          aria-label={`Modifier ${d.fullName}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#004B93]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d)}
                          aria-label={`Supprimer ${d.fullName}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Distributor Delivery History & Product Breakdown */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          {!selected || !selectedStats ? (
            <div className="py-12 text-center space-y-2 text-slate-500">
              <Truck className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-xs">
                Sélectionnez un distributeur pour consulter son historique de livraisons, ses Bons de Livraison et les quantités livrées par produit.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">{selected.fullName}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selected.referenceCode} · {selected.zone || 'Zone non spécifiée'}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">
                  Produits & Quantités Livrés ({selectedStats.productTotals.length})
                </h4>
                {selectedStats.productTotals.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucune livraison enregistrée pour ce distributeur.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedStats.productTotals.map((pt) => (
                      <div
                        key={pt.ref}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100"
                      >
                        <span className="text-slate-800 font-medium truncate pr-2">{pt.name}</span>
                        <span className="font-mono font-bold text-[#004B93] tabular-nums shrink-0">
                          {pt.qty.toLocaleString('fr-FR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">
                  Bons de Livraison Associés ({selectedStats.distDocs.length})
                </h4>
                {selectedStats.distDocs.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucun BL associé.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedStats.distDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-[#004B93]">{doc.docNumber}</div>
                          <div className="text-[11px] text-slate-500">{doc.docDate}</div>
                        </div>
                        <div className="font-mono font-semibold text-slate-900">
                          {doc.items.reduce((a, b) => a + b.quantity, 0).toLocaleString('fr-FR')} u.
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editing ? 'Modifier Distributeur' : 'Nouveau Distributeur'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fermer"
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {errorMsg}
                </div>
              )}
              <div>
                <label htmlFor="dist-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom complet / Raison sociale *
                </label>
                <input
                  id="dist-name"
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="dist-ref" className="block text-xs font-semibold text-slate-700 mb-1">
                  Numéro d’identification / Réf *
                </label>
                <input
                  id="dist-ref"
                  type="text"
                  required
                  value={form.referenceCode}
                  onChange={(e) => setForm({ ...form, referenceCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="dist-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Téléphone (optionnel)
                </label>
                <input
                  id="dist-phone"
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="dist-zone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Zone de distribution
                </label>
                <input
                  id="dist-zone"
                  type="text"
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#004B93] hover:bg-[#00356B] rounded-lg"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
