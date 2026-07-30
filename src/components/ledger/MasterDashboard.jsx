import { useMemo } from 'react';

export default function MasterDashboard({ state }) {
  const allTxns = useMemo(() => {
    const txns = [];
    
    // 1. Ledger Transactions
    (state.ledgerTransactions || []).forEach(t => {
      let accName = 'Unknown Account';
      if (t.vendorId) accName = state.vendors?.find(v => v.id === t.vendorId)?.name || 'Vendor';
      else if (t.customerId) accName = state.customers?.find(c => c.id === t.customerId)?.name || 'Customer';
      else if (t.accountId) accName = state.accounts?.find(a => a.id === t.accountId)?.name || 'Account';
      
      txns.push({
        id: t.id,
        date: t.date || new Date(parseInt(t.id)).toISOString(),
        particulars: `${accName} - ${t.type} (${t.paymentMode || 'Cash'})`,
        amount: t.amount,
        type: t.type
      });
    });

    // 2. Sales
    (state.sales || []).forEach(s => {
      txns.push({
        id: `sale-${s.id}`,
        date: s.date || new Date().toISOString(),
        particulars: `Sale to ${s.customerName || 'Walk-in'} (${s.paymentMode || 'Cash'})`,
        amount: s.grandTotal,
        type: 'Sale'
      });
    });

    // 3. Purchases
    (state.purchases || []).forEach(p => {
      txns.push({
        id: `pur-${p.id}`,
        date: p.date || new Date().toISOString(),
        particulars: `Purchase from ${p.vendorName || 'Vendor'} (${p.paymentMode || 'Cash'})`,
        amount: p.grandTotal,
        type: 'Purchase'
      });
    });

    return txns.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.ledgerTransactions, state.sales, state.purchases, state.vendors, state.customers, state.accounts]);

  return (
    <div style={{ paddingBottom: '20px' }}>
      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0 }}>All Transactions</h3>
        </div>
        <div className="table-container">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Particulars</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {allTxns.length > 0 ? allTxns.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 10px', color: '#475569' }}>{new Date(t.date).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 10px', fontWeight: '500', color: '#0f172a' }}>{t.particulars}</td>
                  <td style={{ padding: '12px 10px', color: '#64748b' }}>{t.type}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
