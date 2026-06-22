import { useState, useEffect } from 'react';
import { AppProvider } from './store/AppContext';
import { ToastProvider } from './components/Toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Inventory from './pages/Inventory';
import ImportExcel from './pages/ImportExcel';
import SalesReport from './pages/SalesReport';
import Login from './pages/Login';

export default function App() {
  const [page, setPage] = useState('billing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is already authenticated in this session
    if (sessionStorage.getItem('cs_auth_session')) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('cs_auth_session', 'true');
  };

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <Login onLogin={handleLogin} />
      </ToastProvider>
    );
  }

  const pages = {
    dashboard: Dashboard,
    billing: Billing,
    inventory: Inventory,
    import: ImportExcel,
    reports: SalesReport,
  };

  const PageComponent = pages[page] || Dashboard;

  return (
    <AppProvider>
      <ToastProvider>
        <div className="app-shell">
          <Sidebar page={page} setPage={setPage} />
          <main className="main-content">
            <PageComponent setPage={setPage} />
          </main>
        </div>
      </ToastProvider>
    </AppProvider>
  );
}
