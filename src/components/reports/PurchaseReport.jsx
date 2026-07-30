import { useMemo } from 'react';
import { Calendar, FileText, Smartphone, Banknote, Edit2, Trash2, BarChart2 } from 'lucide-react';

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function PurchaseReport({ 
  period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, 
  from, to, state, dispatch, deletePurchase 
}) {
  const filterByDate = (dateStr) => {
    const d = new Date(dateStr);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const filteredPurchases = useMemo(() => {
    let purchases = state.purchases?.filter(p => filterByDate(p.date)) || [];
    return purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.purchases, from, to]);

  const totalPurchaseAmount = filteredPurchases.reduce((a, p) => a + p.grandTotal, 0);
  const totalPurchaseBills = filteredPurchases.length;
  
  const cashPurchases = filteredPurchases.filter(p => p.paymentMode === 'Cash');
  const cashPurchasesAmount = cashPurchases.reduce((a, p) => a + p.grandTotal, 0);

  const upiPurchases = filteredPurchases.filter(p => ['UPI', 'Card', 'RTGS', 'NEFT', 'Cheque'].includes(p.paymentMode));
  const upiPurchasesAmount = upiPurchases.reduce((a, p) => a + p.grandTotal, 0);

  const pCashPercent = totalPurchaseAmount ? ((cashPurchasesAmount / totalPurchaseAmount) * 100).toFixed(1) : 0;
  const pUpiPercent = totalPurchaseAmount ? ((upiPurchasesAmount / totalPurchaseAmount) * 100).toFixed(1) : 0;

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
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} color="#F59E0B" />
          <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.25rem' }}>This {period}'s Purchases</h3>
        </div>
        <div style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '4px 12px', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
          {totalPurchaseBills} bills
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #F59E0B', display: 'flex', gap: '15px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ color: '#D97706', fontWeight: 'bold', fontSize: '1.2rem' }}>₹</span>
          </div>
          <div>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '5px' }}>TOTAL SPENDING</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0F172A', marginBottom: '5px' }}>{fmt(totalPurchaseAmount)}</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{totalPurchaseBills} transactions</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #F59E0B', display: 'flex', gap: '15px', position: 'relative' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Banknote size={20} color="#D97706" />
          </div>
          <div>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '5px' }}>CASH PURCHASES</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0F172A', marginBottom: '5px' }}>{fmt(cashPurchasesAmount)}</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{pCashPercent}% of total</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #F59E0B', display: 'flex', gap: '15px', position: 'relative' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Smartphone size={20} color="#D97706" />
          </div>
          <div>
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '5px' }}>UPI/ONLINE PURCHASES</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0F172A', marginBottom: '5px' }}>{fmt(upiPurchasesAmount)}</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{pUpiPercent}% of total</div>
          </div>
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
              <th style={{ padding: '12px 8px', textAlign: 'left', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>VENDOR</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>DATE & TIME</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>PAYMENT</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>TOTAL</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 'bold' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.map(p => {
              const vendor = state.vendors?.find(v => v.id === p.vendorId);
              const isUPI = ['UPI', 'Card', 'RTGS', 'NEFT', 'Cheque'].includes(p.paymentMode);
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
                      #{p.id.slice(-6)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '0.9rem', color: '#1E293B' }}>
                    {vendor ? vendor.name : '—'}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '0.9rem', color: '#64748B' }}>
                    {new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })},{' '}
                    {new Date(p.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: isUPI ? '#EEF2FF' : '#ECFDF5', padding: '4px 8px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', color: isUPI ? '#4F46E5' : '#059669' }}>
                      {isUPI ? <Smartphone size={12} /> : <Banknote size={12} />}
                      {isUPI ? 'UPI' : 'Cash'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '1rem', fontWeight: 'bold', color: '#F59E0B' }}>
                    {fmt(p.grandTotal)}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                      <button onClick={() => { dispatch({ type: 'SET_CART', payload: p.items }); dispatch({ type: 'SET_EDITING_PURCHASE', payload: p.id }); window.location.href = '/purchase'; }} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#64748B' }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deletePurchase(p.id)} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#EF4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredPurchases.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>No purchases found for the selected period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
