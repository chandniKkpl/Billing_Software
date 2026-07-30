import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Paperclip } from 'lucide-react';

export default function AccountStatement({ 
  account, activeTab, state, 
  deleteVendor, deleteCustomer, deleteAccount, 
  setEditingVendor, setVendorForm, setShowVendorModal, 
  setTxnForm, setShowTxnModal, openFile 
}) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const statementData = useMemo(() => {
    if (!account) return { openingBalance: 0, txns: [], currentBalance: 0 };
    
    let combinedTxns = [];

    // 1. Get manual ledger transactions
    const manualTxns = (state.ledgerTransactions || []).filter(t => t.vendorId === account.id || t.customerId === account.id || t.accountId === account.id);
    manualTxns.forEach(t => {
      let drAmount = 0;
      let crAmount = 0;
      let vchType = 'Journal';
      let drAccountName = '';
      let crAccountName = '';
      let narration = t.notes || 'Being transaction recorded';
      
      if (['Payment', 'Spend', 'Expense', 'Borrow', 'Add', 'Debit Note'].includes(t.type)) {
        drAmount = t.amount;
        vchType = t.type;
        drAccountName = `${account.name} A/c`;
        crAccountName = `${t.paymentMode || 'Cash'} A/c`;
      } else {
        crAmount = t.amount;
        vchType = t.type;
        drAccountName = `${t.paymentMode || 'Cash'} A/c`;
        crAccountName = `${account.name} A/c`;
      }

      let particularsText = t.type;
      if (['Payment', 'Borrow', 'Spend', 'Deduct'].includes(t.type)) particularsText = 'Payment Given';
      if (['Receive', 'Add'].includes(t.type)) particularsText = 'Payment Received';
      if (['Credit Note', 'Debit Note'].includes(t.type)) particularsText = 'Goods Returned';

      combinedTxns.push({
        id: t.id,
        date: t.date || new Date(parseInt(t.id)).toISOString(),
        drAccountName,
        crAccountName,
        narration,
        amount: t.amount,
        particulars: particularsText + (t.paymentMode && t.paymentMode !== 'Accrual' ? ` (${t.paymentMode})` : '') + (t.notes ? ` - ${t.notes}` : ''),
        vchType: vchType,
        vchNo: t.id.slice(-4),
        debit: drAmount,
        credit: crAmount,
        hasFile: t.hasFile,
        txnId: t.id
      });
    });

    // 2. Combine Sales data if it's a Customer
    if (activeTab === 'Customer' && state.sales) {
      const customerSales = state.sales.filter(s => String(s.customerId) === String(account.id));
      customerSales.forEach(sale => {
        // Core Sale Amount (excluding freight/labor from grandTotal)
        const itemAmount = (sale.grandTotal || 0) - (sale.labor || 0) - (sale.freight || 0);

        // Sale Voucher (Debit Customer)
        if (itemAmount > 0) {
          combinedTxns.push({
            id: `sale-${sale.id}`,
            date: sale.date || new Date().toISOString(),
            drAccountName: `${account.name} A/c`,
            crAccountName: `Sales A/c`,
            narration: `Being goods sold on credit`,
            amount: itemAmount,
            particulars: 'Goods Purchased',
            vchType: 'Sales',
            vchNo: String(sale.id).slice(-4),
            debit: itemAmount,
            credit: 0
          });
        }

        // Labor Charges (Debit Customer)
        if (sale.labor && sale.labor > 0) {
          combinedTxns.push({
            id: `labor-${sale.id}`,
            date: sale.date || new Date().toISOString(),
            drAccountName: `${account.name} A/c`,
            crAccountName: `Labour A/c`,
            narration: `Labour charges on sale`,
            amount: sale.labor,
            particulars: 'Labour Charges',
            vchType: 'Sales',
            vchNo: String(sale.id).slice(-4),
            debit: sale.labor,
            credit: 0
          });
        }

        // Freight Charges (Debit Customer)
        if (sale.freight && sale.freight > 0) {
          combinedTxns.push({
            id: `freight-${sale.id}`,
            date: sale.date || new Date().toISOString(),
            drAccountName: `${account.name} A/c`,
            crAccountName: `Freight A/c`,
            narration: `Freight Sale`,
            amount: sale.freight,
            particulars: 'Freight Charges',
            vchType: 'Sales',
            vchNo: String(sale.id).slice(-4),
            debit: sale.freight,
            credit: 0
          });
        }

        // Receipt Voucher (Credit Customer)
        const amountReceived = sale.paymentMode === 'Debt' ? Number(sale.cashPaid || 0) : sale.grandTotal;
        if (amountReceived > 0) {
          combinedTxns.push({
            id: `rect-${sale.id}`,
            date: sale.date || new Date().toISOString(),
            drAccountName: `${sale.paymentMode === 'Debt' ? 'Cash' : sale.paymentMode} A/c`,
            crAccountName: `${account.name} A/c`,
            narration: sale.paymentMode === 'Debt' ? `Advance received against sale` : `Being payment received against sale`,
            amount: amountReceived,
            particulars: 'Payment Received',
            vchType: 'Receipt',
            vchNo: String(sale.id).slice(-4),
            debit: 0,
            credit: amountReceived
          });
        }
      });
    }
    
    // 3. Combine Purchase data if it's a Vendor
    if (activeTab === 'Vendor' && state.purchases) {
      const vendorPurchases = state.purchases.filter(p => String(p.vendorId) === String(account.id));
      vendorPurchases.forEach(purchase => {
        // Core Purchase Amount (excluding freight/labor from grandTotal)
        const itemAmount = (purchase.grandTotal || 0) - (purchase.labor || 0) - (purchase.freight || 0);

        // Purchase Voucher (Credit to Vendor)
        if (itemAmount > 0) {
          combinedTxns.push({
            id: `purc-${purchase.id}`,
            date: purchase.date || new Date().toISOString(),
            drAccountName: `Purchase A/c`,
            crAccountName: `${account.name} A/c`,
            narration: `Being goods purchased on credit`,
            amount: itemAmount,
            particulars: 'Goods Purchased',
            vchType: 'Purchase',
            vchNo: purchase.purchaseBillNo || String(purchase.id).slice(-4),
            debit: 0,
            credit: itemAmount
          });
        }

        // Labor Charges (Credit to Vendor)
        if (purchase.labor && purchase.labor > 0) {
          combinedTxns.push({
            id: `labor-${purchase.id}`,
            date: purchase.date || new Date().toISOString(),
            drAccountName: `Labour A/c`,
            crAccountName: `${account.name} A/c`,
            narration: `Labour Purchase`,
            amount: purchase.labor,
            particulars: 'Labour Charges',
            vchType: 'Purchase',
            vchNo: purchase.purchaseBillNo || String(purchase.id).slice(-4),
            debit: 0,
            credit: purchase.labor
          });
        }

        // Freight Charges (Credit to Vendor)
        if (purchase.freight && purchase.freight > 0) {
          combinedTxns.push({
            id: `freight-${purchase.id}`,
            date: purchase.date || new Date().toISOString(),
            drAccountName: `Freight A/c`,
            crAccountName: `${account.name} A/c`,
            narration: `Freight Purchase`,
            amount: purchase.freight,
            particulars: 'Freight Charges',
            vchType: 'Purchase',
            vchNo: purchase.purchaseBillNo || String(purchase.id).slice(-4),
            debit: 0,
            credit: purchase.freight
          });
        }

        // Payment Voucher (Debit from Vendor) if not Debt
        if (purchase.paymentMode && purchase.paymentMode !== 'Debt' && purchase.paymentMode !== 'Credit') {
          combinedTxns.push({
            id: `pay-${purchase.id}`,
            date: purchase.date || new Date().toISOString(),
            drAccountName: `${account.name} A/c`,
            crAccountName: `${purchase.paymentMode} A/c`,
            narration: `Being payment made against purchase`,
            amount: purchase.grandTotal,
            particulars: 'Payment Given',
            vchType: 'Payment',
            vchNo: purchase.purchaseBillNo || String(purchase.id).slice(-4),
            debit: purchase.grandTotal,
            credit: 0
          });
        }
      });
    }

    // 4. Combine Freight / Labour data for Expenditure or Income accounts
    if ((['Expenditure', 'Income', 'Master'].includes(account.type) || ['Expenditure', 'Income', 'Master'].includes(activeTab)) && (state.sales || state.purchases)) {
      const accName = account.name.toLowerCase();
      const isFreightSale = (accName.includes('freight') || accName.includes('frieght')) && accName.includes('sale');
      const isFreightPurchase = (accName.includes('freight') || accName.includes('frieght')) && accName.includes('purchase');
      const isLaborSale = (accName.includes('labor') || accName.includes('labour')) && accName.includes('sale');
      const isLaborPurchase = (accName.includes('labor') || accName.includes('labour')) && accName.includes('purchase');

      const isGenericFreight = (accName.includes('freight') || accName.includes('frieght')) && !accName.includes('sale') && !accName.includes('purchase');
      const isGenericLabor = (accName.includes('labor') || accName.includes('labour')) && !accName.includes('sale') && !accName.includes('purchase');

      if (isFreightSale || isFreightPurchase || isLaborSale || isLaborPurchase || isGenericFreight || isGenericLabor) {
        // From Sales (Income)
        (state.sales || []).forEach(sale => {
          if ((isFreightSale || isGenericFreight) && sale.freight && sale.freight > 0) {
            combinedTxns.push({
              id: `sale-freight-${sale.id}`,
              date: sale.date || new Date().toISOString(),
              drAccountName: `${state.customers?.find(c => c.id === sale.customerId)?.name || 'Customer'} A/c`,
              crAccountName: account.name,
              narration: `Freight Sale #${String(sale.id).slice(-4)}`,
              amount: sale.freight,
              particulars: `By ${state.customers?.find(c => c.id === sale.customerId)?.name || 'Customer'} A/c`,
              vchType: 'Sales',
              vchNo: String(sale.id).slice(-4),
              debit: 0,
              credit: sale.freight
            });
          }
          if ((isLaborSale || isGenericLabor) && sale.labor && sale.labor > 0) {
            combinedTxns.push({
              id: `sale-labor-${sale.id}`,
              date: sale.date || new Date().toISOString(),
              drAccountName: `${state.customers?.find(c => c.id === sale.customerId)?.name || 'Customer'} A/c`,
              crAccountName: account.name,
              narration: `Labour Sale #${String(sale.id).slice(-4)}`,
              amount: sale.labor,
              particulars: `By ${state.customers?.find(c => c.id === sale.customerId)?.name || 'Customer'} A/c`,
              vchType: 'Sales',
              vchNo: String(sale.id).slice(-4),
              debit: 0,
              credit: sale.labor
            });
          }
        });

        // From Purchases (Expense)
        (state.purchases || []).forEach(purchase => {
          if ((isFreightPurchase || isGenericFreight) && purchase.freight && purchase.freight > 0) {
            combinedTxns.push({
              id: `purc-freight-${purchase.id}`,
              date: purchase.date || new Date().toISOString(),
              drAccountName: account.name,
              crAccountName: `${state.vendors?.find(v => v.id === purchase.vendorId)?.name || 'Vendor'} A/c`,
              narration: `Freight Purchase #${purchase.purchaseBillNo || String(purchase.id).slice(-4)}`,
              amount: purchase.freight,
              particulars: `To ${state.vendors?.find(v => v.id === purchase.vendorId)?.name || 'Vendor'} A/c`,
              vchType: 'Purchase',
              vchNo: purchase.purchaseBillNo || String(purchase.id).slice(-4),
              debit: purchase.freight,
              credit: 0
            });
          }
          if ((isLaborPurchase || isGenericLabor) && purchase.labor && purchase.labor > 0) {
            combinedTxns.push({
              id: `purc-labor-${purchase.id}`,
              date: purchase.date || new Date().toISOString(),
              drAccountName: account.name,
              crAccountName: `${state.vendors?.find(v => v.id === purchase.vendorId)?.name || 'Vendor'} A/c`,
              narration: `Labour Purchase #${purchase.purchaseBillNo || String(purchase.id).slice(-4)}`,
              amount: purchase.labor,
              particulars: `To ${state.vendors?.find(v => v.id === purchase.vendorId)?.name || 'Vendor'} A/c`,
              vchType: 'Purchase',
              vchNo: purchase.purchaseBillNo || String(purchase.id).slice(-4),
              debit: purchase.labor,
              credit: 0
            });
          }
        });
      }
    }

    // 5. Combine Sales Revenue for Sales/Income Accounts
    if ((['Income', 'Master'].includes(account.type) || ['Income', 'Master'].includes(activeTab)) && state.sales) {
      const accName = (account.name || '').toLowerCase();
      const isFreight = accName.includes('freight') || accName.includes('frieght');
      const isLabor = accName.includes('labor') || accName.includes('labour');
      const isSalesAccount = (accName.includes('sale') || accName.includes('rev') || accName.includes('income') || (!isFreight && !isLabor));

      if (isSalesAccount && !isFreight && !isLabor) {
        state.sales.forEach(sale => {
          const itemAmount = (sale.grandTotal || 0) - (sale.labor || 0) - (sale.freight || 0);
          if (itemAmount > 0) {
            combinedTxns.push({
              id: `sale-rev-${sale.id}`,
              date: sale.date || new Date().toISOString(),
              drAccountName: `${sale.customerName || 'Walk-in Customer'} A/c`,
              crAccountName: account.name,
              narration: `Sale #${sale.billNo ? String(sale.billNo).padStart(4, '0') : String(sale.id).slice(-4)}`,
              amount: itemAmount,
              particulars: `By ${sale.customerName || 'Walk-in'} (${sale.paymentMode || 'Cash'})`,
              vchType: 'Sales',
              vchNo: String(sale.billNo || sale.id).slice(-4),
              debit: 0,
              credit: itemAmount
            });
          }
        });
      }
    }

    // 6. Combine Transactions for Cash and Bank Accounts
    if ((['Cash', 'Bank'].includes(account.type) || ['Cash', 'Bank'].includes(activeTab))) {
      const isCash = activeTab === 'Cash' || account.type === 'Cash' || (account.name || '').toLowerCase().includes('cash');
      const modeMatch = isCash ? ['Cash'] : ['Bank', 'Bank/Online', 'UPI', 'Cheque', 'Online'];
      (state.sales || []).forEach(sale => {
        const isDebtPartial = sale.paymentMode === 'Debt' && Number(sale.cashPaid) > 0;
        const actualMode = isDebtPartial ? 'Cash' : sale.paymentMode;
        if (modeMatch.includes(actualMode)) {
          const amt = isDebtPartial ? Number(sale.cashPaid) : sale.grandTotal;
          if (amt > 0) {
            combinedTxns.push({
              id: `cash-sale-${sale.id}`,
              date: sale.date || new Date().toISOString(),
              drAccountName: account.name,
              crAccountName: `Sales A/c`,
              narration: `Sale Receipt #${sale.billNo ? String(sale.billNo).padStart(4, '0') : String(sale.id).slice(-4)}`,
              amount: amt,
              particulars: `To Sales (${sale.customerName || 'Walk-in'})`,
              vchType: 'Receipt',
              vchNo: String(sale.billNo || sale.id).slice(-4),
              debit: amt,
              credit: 0
            });
          }
        }
      });
      (state.purchases || []).forEach(purchase => {
        if (modeMatch.includes(purchase.paymentMode) && (purchase.grandTotal || 0) > 0) {
          combinedTxns.push({
            id: `cash-pur-${purchase.id}`,
            date: purchase.date || new Date().toISOString(),
            drAccountName: `Purchase A/c`,
            crAccountName: account.name,
            narration: `Purchase Payment #${purchase.purchaseBillNo || String(purchase.id).slice(-4)}`,
            amount: purchase.grandTotal,
            particulars: `By Purchase (${purchase.vendorName || 'Vendor'})`,
            vchType: 'Payment',
            vchNo: String(purchase.purchaseBillNo || purchase.id).slice(-4),
            debit: 0,
            credit: purchase.grandTotal
          });
        }
      });
    }

    // Sort chronologically
    combinedTxns.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Apply date filters
    if (fromDate) {
      const fromD = new Date(fromDate);
      fromD.setHours(0,0,0,0);
      combinedTxns = combinedTxns.filter(t => new Date(t.date) >= fromD);
    }
    if (toDate) {
      const toD = new Date(toDate);
      toD.setHours(23,59,59,999);
      combinedTxns = combinedTxns.filter(t => new Date(t.date) <= toD);
    }

    let netChange = 0;
    combinedTxns.forEach(t => {
      if (['Income', 'Vendor', 'Employee'].includes(activeTab) || ['Income', 'Vendor', 'Employee'].includes(account.type)) {
        netChange += t.credit;
        netChange -= t.debit;
      } else {
        netChange += t.debit;
        netChange -= t.credit;
      }
    });

    const isCustomerOrVendor = ['Customer', 'Vendor', 'Employee'].includes(activeTab) || ['Customer', 'Vendor', 'old', 'Employee'].includes(account.type);
    const baseBalance = account.udhaarBalance !== undefined ? account.udhaarBalance : (account.balance || 0);
    const openingBalance = isCustomerOrVendor ? (baseBalance - netChange) : Number(account.balance || 0);
    
    let runBal = openingBalance;
    const enrichedTxns = combinedTxns.map(t => {
      if (['Income', 'Vendor', 'Employee'].includes(activeTab) || ['Income', 'Vendor', 'Employee'].includes(account.type)) {
        runBal += t.credit;
        runBal -= t.debit;
      } else {
        runBal += t.debit;
        runBal -= t.credit;
      }
      return { ...t, runningBalance: runBal };
    });
    
    const currentBalance = isCustomerOrVendor ? baseBalance : runBal;
    return { openingBalance, txns: enrichedTxns, currentBalance }; 
  }, [account, state.ledgerTransactions, state.sales, state.purchases, activeTab, fromDate, toDate]);

  const txnsForList = statementData.txns;

  const currentMonthAdvances = useMemo(() => {
    if (activeTab !== 'Employee' || !account.monthlySalary) return 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let advances = 0;
    (state.ledgerTransactions || []).forEach(t => {
      if (t.accountId === account.id && ['Payment', 'Spend'].includes(t.type)) {
        const tDate = new Date(t.date || parseInt(t.id));
        if (tDate >= startOfMonth) {
          advances += Number(t.amount) || 0;
        }
      }
    });
    return advances;
  }, [state.ledgerTransactions, activeTab, account]);

  const isPositiveGreen = !['Customer'].includes(activeTab) && account.type !== 'old';

  return (
    <div className="card" style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', borderBottom: '2px solid var(--border)', paddingBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: 'var(--primary)' }}>{account.name}</h3>
          {account.phone && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text3)' }}>Ph: {account.phone}</p>}
          {account.pan ? <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text3)' }}>PAN: <strong>{account.pan}</strong></p> : null}
          {(account.gstNo || account.gst) ? <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text3)' }}>GST: <strong>{account.gstNo || account.gst}</strong></p> : null}
          {account.dueDate && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--danger)', fontWeight: '600' }}>Next Due: {account.dueDate}</p>}
        </div>
        <div style={{ textAlign: 'right', marginLeft: '10px' }}>
          <p style={{ margin: '0 0 2px 0', color: 'var(--text3)', fontSize: '0.85rem' }}>Closing Balance</p>
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', color: isPositiveGreen ? (statementData.currentBalance >= 0 ? 'var(--green)' : 'var(--danger)') : (statementData.currentBalance > 0 ? 'var(--danger)' : 'var(--green)') }}>
            ₹{Math.abs(statementData.currentBalance).toFixed(2)}
          </h3>
        </div>
      </div>

      {activeTab === 'Employee' && account.monthlySalary ? (
        <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', marginTop: '10px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Monthly Salary:</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0F172A' }}>₹{Number(account.monthlySalary).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Advances (This Month):</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--danger)' }}>- ₹{currentMonthAdvances.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0F172A' }}>Remaining Salary:</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--green)' }}>₹{Math.max(0, Number(account.monthlySalary) - currentMonthAdvances).toFixed(2)}</span>
          </div>
        </div>
      ) : null}

      <div style={{ paddingBottom: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, marginRight: '10px' }}>
          <input type="date" className="input" style={{ flex: 1 }} value={fromDate} onChange={e => setFromDate(e.target.value)} title="From Date" />
          <input type="date" className="input" style={{ flex: 1 }} value={toDate} onChange={e => setToDate(e.target.value)} title="To Date" />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setTxnForm({ targetAccount: account, type: activeTab === 'Customer' ? 'Receive' : 'Payment', amount: '', notes: '', file: null, fileName: '', paymentMode: 'Cash' }); setShowTxnModal(true); }}>
          <Plus size={16} /> Add Entry
        </button>
      </div>

      <div className="table-container" style={{ marginTop: '10px' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 10px', width: '80px', textAlign: 'center', fontWeight: 'bold' }}>Date</th>
              <th style={{ padding: '12px 10px', width: '100px', textAlign: 'center', fontWeight: 'bold' }}>Voucher No.</th>
              <th style={{ padding: '12px 10px', width: '80px', textAlign: 'center', fontWeight: 'bold' }}>Type</th>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 'bold' }}>Particulars</th>
              <th style={{ padding: '12px 10px', width: '100px', textAlign: 'right', fontWeight: 'bold' }}>Debit (₹)</th>
              <th style={{ padding: '12px 10px', width: '100px', textAlign: 'right', fontWeight: 'bold' }}>Credit (₹)</th>
              <th style={{ padding: '12px 10px', width: '120px', textAlign: 'right', fontWeight: 'bold' }}>Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '12px 10px', textAlign: 'center', color: '#6b7280' }}>-</td>
              <td style={{ padding: '12px 10px', textAlign: 'center', color: '#6b7280' }}>-</td>
              <td style={{ padding: '12px 10px', textAlign: 'center', color: '#6b7280' }}>Opening</td>
              <td style={{ padding: '12px 10px', color: '#4b5563' }}>Opening Balance</td>
              <td style={{ padding: '12px 10px', textAlign: 'right', color: '#4b5563' }}>
                {statementData.openingBalance > 0 ? statementData.openingBalance.toFixed(2) : '-'}
              </td>
              <td style={{ padding: '12px 10px', textAlign: 'right', color: '#4b5563' }}>
                {statementData.openingBalance < 0 ? Math.abs(statementData.openingBalance).toFixed(2) : '-'}
              </td>
              <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '500', color: '#111827' }}>
                {Math.abs(statementData.openingBalance).toFixed(2)} {statementData.openingBalance >= 0 ? 'Dr' : 'Cr'}
              </td>
            </tr>

            {txnsForList.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#ffffff' }}>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#4b5563', fontSize: '0.85rem' }}>
                  {new Date(t.date).toLocaleDateString('en-GB')}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#4b5563', fontSize: '0.85rem' }}>
                  {t.vchType === 'Sales' ? 'INV-' : (t.vchType === 'Receipt' ? 'REC-' : 'VCH-')}{t.vchNo}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#4b5563', fontSize: '0.85rem' }}>
                  {t.vchType}
                </td>
                <td style={{ padding: '12px 10px', color: '#4b5563', fontSize: '0.85rem' }}>
                  {t.narration || t.particulars}
                  {t.hasFile && (
                    <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', marginLeft: '5px', display: 'inline' }} onClick={() => openFile(t.txnId)} title="View Receipt">
                      <Paperclip size={12} color="var(--primary)" />
                    </button>
                  )}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>
                  {t.debit > 0 ? t.debit.toFixed(2) : '-'}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right', color: '#4b5563', fontSize: '0.85rem' }}>
                  {t.credit > 0 ? t.credit.toFixed(2) : '-'}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '500', color: '#111827', fontSize: '0.85rem' }}>
                  {Math.abs(t.runningBalance).toFixed(2)} {t.runningBalance >= 0 ? 'Dr' : 'Cr'}
                </td>
              </tr>
            ))}

            {txnsForList.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No transactions recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { 
          setEditingVendor(account); 
          setVendorForm({
            ...account,
            balance: Math.abs(account.balance || 0),
            balanceType: (account.balance || 0) < 0 ? 'Give' : 'Take',
            notes: account.notes || '',
            monthlySalary: account.monthlySalary || '',
            salaryDate: account.salaryDate || ''
          }); 
          setShowVendorModal(true); 
        }}>
          <Edit2 size={14} style={{marginRight:4}}/> Edit Account
        </button>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => {
          if (activeTab === 'Vendor') deleteVendor(account.id);
          else if (activeTab === 'Customer') deleteCustomer(account.id);
          else deleteAccount(account.id);
        }}>
          <Trash2 size={14} style={{marginRight:4}}/> Delete Account
        </button>
      </div>
    </div>
  );
}
