import { X, CheckCircle } from 'lucide-react';

export default function EnquiryModal({ show, editingEnquiry, name, setName, phone, setPhone, itemOfInterest, setItemOfInterest, status, setStatus, notes, setNotes, handleSave, onClose }) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingEnquiry ? 'Edit Enquiry' : 'Add New Enquiry'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Customer Name *</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Rahul Kumar" style={{ width: '100%', marginTop: 5 }} />
          </div>
          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Phone Number</label>
            <input type="text" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 9876543210" style={{ width: '100%', marginTop: 5 }} />
          </div>
          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Item / Service of Interest</label>
            <input type="text" className="form-input" value={itemOfInterest} onChange={e => setItemOfInterest(e.target.value)} placeholder="e.g. Paracetamol 500mg" style={{ width: '100%', marginTop: 5 }} />
          </div>
          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Status</label>
            <select className="form-input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', marginTop: 5 }}>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Notes</label>
            <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any extra details..." style={{ width: '100%', marginTop: 5, height: '80px', resize: 'none' }} />
          </div>
          
          <div className="modal-footer" style={{ marginTop: '25px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><CheckCircle size={16} style={{ marginRight: 5 }} /> Save Enquiry</button>
          </div>
        </form>
      </div>
    </div>
  );
}
