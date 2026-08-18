import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { TrendingUp, Package, AlertTriangle, IndianRupee, Search, Calendar, Clock, MessageCircle, Bot, Mic } from 'lucide-react';
import Receipt from '../components/Receipt';
import WinTogetherAssistantOverlay from '../components/assistant/WinTogetherAssistantOverlay';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

function getToday() { return new Date().toDateString(); }

export default function Dashboard({ setPage }) {
  const { state } = useApp();
  const tx = useT(state.lang);
  const [selectedSale, setSelectedSale] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);

  const todaySales = state.sales.filter(s => new Date(s.date).toDateString() === getToday());
  const todayRevenue = todaySales.reduce((a, s) => a + s.grandTotal, 0);
  const totalRevenue = state.sales.reduce((a, s) => a + s.grandTotal, 0);
  const lowStock = state.products.filter(p => p.itemType !== 'Service' && (p.stock || 0) > 0 && (p.stock || 0) <= 5);
  const oos = state.products.filter(p => p.itemType !== 'Service' && (p.stock || 0) === 0);

  const filteredSales = state.sales.filter(s => {
    const matchSearch = !search || s.id.toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || new Date(s.date).toISOString().startsWith(dateFilter);
    return matchSearch && matchDate;
  });

  const allAccounts = [
    ...(state.customers || []).map(c => ({ ...c, type: 'Customer', balance: c.udhaarBalance || 0 })),
    ...(state.vendors || []).map(v => ({ ...v, type: 'Vendor' })),
    ...(state.accounts || [])
  ];

  const upcomingDues = allAccounts
    .filter(a => a.dueDate && a.balance > 0)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 10);

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
        {/* 
        <div className="assistant-dashboard-card">
          <div className="assistant-dashboard-copy">
            <div className="assistant-dashboard-badge"><Bot size={16} /> WinTogether AI</div>
            <h3>Your Smart Business Assistant</h3>
            <p>Speak naturally to search products, check balance, view today's sales, find low stock, create bills, and send reminders with confirmation.</p>
            <div className="assistant-dashboard-examples">
              <span>"Aaj ki sale batao"</span>
              <span>"Low stock dikhao"</span>
              <span>"Rahul ka balance batao"</span>
              <span>"Bill bana do"</span>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setAssistantOpen(true)}>
            <Mic size={18} /> Talk to WinTogether AI
          </button>
        </div> */}

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
                        <td><span className="badge badge-purple">#{s.billNo ? String(s.billNo).padStart(4, '0') : s.id.slice(-6).toUpperCase()}</span></td>
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

          {/* Upcoming Dues & Reminders */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} /> Reminders & Dues
            </h3>
            {upcomingDues.length === 0 ? (
              <p style={{ color: 'var(--green)', fontSize: '0.85rem', textAlign: 'center', padding: '30px 0' }}>✅ No pending dues or reminders!</p>
            ) : (
              <ul className="low-stock-list">
                {upcomingDues.map(acc => {
                  const daysLeft = Math.ceil((new Date(acc.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysLeft < 0;
                  return (
                    <li
                      key={acc.id}
                      className="low-stock-item"
                      style={{ borderLeft: isOverdue ? '3px solid var(--red)' : '3px solid var(--orange)', paddingLeft: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onClick={() => {
                        if (acc.phone) {
                          const message = `Hello ${acc.name}, this is a gentle reminder regarding your pending balance of Rs. ${acc.balance.toFixed(2)}. Please arrange for payment by ${new Date(acc.dueDate).toLocaleDateString()}. Thank you!\n\nRegards,\nCosmo Store`;
                          window.open(`https://wa.me/91${acc.phone}?text=${encodeURIComponent(message)}`, '_blank');
                        } else {
                          alert('No phone number saved for this account.');
                        }
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{acc.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                          <span className={`badge ${acc.type === 'Customer' ? 'badge-green' : 'badge-yellow'}`} style={{ padding: '0px 4px', fontSize: '0.65rem', marginRight: '4px' }}>{acc.type}</span>
                          ₹{acc.balance.toFixed(2)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginRight: '10px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isOverdue ? 'var(--red)' : 'var(--orange)' }}>
                          {isOverdue ? 'Overdue!' : `${daysLeft} days left`}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{new Date(acc.dueDate).toLocaleDateString()}</div>
                      </div>
                      <div style={{ backgroundColor: '#DCFCE7', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageCircle size={16} color="#16A34A" />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
      {selectedSale && <Receipt sale={selectedSale} onClose={() => setSelectedSale(null)} setPage={setPage} />}
      <WinTogetherAssistantOverlay open={assistantOpen} onClose={() => setAssistantOpen(false)} onMinimize={() => setAssistantOpen(false)} />
    </div>
  );
}
