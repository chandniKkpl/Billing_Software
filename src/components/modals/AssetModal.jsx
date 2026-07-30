import { X, CheckCircle } from 'lucide-react';

export default function AssetModal({ show, editingAsset, name, setName, type, setType, value, setValue, dateAcquired, setDateAcquired, handleSave, onClose }) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Asset Name</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Office Furniture" style={{ width: '100%', marginTop: 5 }} />
          </div>
          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Asset Type</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', marginTop: 5 }}>
              <option value="Fixed">Fixed Asset (e.g. Machinery, Furniture)</option>
              <option value="Current">Current Asset (e.g. Inventory, Cash Equivalents)</option>
            </select>
          </div>
          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Value (₹)</label>
            <input type="number" step="0.01" className="form-input" value={value} onChange={e => setValue(e.target.value)} required style={{ width: '100%', marginTop: 5 }} />
          </div>
          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Date Acquired</label>
            <input type="date" className="form-input" value={dateAcquired} onChange={e => setDateAcquired(e.target.value)} required style={{ width: '100%', marginTop: 5 }} />
          </div>
          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><CheckCircle size={16} /> Save Asset</button>
          </div>
        </form>
      </div>
    </div>
  );
}
