import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { showToast } from '../components/Toast';
import { Plus, Edit2, Trash2, Paperclip, Briefcase, Users, Banknote, Landmark, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';
import { saveFile, getFile } from '../utils/storage';

const AccountStatement = ({ account, activeTab, state, deleteVendor, deleteCustomer, deleteAccount, setEditingVendor, setVendorForm, setShowVendorModal, setTxnForm, setShowTxnModal, openFile }) => {
  const statementData = useMemo(() => {
    if (!account) return { openingBalance: 0, txns: [], currentBalance: 0 };
    
    let combinedTxns = [];

    // 1. Get manual ledger transactions
    const manualTxns = (state.ledgerTransactions || []).filter(t => t.vendorId === account.id || t.customerId === account.id || t.accountId === account.id);
    manualTxns.forEach(t => {
      const isDr = ['Payment', 'Spend', 'Debit Note', 'Expense', 'Deduct', 'Borrow', 'Add'].includes(t.type); // For Customers, Add/Borrow is Dr (increases receivable). Wait.
      // Let's standardise Dr/Cr based on accounting principles.
      // Customer: Asset (Dr increases balance, Cr decreases balance)
      // Vendor: Liability (Cr increases balance, Dr decreases balance)
      // To keep it simple, we treat positive "runningBalance" as "Payable by them to us" (Debit Balance).
      // So Dr increases running balance, Cr decreases running balance.
      
      let drAmount = 0;
      let crAmount = 0;
      let vchType = 'Journal';
      let drAccountName = '';
      let crAccountName = '';
      let narration = t.notes || 'Being transaction recorded';
      
      if (['Payment', 'Spend', 'Expense', 'Borrow', 'Add', 'Debit Note'].includes(t.type)) {
        // We gave them money, or they borrowed -> Debit
        drAmount = t.amount;
        vchType = t.type;
        drAccountName = `${account.name} A/c`;
        crAccountName = `${t.paymentMode || 'Cash'} A/c`;
      } else {
        // We received money, or paid them back -> Credit
        crAmount = t.amount;
        vchType = t.type;
        drAccountName = `${t.paymentMode || 'Cash'} A/c`;
        crAccountName = `${account.name} A/c`;
      }

      combinedTxns.push({
        id: t.id,
        date: t.date || new Date(parseInt(t.id)).toISOString(),
        drAccountName,
        crAccountName,
        narration,
        amount: t.amount,
        particulars: (drAmount > 0 ? `To ` : `By `) + (t.paymentMode || 'Cash') + ' A/c' + (t.notes ? ` (${t.notes})` : ''),
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
        // Sale Voucher (Debit)
        combinedTxns.push({
          id: `sale-${sale.id}`,
          date: sale.date || new Date().toISOString(),
          drAccountName: `${account.name} A/c`,
          crAccountName: `Sales A/c`,
          narration: `Being goods sold on credit`,
          amount: sale.grandTotal,
          particulars: 'To Sales A/c',
          vchType: 'Sales',
          vchNo: String(sale.id),
          debit: sale.grandTotal,
          credit: 0
        });

        // Receipt Voucher (Credit) if not Debt
        if (sale.paymentMode && sale.paymentMode !== 'Debt') {
          combinedTxns.push({
            id: `rect-${sale.id}`,
            date: sale.date || new Date().toISOString(),
            drAccountName: `${sale.paymentMode} A/c`,
            crAccountName: `${account.name} A/c`,
            narration: `Being payment received against sale`,
            amount: sale.grandTotal,
            particulars: `By ${sale.paymentMode} A/c`,
            vchType: 'Receipt',
            vchNo: String(sale.id),
            debit: 0,
            credit: sale.grandTotal
          });
        }
      });
    }

    // Sort chronologically
    combinedTxns.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate net change to find the "True" opening balance (from account creation)
    let netChange = 0;
    combinedTxns.forEach(t => {
      netChange += t.debit;
      netChange -= t.credit;
    });

    // Account.balance in DB is the FINAL current balance. 
    // Opening balance = Final Balance - Net Change.
    const openingBalance = (account.balance || 0) - netChange;
    
    let runBal = openingBalance;
    const enrichedTxns = combinedTxns.map(t => {
      runBal += t.debit;
      runBal -= t.credit;
      return { ...t, runningBalance: runBal };
    });
    
    return { openingBalance, txns: enrichedTxns, currentBalance: runBal };
  }, [account, state.ledgerTransactions, state.sales, activeTab]);

  return (
    <div className="card" style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', borderBottom: '2px solid var(--border)', paddingBottom: '10px' }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: 'var(--primary)' }}>{account.name}</h3>
          <p style={{ margin: 0, color: 'var(--text3)' }}>{activeTab} Account {account.phone ? `| Ph: ${account.phone}` : ''}</p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 2px 0', color: 'var(--text3)', fontSize: '0.9rem' }}>Closing Balance</p>
            <h3 style={{ margin: 0, color: statementData.currentBalance > 0 ? 'var(--red)' : 'var(--green)' }}>
              ₹{Math.abs(statementData.currentBalance).toFixed(2)}
            </h3>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setTxnForm({ targetAccount: account, type: activeTab === 'Customer' ? 'Receive' : 'Payment', amount: '', notes: '', file: null, fileName: '', paymentMode: 'Cash' }); setShowTxnModal(true); }}>
            <Plus size={16} /> Add Txn
          </button>
        </div>
      </div>

      <div className="table-container" style={{ margin: '0 20px 20px' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '12px 10px', width: '120px', textAlign: 'center', fontWeight: '600' }}>Date</th>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: '600' }}>Particulars</th>
              <th style={{ padding: '12px 10px', width: '60px', textAlign: 'center', fontWeight: '600' }}>L.F.</th>
              <th style={{ padding: '12px 10px', width: '120px', textAlign: 'right', fontWeight: '600' }}>Debit</th>
              <th style={{ padding: '12px 10px', width: '120px', textAlign: 'right', fontWeight: '600' }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px 10px', textAlign: 'center', color: '#64748b' }}>-</td>
              <td style={{ padding: '12px 10px', fontWeight: '600', color: '#64748b', fontStyle: 'italic' }}>Opening Balance</td>
              <td style={{ padding: '12px 10px', textAlign: 'center', color: '#64748b' }}>-</td>
              <td style={{ padding: '12px 10px', textAlign: 'right', color: '#64748b' }}>-</td>
              <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>
                ₹{Math.abs(statementData.openingBalance).toFixed(2)} {statementData.openingBalance > 0 ? 'Dr' : statementData.openingBalance < 0 ? 'Cr' : ''}
              </td>
            </tr>

            {statementData.txns.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 10px', verticalAlign: 'top', textAlign: 'center', color: '#475569' }}>
                  {new Date(t.date).toLocaleDateString()}
                </td>
                <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Debit Line */}
                    <div style={{ display: 'flex' }}>
                      <div style={{ flex: 1, padding: '4px 0', fontWeight: '500', color: '#0f172a' }}>
                        {t.drAccountName} <span style={{ float: 'right', fontWeight: 'normal', color: '#64748b' }}>Dr.</span>
                      </div>
                    </div>
                    {/* Credit Line */}
                    <div style={{ display: 'flex' }}>
                      <div style={{ flex: 1, padding: '4px 0', paddingLeft: '40px', color: '#334155' }}>
                        To {t.crAccountName}
                      </div>
                    </div>
                    {/* Narration Line */}
                    <div style={{ display: 'flex' }}>
                      <div style={{ flex: 1, padding: '4px 0', fontStyle: 'italic', color: '#64748b', fontSize: '0.9rem' }}>
                        {t.narration}
                        {t.hasFile && (
                          <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', marginLeft: '5px', display: 'inline' }} onClick={() => openFile(t.txnId)} title="View Receipt">
                            <Paperclip size={12} color="var(--primary)" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 10px', verticalAlign: 'top', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                  {t.vchNo}
                </td>
                <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '4px 0', textAlign: 'right', color: '#0f172a', fontWeight: '500' }}>{Number(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div style={{ padding: '4px 0' }}>&nbsp;</div>
                    <div style={{ padding: '4px 0' }}>&nbsp;</div>
                  </div>
                </td>
                <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '4px 0' }}>&nbsp;</div>
                    <div style={{ padding: '4px 0', textAlign: 'right', color: '#0f172a', fontWeight: '500' }}>{Number(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div style={{ padding: '4px 0' }}>&nbsp;</div>
                  </div>
                </td>
              </tr>
            ))}

            {statementData.txns.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No transactions recorded yet.</td></tr>
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
};

const LedgerSummary = ({ state }) => {
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
};

const SystemAccountStatement = ({ type, state }) => {
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
};

const MasterDashboard = ({ state }) => {
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
};

export default function Ledger() {
  const { state, addVendor, updateVendor, deleteVendor, addCustomer, updateCustomer, deleteCustomer, addAccount, updateAccount, deleteAccount, addLedgerTransaction } = useApp();
  
  const [activeTab, setActiveTab] = useState('Master');
  const accountTypes = [
    { id: 'Master', icon: BookOpen },
    { id: 'Customer', icon: Users },
    { id: 'Vendor', icon: Briefcase },
    { id: 'Employee', icon: Users },
    { id: 'Cash', icon: Banknote },
    { id: 'Bank', icon: Landmark },
    { id: 'Income', icon: TrendingUp },
    { id: 'Expenditure', icon: TrendingDown },
  ];

  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', interestRate: 0, interestType: 'Monthly', balance: 0, balanceType: 'Take', fromDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '', monthlySalary: '', salaryDate: '' });
  const [editingVendor, setEditingVendor] = useState(null);
  
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [txnForm, setTxnForm] = useState({ targetAccount: null, type: 'Add', amount: '', notes: '', file: null, fileName: '', paymentMode: 'Cash' });
  const [viewingFile, setViewingFile] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  const getNormalizedList = () => {
    if (activeTab === 'Vendor') return state.vendors || [];
    if (activeTab === 'Customer') {
       return (state.customers || []).map(c => ({
         ...c,
         balance: c.udhaarBalance || 0,
         interestRate: c.interestRate || 0,
         interestType: c.interestType || 'Monthly',
         fromDate: c.fromDate || '',
         dueDate: c.dueDate || ''
       }));
    }
    return (state.accounts || []).filter(a => a.type === activeTab);
  };
  
  let currentList = getNormalizedList();
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    currentList = currentList.filter(a => a.name?.toLowerCase().includes(q) || a.phone?.includes(q));
  }

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!vendorForm.name) return;
    try {
      const rawBalance = Number(vendorForm.balance) || 0;
      const computedBalance = vendorForm.balanceType === 'Give' ? -Math.abs(rawBalance) : Math.abs(rawBalance);
      
      const payload = {
        ...vendorForm,
        balance: computedBalance,
        interestRate: Number(vendorForm.interestRate)
      };
      if (editingVendor) {
        if (activeTab === 'Vendor') await updateVendor({ ...editingVendor, ...payload });
        else if (activeTab === 'Customer') await updateCustomer({ ...editingVendor, ...payload, udhaarBalance: payload.balance });
        else await updateAccount({ ...editingVendor, ...payload });
        showToast(`${activeTab} updated`, 'success');
      } else {
        if (activeTab === 'Vendor') await addVendor(payload);
        else if (activeTab === 'Customer') await addCustomer({ ...payload, udhaarBalance: payload.balance, type: 'old' });
        else await addAccount({ ...payload, type: activeTab });
        showToast(`${activeTab} added`, 'success');
      }
      setShowVendorModal(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveTxn = async (e) => {
    e.preventDefault();
    if (!txnForm.amount || Number(txnForm.amount) <= 0 || !txnForm.targetAccount) return;
    try {
      const txnId = Date.now().toString();
      if (txnForm.file) {
        await saveFile(txnId, txnForm.file);
      }
      await addLedgerTransaction({
        id: txnId,
        vendorId: activeTab === 'Vendor' ? txnForm.targetAccount.id : null,
        customerId: activeTab === 'Customer' ? txnForm.targetAccount.id : null,
        accountId: !['Vendor', 'Customer'].includes(activeTab) ? txnForm.targetAccount.id : null,
        type: txnForm.type,
        amount: Number(txnForm.amount),
        notes: txnForm.notes,
        paymentMode: txnForm.paymentMode,
        hasFile: !!txnForm.file,
        fileName: txnForm.fileName
      });

      if (activeTab === 'Customer') {
         let newBal = txnForm.targetAccount.balance;
         if (['Borrow', 'Receive', 'Credit Note', 'Income', 'Add'].includes(txnForm.type)) newBal += Number(txnForm.amount);
         if (['Payment', 'Spend', 'Debit Note', 'Expense', 'Deduct'].includes(txnForm.type)) newBal -= Number(txnForm.amount);
         await updateCustomer({ ...txnForm.targetAccount, udhaarBalance: newBal });
      }

      showToast(`Transaction ${txnForm.type} recorded successfully`, 'success');
      setShowTxnModal(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File must be smaller than 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setTxnForm({ ...txnForm, file: event.target.result, fileName: file.name });
    reader.readAsDataURL(file);
  };

  const openFile = async (txnId) => {
    const data = await getFile(txnId);
    if (data) setViewingFile(data);
    else showToast('File not found', 'error');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '20px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>📖 Universal Ledger (Khata)</h2>
        {activeTab !== 'Master' && (
          <button className="btn btn-primary" onClick={() => { setEditingVendor(null); setVendorForm({ name: '', phone: '', interestRate: 0, interestType: 'Monthly', balance: 0, balanceType: 'Take', fromDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '', monthlySalary: '', salaryDate: '' }); setShowVendorModal(true); }}>
            <Plus size={16} /> Create New {activeTab}
          </button>
        )}
      </div>

      {/* Account Type Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
        {accountTypes.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
            >
              <Icon size={16} />
              {tab.id}
            </button>
          )
        })}
      </div>

      {activeTab !== 'Master' && (
        <div style={{ marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid var(--border)' }}>
          <input
            type="text"
            className="form-input"
            placeholder={`Search ${activeTab} by name or phone...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: '400px' }}
          />
        </div>
      )}

      {/* Continuous Ledger Statements */}
      <div>
        {activeTab === 'Master' ? (
          <MasterDashboard state={state} />
        ) : currentList.length === 0 ? (
          (['Cash', 'Bank', 'Income', 'Expenditure'].includes(activeTab)) ? (
             <SystemAccountStatement type={activeTab} state={state} />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', border: '2px dashed var(--border)', borderRadius: '8px' }}>
              <Briefcase size={48} style={{ opacity: 0.2, marginBottom: '15px' }} />
              <h3>No {activeTab}s Found</h3>
              <p>Click "Create New {activeTab}" to add an account.</p>
            </div>
          )
        ) : (
          currentList.map(account => (
            <AccountStatement 
              key={account.id}
              account={account}
              activeTab={activeTab}
              state={state}
              deleteVendor={deleteVendor}
              deleteCustomer={deleteCustomer}
              deleteAccount={deleteAccount}
              setEditingVendor={setEditingVendor}
              setVendorForm={setVendorForm}
              setShowVendorModal={setShowVendorModal}
              setTxnForm={setTxnForm}
              setShowTxnModal={setShowTxnModal}
              openFile={openFile}
            />
          ))
        )}
      </div>

      {/* Account Modal (Create/Edit) */}
      {showVendorModal && (
        <div className="modal-overlay" onClick={() => setShowVendorModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{editingVendor ? 'Edit' : 'Add'} {activeTab}</h3>
              <button className="modal-close" onClick={() => setShowVendorModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveAccount}>
              <div className="form-group">
                <label className="form-label">
                  {activeTab === 'Customer' ? 'Customer Name *' :
                   activeTab === 'Vendor' ? 'Vendor / Supplier Name *' :
                   activeTab === 'Employee' ? 'Employee Name *' :
                   activeTab === 'Cash' ? 'Cash Account Name *' :
                   activeTab === 'Bank' ? 'Bank Name *' :
                   activeTab === 'Income' ? 'Income Source / Category *' :
                   activeTab === 'Expenditure' ? 'Expense Category (e.g., Rent) *' : 'Name *'}
                </label>
                <input 
                  className="form-input" 
                  type="text" 
                  value={vendorForm.name} 
                  onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} 
                  placeholder={
                    activeTab === 'Customer' ? 'e.g., Rahul Kumar' :
                    activeTab === 'Vendor' ? 'e.g., Sharma Distributors' :
                    activeTab === 'Employee' ? 'e.g., Amit Singh' :
                    activeTab === 'Cash' ? 'e.g., Main Cash, Petty Cash' :
                    activeTab === 'Bank' ? 'e.g., HDFC Bank, SBI' :
                    activeTab === 'Income' ? 'e.g., Commission, Interest' :
                    activeTab === 'Expenditure' ? 'e.g., Rent, Electricity, Tea' : 'Enter Name'
                  }
                  required 
                />
              </div>
              
              {['Customer', 'Vendor', 'Employee'].includes(activeTab) && (
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" type="text" value={vendorForm.phone} onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })} />
                </div>
              )}

              {activeTab === 'Bank' && (
                <div className="form-group">
                  <label className="form-label">Account Number / Details</label>
                  <input className="form-input" type="text" value={vendorForm.phone} onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })} placeholder="e.g. A/C 123456789" />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Initial Balance (₹)</label>
                  <input className="form-input" type="number" step="any" value={vendorForm.balance} onChange={e => setVendorForm({ ...vendorForm, balance: e.target.value })} disabled={!!editingVendor} />
                </div>
                {['Customer', 'Vendor', 'Employee'].includes(activeTab) && (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Balance Type</label>
                    <select className="form-input" value={vendorForm.balanceType} onChange={e => setVendorForm({ ...vendorForm, balanceType: e.target.value })} disabled={!!editingVendor}>
                      <option value="Take">Receivable (I will get)</option>
                      <option value="Give">Payable (I will give)</option>
                    </select>
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Customer', 'Vendor', 'Employee'].includes(activeTab) && (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">{activeTab === 'Employee' ? 'Joining Date' : 'From Date'}</label>
                    <input className="form-input" type="date" value={vendorForm.fromDate} onChange={e => setVendorForm({ ...vendorForm, fromDate: e.target.value })} />
                  </div>
                )}
              </div>

              {activeTab === 'Employee' && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Monthly Salary (₹)</label>
                    <input className="form-input" type="number" step="any" value={vendorForm.monthlySalary} onChange={e => setVendorForm({ ...vendorForm, monthlySalary: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Salary Date (e.g. 1st)</label>
                    <input className="form-input" type="text" placeholder="e.g. 5th of every month" value={vendorForm.salaryDate} onChange={e => setVendorForm({ ...vendorForm, salaryDate: e.target.value })} />
                  </div>
                </div>
              )}

              {['Customer', 'Vendor'].includes(activeTab) && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Interest Rate (%)</label>
                    <input className="form-input" type="number" step="any" value={vendorForm.interestRate} onChange={e => setVendorForm({ ...vendorForm, interestRate: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Interest Type</label>
                    <select className="form-input" value={vendorForm.interestType || 'Monthly'} onChange={e => setVendorForm({ ...vendorForm, interestType: e.target.value })}>
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </div>
              )}

              {['Customer', 'Vendor', 'Employee', 'Expenditure'].includes(activeTab) && (
                <div className="form-group">
                  <label className="form-label">Due Date (Reminder)</label>
                  <input className="form-input" type="date" value={vendorForm.dueDate} onChange={e => setVendorForm({ ...vendorForm, dueDate: e.target.value })} />
                </div>
              )}

              {['Customer', 'Vendor', 'Employee'].includes(activeTab) && (
                <div className="form-group">
                  <label className="form-label">Notes / Remarks</label>
                  <textarea className="form-input" rows="2" value={vendorForm.notes} onChange={e => setVendorForm({ ...vendorForm, notes: e.target.value })} placeholder="Any extra information..." />
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowVendorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTxnModal && (
        <div className="modal-overlay" onClick={() => setShowTxnModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Add Transaction</h3>
              <button className="modal-close" onClick={() => setShowTxnModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveTxn}>
              <p style={{ marginBottom: '10px' }}>For: <strong>{txnForm.targetAccount?.name}</strong></p>
              <div className="form-group">
                <label className="form-label">Transaction Type</label>
                <select className="form-input" value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value })}>
                  {['Customer', 'Vendor'].includes(activeTab) && (
                    <>
                      <option value="Borrow">Borrow (Udhar Liya)</option>
                      <option value="Payment">Payment</option>
                      <option value="Receive">Receive (Received Payment)</option>
                      <option value="Credit Note">Credit Note</option>
                      <option value="Debit Note">Debit Note</option>
                    </>
                  )}
                  {activeTab === 'Employee' && (
                    <>
                      <option value="Payment">Pay Salary / Wage</option>
                      <option value="Borrow">Advance Given</option>
                      <option value="Receive">Return Advance</option>
                    </>
                  )}
                  {activeTab === 'Expenditure' && (
                    <>
                      <option value="Expense">Record Expense</option>
                      <option value="Payment">Pay Expense</option>
                    </>
                  )}
                  {activeTab === 'Income' && (
                    <>
                      <option value="Add">Record Income</option>
                      <option value="Receive">Receive Income</option>
                    </>
                  )}
                  {['Bank', 'Cash'].includes(activeTab) && (
                    <>
                      <option value="Add">Deposit / Add Money</option>
                      <option value="Deduct">Withdraw / Deduct Money</option>
                    </>
                  )}
                  <option value="Add">Add (Increase Balance)</option>
                  <option value="Deduct">Deduct (Decrease Balance)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={txnForm.paymentMode} onChange={e => setTxnForm({ ...txnForm, paymentMode: e.target.value })}>
                  <option value="Cash">Cash</option>
                  <option value="Bank/Online">Bank / Online</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input className="form-input" type="number" step="any" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input className="form-input" type="text" value={txnForm.notes} onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })} placeholder="E.g., Interest for Jan" />
              </div>
              <div className="form-group">
                <label className="form-label">Attach Bill/Receipt (Optional)</label>
                <input className="form-input" type="file" accept="image/*,.pdf,.csv" onChange={handleFileUpload} />
                {txnForm.fileName && <span style={{ fontSize: '0.8rem', color: 'var(--green)' }}>Attached: {txnForm.fileName}</span>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowTxnModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Txn</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View File Modal */}
      {viewingFile && (
        <div className="modal-overlay" onClick={() => setViewingFile(null)} style={{ zIndex: 10000 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3>View Document</h3>
              <button className="modal-close" onClick={() => setViewingFile(null)}>✕</button>
            </div>
            <div style={{ flex: 1, padding: '10px', overflow: 'hidden' }}>
              {viewingFile.startsWith('data:image') ? (
                <img src={viewingFile} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <iframe src={viewingFile} style={{ width: '100%', height: '100%', border: 'none' }} title="Document" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
