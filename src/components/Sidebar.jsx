"use client";
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import {
  LayoutDashboard, ShoppingCart, Package, FileSpreadsheet,
  Globe, X, BarChart2, Users, BookOpen
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, dispatch } = useApp();
  const tx = useT(state.lang);

  const lowStockCount = state.products?.filter(p => (p.stock || 0) <= 5 && (p.stock || 0) > 0).length || 0;
  const oos = state.products?.filter(p => (p.stock || 0) === 0).length || 0;

  const dueVendors = state.vendors?.filter(v => {
    if (!v.dueDate) return false;
    const due = new Date(v.dueDate);
    const diffDays = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 10;
  }).length || 0;

  const navItems = [
    { id: '/', label: tx.dashboard, icon: LayoutDashboard },
    { id: '/billing', label: tx.billing, icon: ShoppingCart },
    { id: '/reports', label: tx.reports || 'Reports', icon: BarChart2 },
    { id: '/customers', label: 'Customers', icon: Users },
    { id: '/ledger', label: 'Ledger (Khata)', icon: BookOpen },
    { id: '/inventory', label: tx.inventory, icon: Package },
    { id: '/import', label: tx.import, icon: FileSpreadsheet },
  ];

  const handleNavClick = (id) => {
    router.push(id);
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>📊 Billing Software</h1>
          <p>Pharmacy & Retail POS</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              className={`nav-item ${pathname === id ? 'active' : ''}`}
              onClick={() => handleNavClick(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === '/inventory' && (lowStockCount + oos) > 0 && (
                <span className="badge badge-yellow" style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>
                  {lowStockCount + oos}
                </span>
              )}
              {id === '/ledger' && dueVendors > 0 && (
                <span className="badge badge-red" style={{ marginLeft: 'auto', fontSize: '0.65rem', backgroundColor: 'var(--red)', color: '#fff' }}>
                  {dueVendors} Due
                </span>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="lang-toggle">
            <Globe size={14} />
            <span>{tx.language}:</span>
            <button
              className={`lang-btn ${state.lang === 'en' ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_LANG', payload: 'en' })}
            >EN</button>
            <button
              className={`lang-btn ${state.lang === 'hi' ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_LANG', payload: 'hi' })}
            >HI</button>
          </div>

          {/* Wintogether Branding */}
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text3)', marginBottom: '6px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Designed &amp; Developed by
            </div>
            <img
              src="/wintogether_logo.png"
              alt="Wintogether Technology"
              style={{
                height: '24px',
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto',
                maxWidth: '140px'
              }}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
