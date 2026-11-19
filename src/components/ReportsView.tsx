import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { TRANSLATIONS } from '../i18n/translations';
import type { Language, UserProfile, WorkspaceState } from '../types/stock';

interface ReportsViewProps {
  language: Language;
  user: UserProfile;
  workspace: WorkspaceState;
}

type ReportTab = 'daily' | 'weekly' | 'monthly' | 'inventory' | 'movements' | 'discrepancies';

export const ReportsView: React.FC<ReportsViewProps> = ({ language, user, workspace }) => {
  const t = TRANSLATIONS[language];
  const [activeTab, setActiveTab] = useState<ReportTab>('daily');
  const [selectedInvId, setSelectedInvId] = useState<string>(
    workspace.inventories[0]?.id ?? ''
  );

  const selectedInv = useMemo(
    () =>
      workspace.inventories.find((i) => i.id === selectedInvId) ||
      workspace.inventories[0] ||
      null,
    [workspace.inventories, selectedInvId]
  );

  const periodMovements = useMemo(() => {
    const now = Date.now();
    const cutoffHours =
      activeTab === 'daily' ? 24 : activeTab === 'weekly' ? 24 * 7 : 24 * 30;
    const cutoffMs = now - cutoffHours * 3600 * 1000;
    return workspace.movements.filter((m) => new Date(m.createdAt).getTime() >= cutoffMs);
  }, [workspace.movements, activeTab]);

  const reportRows = useMemo(() => {
    if (activeTab === 'inventory' || activeTab === 'discrepancies') {
      const inv = selectedInv;
      if (!inv) {
        return workspace.products.map((p) => ({
          name: p.name,
          reference: p.reference,
          theoretical: p.currentStock,
          physical: p.currentStock,
          diff: 0,
          inQty: p.totalIn,
          outQty: p.totalOut,
          date: new Date().toISOString().slice(0, 10),
          user: user.displayName,
        }));
      }
      const lines =
        activeTab === 'discrepancies'
          ? inv.lines.filter((l) => l.discrepancy !== 0)
          : inv.lines;
      return lines.map((l) => {
        const prod = workspace.products.find((p) => p.id === l.productId);
        return {
          name: l.productName,
          reference: l.productReference,
          theoretical: l.theoreticalQty,
          physical: l.physicalQty,
          diff: l.discrepancy,
          inQty: prod?.totalIn ?? 0,
          outQty: prod?.totalOut ?? 0,
          date: inv.createdAt.slice(0, 16).replace('T', ' '),
          user: inv.userName,
        };
      });
    }

    if (activeTab === 'movements') {
      return workspace.movements.map((m) => ({
        name: m.productName,
        reference: m.productReference,
        theoretical: m.previousStock,
        physical: m.newStock,
        diff: m.quantity,
        inQty: m.operationType === 'ENTREE' ? m.quantity : 0,
        outQty: m.operationType === 'SORTIE' ? Math.abs(m.quantity) : 0,
        date: m.createdAt.slice(0, 16).replace('T', ' '),
        user: m.userName,
      }));
    }

    // Daily / Weekly / Monthly consolidated per product
    return workspace.products.map((p) => {
      const pMovs = periodMovements.filter((m) => m.productId === p.id);
      const inQty = pMovs
        .filter((m) => m.operationType === 'ENTREE')
        .reduce((a, b) => a + b.quantity, 0);
      const outQty = pMovs
        .filter((m) => m.operationType === 'SORTIE')
        .reduce((a, b) => a + Math.abs(b.quantity), 0);
      const latestInvLine = selectedInv?.lines.find((l) => l.productId === p.id);
      return {
        name: p.name,
        reference: p.reference,
        theoretical: latestInvLine ? latestInvLine.theoreticalQty : p.currentStock,
        physical: latestInvLine ? latestInvLine.physicalQty : p.currentStock,
        diff: latestInvLine ? latestInvLine.discrepancy : 0,
        inQty,
        outQty,
        date: new Date().toISOString().slice(0, 10),
        user: latestInvLine ? selectedInv!.userName : user.displayName,
      };
    });
  }, [activeTab, selectedInv, workspace.products, workspace.movements, periodMovements, user.displayName]);

  const tabTitle: Record<ReportTab, string> = {
    daily: 'Rapport Journalier',
    weekly: 'Rapport Hebdomadaire',
    monthly: 'Rapport Mensuel',
    inventory: 'Rapport Inventaire Général',
    movements: 'Rapport Mouvements de Stock',
    discrepancies: 'Rapport des Écarts',
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.setTextColor(0, 75, 147);
    doc.text(`GESTION DE STOCK – CHEF DE QUAI | ${tabTitle[activeTab]}`, 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(80, 90, 100);
    doc.text(
      `Généré le ${new Date().toISOString().slice(0, 16).replace('T', ' ')} par ${user.displayName}`,
      14,
      23
    );

    autoTable(doc, {
      startY: 28,
      head: [
        [
          'Produit',
          'Référence',
          'Qté Théorique',
          'Qté Physique',
          'Différence',
          'Entrées',
          'Sorties',
          'Date',
          'Responsable',
        ],
      ],
      body: reportRows.map((r) => [
        r.name,
        r.reference,
        r.theoretical,
        r.physical,
        r.diff > 0 ? `+${r.diff}` : r.diff,
        r.inQty,
        r.outQty,
        r.date,
        r.user,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 75, 147] },
    });

    doc.save(`rapport-quai-${activeTab}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      reportRows.map((r) => ({
        Produit: r.name,
        Référence: r.reference,
        'Quantité Théorique': r.theoretical,
        'Quantité Physique Réelle': r.physical,
        Différence: r.diff,
        Entrées: r.inQty,
        Sorties: r.outQty,
        Date: r.date,
        Responsable: r.user,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tabTitle[activeTab].slice(0, 30));
    XLSX.writeFile(workbook, `rapport-quai-${activeTab}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Report Type Tabs & Export Buttons */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          {(Object.keys(tabTitle) as ReportTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-white text-[#004B93] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tabTitle[tab]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(activeTab === 'inventory' || activeTab === 'discrepancies') &&
            workspace.inventories.length > 0 && (
              <select
                value={selectedInv?.id ?? ''}
                onChange={(e) => setSelectedInvId(e.target.value)}
                aria-label="Choisir session d'inventaire"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {workspace.inventories.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.sessionCode} ({inv.createdAt.slice(0, 10)})
                  </option>
                ))}
              </select>
            )}

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#004B93] hover:bg-[#00356B] text-white text-xs font-semibold rounded-lg"
          >
            <FileText className="w-4 h-4" />
            {t.actions.exportPdf}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t.actions.exportExcel}
          </button>
        </div>
      </div>

      {/* Report Preview Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-900">
            {tabTitle[activeTab]} ({reportRows.length} lignes)
          </span>
          <span className="text-slate-500">Prêt pour export PDF / Excel</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Produit</th>
                <th className="py-3 px-4 font-semibold">Référence</th>
                <th className="py-3 px-4 font-semibold text-right">Qté Théorique</th>
                <th className="py-3 px-4 font-semibold text-right">Qté Physique</th>
                <th className="py-3 px-4 font-semibold text-right">Différence</th>
                <th className="py-3 px-4 font-semibold text-right">Entrées</th>
                <th className="py-3 px-4 font-semibold text-right">Sorties</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Aucune donnée disponible pour ce filtre de rapport.
                  </td>
                </tr>
              ) : (
                reportRows.map((r, idx) => (
                  <tr key={`${r.reference}-${idx}`} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{r.name}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{r.reference}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {r.theoretical.toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                      {r.physical.toLocaleString('fr-FR')}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono font-bold tabular-nums ${
                        r.diff < 0
                          ? 'text-red-600'
                          : r.diff > 0
                          ? 'text-[#16A34A]'
                          : 'text-slate-500'
                      }`}
                    >
                      {r.diff > 0 ? `+${r.diff}` : r.diff}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#16A34A]">
                      {r.inQty.toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#004B93]">
                      {r.outQty.toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{r.user}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
