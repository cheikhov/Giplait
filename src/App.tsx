import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { Layout } from './components/Layout';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { StockView } from './components/StockView';
import { DocumentOcrView } from './components/DocumentOcrView';
import { InventoryView } from './components/InventoryView';
import { DistributorsView } from './components/DistributorsView';
import { MovementsView } from './components/MovementsView';
import { ReportsView } from './components/ReportsView';
import { ArchivesView } from './components/ArchivesView';
import { SettingsView } from './components/SettingsView';
import { DEFAULT_COLD_ROOMS } from './data/catalog';
import { auth, firebaseInitError, googleProvider, isFirebaseConfigured } from './lib/firebase';
import {
  ensureFirebaseUserProfile,
  fetchLocalWorkspace,
  seedFirestoreIfEmpty,
  subscribeFirestoreWorkspace,
} from './services/dataService';
import type { Language, MenuId, UserProfile, WorkspaceState } from './types/stock';
import { computeAlerts } from './utils/stockEngine';

const EMPTY_WORKSPACE: WorkspaceState = {
  products: [],
  distributors: [],
  documents: [],
  movements: [],
  inventories: [],
  auditLogs: [],
  coldRooms: DEFAULT_COLD_ROOMS,
};

function AppContent() {
  const [language, setLanguage] = useState<Language>('fr');
  const [activeMenu, setActiveMenu] = useState<MenuId>('dashboard');
  const [user, setUser] = useState<UserProfile | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      return {
        uid: 'chef-quai-local',
        email: 'quai@giplait-ops.local',
        displayName: 'Chef de Quai',
        role: 'admin',
        active: true,
        authMode: 'local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  });
  const [workspace, setWorkspace] = useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(() =>
    !isFirebaseConfigured ? firebaseInitError : null
  );
  const [dataLoading, setDataLoading] = useState(false);

  // Sync HTML dir="rtl" / "ltr" and lang attribute
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;
      try {
        setAuthLoading(true);
        const profile = await ensureFirebaseUserProfile({
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || fbUser.email || 'Chef de Quai',
        });
        await seedFirestoreIfEmpty(profile);
        setUser(profile);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Erreur profil Firebase.');
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const refreshLocalWorkspace = useCallback(async () => {
    if (user?.authMode !== 'local') return;
    setDataLoading(true);
    try {
      const data = await fetchLocalWorkspace();
      setWorkspace(data);
    } finally {
      setDataLoading(false);
    }
  }, [user?.authMode]);

  // Subscribe to Firestore OR fetch Local Server workspace
  useEffect(() => {
    if (!user) return;
    if (user.authMode === 'local') {
      void refreshLocalWorkspace();
      return;
    }

    setDataLoading(true);
    const unsub = subscribeFirestoreWorkspace(user.uid, (partial) => {
      setWorkspace((prev) => ({ ...prev, ...partial }));
      setDataLoading(false);
    });
    return () => unsub();
  }, [user, refreshLocalWorkspace]);

  const handleGoogleLogin = async () => {
    if (!auth || !isFirebaseConfigured) {
      setAuthError(
        firebaseInitError ||
          'Configuration Firebase manquante. Ajoutez les variables VITE_FIREBASE_* dans Vercel.'
      );
      return;
    }
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Impossible d’ouvrir la fenêtre de connexion Google.';
      if (msg.includes('auth/unauthorized-domain')) {
        setAuthError(
          `Domaine non autorisé dans Firebase (${window.location.hostname}). Ajoutez ce domaine dans Firebase Console → Authentication → Settings → Authorized domains (ou utilisez les identifiants de votre propre projet Firebase dans VITE_FIREBASE_*).`
        );
      } else {
        setAuthError(msg);
      }
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (user?.authMode === 'firebase' && auth) {
      await signOut(auth);
    }
    setUser(null);
    setWorkspace(EMPTY_WORKSPACE);
    setActiveMenu('dashboard');
    setAuthLoading(false);
  };

  const alerts = useMemo(
    () =>
      computeAlerts(
        workspace.products,
        workspace.documents,
        workspace.movements,
        workspace.inventories
      ),
    [workspace.products, workspace.documents, workspace.movements, workspace.inventories]
  );

  if (!user) {
    return (
      <LoginScreen
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'fr' ? 'ar' : 'fr'))}
        onGoogleLogin={handleGoogleLogin}
        authError={authError}
        loading={authLoading}
      />
    );
  }

  return (
    <Layout
      language={language}
      onToggleLanguage={() => setLanguage((l) => (l === 'fr' ? 'ar' : 'fr'))}
      activeMenu={activeMenu}
      onSelectMenu={setActiveMenu}
      user={user}
      onLogout={handleLogout}
      alerts={alerts}
      onQuickScan={() => setActiveMenu('reception')}
    >
      {dataLoading && workspace.products.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Chargement des données du quai...
        </div>
      ) : (
        <>
          {activeMenu === 'dashboard' && (
            <DashboardView
              language={language}
              workspace={workspace}
              alerts={alerts}
              onNavigate={setActiveMenu}
            />
          )}
          {activeMenu === 'products' && (
            <ProductsView
              language={language}
              user={user}
              products={workspace.products}
              onRefresh={refreshLocalWorkspace}
            />
          )}
          {activeMenu === 'stock' && (
            <StockView
              language={language}
              user={user}
              products={workspace.products}
              onRefresh={refreshLocalWorkspace}
            />
          )}
          {activeMenu === 'reception' && (
            <DocumentOcrView
              language={language}
              docType="RECEPTION"
              user={user}
              products={workspace.products}
              distributors={workspace.distributors}
              documents={workspace.documents}
              onRefresh={refreshLocalWorkspace}
            />
          )}
          {activeMenu === 'livraison' && (
            <DocumentOcrView
              language={language}
              docType="LIVRAISON"
              user={user}
              products={workspace.products}
              distributors={workspace.distributors}
              documents={workspace.documents}
              onRefresh={refreshLocalWorkspace}
            />
          )}
          {activeMenu === 'inventory' && (
            <InventoryView
              language={language}
              user={user}
              products={workspace.products}
              coldRooms={workspace.coldRooms}
              inventories={workspace.inventories}
              onRefresh={refreshLocalWorkspace}
            />
          )}
          {activeMenu === 'distributors' && (
            <DistributorsView
              language={language}
              user={user}
              distributors={workspace.distributors}
              documents={workspace.documents}
              movements={workspace.movements}
              onRefresh={refreshLocalWorkspace}
            />
          )}
          {activeMenu === 'movements' && (
            <MovementsView
              language={language}
              movements={workspace.movements}
              products={workspace.products}
              distributors={workspace.distributors}
            />
          )}
          {activeMenu === 'reports' && (
            <ReportsView language={language} user={user} workspace={workspace} />
          )}
          {activeMenu === 'archives' && (
            <ArchivesView language={language} workspace={workspace} />
          )}
          {activeMenu === 'settings' && (
            <SettingsView
              language={language}
              onToggleLanguage={() => setLanguage((l) => (l === 'fr' ? 'ar' : 'fr'))}
              user={user}
              workspace={workspace}
              onRefresh={refreshLocalWorkspace}
            />
          )}
        </>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
