import React, { useState } from 'react';
import {
  Archive,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  ClipboardCheck,
  FileInput,
  FileOutput,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScanLine,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { MENU_ORDER, TRANSLATIONS } from '../i18n/translations';
import type { Language, MenuId, StockAlert, UserProfile } from '../types/stock';

interface LayoutProps {
  language: Language;
  onToggleLanguage: () => void;
  activeMenu: MenuId;
  onSelectMenu: (menu: MenuId) => void;
  user: UserProfile;
  onLogout: () => void;
  alerts: StockAlert[];
  onQuickScan: () => void;
  children: React.ReactNode;
}

const MENU_ICONS: Record<MenuId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  products: Package,
  stock: Boxes,
  reception: FileInput,
  livraison: FileOutput,
  inventory: ClipboardCheck,
  distributors: Users,
  movements: ArrowLeftRight,
  reports: BarChart3,
  archives: Archive,
  settings: Settings,
};

export const Layout: React.FC<LayoutProps> = ({
  language,
  onToggleLanguage,
  activeMenu,
  onSelectMenu,
  user,
  onLogout,
  alerts,
  onQuickScan,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const t = TRANSLATIONS[language];
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  const handleNavClick = (id: MenuId) => {
    onSelectMenu(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Navigation (260px) */}
      <aside
        className={`${
          mobileOpen ? 'fixed inset-y-0 flex' : 'hidden lg:flex lg:sticky lg:top-0'
        } ${
          language === 'ar' ? 'right-0' : 'left-0'
        } z-50 w-64 lg:h-screen bg-[#004B93] text-white flex-col shrink-0`}
      >
        {/* Brand Header */}
        <div className="px-4 py-4 border-b border-white/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white text-[#004B93] flex items-center justify-center font-bold text-sm shrink-0">
              GQ
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold tracking-wide truncate">CHEF DE QUAI</div>
              <div className="text-[11px] text-blue-200 truncate">
                {language === 'ar' ? 'إدارة المخزون' : 'Gestion Stock Laitier'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 11 Menu Items */}
        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {MENU_ORDER.map((id, index) => {
            const Icon = MENU_ICONS[id];
            const active = activeMenu === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleNavClick(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors text-start ${
                  active
                    ? 'bg-white text-[#004B93]'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#16A34A]' : 'text-blue-200'}`} />
                <span className="truncate">
                  {index + 1}. {t.menu[id]}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Active User Footer */}
        <div className="p-3 border-t border-white/15 space-y-2 bg-[#00356B]">
          <div className="px-2">
            <div className="text-xs font-semibold text-white truncate">{user.displayName}</div>
            <div className="text-[11px] text-blue-200 truncate">
              {t.roles[user.role]} · {user.authMode === 'firebase' ? 'Cloud' : 'Poste Local'}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.actions.logout}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {t.menu[activeMenu]}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setAlertsOpen((v) => !v)}
                aria-label="Alertes de stock"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Bell className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-600' : 'text-slate-500'}`} />
                <span className="tabular-nums">{alerts.length}</span>
              </button>

              {alertsOpen && (
                <div
                  className={`absolute ${
                    language === 'ar' ? 'left-0' : 'right-0'
                  } mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden`}
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{t.dashboard.alertsTitle}</span>
                    <button
                      type="button"
                      onClick={() => setAlertsOpen(false)}
                      aria-label="Fermer les alertes"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {alerts.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">
                        Aucune alerte active. Tous les stocks sont conformes.
                      </div>
                    ) : (
                      alerts.slice(0, 12).map((alert) => (
                        <div key={alert.id} className="p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                alert.severity === 'critical'
                                  ? 'text-red-700'
                                  : alert.severity === 'warning'
                                  ? 'text-amber-700'
                                  : 'text-[#004B93]'
                              }`}
                            >
                              {alert.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{alert.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleLanguage}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Globe className="w-4 h-4 text-[#004B93]" />
              {language === 'fr' ? 'AR' : 'FR'}
            </button>

            <button
              type="button"
              onClick={onQuickScan}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ScanLine className="w-4 h-4" />
              <span className="hidden sm:inline">{t.actions.scanDoc}</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
