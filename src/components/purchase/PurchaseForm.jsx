export default function PurchaseForm({
  tx,
  subtotal, gst, grandTotal, discount,
  billDiscount, setBillDiscount,
  paymentMode, setPaymentMode,
  bankDetails, setBankDetails,
  cashPaid, setCashPaid, change,
  purchaseDate, setPurchaseDate,
  purchaseBillNo, setPurchaseBillNo,
  generatePurchase, state
}) {
  return (
    <div className="totals-card">
      <div className="total-row"><span>{tx.subtotal}</span><span>₹{subtotal.toFixed(2)}</span></div>
      <div className="total-row"><span>GST</span><span>₹{gst.toFixed(2)}</span></div>
      
      {/* Discount Controls */}
      <div style={{ marginTop: '10px', marginBottom: '10px', padding: '10px', background: 'var(--bg2)', borderRadius: '8px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '6px' }}>Apply Discount</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select 
            className="form-input" 
            style={{ flex: 1, padding: '6px' }}
            value={billDiscount.type}
            onChange={e => setBillDiscount({ ...billDiscount, type: e.target.value })}
          >
            <option value="none">No Discount</option>
            <option value="flat">Flat Amount (₹)</option>
            <option value="percent">Percentage (%)</option>
          </select>
          {billDiscount.type !== 'none' && (
            <input 
              type="number" 
              className="form-input" 
              style={{ flex: 1, padding: '6px' }}
              placeholder="Value"
              value={billDiscount.value || ''}
              onChange={e => setBillDiscount({ ...billDiscount, value: e.target.value })}
            />
          )}
        </div>
      </div>

      {discount > 0 && <div className="total-row"><span>{tx.discount}</span><span style={{ color: 'var(--green)' }}>-₹{discount.toFixed(2)}</span></div>}
      <div className="total-row grand"><span>{tx.grandTotal}</span><span>₹{grandTotal.toFixed(2)}</span></div>

      <div style={{ marginTop: 14 }}>
        <label className="form-label">Payment Mode</label>
        <select className="form-input" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Card">Card</option>
          <option value="Credit">Credit (Udhaar)</option>
        </select>

        {['RTGS', 'NEFT'].includes(paymentMode) && (
          <div className="cash-input-row" style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
            <input
              className="form-input"
              type="text"
              placeholder="UTR Number"
              value={bankDetails.utr}
              onChange={e => setBankDetails({ ...bankDetails, utr: e.target.value })}
              style={{ flex: 1 }}
            />
            <input
              className="form-input"
              type="date"
              value={bankDetails.date}
              onChange={e => setBankDetails({ ...bankDetails, date: e.target.value })}
              style={{ flex: 1 }}
            />
          </div>
        )}
        {paymentMode === 'Cheque' && (
          <div className="cash-input-row" style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              type="text"
              placeholder="Cheque No."
              value={bankDetails.chequeNo}
              onChange={e => setBankDetails({ ...bankDetails, chequeNo: e.target.value })}
              style={{ flex: '1 1 45%' }}
            />
            <input
              className="form-input"
              type="text"
              placeholder="Bank Name"
              value={bankDetails.bankName}
              onChange={e => setBankDetails({ ...bankDetails, bankName: e.target.value })}
              style={{ flex: '1 1 45%' }}
            />
            <input
              className="form-input"
              type="date"
              value={bankDetails.date}
              onChange={e => setBankDetails({ ...bankDetails, date: e.target.value })}
              style={{ flex: '1 1 100%' }}
            />
          </div>
        )}

        {paymentMode === 'Cash' && (
          <div className="cash-input-row">
            <input
              className="form-input"
              type="number"
              step="any"
              placeholder={tx.enterAmount}
              value={cashPaid}
              onChange={e => setCashPaid(e.target.value)}
            />
            {cashPaid && parseFloat(cashPaid) >= grandTotal && (
              <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 700, color: 'var(--green)' }}>
                ↩ ₹{change.toFixed(2)}
              </div>
            )}
          </div>
        )}

        {paymentMode === 'Credit' && (
          <div className="cash-input-row" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text3)', marginBottom: '4px' }}>Amount Paid Now (Advance)</div>
              <input
                className="form-input"
                type="number"
                step="any"
                placeholder="0.00"
                value={cashPaid}
                onChange={e => setCashPaid(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text3)', marginBottom: '4px' }}>Remaining Balance (Udhaar)</div>
              <div style={{ padding: '8px', backgroundColor: 'var(--bg2)', borderRadius: '4px', fontWeight: 'bold', color: 'var(--danger)' }}>
                ₹{Math.max(0, grandTotal - (parseFloat(cashPaid) || 0)).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>Purchase Date</label>
            <input
              className="form-input"
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>Vendor Bill No.</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. INV-001"
              value={purchaseBillNo}
              onChange={e => setPurchaseBillNo(e.target.value)}
            />
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1.1rem', marginTop: 20 }} onClick={generatePurchase}>
          Complete Purchase
        </button>
      </div>
    </div>
  );
}
