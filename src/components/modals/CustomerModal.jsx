export default function CustomerModal({ show, editingCustomer, formData, setFormData, handleSave, onClose }) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
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
            <label className="form-label">PAN No.</label>
            <input className="form-input" type="text" value={formData.pan || ''} onChange={e => setFormData({ ...formData, pan: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">GST No.</label>
            <input className="form-input" type="text" value={formData.gst || ''} onChange={e => setFormData({ ...formData, gst: e.target.value })} />
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
            <input className="form-input" type="number" min="0" step="any" value={formData.udhaarBalance} onChange={e => setFormData({ ...formData, udhaarBalance: Math.max(0, e.target.value) })} disabled={!!editingCustomer} />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Due Date</label>
            <input className="form-input" type="date" value={formData.dueDate || ''} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
