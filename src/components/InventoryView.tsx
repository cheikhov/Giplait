import React, { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Loader2,
  Search,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { CameraModal } from './CameraModal';
import { TRANSLATIONS } from '../i18n/translations';
import {
  analyzeColdRoomMedia,
  uploadMediaFile,
  validateGlobalInventory,
} from '../services/dataService';
import type {
  ColdRoomCountMap,
  GlobalInventory,
  Language,
  MediaEvidence,
  Product,
  UserProfile,
} from '../types/stock';
import { computeInventorySummary } from '../utils/stockEngine';

interface InventoryViewProps {
  language: Language;
  user: UserProfile;
  products: Product[];
  coldRooms: string[];
  inventories: GlobalInventory[];
  onRefresh: () => Promise<void>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  language,
  user,
  products,
  coldRooms,
  inventories,
  onRefresh,
}) => {
  const t = TRANSLATIONS[language];
  const [sessionActive, setSessionActive] = useState(false);
  const [search, setSearch] = useState('');
  const [roomCounts, setRoomCounts] = useState<Record<string, ColdRoomCountMap>>({});
  const [mediaItems, setMediaItems] = useState<MediaEvidence[]>([]);
  const [activeMediaRoom, setActiveMediaRoom] = useState<string>(coldRooms[0] || 'Chambre Froide 1');
  const [notes, setNotes] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validatedReport, setValidatedReport] = useState<GlobalInventory | null>(null);

  const summary = useMemo(
    () => computeInventorySummary(products, roomCounts),
    [products, roomCounts]
  );

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summary.lines;
    return summary.lines.filter(
      (l) =>
        l.productName.toLowerCase().includes(q) ||
        l.productReference.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
    );
  }, [summary.lines, search]);

  const startNewSession = () => {
    // Pre-initialize each product with existing theoretical stock in Room 1 only if desired,
    // or start clean empty rooms so operator enters actual physical counts across rooms.
    // Leaving room entries empty falls back to theoretical until entered; entering any room sets exact consolidated sum!
    setRoomCounts({});
    setMediaItems([]);
    setNotes('');
    setErrorMsg(null);
    setValidatedReport(null);
    setSessionActive(true);
  };

  const updateRoomQty = (productId: string, roomName: string, qty: number) => {
    const cleanQty = Number.isFinite(qty) && qty >= 0 ? Math.round(qty) : 0;
    setRoomCounts((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] ?? {}),
        [roomName]: cleanQty,
      },
    }));
  };

  const handlePhotoCaptured = async (dataUrl: string) => {
    setCameraOpen(false);
    try {
      const url = await uploadMediaFile(dataUrl, 'chambre-froide');
      const evidenceId = `media-${Date.now()}`;
      const newEvidence: MediaEvidence = {
        id: evidenceId,
        type: 'photo',
        url,
        roomLabel: activeMediaRoom,
        capturedAt: new Date().toISOString(),
      };
      setMediaItems((prev) => [...prev, newEvidence]);

      // Automatically assist with AI product recognition (without inventing counts)
      setAnalyzingId(evidenceId);
      try {
        const aiRes = await analyzeColdRoomMedia(dataUrl, activeMediaRoom);
        setMediaItems((prev) =>
          prev.map((m) =>
            m.id === evidenceId
              ? { ...m, aiSummary: aiRes.summary, recognizedProducts: aiRes.recognizedProducts }
              : m
          )
        );
      } catch {
        // AI vision analysis is optional assistance; media evidence remains preserved
      } finally {
        setAnalyzingId(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur enregistrement photo.');
    }
  };

  const handleVideoCaptured = async (dataUrl: string) => {
    setCameraOpen(false);
    try {
      const url = await uploadMediaFile(dataUrl, 'video-chambre');
      setMediaItems((prev) => [
        ...prev,
        {
          id: `media-${Date.now()}`,
          type: 'video',
          url,
          roomLabel: activeMediaRoom,
          aiSummary: 'Vidéo d’inspection enregistrée comme pièce justificative.',
          capturedAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur enregistrement vidéo.');
    }
  };

  const handleValidateInventory = async () => {
    setValidating(true);
    setErrorMsg(null);
    try {
      const created = await validateGlobalInventory(user, products, inventories.length, {
        roomCountsByProduct: roomCounts,
        mediaItems,
        notes,
      });
      await onRefresh();
      setSessionActive(false);
      setValidatedReport(created);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur validation inventaire.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Control */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">
            {language === 'ar'
              ? 'الجرد العام الموحد — جميع غرف التبريد'
              : 'Inventaire Général Consolidé — Toutes Chambres Froides'}
          </h2>
          <p className="text-xs text-slate-600">
            {language === 'ar'
              ? 'أدخل الكميات الفعلية في كل غرفة تبريد: يقوم النظام بتجميعها تلقائياً في مجموع واحد ومقارنتها بالمخزون النظري.'
              : 'Saisissez les quantités physiques relevées dans chaque chambre froide : le système fusionne automatiquement chaque produit en un seul total global comparé au stock théorique.'}
          </p>
        </div>

        {!sessionActive ? (
          <button
            type="button"
            onClick={startNewSession}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#004B93] hover:bg-[#00356B] text-white text-xs font-bold rounded-lg transition-colors shrink-0"
          >
            <ClipboardCheck className="w-4 h-4" />
            {t.actions.startInventory}
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSessionActive(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {language === 'ar' ? 'إغلاق الجلسة' : 'Fermer Session'}
            </button>
            <button
              type="button"
              onClick={handleValidateInventory}
              disabled={validating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {validating ? (language === 'ar' ? 'جاري الاعتماد...' : 'Validation...') : t.actions.validateInventory}
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Active Global Inventory Workspace */}
      {sessionActive && (
        <div className="space-y-5">
          {/* Summary Live Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-500">Total Stock Théorique</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {summary.totalTheoretical.toLocaleString('fr-FR')}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-500">Total Physique Consolidé</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#004B93] mt-1">
                {summary.totalPhysical.toLocaleString('fr-FR')}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-500">Écart Global</div>
              <div
                className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                  summary.totalDiscrepancy < 0
                    ? 'text-red-600'
                    : summary.totalDiscrepancy > 0
                    ? 'text-[#16A34A]'
                    : 'text-slate-900'
                }`}
              >
                {summary.totalDiscrepancy > 0
                  ? `+${summary.totalDiscrepancy}`
                  : summary.totalDiscrepancy}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-500">Écarts détectés</div>
              <div className="text-sm font-mono font-semibold text-slate-800 mt-2">
                +{summary.positiveCount} positifs · {summary.negativeCount} négatifs
              </div>
            </div>
          </div>

          {/* Step 2: Cold Room Photos & Video Evidence + AI Recognition */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Preuves Visuelles des Chambres Froides (Photos & Vidéos)
                </h3>
                <p className="text-xs text-slate-500">
                  L’IA identifie les produits visibles sans inventer les quantités cachées ; la saisie des quantités reste sous votre contrôle.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={activeMediaRoom}
                  onChange={(e) => setActiveMediaRoom(e.target.value)}
                  aria-label="Chambre froide pour capture"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {coldRooms.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#004B93] hover:bg-[#00356B] text-white text-xs font-semibold rounded-lg"
                >
                  <Camera className="w-4 h-4" />
                  Photo / Vidéo
                </button>
              </div>
            </div>

            {mediaItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediaItems.map((m) => (
                  <div key={m.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    {m.type === 'photo' ? (
                      <img src={m.url} alt={m.roomLabel} className="w-full h-36 object-cover" />
                    ) : (
                      <video src={m.url} controls className="w-full h-36 bg-black" />
                    )}
                    <div className="p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                        <span>{m.roomLabel}</span>
                        {m.type === 'video' && <Video className="w-3.5 h-3.5 text-[#004B93]" />}
                      </div>
                      {analyzingId === m.id ? (
                        <div className="inline-flex items-center gap-1.5 text-[11px] text-[#004B93]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Reconnaissance IA en cours...
                        </div>
                      ) : (
                        m.aiSummary && (
                          <div className="text-[11px] text-slate-600 flex items-start gap-1">
                            <Sparkles className="w-3 h-3 text-[#16A34A] shrink-0 mt-0.5" />
                            <span>{m.aiSummary}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3 & 4: Unified Multi-Room Consolidated Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un produit dans l'inventaire..."
                  aria-label="Filtrer les produits de l'inventaire"
                  className="w-full ps-9 pe-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations du Chef de Quai (optionnel)..."
                aria-label="Observations inventaire"
                className="flex-1 max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-3 font-semibold">Produit</th>
                    <th className="py-3 px-3 font-semibold text-right">Théorique</th>
                    {coldRooms.map((room, idx) => (
                      <th key={room} className="py-3 px-2 font-semibold text-right min-w-[95px]">
                        CF {idx + 1}
                      </th>
                    ))}
                    <th className="py-3 px-3 font-semibold text-right bg-blue-50/70 text-[#004B93]">
                      Total Physique
                    </th>
                    <th className="py-3 px-3 font-semibold text-right">Écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLines.map((line) => {
                    const hasAnyRoomInput = Object.keys(roomCounts[line.productId] ?? {}).length > 0;
                    return (
                      <tr key={line.productId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{line.productName}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {line.productReference} · {line.unit}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {line.theoreticalQty.toLocaleString('fr-FR')}
                        </td>
                        {coldRooms.map((room) => (
                          <td key={room} className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min={0}
                              placeholder={hasAnyRoomInput ? '0' : String(line.theoreticalQty)}
                              value={roomCounts[line.productId]?.[room] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  const next = { ...(roomCounts[line.productId] ?? {}) };
                                  delete next[room];
                                  setRoomCounts((prev) => ({ ...prev, [line.productId]: next }));
                                } else {
                                  updateRoomQty(line.productId, room, Number(val));
                                }
                              }}
                              aria-label={`${line.productName} - ${room}`}
                              className="w-20 px-2 py-1 text-right font-mono text-xs border border-slate-300 rounded-md"
                            />
                          </td>
                        ))}
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums bg-blue-50/40 text-[#004B93]">
                          {line.physicalQty.toLocaleString('fr-FR')}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                            line.discrepancy < 0
                              ? 'text-red-600'
                              : line.discrepancy > 0
                              ? 'text-[#16A34A]'
                              : 'text-slate-500'
                          }`}
                        >
                          {line.discrepancy > 0 ? `+${line.discrepancy}` : line.discrepancy}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={handleValidateInventory}
                disabled={validating}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#16A34A] hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                {validating ? 'Enregistrement en cours...' : t.actions.validateInventory}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Inventory Sessions */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">
            {language === 'ar'
              ? `جلسات الجرد العام المعتمدة (${inventories.length})`
              : `Sessions d’Inventaire Général Validées (${inventories.length})`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Code Session</th>
                <th className="py-3 px-4 font-semibold">Date & Heure</th>
                <th className="py-3 px-4 font-semibold">Responsable</th>
                <th className="py-3 px-4 font-semibold text-right">Théorique Total</th>
                <th className="py-3 px-4 font-semibold text-right">Physique Total</th>
                <th className="py-3 px-4 font-semibold text-right">Écart Net</th>
                <th className="py-3 px-4 font-semibold text-right">Médias</th>
                <th className="py-3 px-4 font-semibold text-right">Rapport</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Aucun inventaire général validé. Cliquez sur « Démarrer Inventaire Général » pour lancer le comptage consolidé.
                  </td>
                </tr>
              ) : (
                inventories.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-[#004B93]">{inv.sessionCode}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {inv.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{inv.userName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {inv.totalTheoretical.toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                      {inv.totalPhysical.toLocaleString('fr-FR')}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${
                        inv.totalDiscrepancy < 0
                          ? 'text-red-600'
                          : inv.totalDiscrepancy > 0
                          ? 'text-[#16A34A]'
                          : 'text-slate-600'
                      }`}
                    >
                      {inv.totalDiscrepancy > 0 ? `+${inv.totalDiscrepancy}` : inv.totalDiscrepancy}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{inv.mediaItems.length}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setValidatedReport(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#004B93] border border-slate-200 rounded-lg hover:bg-[#EEF5FC]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Rapport
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Camera Modal (Photos + Videos) */}
      <CameraModal
        isOpen={cameraOpen}
        mode="photo_and_video"
        title={`Capture Chambre Froide : ${activeMediaRoom}`}
        onClose={() => setCameraOpen(false)}
        onCapturePhoto={handlePhotoCaptured}
        onCaptureVideo={handleVideoCaptured}
      />

      {/* Complete Validated Inventory Report Modal */}
      {validatedReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Rapport d’Inventaire Général — {validatedReport.sessionCode}
                </h3>
                <p className="text-xs text-slate-500">
                  Validé le {validatedReport.createdAt.slice(0, 16).replace('T', ' ')} par{' '}
                  {validatedReport.userName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setValidatedReport(null)}
                aria-label="Fermer le rapport"
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] text-slate-500">Théorique Global</div>
                  <div className="text-lg font-bold font-mono tabular-nums">
                    {validatedReport.totalTheoretical.toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-[11px] text-[#004B93]">Physique Consolidé</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-[#004B93]">
                    {validatedReport.totalPhysical.toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] text-slate-500">Écart Total</div>
                  <div
                    className={`text-lg font-bold font-mono tabular-nums ${
                      validatedReport.totalDiscrepancy < 0 ? 'text-red-600' : 'text-[#16A34A]'
                    }`}
                  >
                    {validatedReport.totalDiscrepancy > 0
                      ? `+${validatedReport.totalDiscrepancy}`
                      : validatedReport.totalDiscrepancy}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Réf</th>
                      <th className="py-2 px-3 font-semibold">Produit</th>
                      <th className="py-2 px-3 font-semibold text-right">Théorique</th>
                      <th className="py-2 px-3 font-semibold text-right">Physique</th>
                      <th className="py-2 px-3 font-semibold text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validatedReport.lines.map((line) => (
                      <tr key={line.productId}>
                        <td className="py-2 px-3 font-mono">{line.productReference}</td>
                        <td className="py-2 px-3 font-medium">{line.productName}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {line.theoreticalQty.toLocaleString('fr-FR')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                          {line.physicalQty.toLocaleString('fr-FR')}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold tabular-nums ${
                            line.discrepancy < 0
                              ? 'text-red-600'
                              : line.discrepancy > 0
                              ? 'text-[#16A34A]'
                              : 'text-slate-500'
                          }`}
                        >
                          {line.discrepancy > 0 ? `+${line.discrepancy}` : line.discrepancy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
