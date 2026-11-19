import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import { IMG_CHEESE_BUTTER, IMG_MILK, IMG_YOGURT_DAIRY, PDF_CATEGORIES } from '../data/catalog';
import { TRANSLATIONS } from '../i18n/translations';
import { removeProduct, saveProduct } from '../services/dataService';
import type { Language, Product, ProductGroupCategory, UserProfile } from '../types/stock';

interface ProductsViewProps {
  language: Language;
  user: UserProfile;
  products: Product[];
  onRefresh: () => Promise<void>;
}

const GROUP_OPTIONS: ProductGroupCategory[] = [
  'Lait',
  'Beurre',
  'Yaourt',
  'Fromages',
  'Dérivés laitiers',
  'Autres produits',
];

export const ProductsView: React.FC<ProductsViewProps> = ({
  language,
  user,
  products,
  onRefresh,
}) => {
  const t = TRANSLATIONS[language];
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    reference: '',
    barcode: '',
    category: 'Lait subventionné',
    groupCategory: 'Lait' as ProductGroupCategory,
    unit: 'Sachet 1L',
    packagingType: 'Caisse plastique (20 sachets)',
    unitsPerCarton: 20,
    minThreshold: 200,
    currentStock: 0,
    imageUrl: IMG_MILK,
    description: '',
  });

  const canEdit = user.role === 'admin' || user.role === 'chef_de_quai';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = selectedCategory === 'ALL' || p.category === selectedCategory;
      if (!catOk) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, search, selectedCategory]);

  const openCreateModal = () => {
    setEditing(null);
    setErrorMsg(null);
    setForm({
      name: '',
      reference: `GPL-NEW-${String(products.length + 1).padStart(3, '0')}`,
      barcode: `6130001${String(100000 + products.length + 1).slice(0, 6)}`,
      category: 'Lait non subventionné',
      groupCategory: 'Lait',
      unit: 'Unité',
      packagingType: 'Carton (12 unités)',
      unitsPerCarton: 12,
      minThreshold: 200,
      currentStock: 0,
      imageUrl: IMG_MILK,
      description: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditing(product);
    setErrorMsg(null);
    setForm({
      name: product.name,
      reference: product.reference,
      barcode: product.barcode,
      category: product.category,
      groupCategory: product.groupCategory,
      unit: product.unit,
      packagingType: product.packagingType,
      unitsPerCarton: product.unitsPerCarton,
      minThreshold: product.minThreshold,
      currentStock: product.currentStock,
      imageUrl: product.imageUrl || IMG_MILK,
      description: product.description || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.reference.trim() || !form.barcode.trim()) {
      setErrorMsg('Nom, référence et code-barres sont obligatoires.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await saveProduct(
        user,
        {
          ...form,
          name: form.name.trim(),
          reference: form.reference.trim(),
          barcode: form.barcode.trim(),
          createdByUid: user.uid,
        },
        editing?.id
      );
      await onRefresh();
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Supprimer le produit "${product.name}" (${product.reference}) ?`)) return;
    try {
      await removeProduct(user, product.id);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.actions.searchPlaceholder}
              aria-label="Rechercher un produit"
              className="w-full ps-9 pe-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004B93]"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filtrer par catégorie"
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#004B93]"
          >
            <option value="ALL">Toutes les catégories ({products.length})</option>
            {PDF_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#004B93] hover:bg-[#00356B] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t.actions.addProduct}
          </button>
        )}
      </div>

      {/* Products Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            Catalogue Laitier ({filtered.length} références affichées)
          </span>
          <span>Source : Catalogue officiel PDF & Quai</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Produit</th>
                <th className="py-3 px-4 font-semibold">Référence / Code-barres</th>
                <th className="py-3 px-4 font-semibold">Catégorie</th>
                <th className="py-3 px-4 font-semibold">Conditionnement</th>
                <th className="py-3 px-4 font-semibold text-right">Qté / Colis</th>
                <th className="py-3 px-4 font-semibold text-right">Seuil Min</th>
                <th className="py-3 px-4 font-semibold text-right">Stock Actuel</th>
                {canEdit && <th className="py-3 px-4 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.imageUrl || IMG_MILK}
                        alt={p.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 max-w-md">
                            {p.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <div className="font-semibold text-slate-800">{p.reference}</div>
                    <div className="text-[11px] text-slate-500">{p.barcode}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <div>{p.category}</div>
                    <div className="text-[11px] text-slate-400">{p.groupCategory}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <div>{p.unit}</div>
                    <div className="text-[11px] text-slate-500">{p.packagingType}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{p.unitsPerCarton}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {p.minThreshold.toLocaleString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                    <span
                      className={
                        p.currentStock <= 0
                          ? 'text-red-600'
                          : p.currentStock <= p.minThreshold
                          ? 'text-amber-600'
                          : 'text-[#16A34A]'
                      }
                    >
                      {p.currentStock.toLocaleString('fr-FR')}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          aria-label={`Modifier ${p.name}`}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#004B93]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          aria-label={`Supprimer ${p.name}`}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editing ? `Modifier : ${editing.name}` : t.actions.addProduct}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fermer"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              <div>
                <label htmlFor="prod-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom du produit *
                </label>
                <input
                  id="prod-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="prod-ref" className="block text-xs font-semibold text-slate-700 mb-1">
                    Référence unique *
                  </label>
                  <input
                    id="prod-ref"
                    type="text"
                    required
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="prod-barcode" className="block text-xs font-semibold text-slate-700 mb-1">
                    Code-barres *
                  </label>
                  <input
                    id="prod-barcode"
                    type="text"
                    required
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="prod-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                    Catégorie catalogue
                  </label>
                  <select
                    id="prod-cat"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {PDF_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="prod-group" className="block text-xs font-semibold text-slate-700 mb-1">
                    Famille principale
                  </label>
                  <select
                    id="prod-group"
                    value={form.groupCategory}
                    onChange={(e) =>
                      setForm({ ...form, groupCategory: e.target.value as ProductGroupCategory })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {GROUP_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="prod-unit" className="block text-xs font-semibold text-slate-700 mb-1">
                    Unité de mesure
                  </label>
                  <input
                    id="prod-unit"
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="prod-pack" className="block text-xs font-semibold text-slate-700 mb-1">
                    Type d’emballage
                  </label>
                  <input
                    id="prod-pack"
                    type="text"
                    value={form.packagingType}
                    onChange={(e) => setForm({ ...form, packagingType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="prod-upc" className="block text-xs font-semibold text-slate-700 mb-1">
                    Qté / Carton
                  </label>
                  <input
                    id="prod-upc"
                    type="number"
                    min={1}
                    value={form.unitsPerCarton}
                    onChange={(e) => setForm({ ...form, unitsPerCarton: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="prod-min" className="block text-xs font-semibold text-slate-700 mb-1">
                    Seuil minimal
                  </label>
                  <input
                    id="prod-min"
                    type="number"
                    min={0}
                    value={form.minThreshold}
                    onChange={(e) => setForm({ ...form, minThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                {!editing && (
                  <div>
                    <label htmlFor="prod-init" className="block text-xs font-semibold text-slate-700 mb-1">
                      Stock initial
                    </label>
                    <input
                      id="prod-init"
                      type="number"
                      min={0}
                      value={form.currentStock}
                      onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="prod-img" className="block text-xs font-semibold text-slate-700 mb-1">
                  Visuel produit
                </label>
                <select
                  id="prod-img"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value={IMG_MILK}>Gamme Lait</option>
                  <option value={IMG_CHEESE_BUTTER}>Gamme Fromages & Beurre</option>
                  <option value={IMG_YOGURT_DAIRY}>Gamme Yaourt, Lben & Raïb</option>
                </select>
              </div>

              <div>
                <label htmlFor="prod-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (optionnelle)
                </label>
                <textarea
                  id="prod-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#004B93] hover:bg-[#00356B] rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Enregistrement...' : t.actions.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
