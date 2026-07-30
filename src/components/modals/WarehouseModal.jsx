import { X, CheckCircle } from 'lucide-react';

export default function WarehouseModal({ show, editingWh, name, setName, address, setAddress, handleSave, onClose }) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingWh ? 'Edit Warehouse' : 'Add New Warehouse'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Warehouse Name *</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Godown 2" style={{ width: '100%', marginTop: 5 }} />
          </div>
          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Location / Address</label>
            <textarea className="form-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Main Market, Delhi" style={{ width: '100%', marginTop: 5, height: '80px', resize: 'none' }} />
          </div>
          
          <div className="modal-footer" style={{ marginTop: '25px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><CheckCircle size={16} style={{ marginRight: 5 }} /> Save Warehouse</button>
          </div>
        </form>
      </div>
    </div>
  );
}
