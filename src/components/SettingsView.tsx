import React, { useState } from 'react';
import { Globe, Plus, RotateCcw, Shield, Trash2, Warehouse } from 'lucide-react';
import { TRANSLATIONS } from '../i18n/translations';
import type { Language, UserProfile, WorkspaceState } from '../types/stock';

interface SettingsViewProps {
  language: Language;
  onToggleLanguage: () => void;
  user: UserProfile;
  workspace: WorkspaceState;
  onRefresh: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  onToggleLanguage,
  user,
  workspace,
  onRefresh,
}) => {
  const t = TRANSLATIONS[language];
  const [rooms, setRooms] = useState<string[]>(workspace.coldRooms);
  const [newRoom, setNewRoom] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSaveRooms = async (nextRooms: string[]) => {
    setRooms(nextRooms);
    if (user.authMode === 'local') {
      await fetch('/api/workspace/cold-rooms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coldRooms: nextRooms,
          userUid: user.uid,
          userName: user.displayName,
          userRole: user.role,
        }),
      });
      await onRefresh();
      setStatusMsg('Liste des chambres froides mise à jour.');
    }
  };

  const handleResetDemo = async () => {
    if (user.authMode !== 'local') return;
    if (
      !window.confirm(
        'Réinitialiser les données du poste local avec les 69 produits du catalogue officiel ?'
      )
    ) {
      return;
    }
    await fetch('/api/workspace/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userUid: user.uid }),
    });
    await onRefresh();
    setStatusMsg('Base de données du poste réinitialisée avec le catalogue officiel.');
  };

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Language & User Profile Card */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Shield className="w-4 h-4 text-[#004B93]" />
            Profil Utilisateur & Accès
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs">
            <div>
              <span className="text-slate-500">Agent connecté :</span>{' '}
              <strong className="text-slate-900">{user.displayName}</strong>
            </div>
            <div>
              <span className="text-slate-500">Rôle :</span>{' '}
              <strong className="text-[#004B93]">{t.roles[user.role]}</strong>
            </div>
            <div>
              <span className="text-slate-500">Base active :</span>{' '}
              <strong className="font-mono">
                {user.authMode === 'firebase' ? 'Cloud Firestore + Auth' : 'Serveur Quai Persistant'}
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-900">Langue de l’interface</div>
              <div className="text-[11px] text-slate-500">
                Français (défaut) ou Arabe (RTL complet)
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleLanguage}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#004B93] text-white text-xs font-semibold rounded-lg"
            >
              <Globe className="w-4 h-4" />
              {language === 'fr' ? 'Basculer en العربية (RTL)' : 'Basculer en Français'}
            </button>
          </div>
        </section>

        {/* Cold Storage Rooms Configuration */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Warehouse className="w-4 h-4 text-[#16A34A]" />
            Chambres Froides (Consolidation Inventaire Général)
          </div>

          <div className="space-y-2">
            {rooms.map((room, idx) => (
              <div
                key={`${room}-${idx}`}
                className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <span className="font-medium text-slate-900">{room}</span>
                {rooms.length > 1 && user.authMode === 'local' && (
                  <button
                    type="button"
                    onClick={() => handleSaveRooms(rooms.filter((_, i) => i !== idx))}
                    aria-label={`Supprimer ${room}`}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {user.authMode === 'local' && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                placeholder="Ex: Chambre Froide 5 (Export)"
                aria-label="Nouvelle chambre froide"
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newRoom.trim()) return;
                  void handleSaveRooms([...rooms, newRoom.trim()]);
                  setNewRoom('');
                }}
                className="inline-flex items-center gap-1 px-3 py-2 bg-[#16A34A] text-white text-xs font-semibold rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Security & Operations Audit Log */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Journal d’Audit & Actions Critiques ({workspace.auditLogs.length})
          </h3>
          {user.authMode === 'local' && user.role === 'admin' && (
            <button
              type="button"
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser Catalogue
            </button>
          )}
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Date & Heure</th>
                <th className="py-2.5 px-4 font-semibold">Action</th>
                <th className="py-2.5 px-4 font-semibold">Détails</th>
                <th className="py-2.5 px-4 font-semibold">Utilisateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {log.createdAt.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-[#004B93]">{log.action}</td>
                  <td className="py-2.5 px-4 text-slate-700">{log.details}</td>
                  <td className="py-2.5 px-4 text-slate-700">
                    {log.userName} {log.userRole ? `(${log.userRole})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
