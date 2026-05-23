import { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { Calendar, TrendingUp, Banknote, Smartphone, IndianRupee, FileBarChart2, Download, Trash2, Edit2 } from 'lucide-react';

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function getDateRange(period, customFrom, customTo) {
  const now = new Date();
  let from, to;

  switch (period) {
    case 'daily': {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    }
    case 'weekly': {
      const day = now.getDay(); // 0=Sun
      const diffToMon = (day === 0 ? -6 : 1 - day);
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon, 0, 0, 0);
      to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59);
      break;
    }
    case 'monthly': {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    }
    case 'yearly': {
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    }
    case 'custom': {
      from = customFrom ? new Date(customFrom + 'T00:00:00') : null;
      to = customTo ? new Date(customTo + 'T23:59:59') : null;
      break;
    }
    default:
      from = null; to = null;
  }
  return { from, to };
}

// Group sales by day label for the "chart" (bar visualization)
function groupByDay(sales) {
  const map = {};
  sales.forEach(s => {
    const d = new Date(s.date);
    const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (!map[key]) map[key] = { label: key, total: 0, cash: 0, upi: 0, card: 0, count: 0 };
    map[key].total += s.grandTotal;
    map[key].count += 1;
    if (s.paymentMode === 'Cash') map[key].cash += s.grandTotal;
    else if (s.paymentMode === 'UPI') map[key].upi += s.grandTotal;
    else if (s.paymentMode === 'Card') map[key].card += s.grandTotal;
  });
  return Object.values(map);
}

export default function SalesReport({ setPage }) {
  const { state, dispatch, deleteSale } = useApp();
  const [period, setPeriod] = useState('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const handleDeleteBill = async (id) => {
    if (!confirm('Are you sure you want to delete this bill? Stock will be restored.')) return;
    try {
       await deleteSale(id);
    } catch(e) {
       console.error(e);
    }
  };

  const editBill = (sale) => {
    if (!confirm('This will replace your current cart and allow you to modify this bill. Continue?')) return;
    dispatch({ type: 'SET_CART', payload: sale.items });
    dispatch({ type: 'SET_EDITING_SALE', payload: sale.id });
    if (setPage) setPage('billing');
  };

  const { from, to } = getDateRange(period, customFrom, customTo);

  const filteredSales = useMemo(() => {
    return state.sales.filter(s => {
      const d = new Date(s.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [state.sales, from, to, period]);

  // Aggregated totals
  const totalRevenue = filteredSales.reduce((a, s) => a + s.grandTotal, 0);
  const cashSales = filteredSales.filter(s => s.paymentMode === 'Cash');
  const upiSales = filteredSales.filter(s => s.paymentMode === 'UPI');
  const cardSales = filteredSales.filter(s => s.paymentMode === 'Card');
  const cashTotal = cashSales.reduce((a, s) => a + s.grandTotal, 0);
  const upiTotal = upiSales.reduce((a, s) => a + s.grandTotal, 0);
  const cardTotal = cardSales.reduce((a, s) => a + s.grandTotal, 0);
  const totalGST = filteredSales.reduce((a, s) => a + (s.gst || 0), 0);
  const totalDiscount = filteredSales.reduce((a, s) => a + (s.discount || 0), 0);

  // Bar chart data
  const chartData = groupByDay(filteredSales);
  const maxVal = Math.max(...chartData.map(d => d.total), 1);

  const periodLabels = {
    daily: "Today's Report",
    weekly: 'This Week\'s Report',
    monthly: 'This Month\'s Report',
    yearly: 'This Year\'s Report',
    custom: 'Custom Range Report',
  };

  // Download CSV
  const downloadCSV = () => {
    const rows = [
      ['Bill No', 'Date', 'Amount (₹)', 'Payment Mode', 'GST (₹)', 'Discount (₹)'],
      ...filteredSales.map(s => [
        '#' + s.id.slice(-6).toUpperCase(),
        new Date(s.date).toLocaleString('en-IN'),
        s.grandTotal.toFixed(2),
        s.paymentMode,
        (s.gst || 0).toFixed(2),
        (s.discount || 0).toFixed(2),
      ])
    ];
    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${period}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <h2>📊 Sales Report</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <div className="page-content">

        {/* Period Filter Bar */}
        <div className="report-filter-bar">
          {['daily', 'weekly', 'monthly', 'yearly', 'custom'].map(p => (
            <button
              key={p}
              className={`report-period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'daily' ? '📅 Daily' : p === 'weekly' ? '📆 Weekly' : p === 'monthly' ? '🗓️ Monthly' : p === 'yearly' ? '📈 Yearly' : '🔎 Custom'}
            </button>
          ))}

          {period === 'custom' && (
            <div className="custom-range-inputs">
              <input
                type="date"
                className="report-date-input"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                max={customTo || undefined}
              />
              <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>to</span>
              <input
                type="date"
                className="report-date-input"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                min={customFrom || undefined}
              />
            </div>
          )}

          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={downloadCSV}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Period Title */}
        <div className="report-period-title">
          <FileBarChart2 size={18} color="var(--primary)" />
          <h3>{periodLabels[period]}</h3>
          <span className="badge badge-green">{filteredSales.length} bills</span>
        </div>

        {/* Summary Stats */}
        <div className="report-stats-grid">
          {/* Total Revenue */}
          <div className="report-stat-card total">
            <div className="rsc-icon"><IndianRupee size={20} /></div>
            <div className="rsc-body">
              <div className="rsc-label">Total Revenue</div>
              <div className="rsc-value">{fmt(totalRevenue)}</div>
              <div className="rsc-sub">{filteredSales.length} transactions</div>
            </div>
          </div>

          {/* Cash */}
          <div className="report-stat-card cash">
            <div className="rsc-icon cash-icon"><Banknote size={20} /></div>
            <div className="rsc-body">
              <div className="rsc-label">💵 Cash Sales</div>
              <div className="rsc-value cash-val">{fmt(cashTotal)}</div>
              <div className="rsc-sub">{cashSales.length} bills</div>
            </div>
            {totalRevenue > 0 && (
              <div className="rsc-pct cash-pct">{((cashTotal / totalRevenue) * 100).toFixed(1)}%</div>
            )}
          </div>

          {/* UPI */}
          <div className="report-stat-card upi">
            <div className="rsc-icon upi-icon"><Smartphone size={20} /></div>
            <div className="rsc-body">
              <div className="rsc-label">📱 UPI Sales</div>
              <div className="rsc-value upi-val">{fmt(upiTotal)}</div>
              <div className="rsc-sub">{upiSales.length} bills</div>
            </div>
            {totalRevenue > 0 && (
              <div className="rsc-pct upi-pct">{((upiTotal / totalRevenue) * 100).toFixed(1)}%</div>
            )}
          </div>

          {/* GST */}
          <div className="report-stat-card gst">
            <div className="rsc-icon gst-icon"><TrendingUp size={20} /></div>
            <div className="rsc-body">
              <div className="rsc-label">🧾 Total GST</div>
              <div className="rsc-value gst-val">{fmt(totalGST)}</div>
              <div className="rsc-sub">Incl. in revenue</div>
            </div>
          </div>
        </div>

        {/* Payment Bifurcation Visual */}
        <div className="report-bifurcation-card">
          <h4 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>💳 Payment Mode Bifurcation</h4>
          <div className="bifurc-bar-wrap">
            {totalRevenue === 0 ? (
              <div className="bifurc-empty">No sales data for this period</div>
            ) : (
              <>
                <div className="bifurc-bar">
                  {cashTotal > 0 && (
                    <div
                      className="bifurc-segment cash-seg"
                      style={{ width: `${(cashTotal / totalRevenue) * 100}%` }}
                      title={`Cash: ${fmt(cashTotal)}`}
                    />
                  )}
                  {upiTotal > 0 && (
                    <div
                      className="bifurc-segment upi-seg"
                      style={{ width: `${(upiTotal / totalRevenue) * 100}%` }}
                      title={`UPI: ${fmt(upiTotal)}`}
                    />
                  )}
                  {cardTotal > 0 && (
                    <div
                      className="bifurc-segment card-seg"
                      style={{ width: `${(cardTotal / totalRevenue) * 100}%` }}
                      title={`Card: ${fmt(cardTotal)}`}
                    />
                  )}
                </div>
                <div className="bifurc-legend">
                  <div className="bifurc-legend-item">
                    <span className="legend-dot cash-dot" />
                    <span>💵 Cash</span>
                    <strong>{fmt(cashTotal)}</strong>
                    <span className="legend-pct">({((cashTotal / totalRevenue) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="bifurc-legend-item">
                    <span className="legend-dot upi-dot" />
                    <span>📱 UPI</span>
                    <strong>{fmt(upiTotal)}</strong>
                    <span className="legend-pct">({((upiTotal / totalRevenue) * 100).toFixed(1)}%)</span>
                  </div>
                  {cardTotal > 0 && (
                    <div className="bifurc-legend-item">
                      <span className="legend-dot card-dot" />
                      <span>💳 Card</span>
                      <strong>{fmt(cardTotal)}</strong>
                      <span className="legend-pct">({((cardTotal / totalRevenue) * 100).toFixed(1)}%)</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Daily Bar Chart */}
        {chartData.length > 0 && (
          <div className="report-chart-card">
            <h4 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>📊 Day-wise Sales</h4>
            <div className="bar-chart-wrap">
              {chartData.map((d, i) => (
                <div key={i} className="bar-col">
                  <div className="bar-val-label">{fmt(d.total)}</div>
                  <div className="bar-outer">
                    <div className="bar-stack">
                      {d.upi > 0 && (
                        <div
                          className="bar-seg upi-bar"
                          style={{ height: `${(d.upi / maxVal) * 100}%` }}
                          title={`UPI: ${fmt(d.upi)}`}
                        />
                      )}
                      {d.cash > 0 && (
                        <div
                          className="bar-seg cash-bar"
                          style={{ height: `${(d.cash / maxVal) * 100}%` }}
                          title={`Cash: ${fmt(d.cash)}`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="bar-label">{d.label}</div>
                  <div className="bar-count">{d.count} bills</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Table */}
        <div className="card" style={{ marginTop: 20 }}>
          <h4 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>🧾 Bill-wise Detail</h4>
          {filteredSales.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: '0.85rem' }}>
              No sales found for this period
            </div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)' }}>
                  <tr>
                    <th>Bill No</th>
                    <th>Date & Time</th>
                    <th>Payment</th>
                    <th style={{ textAlign: 'right' }}>Discount</th>
                    <th style={{ textAlign: 'right' }}>GST</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(s => (
                    <tr key={s.id}>
                      <td><span className="badge badge-purple">#{s.id.slice(-6).toUpperCase()}</span></td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                        {new Date(s.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <span className={`badge ${s.paymentMode === 'Cash' ? 'badge-green' : s.paymentMode === 'UPI' ? 'badge-purple' : 'badge-yellow'}`}>
                          {s.paymentMode === 'Cash' ? '💵' : s.paymentMode === 'UPI' ? '📱' : '💳'} {s.paymentMode}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--green)', fontSize: '0.82rem' }}>
                        {s.discount > 0 ? `-${fmt(s.discount)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text3)', fontSize: '0.82rem' }}>
                        {fmt(s.gst || 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        {fmt(s.grandTotal)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => editBill(s)} title="Edit Bill">
                            ✏️
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBill(s.id)} title="Delete Bill">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg3)' }}>
                    <td colSpan={3} style={{ fontWeight: 700, fontSize: '0.85rem' }}>TOTAL ({filteredSales.length} bills)</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)', fontSize: '0.85rem' }}>{totalDiscount > 0 ? `-${fmt(totalDiscount)}` : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>{fmt(totalGST)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>{fmt(totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
