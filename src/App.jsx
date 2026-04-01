import { useState, useEffect, useCallback, useRef } from 'react';
import { getUser, clearSession, apiFetch } from './utils/api';
import LoginScreen from './components/Auth/LoginScreen';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import MobileNav from './components/Layout/MobileNav';
import Dashboard from './components/Pages/Dashboard';
import Clients from './components/Pages/Clients';
import Projets from './components/Pages/Projets';
import Pipeline from './components/Pages/Pipeline';
import Objectifs from './components/Pages/Objectifs';
import AdminDashboard from './components/Pages/Admin/AdminDashboard';
import Assignments from './components/Pages/Admin/Assignments';
import UserManagement from './components/Pages/Admin/UserManagement';
import ObjectifImport from './components/Pages/Admin/ObjectifImport';

// Persist current page in sessionStorage so it survives HMR / soft reloads
const PAGE_KEY = 'spk_dc_page';

function getInitialPage(user) {
  if (!user) return 'dashboard';
  const saved = sessionStorage.getItem(PAGE_KEY);
  if (saved) return saved;
  return user.role === 'admin' ? 'admin-dashboard' : 'dashboard';
}

export default function App() {
  const [user, setUser] = useState(() => getUser());
  const [currentPage, setCurrentPage] = useState(() => getInitialPage(getUser()));
  const [portfolio, setPortfolio] = useState(null);
  const [portfolios, setPortfolios] = useState(null);
  const [objectives, setObjectives] = useState(null);
  const [allObjectives, setAllObjectives] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const needsRefreshRef = useRef(false);

  const handleLogin = (userData) => {
    setUser(userData);
    const page = userData.role === 'admin' ? 'admin-dashboard' : 'dashboard';
    setCurrentPage(page);
    sessionStorage.setItem(PAGE_KEY, page);
  };

  const handleLogout = () => {
    clearSession();
    sessionStorage.removeItem(PAGE_KEY);
    setUser(null);
    setPortfolio(null);
    setPortfolios(null);
  };

  // Load data on login
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await apiFetch('/api/data/portfolio');
      if (user.role === 'admin') {
        setPortfolios(data.portfolios || {});
        // Pick first DC portfolio for DC views when admin
        const firstDC = Object.values(data.portfolios || {})[0] || null;
        setPortfolio(firstDC);
      } else {
        setPortfolio(data.myPortfolio || null);
      }

      const objData = await apiFetch('/api/data/objectives');
      if (user.role === 'admin') {
        setAllObjectives(objData.objectives || {});
        // For admin viewing DC pages, get first DC's objectives
        const firstDCName = Object.keys(data.portfolios || {})[0];
        if (firstDCName) {
          const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          const key = Object.keys(objData.objectives || {}).find(k => norm(k) === norm(firstDCName));
          setObjectives(key ? objData.objectives[key] : []);
        }
      } else {
        setObjectives(objData.objectives || []);
      }
    } catch (e) {
      console.error('[App] Data load error:', e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiFetch('/api/sync', { method: 'POST' });
      // Wait a bit then reload
      setTimeout(() => { loadData(); setSyncing(false); }, 5000);
    } catch (e) {
      console.error('[App] Sync error:', e);
      setSyncing(false);
    }
  };

  // Stable callback — ne force pas le re-render d'Assignments
  const handleAssigned = useCallback(() => {
    needsRefreshRef.current = true;
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    sessionStorage.setItem(PAGE_KEY, page);
    // Recharger uniquement si des assignations ont eu lieu et qu'on retourne sur la vue globale
    if (page === 'admin-dashboard' && needsRefreshRef.current) {
      needsRefreshRef.current = false;
      loadData();
    }
  }, [loadData]);

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const renderPage = () => {
    if (loading && !portfolio && !portfolios) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[#888] text-sm">Chargement des donnees...</p>
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard': return <Dashboard portfolio={portfolio} objectives={objectives} />;
      case 'clients': return <Clients portfolio={portfolio} />;
      case 'projets': return <Projets portfolio={portfolio} />;
      case 'pipeline': return <Pipeline portfolio={portfolio} />;
      case 'objectifs': return <Objectifs portfolio={portfolio} objectives={objectives} />;
      case 'admin-dashboard': return <AdminDashboard portfolios={portfolios} />;
      case 'admin-assignments': return <Assignments onAssigned={handleAssigned} />;
      case 'admin-users': return <UserManagement />;
      case 'admin-objectifs': return <ObjectifImport />;
      default: return <Dashboard portfolio={portfolio} objectives={objectives} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar currentPage={currentPage} onPageChange={handlePageChange} userRole={user.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar user={user} onLogout={handleLogout} onSync={handleSync} syncing={syncing}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {renderPage()}
        </main>
      </div>

      <MobileNav currentPage={currentPage} onPageChange={handlePageChange} userRole={user.role} />
    </div>
  );
}
