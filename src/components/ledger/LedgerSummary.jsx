export default function LedgerSummary({ state }) {
  const cashSales = (state.sales || []).filter(s => s.paymentMode === 'Cash').reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
  const bankSales = (state.sales || []).filter(s => ['Bank/Online', 'UPI', 'Cheque'].includes(s.paymentMode)).reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
  
  const totalExpenses = (state.ledgerTransactions || []).filter(t => {
    if (t.type === 'Expense') return true;
    if (t.accountId) {
      const acc = state.accounts?.find(a => a.id === t.accountId);
      return acc && acc.type === 'Expenditure';
    }
    return false;
  }).reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const manualIncome = (state.ledgerTransactions || []).filter(t => {
    if (t.type === 'Income') return true;
    if (t.accountId) {
      const acc = state.accounts?.find(a => a.id === t.accountId);
      return acc && acc.type === 'Income';
    }
    return false;
  }).reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const salesIncome = (state.sales || []).reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
  const totalIncome = manualIncome + salesIncome;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
      <div className="card" style={{ borderLeft: '4px solid var(--green)', padding: '20px', margin: 0 }}>
        <h3 style={{ margin: '0 0 10px 0', color: 'var(--text2)', fontSize: '1.1rem' }}>Total Cash from Sales</h3>
        <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text1)' }}>₹{cashSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="card" style={{ borderLeft: '4px solid var(--primary)', padding: '20px', margin: 0 }}>
        <h3 style={{ margin: '0 0 10px 0', color: 'var(--text2)', fontSize: '1.1rem' }}>Total Bank from Sales</h3>
        <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text1)' }}>₹{bankSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="card" style={{ borderLeft: '4px solid #3b82f6', padding: '20px', margin: 0 }}>
        <h3 style={{ margin: '0 0 10px 0', color: 'var(--text2)', fontSize: '1.1rem' }}>Total Income</h3>
        <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text1)' }}>₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="card" style={{ borderLeft: '4px solid var(--red)', padding: '20px', margin: 0 }}>
        <h3 style={{ margin: '0 0 10px 0', color: 'var(--text2)', fontSize: '1.1rem' }}>Total Expenses</h3>
        <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text1)' }}>₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
      </div>
    </div>
  );
}
