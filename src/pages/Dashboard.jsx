import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { TrendingUp, Package, AlertTriangle, IndianRupee, Search, Calendar } from 'lucide-react';
import Receipt from '../components/Receipt';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

function getToday() { return new Date().toDateString(); }

export default function Dashboard({ setPage }) {
  const { state } = useApp();
  const tx = useT(state.lang);
  const [selectedSale, setSelectedSale] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const todaySales = state.sales.filter(s => new Date(s.date).toDateString() === getToday());
  const todayRevenue = todaySales.reduce((a, s) => a + s.grandTotal, 0);
  const totalRevenue = state.sales.reduce((a, s) => a + s.grandTotal, 0);
  const lowStock = state.products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5);
  const oos = state.products.filter(p => (p.stock || 0) === 0);

  const filteredSales = state.sales.filter(s => {
    const matchSearch = !search || s.id.toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || new Date(s.date).toISOString().startsWith(dateFilter);
    return matchSearch && matchDate;
  });

  return (
    <div>
      <div className="page-header">
        <h2>📊 {tx.dashboard}</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card pink">
            <div className="stat-label">{tx.todaySales}</div>
            <div className="stat-value">{fmt(todayRevenue)}</div>
            <div className="stat-sub">{todaySales.length} bills today</div>
            <div className="stat-icon">🛒</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-label">{tx.totalRevenue}</div>
            <div className="stat-value">{fmt(totalRevenue)}</div>
            <div className="stat-sub">{state.sales.length} total bills</div>
            <div className="stat-icon">💰</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">{tx.totalProducts}</div>
            <div className="stat-value">{state.products.length}</div>
            <div className="stat-sub">{oos.length} out of stock</div>
            <div className="stat-icon">📦</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-label">{tx.lowStockAlert}</div>
            <div className="stat-value">{lowStock.length + oos.length}</div>
            <div className="stat-sub">Need restocking</div>
            <div className="stat-icon">⚠️</div>
          </div>
        </div>

        <div className="dash-grid">
          {/* Bill History */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>📜 Bill History (Click to View/Edit)</h3>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input
                  type="text"
                  placeholder="Search Bill No..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ padding: '8px 10px 8px 32px', width: '100%', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg2)', color: 'var(--text1)', outline: 'none' }}
                />
              </div>
              <div style={{ width: '140px', position: 'relative' }}>
                 <Calendar size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                 <input 
                   type="date" 
                   value={dateFilter} 
                   onChange={e => setDateFilter(e.target.value)} 
                   style={{ padding: '8px 10px 8px 32px', width: '100%', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg2)', color: 'var(--text1)', outline: 'none' }}
                 />
              </div>
            </div>

            {filteredSales.length === 0 ? (
              <p style={{ color: 'var(--text3)', fontSize: '0.85rem', textAlign: 'center', padding: '30px 0' }}>{tx.noSales || 'No bills found'}</p>
            ) : (
              <div className="table-wrap" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)' }}>
                    <tr>
                      <th>{tx.billNo}</th>
                      <th>{tx.amount}</th>
                      <th>{tx.paymentMode}</th>
                      <th>{tx.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map(s => (
                      <tr key={s.id} onClick={() => setSelectedSale(s)} style={{ cursor: 'pointer' }} className="hover-row">
                        <td><span className="badge badge-purple">#{s.id.slice(-6).toUpperCase()}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{fmt(s.grandTotal)}</td>
                        <td><span className={`badge ${s.paymentMode === 'Cash' ? 'badge-green' : s.paymentMode === 'UPI' ? 'badge-purple' : 'badge-yellow'}`}>{s.paymentMode}</span></td>
                        <td style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>{new Date(s.date).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Low Stock */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700, color: 'var(--yellow)' }}>⚠️ {tx.lowStockAlert}</h3>
            {lowStock.length === 0 && oos.length === 0 ? (
              <p style={{ color: 'var(--green)', fontSize: '0.85rem', textAlign: 'center', padding: '30px 0' }}>✅ All products are well stocked!</p>
            ) : (
              <ul className="low-stock-list">
                {[...oos, ...lowStock].slice(0, 8).map(p => (
                  <li key={p.id} className="low-stock-item">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{p.brand} · {p.category}</div>
                    </div>
                    <span className={`badge ${p.stock === 0 ? 'badge-red' : 'badge-yellow'}`}>
                      {p.stock === 0 ? 'Out of Stock' : `${p.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {selectedSale && <Receipt sale={selectedSale} onClose={() => setSelectedSale(null)} setPage={setPage} />}
    </div>
  );
}
