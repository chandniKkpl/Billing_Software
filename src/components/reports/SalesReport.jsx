import { useMemo } from 'react';
import { Calendar, Download, FileText, Smartphone, Banknote, TrendingUp, BarChart2, Eye, Edit2, Trash2, CreditCard } from 'lucide-react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function SalesReport({ 
  period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, 
  from, to, state, dispatch, deleteSale, setSelectedSale 
}) {
  const filterByDate = (dateStr) => {
    const d = new Date(dateStr);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const filteredSales = useMemo(() => {
    let sales = state.sales?.filter(s => filterByDate(s.date)) || [];
    return sales.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.sales, from, to]);

  const totalSalesAmount = filteredSales.reduce((a, s) => a + s.grandTotal, 0);
  const totalBills = filteredSales.length;
  
  const cashSales = filteredSales.filter(s => s.paymentMode === 'Cash');
  const cashSalesAmount = cashSales.reduce((a, s) => a + s.grandTotal, 0);
  const cashBillsCount = cashSales.length;

  const upiSales = filteredSales.filter(s => ['UPI', 'Card', 'RTGS', 'NEFT', 'Cheque'].includes(s.paymentMode));
  const upiSalesAmount = upiSales.reduce((a, s) => a + s.grandTotal, 0);
  const upiBillsCount = upiSales.length;

  const totalGST = totalSalesAmount * 0.15; // Dummy approx
  const cashPercent = totalSalesAmount ? ((cashSalesAmount / totalSalesAmount) * 100).toFixed(1) : 0;
  const upiPercent = totalSalesAmount ? ((upiSalesAmount / totalSalesAmount) * 100).toFixed(1) : 0;

  const dayWiseSalesData = useMemo(() => {
    const dataMap = {};
    filteredSales.forEach(s => {
      const d = new Date(s.date);
      const dayKey = d.toISOString().split('T')[0];
      if (!dataMap[dayKey]) {
        dataMap[dayKey] = { dateStr: dayKey, name: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), total: 0, bills: 0 };
      }
      dataMap[dayKey].total += s.grandTotal;
      dataMap[dayKey].bills += 1;
    });
    return Object.values(dataMap).sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
  }, [filteredSales]);

  const handleExportCSV = () => {
    const wb = XLSX.utils.book_new();
    const salesData = filteredSales.map(s => {
      const customer = state.customers?.find(c => c.id === s.customerId);
      return {
        'Bill No': s.id.slice(-6),
        'Date': new Date(s.date).toLocaleString(),
        'Customer': customer ? customer.name : 'Walk-in',
        'Amount': s.grandTotal,
        'Mode': s.paymentMode,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), "Sales");
    XLSX.writeFile(wb, `Sales_Report_${period}_${Date.now()}.csv`);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#1E293B' }}>{label}</p>
          <p style={{ margin: '5px 0 0 0', color: '#3B82F6' }}>{fmt(payload[0].value)}</p>
          <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '12px' }}>{payload[0].payload.bills} bills</p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 15px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '25px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: period === p ? '#10B981' : '#F1F5F9',
                color: period === p ? '#fff' : '#475569',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {p === 'Daily' && <Calendar size={14} />}
              {p === 'Weekly' && <Calendar size={14} />}
              {p === 'Monthly' && <Calendar size={14} />}
              {p === 'Yearly' && <Calendar size={14} />}
              {p === 'Custom' && <BarChart2 size={14} />}
              {p}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {period === 'Custom' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginRight: '15px' }}>
              <input type="date" className="form-input" style={{ padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: '6px' }} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span style={{color: '#64748B'}}>to</span>
              <input type="date" className="form-input" style={{ padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: '6px' }} value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}
          <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontWeight: '600', cursor: 'pointer' }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} color="#10B981" />
          <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.25rem' }}>This {period}'s Report</h3>
        </div>
        <div style={{ backgroundColor: '#D1FAE5', color: '#059669', padding: '4px 12px', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
          {totalBills} bills
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #10B981', display: 'flex', gap: '15px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#D1FAE5', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ color: '#059669', fontWeight: 'bold', fontSize: '1.2rem' }}>₹</span>
          </div>
          <div>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '5px' }}>TOTAL REVENUE</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0F172A', marginBottom: '5px' }}>{fmt(totalSalesAmount)}</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{totalBills} transactions</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #10B981', display: 'flex', gap: '15px', position: 'relative' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#D1FAE5', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Banknote size={20} color="#059669" />
          </div>
          <div>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '5px' }}>CASH SALES</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10B981', marginBottom: '5px' }}>{fmt(cashSalesAmount)}</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{cashBillsCount} bills</div>
          </div>
          <div style={{ position: 'absolute', top: '15px', right: '15px', color: '#10B981', fontWeight: 'bold', fontSize: '0.85rem', backgroundColor: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
            {cashPercent}%
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #6366F1', display: 'flex', gap: '15px', position: 'relative' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#E0E7FF', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Smartphone size={20} color="#4F46E5" />
          </div>
          <div>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '5px' }}>UPI SALES</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#6366F1', marginBottom: '5px' }}>{fmt(upiSalesAmount)}</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{upiBillsCount} bills</div>
          </div>
          <div style={{ position: 'absolute', top: '15px', right: '15px', color: '#6366F1', fontWeight: 'bold', fontSize: '0.85rem', backgroundColor: '#EEF2FF', padding: '2px 6px', borderRadius: '4px' }}>
            {upiPercent}%
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #F59E0B', display: 'flex', gap: '15px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <TrendingUp size={20} color="#D97706" />
          </div>
          <div>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '5px' }}>TOTAL GST</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#F59E0B', marginBottom: '5px' }}>{fmt(totalGST)}</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Incl. in revenue</div>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <CreditCard size={18} color="#0F172A" />
          <h4 style={{ margin: 0, color: '#0F172A', fontSize: '1.1rem' }}>Payment Mode Bifurcation</h4>
        </div>
        <div style={{ height: '24px', backgroundColor: '#E2E8F0', borderRadius: '12px', display: 'flex', overflow: 'hidden', marginBottom: '15px' }}>
          <div style={{ width: `${cashPercent}%`, backgroundColor: '#34D399', height: '100%' }}></div>
          <div style={{ width: `${upiPercent}%`, backgroundColor: '#8B5CF6', height: '100%' }}></div>
        </div>
        <div style={{ display: 'flex', gap: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#34D399' }}></div>
            <span style={{ fontSize: '0.9rem', color: '#475569' }}>💵 Cash</span>
            <span style={{ fontWeight: 'bold', color: '#0F172A', marginLeft: '5px' }}>{fmt(cashSalesAmount)}</span>
            <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>({cashPercent}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8B5CF6' }}></div>
            <span style={{ fontSize: '0.9rem', color: '#475569' }}>📱 UPI</span>
            <span style={{ fontWeight: 'bold', color: '#0F172A', marginLeft: '5px' }}>{fmt(upiSalesAmount)}</span>
            <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>({upiPercent}%)</span>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <BarChart2 size={18} color="#0F172A" />
          <h4 style={{ margin: 0, color: '#0F172A', fontSize: '1.1rem' }}>Day-wise Sales</h4>
        </div>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayWiseSalesData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {dayWiseSalesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#E2E8F0" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <FileText size={18} color="#0F172A" />
          <h4 style={{ margin: 0, color: '#0F172A', fontSize: '1.1rem' }}>Bill-wise Detail</h4>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>BILL NO</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>CUSTOMER</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>DATE & TIME</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>PAYMENT</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>DISCOUNT</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>GST</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>TOTAL</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map(s => {
              const customer = state.customers?.find(c => c.id === s.customerId);
              const isUPI = ['UPI', 'Card', 'RTGS', 'NEFT', 'Cheque'].includes(s.paymentMode);
              const gstApprox = s.grandTotal * 0.15; // dummy approx
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
                      #{s.id.slice(-6)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '0.9rem', color: '#1E293B' }}>
                    {customer ? customer.name : '—'}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '0.9rem', color: '#64748B' }}>
                    {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })},{' '}
                    {new Date(s.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: isUPI ? '#EEF2FF' : '#ECFDF5', padding: '4px 8px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', color: isUPI ? '#4F46E5' : '#059669' }}>
                      {isUPI ? <Smartphone size={12} /> : <Banknote size={12} />}
                      {isUPI ? 'UPI' : 'Cash'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.9rem', color: '#10B981' }}>
                    —
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.9rem', color: '#94A3B8' }}>
                    {fmt(gstApprox)}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '1rem', fontWeight: 'bold', color: '#10B981' }}>
                    {fmt(s.grandTotal)}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                      <button onClick={() => setSelectedSale(s)} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#64748B' }}>
                        <Eye size={14} />
                      </button>
                      <button onClick={() => { dispatch({ type: 'SET_CART', payload: s.items }); dispatch({ type: 'SET_EDITING_SALE', payload: s.id }); window.location.href = '/billing'; }} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#64748B' }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteSale(s.id)} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#EF4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredSales.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>No sales found for the selected period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
