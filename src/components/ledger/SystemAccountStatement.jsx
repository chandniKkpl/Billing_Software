import { useMemo } from 'react';

export default function SystemAccountStatement({ type, state }) {
  const statementData = useMemo(() => {
    let combinedTxns = [];
    
    // 1. Ledger Transactions matching payment mode or type
    const manualTxns = (state.ledgerTransactions || []).filter(t => {
      if (type === 'Cash') return t.paymentMode === 'Cash';
      if (type === 'Bank') return ['Bank/Online', 'UPI', 'Cheque'].includes(t.paymentMode);
      if (type === 'Income') {
        if (t.type === 'Income') return true;
        const acc = state.accounts?.find(a => a.id === t.accountId);
        return acc && acc.type === 'Income';
      }
      if (type === 'Expenditure') {
        if (t.type === 'Expense') return true;
        const acc = state.accounts?.find(a => a.id === t.accountId);
        return acc && acc.type === 'Expenditure';
      }
      return false;
    });
    
    manualTxns.forEach(t => {
      let amountIn = 0;
      let amountOut = 0;
      
      if (type === 'Cash' || type === 'Bank') {
        if (['Payment', 'Spend', 'Expense', 'Deduct'].includes(t.type)) {
          amountOut = t.amount;
        } else if (['Receive', 'Add', 'Income'].includes(t.type)) {
          amountIn = t.amount;
        } else if (t.type === 'Borrow') {
          if (t.vendorId) amountIn = t.amount; 
          else amountOut = t.amount; 
        } else {
           amountIn = t.amount; 
        }
      } else if (type === 'Income') {
        amountIn = t.amount; // Income comes in
      } else if (type === 'Expenditure') {
        amountOut = t.amount; // Expenses go out
      }
      
      let accName = 'System';
      if (t.vendorId) accName = state.vendors?.find(v => v.id === t.vendorId)?.name || 'Vendor';
      else if (t.customerId) accName = state.customers?.find(c => c.id === t.customerId)?.name || 'Customer';
      else if (t.accountId) accName = state.accounts?.find(a => a.id === t.accountId)?.name || 'Account';

      combinedTxns.push({
        id: t.id,
        date: t.date || new Date(parseInt(t.id)).toISOString(),
        particulars: `${accName} - ${t.type}`,
        vchNo: t.id.slice(-4),
        in: amountIn,
        out: amountOut
      });
    });

    // 2. Sales & Purchases
    if (type === 'Cash' || type === 'Bank') {
      const paymentMode = type === 'Cash' ? 'Cash' : ['Bank/Online', 'UPI', 'Cheque'];
      const sales = (state.sales || []).filter(s => 
        Array.isArray(paymentMode) ? paymentMode.includes(s.paymentMode) : s.paymentMode === paymentMode
      );
      sales.forEach(sale => {
        combinedTxns.push({
          id: `sale-${sale.id}`,
          date: sale.date || new Date().toISOString(),
          particulars: `Sale to ${sale.customerName || 'Walk-in'}`,
          vchNo: String(sale.id).slice(-4),
          in: sale.grandTotal,
          out: 0
        });
      });

      const purchases = (state.purchases || []).filter(p => 
        Array.isArray(paymentMode) ? paymentMode.includes(p.paymentMode) : p.paymentMode === paymentMode
      );
      purchases.forEach(p => {
        combinedTxns.push({
          id: `pur-${p.id}`,
          date: p.date || new Date().toISOString(),
          particulars: `Purchase from ${p.vendorName || 'Vendor'}`,
          vchNo: String(p.id).slice(-4),
          in: 0,
          out: p.grandTotal
        });
      });
    } else if (type === 'Income') {
      const sales = state.sales || [];
      sales.forEach(sale => {
        combinedTxns.push({
          id: `sale-${sale.id}`,
          date: sale.date || new Date().toISOString(),
          particulars: `Sale to ${sale.customerName || 'Walk-in'}`,
          vchNo: String(sale.id).slice(-4),
          in: sale.grandTotal,
          out: 0
        });
      });
    } else if (type === 'Expenditure') {
      const purchases = state.purchases || [];
      purchases.forEach(p => {
        combinedTxns.push({
          id: `pur-${p.id}`,
          date: p.date || new Date().toISOString(),
          particulars: `Purchase from ${p.vendorName || 'Vendor'}`,
          vchNo: String(p.id).slice(-4),
          in: 0,
          out: p.grandTotal
        });
      });
    }

    combinedTxns.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let runBal = 0;
    const enrichedTxns = combinedTxns.map(t => {
      runBal += Number(t.in || 0);
      runBal -= Number(t.out || 0);
      return { ...t, runningBalance: runBal };
    });
    
    return { txns: enrichedTxns, currentBalance: runBal };
  }, [state, type]);

  return (
    <div className="card" style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', borderBottom: '2px solid var(--border)', paddingBottom: '10px' }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: 'var(--primary)' }}>System {type} Account</h3>
          <p style={{ margin: 0, color: 'var(--text3)' }}>Auto-generated {type} ledger from all transactions</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 2px 0', color: 'var(--text3)', fontSize: '0.9rem' }}>Closing Balance</p>
          <h3 style={{ margin: 0, color: statementData.currentBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
            ₹{Math.abs(statementData.currentBalance).toFixed(2)}
          </h3>
        </div>
      </div>

      <div className="table-container" style={{ margin: '0 20px 20px' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '12px 10px', textAlign: 'center' }}>Date</th>
              <th style={{ padding: '12px 10px', textAlign: 'left' }}>Particulars</th>
              <th style={{ padding: '12px 10px', textAlign: 'center' }}>Vch No</th>
              <th style={{ padding: '12px 10px', textAlign: 'right' }}>In (+)</th>
              <th style={{ padding: '12px 10px', textAlign: 'right' }}>Out (-)</th>
              <th style={{ padding: '12px 10px', textAlign: 'right' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {statementData.txns.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>{new Date(t.date).toLocaleDateString()}</td>
                <td style={{ padding: '12px 10px' }}>{t.particulars}</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#94a3b8' }}>{t.vchNo}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--green)' }}>{t.in > 0 ? `₹${Number(t.in).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--red)' }}>{t.out > 0 ? `₹${Number(t.out).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold' }}>₹{Number(t.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
            {statementData.txns.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No {type} transactions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
