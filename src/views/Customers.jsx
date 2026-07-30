import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { showToast } from '../components/Toast';
import { Search, MessageCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import CustomerModal from '../components/modals/CustomerModal';
import PaymentModal from '../components/modals/PaymentModal';

export default function Customers() {
  const { state, addCustomer, updateCustomer, deleteCustomer, addLedgerTransaction } = useApp();
  const tx = useT(state.lang);
  const [search, setSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', type: 'new', membershipTier: 'None', udhaarBalance: 0, dueDate: '', pan: '', gst: '' });
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  const filtered = state.customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  ) || [];

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      showToast('Name and phone are required', 'error');
      return;
    }
    try {
      if (editingCustomer) {
        await updateCustomer({ ...editingCustomer, ...formData, udhaarBalance: Number(formData.udhaarBalance) });
        showToast('Customer updated', 'success');
      } else {
        await addCustomer({ ...formData, udhaarBalance: Number(formData.udhaarBalance) });
        showToast('Customer added', 'success');
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSettlePayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (amount <= 0 || amount > paymentModal.udhaarBalance) {
      showToast('Invalid amount', 'error');
      return;
    }
    try {
      await updateCustomer({ ...paymentModal, udhaarBalance: paymentModal.udhaarBalance - amount });
      
      await addLedgerTransaction({
        date: new Date().toISOString(),
        customerId: paymentModal.id,
        type: 'Receive',
        amount: amount,
        paymentMode: paymentMode,
        notes: 'Debt collection payment'
      });

      showToast(`Payment of ₹${amount} recorded`, 'success');
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentMode('Cash');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openWhatsApp = (customer) => {
    if (!customer.phone || customer.udhaarBalance <= 0) return;
    const dueDateStr = customer.dueDate ? ` by ${customer.dueDate}` : ' at your earliest convenience';
    const msg = `Hello ${customer.name}, this is a gentle reminder that your pending dues are ₹${customer.udhaarBalance.toFixed(2)}. Please settle the amount${dueDateStr}. Thank you! - Cosmo Store`;
    const url = `https://wa.me/91${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>👥 {tx.customers || 'Customers & Debt'}</h2>
        <button className="btn btn-primary" onClick={() => { setEditingCustomer(null); setFormData({ name: '', phone: '', type: 'new', membershipTier: 'None', udhaarBalance: 0, dueDate: '', pan: '', gst: '' }); setShowModal(true); }}>
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="page-content">
        <div className="search-bar" style={{ maxWidth: '400px', marginBottom: '20px' }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Membership</th>
                <th>Debt Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td><span className={`badge ${c.type === 'old' ? 'badge-yellow' : 'badge-green'}`}>{c.type}</span></td>
                  <td>{c.membershipTier}</td>
                  <td style={{ color: c.udhaarBalance > 0 ? 'var(--red)' : 'inherit', fontWeight: 'bold' }}>
                    ₹{c.udhaarBalance?.toFixed(2) || '0.00'}
                    {c.dueDate && c.udhaarBalance > 0 && (
                      <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text3)', marginTop: 4 }}>
                        Due: {c.dueDate}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditingCustomer(c); setFormData(c); setShowModal(true); }}>
                        <Edit2 size={14} />
                      </button>
                      {c.udhaarBalance > 0 && (
                        <>
                          <button className="btn btn-success btn-sm" title="WhatsApp Reminder" onClick={() => openWhatsApp(c)}>
                            <MessageCircle size={14} />
                          </button>
                          <button className="btn btn-primary btn-sm" title="Collect Payment" onClick={() => { setPaymentModal(c); setPaymentAmount(c.udhaarBalance); }}>
                            Pay
                          </button>
                        </>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => deleteCustomer(c.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <CustomerModal 
        show={showModal} 
        editingCustomer={editingCustomer} 
        formData={formData} 
        setFormData={setFormData} 
        handleSave={handleSave} 
        onClose={() => setShowModal(false)} 
      />

      {/* Payment Modal */}
      <PaymentModal 
        show={!!paymentModal} 
        paymentModal={paymentModal} 
        paymentAmount={paymentAmount} 
        setPaymentAmount={setPaymentAmount} 
        paymentMode={paymentMode} 
        setPaymentMode={setPaymentMode} 
        handleSettlePayment={handleSettlePayment} 
        onClose={() => setPaymentModal(null)} 
      />
    </div>
  );
}
