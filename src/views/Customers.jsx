import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { showToast } from '../components/Toast';
import { Search, MessageCircle, Plus, Edit2, Trash2 } from 'lucide-react';

export default function Customers() {
  const { state, addCustomer, updateCustomer, deleteCustomer } = useApp();
  const [search, setSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', type: 'new', membershipTier: 'None', udhaarBalance: 0 });
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

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
      showToast(`Payment of ₹${amount} recorded`, 'success');
      setPaymentModal(null);
      setPaymentAmount('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openWhatsApp = (customer) => {
    if (!customer.phone || customer.udhaarBalance <= 0) return;
    const msg = `Hello ${customer.name}, this is a gentle reminder that your pending dues are ₹${customer.udhaarBalance.toFixed(2)}. Please settle the amount at your earliest convenience. Thank you! - Cosmo Store`;
    const url = `https://wa.me/91${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>👥 Customers & Debt</h2>
        <button className="btn btn-primary" onClick={() => { setEditingCustomer(null); setFormData({ name: '', phone: '', type: 'new', membershipTier: 'None', udhaarBalance: 0 }); setShowModal(true); }}>
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
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Type</label>
                <select className="form-input" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                  <option value="new">New</option>
                  <option value="old">Old</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Membership Tier</label>
                <select className="form-input" value={formData.membershipTier} onChange={e => setFormData({ ...formData, membershipTier: e.target.value })}>
                  <option value="None">None</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Initial Debt Balance (₹)</label>
                <input className="form-input" type="number" step="any" value={formData.udhaarBalance} onChange={e => setFormData({ ...formData, udhaarBalance: e.target.value })} disabled={!!editingCustomer} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px' }}>
            <div className="modal-header">
              <h3>Collect Payment</h3>
              <button className="modal-close" onClick={() => setPaymentModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSettlePayment}>
              <p style={{ marginBottom: '10px', fontSize: '14px' }}>
                Customer: <strong>{paymentModal.name}</strong><br/>
                Total Dues: <strong style={{ color: 'var(--red)' }}>₹{paymentModal.udhaarBalance.toFixed(2)}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Amount Paying Now (₹)</label>
                <input 
                  className="form-input" 
                  type="number" 
                  step="any" 
                  max={paymentModal.udhaarBalance}
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  required 
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPaymentModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
