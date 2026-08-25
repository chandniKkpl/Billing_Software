export default function CheckoutForm({
  tx, state,
  subtotal, gst, grandTotal, discount,
  billDiscount, setBillDiscount,
  roundOff, setRoundOff,
  paymentMode, setPaymentMode,
  bankDetails, setBankDetails,
  cashPaid, setCashPaid, change,
  dueDate, setDueDate,
  generateBill
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
              min="0"
              className="form-input" 
              style={{ flex: 1, padding: '6px' }}
              placeholder="Value"
              value={billDiscount.value || ''}
              onChange={e => setBillDiscount({ ...billDiscount, value: Math.max(0, e.target.value) })}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '0.7rem' }} onClick={() => setBillDiscount({ type: 'percent', value: 5 })}>Bulk 5%</button>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '0.7rem' }} onClick={() => setBillDiscount({ type: 'percent', value: 10 })}>Bulk 10%</button>
        </div>
      </div>

      {/* Freight & Labor Controls */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '4px' }}>Freight/Shipping</div>
          <input type="number" min="0" className="form-input" placeholder="0.00" value={billDiscount.freight} onChange={e => setBillDiscount({ ...billDiscount, freight: Math.max(0, e.target.value) })} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '4px' }}>Labor Charges</div>
          <input type="number" min="0" className="form-input" placeholder="0.00" value={billDiscount.labor} onChange={e => setBillDiscount({ ...billDiscount, labor: Math.max(0, e.target.value) })} />
        </div>
      </div>

      {/* Target Total / Round Off */}
      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '4px' }}>Target Total (Round Off)</div>
        <input 
          type="number" 
          min="0"
          className="form-input" 
          placeholder="e.g. 125"
          value={roundOff} 
          onChange={e => setRoundOff(Math.max(0, e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {discount > 0 && <div className="total-row"><span>{tx.discount}</span><span style={{ color: 'var(--green)' }}>-₹{discount.toFixed(2)}</span></div>}
      <div className="total-row grand"><span>{tx.grandTotal}</span><span>₹{grandTotal.toFixed(2)}</span></div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: 6 }}>{tx.payment}</div>
        <div className="payment-modes" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {['Cash', 'UPI', 'Card', 'RTGS', 'NEFT', 'Cheque', 'Debt'].map(m => (
            <button
              key={m}
              className={`payment-mode-btn ${paymentMode === m ? 'active' : ''}`}
              onClick={() => setPaymentMode(m)}
              style={{ flex: '1 1 calc(33% - 6px)', padding: '6px', fontSize: '0.8rem' }}
            >
              {m === 'Cash' ? '💵' : m === 'UPI' ? '📱' : m === 'Card' ? '💳' : m === 'Debt' ? '📒' : '🏦'} {m}
            </button>
          ))}
        </div>

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

        {paymentMode === 'Debt' && (
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
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text3)', marginBottom: '4px' }}>Payment Due Date (Optional)</div>
              <input
                className="form-input"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
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

        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={generateBill}
          disabled={state.cart.length === 0}
        >
          🧾 {state.editingSaleId ? 'Update Bill' : tx.generateBill}
        </button>
      </div>
    </div>
  );
}
