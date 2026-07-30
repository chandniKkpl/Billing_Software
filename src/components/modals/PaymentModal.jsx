export default function PaymentModal({ show, paymentModal, paymentAmount, setPaymentAmount, paymentMode, setPaymentMode, handleSettlePayment, onClose }) {
  if (!show || !paymentModal) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px' }}>
        <div className="modal-header">
          <h3>Collect Payment</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
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
          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select className="form-input" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank/Online">Bank/Online</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success">Record Payment</button>
          </div>
        </form>
      </div>
    </div>
  );
}
