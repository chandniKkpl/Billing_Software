import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { showToast } from '../components/Toast';
import { Plus, Edit2, Trash2, Clock, Paperclip, Eye, Briefcase, Users, CreditCard, Banknote, Landmark, TrendingUp, TrendingDown } from 'lucide-react';
import { saveFile, getFile } from '../utils/storage';

export default function Ledger() {
  const { state, addVendor, updateVendor, deleteVendor, addCustomer, updateCustomer, deleteCustomer, addAccount, updateAccount, deleteAccount, addLedgerTransaction } = useApp();
  
  const [activeTab, setActiveTab] = useState('Vendor');
  const accountTypes = [
    { id: 'Customer', icon: Users },
    { id: 'Vendor', icon: Briefcase },
    { id: 'Employee', icon: Users },
    { id: 'Cash', icon: Banknote },
    { id: 'Bank', icon: Landmark },
    { id: 'Income', icon: TrendingUp },
    { id: 'Expenditure', icon: TrendingDown },
  ];

  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', interestRate: 0, interestType: 'Monthly', balance: 0, fromDate: new Date().toISOString().split('T')[0], dueDate: '' });
  const [editingVendor, setEditingVendor] = useState(null);
  
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [txnForm, setTxnForm] = useState({ type: 'Add', amount: '', notes: '', file: null, fileName: '', paymentMode: 'Cash' });
  const [viewingFile, setViewingFile] = useState(null);

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
  
  const currentList = getNormalizedList();
  const transactions = state.ledgerTransactions || [];

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!vendorForm.name) return;
    try {
      const payload = {
        ...vendorForm,
        balance: Number(vendorForm.balance),
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
    if (!txnForm.amount || Number(txnForm.amount) <= 0) return;
    try {
      const txnId = Date.now().toString();
      if (txnForm.file) {
        await saveFile(txnId, txnForm.file);
      }
      await addLedgerTransaction({
        id: txnId,
        vendorId: activeTab === 'Vendor' ? selectedVendor.id : undefined,
        customerId: activeTab === 'Customer' ? selectedVendor.id : undefined,
        accountId: !['Vendor', 'Customer'].includes(activeTab) ? selectedVendor.id : undefined,
        type: txnForm.type,
        amount: Number(txnForm.amount),
        notes: txnForm.notes,
        paymentMode: txnForm.paymentMode,
        hasFile: !!txnForm.file,
        fileName: txnForm.fileName
      });

      if (activeTab === 'Customer') {
         let newBal = selectedVendor.balance;
         if (['Borrow', 'Receive', 'Credit Note', 'Income', 'Add'].includes(txnForm.type)) newBal += Number(txnForm.amount);
         if (['Payment', 'Spend', 'Debit Note', 'Expense', 'Deduct'].includes(txnForm.type)) newBal -= Number(txnForm.amount);
         await updateCustomer({ ...selectedVendor, udhaarBalance: newBal });
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
    
    // Check size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('File must be smaller than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setTxnForm({ ...txnForm, file: event.target.result, fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const openFile = async (txnId) => {
    const data = await getFile(txnId);
    if (data) {
      setViewingFile(data);
    } else {
      showToast('File not found', 'error');
    }
  };

  const isDueSoon = (dateStr) => {
    if (!dateStr) return false;
    const due = new Date(dateStr);
    const now = new Date();
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 10;
  };

  const calculateInterest = (vendor) => {
    if (!vendor.balance || vendor.balance <= 0 || !vendor.interestRate || !vendor.fromDate) return 0;
    
    const from = new Date(vendor.fromDate);
    // Use dueDate for calculation if provided, otherwise use current date
    let toDate = new Date();
    if (vendor.dueDate) {
      toDate = new Date(vendor.dueDate);
      // If the due date is somehow before the from date, fallback to current date or just 0
      if (toDate < from) {
        toDate = new Date();
      }
    }
    
    // Calculate difference in days
    const diffTime = toDate.getTime() - from.getTime();
    const diffDays = Math.max(0, diffTime / (1000 * 60 * 60 * 24));
    
    let interest = 0;
    if (vendor.interestType === 'Yearly') {
      const years = diffDays / 365.25;
      interest = vendor.balance * (vendor.interestRate / 100) * years;
    } else {
      // Monthly interest
      const months = diffDays / 30.4166;
      interest = vendor.balance * (vendor.interestRate / 100) * months;
    }
    
    return interest;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>📖 Universal Ledger (Khata)</h2>
        <button className="btn btn-primary" onClick={() => { setEditingVendor(null); setVendorForm({ name: '', phone: '', interestRate: 0, interestType: 'Monthly', balance: 0, fromDate: new Date().toISOString().split('T')[0], dueDate: '' }); setShowVendorModal(true); }}>
          <Plus size={16} /> Add {activeTab}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
        {accountTypes.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} />
              {tab.id}
            </button>
          )
        })}
      </div>

      <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Account List */}
        <div className="card">
          <h3>{activeTab} Accounts</h3>
          <div className="table-container" style={{ marginTop: '10px' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Balance</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentList.map(v => (
                  <tr key={v.id}>
                    <td>
                      {v.name}
                      {v.interestRate > 0 && <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text3)' }}>{v.interestRate}% Int. ({v.interestType || 'Monthly'})</span>}
                      {v.fromDate && <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text3)' }}>From: {v.fromDate}</span>}
                    </td>
                    <td style={{ color: v.balance > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 'bold' }}>
                      ₹{v.balance?.toFixed(2) || '0.00'}
                      {v.balance > 0 && (
                        <>
                          {v.interestRate > 0 && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--orange)' }}>
                              + ₹{calculateInterest(v).toFixed(2)} Int.
                            </span>
                          )}
                          <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text)', marginTop: '4px' }}>
                            Total Payable: <strong>₹{(v.balance + calculateInterest(v)).toFixed(2)}</strong>
                          </span>
                        </>
                      )}
                    </td>
                    <td>
                      {v.dueDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isDueSoon(v.dueDate) ? 'var(--red)' : 'inherit' }}>
                          <Clock size={12} />
                          {v.dueDate}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditingVendor(v); setVendorForm(v); setShowVendorModal(true); }}><Edit2 size={12}/></button>
                        <button className="btn btn-primary btn-sm" onClick={() => { setSelectedVendor(v); setTxnForm({ type: 'Add', amount: '', notes: '', file: null, fileName: '', paymentMode: 'Cash' }); setShowTxnModal(true); }}>Add Txn</button>
                        <button className="btn btn-danger btn-sm" onClick={() => {
                          if (activeTab === 'Vendor') deleteVendor(v.id);
                          else if (activeTab === 'Customer') deleteCustomer(v.id);
                          else deleteAccount(v.id);
                        }}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {currentList.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center' }}>No {activeTab}s found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <h3>Recent Transactions</h3>
          <div className="table-container" style={{ marginTop: '10px', maxHeight: '400px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {[...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 50).map(t => {
                  let relatedEntity = state.vendors?.find(v => v.id === t.vendorId);
                  if (!relatedEntity) relatedEntity = state.customers?.find(c => c.id === t.customerId);
                  if (!relatedEntity) relatedEntity = state.accounts?.find(a => a.id === t.accountId);
                  return (
                    <tr key={t.id}>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(t.date).toLocaleDateString()}</td>
                      <td>{relatedEntity?.name || 'Unknown'}</td>
                      <td>
                        <span className={`badge ${t.type === 'Payment' || t.type === 'Debit Note' ? 'badge-green' : 'badge-yellow'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>
                        ₹{t.amount.toFixed(2)}
                        {t.hasFile && (
                          <button className="btn btn-ghost btn-sm" style={{ padding: '2px', marginLeft: '8px' }} onClick={() => openFile(t.id)} title="View Receipt">
                            <Paperclip size={12} color="var(--primary)" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Account Modal */}
      {showVendorModal && (
        <div className="modal-overlay" onClick={() => setShowVendorModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{editingVendor ? 'Edit' : 'Add'} {activeTab}</h3>
              <button className="modal-close" onClick={() => setShowVendorModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveAccount}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" type="text" value={vendorForm.name} onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" type="text" value={vendorForm.phone} onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Initial Balance (₹)</label>
                  <input className="form-input" type="number" step="any" value={vendorForm.balance} onChange={e => setVendorForm({ ...vendorForm, balance: e.target.value })} disabled={!!editingVendor} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">From Date</label>
                  <input className="form-input" type="date" value={vendorForm.fromDate} onChange={e => setVendorForm({ ...vendorForm, fromDate: e.target.value })} />
                </div>
              </div>
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
              <div className="form-group">
                <label className="form-label">Return Due Date</label>
                <input className="form-input" type="date" value={vendorForm.dueDate} onChange={e => setVendorForm({ ...vendorForm, dueDate: e.target.value })} />
              </div>
              
              {(Number(vendorForm.balance) > 0) ? (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)' }}>Interest Calculated: ₹{calculateInterest(vendorForm).toFixed(2)}</p>
                  <p style={{ margin: '4px 0 0', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--red)' }}>
                    Total Payable: ₹{(Number(vendorForm.balance) + calculateInterest(vendorForm)).toFixed(2)}
                  </p>
                </div>
              ) : null}

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
              <p style={{ marginBottom: '10px' }}>{activeTab}: <strong>{selectedVendor?.name}</strong></p>
              
              <div className="form-group">
                <label className="form-label">Transaction Type</label>
                <select className="form-input" value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value })}>
                  <option value="Borrow">Borrow (Udhar Liya)</option>
                  <option value="Payment">Payment</option>
                  <option value="Receive">Receive (Received Payment)</option>
                  <option value="Credit Note">Credit Note</option>
                  <option value="Debit Note">Debit Note</option>
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
        <div className="modal-overlay" onClick={() => setViewingFile(null)}>
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
