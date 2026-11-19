import React from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  FileCheck2,
  PackageCheck,
  TrendingUp,
} from 'lucide-react';
import { IMG_PLANT_HERO } from '../data/catalog';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  Language,
  MenuId,
  StockAlert,
  WorkspaceState,
} from '../types/stock';
import { computeDashboardStats } from '../utils/stockEngine';

interface DashboardViewProps {
  language: Language;
  workspace: WorkspaceState;
  alerts: StockAlert[];
  onNavigate: (menu: MenuId) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  language,
  workspace,
  alerts,
  onNavigate,
}) => {
  const t = TRANSLATIONS[language];
  const stats = computeDashboardStats(
    workspace.products,
    workspace.documents,
    workspace.movements,
    workspace.inventories
  );

  // Category distribution computed directly from persisted products
  const categoryTotals = workspace.products.reduce<Record<string, number>>((acc, p) => {
    acc[p.groupCategory] = (acc[p.groupCategory] ?? 0) + p.currentStock;
    return acc;
  }, {});
  const categoryEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const maxCategoryVal = Math.max(1, ...categoryEntries.map(([, v]) => v));

  return (
    <div className="space-y-6">
      {/* Giplait Operational Banner */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 p-6 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-[#16A34A]">
              {language === 'ar'
                ? 'محطة رئيس الرصيف · المراقبة الفورية للمخزون'
                : 'POSTE CHEF DE QUAI · SUPERVISION EN TEMPS RÉEL'}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              {language === 'ar'
                ? 'نظرة شاملة على سلسلة التبريد والتموين'
                : 'Pilotage des Flux Laitiers & Chambres Froides'}
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              {language === 'ar'
                ? 'تتبع لحظي للمدخلات والمخرجات عبر المسح الضوئي الذكي OCR والجرد العام الموحد.'
                : 'Suivi en temps réel des réceptions, livraisons distributeurs, lecture OCR des bons et inventaire général consolidé.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('reception')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#004B93] hover:bg-[#00356B] text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <ArrowDownLeft className="w-4 h-4" />
              {t.menu.reception}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('livraison')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              {t.menu.livraison}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
            >
              <ClipboardCheck className="w-4 h-4 text-[#004B93]" />
              {t.menu.inventory}
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 relative min-h-[160px] bg-slate-100">
          <img
            src={IMG_PLANT_HERO}
            alt="Quai de chargement laitier"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#00356B]/80 via-transparent to-transparent flex items-end p-4 text-white">
            <div className="text-xs font-medium">
              {stats.inventoryDoneToday ? t.dashboard.inventoryDone : t.dashboard.inventoryPending} ·{' '}
              <span className="font-mono">{workspace.coldRooms.length} chambres froides</span>
            </div>
          </div>
        </div>
      </section>

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{t.dashboard.currentStock}</span>
            <Boxes className="w-4 h-4 text-[#004B93]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.totalCurrentStock.toLocaleString('fr-FR')}
          </div>
          <div className="text-[11px] text-slate-500">{t.dashboard.units}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{t.dashboard.totalIn}</span>
            <ArrowDownLeft className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="text-2xl font-bold text-[#16A34A] font-mono tabular-nums">
            +{stats.totalIncoming.toLocaleString('fr-FR')}
          </div>
          <div className="text-[11px] text-slate-500">{t.dashboard.units}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{t.dashboard.totalOut}</span>
            <ArrowUpRight className="w-4 h-4 text-[#004B93]" />
          </div>
          <div className="text-2xl font-bold text-[#004B93] font-mono tabular-nums">
            -{stats.totalOutgoing.toLocaleString('fr-FR')}
          </div>
          <div className="text-[11px] text-slate-500">{t.dashboard.units}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{t.dashboard.productsInStock}</span>
            <PackageCheck className="w-4 h-4 text-[#004B93]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.productsInStockCount} / {stats.totalProductsCount}
          </div>
          <div className="text-[11px] text-slate-500">
            {stats.lowStockCount} bas · {stats.outOfStockCount} rupture
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{t.dashboard.docsProcessed}</span>
            <FileCheck2 className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.processedDocumentsCount}
          </div>
          <div className="text-[11px] text-slate-500">BR & BL confirmés</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{t.dashboard.discrepancies}</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              stats.totalDiscrepancy < 0
                ? 'text-red-600'
                : stats.totalDiscrepancy > 0
                ? 'text-[#16A34A]'
                : 'text-slate-900'
            }`}
          >
            {stats.totalDiscrepancy > 0 ? `+${stats.totalDiscrepancy}` : stats.totalDiscrepancy}
          </div>
          <div className="text-[11px] text-slate-500">
            {stats.latestInventory ? stats.latestInventory.sessionCode : 'Aucun inventaire validé'}
          </div>
        </div>
      </section>

      {/* Category Chart + Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{t.dashboard.categoryBreakdown}</h3>
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="text-xs font-semibold text-[#004B93] hover:underline"
            >
              Voir tout le stock
            </button>
          </div>
          <div className="space-y-3">
            {categoryEntries.map(([cat, total]) => {
              const pct = Math.round((total / maxCategoryVal) * 100);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{cat}</span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {total.toLocaleString('fr-FR')} {t.dashboard.units}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#004B93] rounded-full transition-all"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              {t.dashboard.alertsTitle}
            </h3>
            <span className="text-xs font-mono font-semibold text-slate-600">{alerts.length}</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Aucune alerte de stock ou d’écart détectée.
              </p>
            ) : (
              alerts.slice(0, 8).map((alert) => (
                <div key={alert.id} className="py-2.5 space-y-0.5">
                  <div
                    className={`text-xs font-semibold ${
                      alert.severity === 'critical'
                        ? 'text-red-700'
                        : alert.severity === 'warning'
                        ? 'text-amber-700'
                        : 'text-[#004B93]'
                    }`}
                  >
                    {alert.title}
                  </div>
                  <div className="text-[11px] text-slate-600">{alert.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Latest Movements & Activity History */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{t.dashboard.latestMovements}</h3>
            <button
              type="button"
              onClick={() => onNavigate('movements')}
              className="text-xs font-semibold text-[#004B93] hover:underline"
            >
              Historique complet
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Date / Heure</th>
                  <th className="py-2.5 px-4 font-semibold">Produit</th>
                  <th className="py-2.5 px-4 font-semibold">Type</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Quantité</th>
                  <th className="py-2.5 px-4 font-semibold">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspace.movements.slice(0, 8).map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {mov.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{mov.productName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{mov.productReference}</div>
                    </td>
                    <td className="py-2.5 px-4 font-semibold">
                      <span
                        className={
                          mov.operationType === 'ENTREE'
                            ? 'text-[#16A34A]'
                            : mov.operationType === 'SORTIE'
                            ? 'text-[#004B93]'
                            : 'text-amber-700'
                        }
                      >
                        {mov.operationType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums">
                      {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">
                      {mov.documentNumber || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">{t.dashboard.activityHistory}</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto p-4 space-y-3">
            {workspace.auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="pt-2 first:pt-0 space-y-0.5">
                <div className="text-xs font-semibold text-slate-900">{log.action}</div>
                <div className="text-[11px] text-slate-600">{log.details}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {log.userName} · {log.createdAt.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
