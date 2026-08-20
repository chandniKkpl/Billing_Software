import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '../store/AppContext';
import Receipt from '../components/Receipt';
import SalesReport from '../components/reports/SalesReport';
import PurchaseReport from '../components/reports/PurchaseReport';
import TrialBalance from '../components/reports/TrialBalance';
import BalanceSheet from '../components/reports/BalanceSheet';

function getDateRange(period, customFrom, customTo) {
  const now = new Date();
  let from, to;
  switch (period) {
    case 'Daily': {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    }
    case 'Weekly': {
      const firstDay = now.getDate() - now.getDay();
      from = new Date(now.setDate(firstDay));
      from.setHours(0,0,0,0);
      to = new Date(from);
      to.setDate(to.getDate() + 6);
      to.setHours(23,59,59,999);
      break;
    }
    case 'Monthly': {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    }
    case 'Yearly': {
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    }
    case 'Custom': {
      from = customFrom ? new Date(customFrom + 'T00:00:00') : null;
      to = customTo ? new Date(customTo + 'T23:59:59') : null;
      break;
    }
    default:
      from = null; to = null;
  }
  return { from, to };
}

export default function Reports() {
  const { state, deleteSale, deletePurchase, dispatch } = useApp();
  const [period, setPeriod] = useState('Monthly');
  const [reportTab, setReportTab] = useState('Sales'); // 'Sales' | 'Purchases' | 'Trial' | 'Balance'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams) {
      const tabParam = searchParams.get('tab');
      if (tabParam && ['Sales', 'Purchases', 'Trial', 'Balance'].includes(tabParam)) {
        setReportTab(tabParam);
      }
    }
  }, [searchParams]);

  const { from, to } = getDateRange(period, customFrom, customTo);

  const fin = useMemo(() => {
    let customersDrActual = 0, customersCr = 0, vendorsDr = 0, vendorsCr = 0;
    let cashBankDr = 0, cashBankCr = 0, incomeCr = 0, expenseDr = 0, otherDr = 0, otherCr = 0;

    (state.customers || []).forEach(c => {
      if (c.udhaarBalance < 0) customersCr += Math.abs(c.udhaarBalance);
      else customersDrActual += c.udhaarBalance || 0;
    });

    (state.vendors || []).forEach(v => {
      if (v.balance < 0) vendorsCr += Math.abs(v.balance);
      else vendorsDr += v.balance || 0;
    });

    (state.accounts || []).forEach(a => {
      const isNegative = (a.balance || 0) < 0;
      const absBal = Math.abs(a.balance || 0);
      if (['Cash', 'Bank'].includes(a.type)) {
        if (isNegative) cashBankCr += absBal; else cashBankDr += absBal;
      } else if (a.type === 'Income') {
        if (isNegative) incomeCr += absBal; else otherDr += absBal;
      } else if (a.type === 'Expenditure') {
        if (isNegative) otherCr += absBal; else expenseDr += absBal;
      } else {
        if (isNegative) otherCr += absBal; else otherDr += absBal;
      }
    });

    const inventoryVal = (state.products || []).reduce((sum, p) => sum + ((p.stock || 0) * (p.purchasePrice || 0)), 0);
    const fixedAssetsVal = (state.assets || []).reduce((sum, a) => sum + (a.value || 0), 0);
    const salesRevenueCr = (state.sales || []).reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    
    // Estimate COGS based on sales
    const cogsDr = (state.sales || []).reduce((sum, s) => {
      return sum + s.items.reduce((iSum, i) => iSum + ((i.qty || 0) * (state.products?.find(p => p.id === i.id)?.purchasePrice || 0)), 0);
    }, 0);

    const totalDr = customersDrActual + vendorsDr + cashBankDr + expenseDr + otherDr + inventoryVal + fixedAssetsVal + cogsDr;
    const totalCr = customersCr + vendorsCr + cashBankCr + incomeCr + otherCr + salesRevenueCr;

    return {
      customersDr: customersDrActual, customersCr,
      vendorsDr, vendorsCr,
      cashBankDr, cashBankCr,
      incomeCr, expenseDr,
      otherDr, otherCr,
      inventoryVal, fixedAssetsVal,
      salesRevenueCr, cogsDr,
      totalDr, totalCr
    };
  }, [state]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC' }}>
      
      {/* Header */}
      <div style={{ padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#0F172A', borderRadius: '4px' }}></div>
          <h2 style={{ margin: 0, color: '#0F172A', fontSize: '1.75rem', fontWeight: '800' }}>Reports</h2>
        </div>
        <div style={{ color: '#64748B', fontWeight: '500' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 30px', background: '#fff' }}>
        {['Sales', 'Purchases', 'Trial', 'Balance'].map(tab => (
          <div
            key={tab}
            onClick={() => setReportTab(tab)}
            style={{
              padding: '12px 24px',
              cursor: 'pointer',
              fontWeight: '600',
              color: reportTab === tab ? '#2563EB' : '#64748B',
              borderBottom: reportTab === tab ? '2px solid #2563EB' : '2px solid transparent',
            }}
          >
            {tab === 'Sales' ? 'Sales Report' : tab === 'Purchases' ? 'Purchases Report' : tab === 'Trial' ? 'Trial Balance' : 'Balance Sheet'}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
        {reportTab === 'Sales' && (
          <SalesReport 
            period={period} 
            setPeriod={setPeriod} 
            customFrom={customFrom} 
            setCustomFrom={setCustomFrom} 
            customTo={customTo} 
            setCustomTo={setCustomTo} 
            from={from} 
            to={to} 
            state={state} 
            dispatch={dispatch} 
            deleteSale={deleteSale} 
            setSelectedSale={setSelectedSale} 
          />
        )}

        {reportTab === 'Purchases' && (
          <PurchaseReport 
            period={period} 
            setPeriod={setPeriod} 
            customFrom={customFrom} 
            setCustomFrom={setCustomFrom} 
            customTo={customTo} 
            setCustomTo={setCustomTo} 
            from={from} 
            to={to} 
            state={state} 
            dispatch={dispatch} 
            deletePurchase={deletePurchase} 
          />
        )}

        {reportTab === 'Trial' && (
          <TrialBalance fin={fin} />
        )}

        {reportTab === 'Balance' && (
          <BalanceSheet fin={fin} />
        )}

      </div>
      {selectedSale && <Receipt sale={selectedSale} onClose={() => setSelectedSale(null)} setPage={(p) => window.location.href = '/' + p} />}
    </div>
  );
}
