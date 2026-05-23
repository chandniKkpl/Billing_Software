import { useState } from 'react';
import { AppProvider } from './store/AppContext';
import { ToastProvider } from './components/Toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Inventory from './pages/Inventory';
import ImportExcel from './pages/ImportExcel';
import SalesReport from './pages/SalesReport';

export default function App() {
  const [page, setPage] = useState('billing');

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
