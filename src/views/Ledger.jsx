import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { showToast } from '../components/Toast';
import { Plus, Edit2, Trash2, Paperclip, Briefcase, Users, Banknote, Landmark, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';
import { saveFile, getFile } from '../utils/storage';

import AccountStatement from '../components/ledger/AccountStatement';
import LedgerSummary from '../components/ledger/LedgerSummary';
import SystemAccountStatement from '../components/ledger/SystemAccountStatement';
import MasterDashboard from '../components/ledger/MasterDashboard';

export default function Ledger() {
  const { state, addVendor, updateVendor, deleteVendor, addCustomer, updateCustomer, deleteCustomer, addAccount, updateAccount, deleteAccount, addLedgerTxn, updateLedgerTxn, deleteLedgerTxn } = useApp();
  const tx = useT(state.lang);
  
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

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams) {
      const tabParam = searchParams.get('tab');
      if (tabParam && accountTypes.some(t => t.id.toLowerCase() === tabParam.toLowerCase())) {
        const matchingTab = accountTypes.find(t => t.id.toLowerCase() === tabParam.toLowerCase());
        setActiveTab(matchingTab.id);
      }
    }
  }, [searchParams]);

  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', pan: '', gst: '', interestRate: 0, interestType: 'Monthly', balance: 0, balanceType: 'Take', fromDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '', monthlySalary: '', salaryDate: '' });
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
        <h2 style={{ margin: 0 }}>📖 {tx.ledger || 'Universal Ledger (Khata)'}</h2>
        {activeTab !== 'Master' && (
          <button className="btn btn-primary" onClick={() => { setEditingVendor(null); setVendorForm({ name: '', phone: '', pan: '', gst: '', interestRate: 0, interestType: 'Monthly', balance: 0, balanceType: 'Take', fromDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '', monthlySalary: '', salaryDate: '' }); setShowVendorModal(true); }}>
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

              {['Customer', 'Vendor'].includes(activeTab) && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">PAN No.</label>
                    <input className="form-input" type="text" value={vendorForm.pan} onChange={e => setVendorForm({ ...vendorForm, pan: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">GST No.</label>
                    <input className="form-input" type="text" value={vendorForm.gst} onChange={e => setVendorForm({ ...vendorForm, gst: e.target.value })} />
                  </div>
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
                      <option value="Add">Salary Due (Increase Payable)</option>
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
