import { Banknote, TrendingUp } from 'lucide-react';

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function BalanceSheet({ fin }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Banknote size={20} color="#059669" />
          <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.25rem' }}>Assets (What you own)</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#475569' }}>Fixed Assets</span><span style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.fixedAssetsVal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#475569' }}>Inventory (Stock)</span><span style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.inventoryVal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#475569' }}>Customers (Receivables)</span><span style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.customersDr)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#475569' }}>Cash & Bank Balance</span><span style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.cashBankDr)}</span></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #E2E8F0' }}>
          <span style={{ fontWeight: 'bold', color: '#059669', fontSize: '1.1rem' }}>Total Assets</span>
          <span style={{ fontWeight: 'bold', color: '#059669', fontSize: '1.1rem' }}>{fmt(fin.fixedAssetsVal + fin.inventoryVal + fin.customersDr + fin.cashBankDr)}</span>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <TrendingUp size={20} color="#EF4444" />
          <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.25rem' }}>Liabilities (What you owe)</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#475569' }}>Vendors (Payables)</span><span style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.vendorsCr)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#475569' }}>Customer Advances</span><span style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.customersCr)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#475569' }}>Other Credit Balances</span><span style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.otherCr + fin.cashBankCr)}</span></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #E2E8F0' }}>
          <span style={{ fontWeight: 'bold', color: '#EF4444', fontSize: '1.1rem' }}>Total Liabilities</span>
          <span style={{ fontWeight: 'bold', color: '#EF4444', fontSize: '1.1rem' }}>{fmt(fin.vendorsCr + fin.customersCr + fin.otherCr + fin.cashBankCr)}</span>
        </div>
      </div>
    </div>
  );
}
