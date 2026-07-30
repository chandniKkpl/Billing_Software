import { useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { showToast } from './Toast';

export default function Receipt({ sale: initialSale, onClose, setPage }) {
  const ref = useRef();
  const { updateSale, deleteSale, dispatch, state } = useApp();
  const [sale, setSale] = useState(initialSale);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState(initialSale?.items || []);
  const [confirmAction, setConfirmAction] = useState(null);

  const handleEditBill = () => {
    setConfirmAction({
      type: 'edit',
      message: 'This will load the bill back into your cart so you can add or remove products. Continue?'
    });
  };

  const handleDeleteBill = () => {
    setConfirmAction({
      type: 'delete',
      message: 'Are you sure you want to delete this bill entirely? Stock will be restored.'
    });
  };

  const confirmExecution = async () => {
    if (!confirmAction) return;
    
    if (confirmAction.type === 'edit') {
      dispatch({ type: 'SET_CART', payload: sale.items });
      dispatch({ type: 'SET_EDITING_SALE', payload: sale.id });
      onClose();
      if (setPage) setPage('billing');
    } else if (confirmAction.type === 'delete') {
      try {
        await deleteSale(sale.id);
        showToast('Bill deleted successfully!', 'success');
        onClose();
      } catch (err) {
        showToast('Error deleting bill: ' + err.message, 'error');
      }
    }
    setConfirmAction(null);
  };

  const handlePrint = () => {
    const el = ref.current;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt_${sale.id}</title>
          <style>
            @page { size: A4; margin: 12mm 15mm; }
            * { box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 13px; 
              width: 100%;
              max-width: 180mm;
              margin: 0 auto;
              padding: 0;
              color: #000;
              background: #fff;
            }
            .receipt-center { text-align: center; }
            .receipt-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .receipt-divider { border-top: 1px dashed #000; margin: 6px 0; }
            .receipt-title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 3px; letter-spacing: 1px; }
            .receipt-subtitle { font-size: 12px; text-align: center; margin-bottom: 2px; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
            .items-table th { 
              text-align: left; 
              border-top: 1px solid #000;
              border-bottom: 1px solid #000; 
              padding: 4px 3px; 
              font-size: 11px;
              white-space: nowrap;
            }
            .items-table th.right { text-align: right; }
            .items-table th.center { text-align: center; }
            .items-table td { padding: 5px 3px; vertical-align: top; font-size: 12px; }
            .items-table td.right { text-align: right; }
            .items-table td.center { text-align: center; }
            .items-table tbody tr { border-bottom: 1px dotted #ccc; }
            .item-name { font-weight: bold; font-size: 12px; }
            .item-barcode { font-size: 10px; color: #555; }
            .item-mrp-strike { text-decoration: line-through; color: #888; font-size: 11px; }
            .totals-section { margin-top: 6px; }
            .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 13px; }
            .grand-total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 16px; font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000; margin-top: 4px; }
            .footer-section { margin-top: 14px; text-align: center; }
            .qr-section { display: flex; flex-direction: column; align-items: center; margin-top: 10px; }
            .savings-badge { background: #000; color: #fff; padding: 2px 8px; font-size: 11px; display: inline-block; margin-top: 4px; }
            .wintogether-footer { text-align: center; margin-top: 14px; padding-top: 8px; border-top: 1px dotted #ccc; }
            .wintogether-footer img { height: 14px; opacity: 0.4; display: block; margin: 3px auto 0; }
            .wintogether-footer span { font-size: 8px; color: #bbb; letter-spacing: 0.5px; }
          </style>
        </head>
        <body>${el.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handlePriceChange = (index, newPrice) => {
    const items = [...editedItems];
    items[index] = { ...items[index], sellingPrice: newPrice };
    setEditedItems(items);
  };

  const saveEdits = async () => {
    try {
      let subtotal = 0;
      let gst = 0;
      
      editedItems.forEach(c => {
        const qty = Number(c.qty) || 0;
        const price = Number(c.sellingPrice) || 0;
        const itemGstPct = Number(c.gst) || 0;
        subtotal += price * qty;
        gst += (price * qty) * (itemGstPct / 100);
      });

      let discount = 0;
      const billDiscount = sale.billDiscount || { type: 'none', value: 0 };
      const val = Number(billDiscount.value) || 0;
      if (billDiscount.type === 'percent') {
        discount = (subtotal + gst) * (val / 100);
      } else if (billDiscount.type === 'flat') {
        discount = val;
      }

      const grandTotal = Math.max(0, subtotal + gst - discount);
      
      const updatedSale = { items: editedItems, subtotal, gst, discount, grandTotal };
      await updateSale(sale.id, updatedSale);

      setSale({ ...sale, ...updatedSale });
      setIsEditing(false);
      showToast('Bill updated successfully!', 'success');
    } catch (err) {
      showToast('Error updating bill: ' + err.message, 'error');
    }
  };

  if (!sale) return null;

  const storeInfo = { 
    name: 'Well Pharmacy', 
    address: 'Shop No 1. Grover Market, Near azad chowk, Rewari 123401', 
    phone: 'Mob no- 7015167948.'
  };

  const currentItems = isEditing ? editedItems : sale.items;
  
  let previewSubtotal = 0;
  let previewGst = 0;
  currentItems.forEach(c => {
    const qty = Number(c.qty) || 0;
    const price = Number(c.sellingPrice) || 0;
    const itemGstPct = Number(c.gst) || 0;
    previewSubtotal += price * qty;
    previewGst += (price * qty) * (itemGstPct / 100);
  });

  let previewDiscount = 0;
  const billDiscount = sale.billDiscount || { type: 'none', value: 0 };
  const val = Number(billDiscount.value) || 0;
  if (billDiscount.type === 'percent') {
    previewDiscount = (previewSubtotal + previewGst) * (val / 100);
  } else if (billDiscount.type === 'flat') {
    previewDiscount = val;
  }
  
  const currentSubtotal = isEditing ? previewSubtotal : sale.subtotal;
  const currentGst = isEditing ? previewGst : sale.gst;
  const currentDiscount = isEditing ? previewDiscount : sale.discount;
  const currentGrandTotal = isEditing ? Math.max(0, previewSubtotal + previewGst - previewDiscount) : sale.grandTotal;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal receipt-modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3>🧾 {sale.id ? 'Bill Generated' : 'Receipt Preview'}</h3>
            {!isEditing && <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>✏️ Edit Prices</button>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div ref={ref} style={{ padding: '20px', background: '#fff', color: '#000', borderRadius: '4px', border: '1px solid #ddd', maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Store Header */}
          <div className="receipt-center">
            <div className="receipt-title">{storeInfo.name}</div>
            <div className="receipt-subtitle">{storeInfo.address}</div>
            <div className="receipt-subtitle">{storeInfo.phone}</div>
          </div>
          
          <div className="receipt-divider"></div>
          
          {/* Bill Info */}
          <div className="receipt-row" style={{ fontSize: '12px' }}>
            <span><strong>Bill: #{sale.billNo ? String(sale.billNo).padStart(4, '0') : sale.id.slice(-6).toUpperCase()}</strong></span>
            <span>{new Date(sale.date).toLocaleDateString()}</span>
          </div>
          <div style={{ fontSize: '12px' }}>Time: {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ fontSize: '12px' }}>Mode: {sale.paymentMode}</div>
          {sale.bankInfo && <div style={{ fontSize: '12px' }}>Ref/Bank: {sale.bankInfo}</div>}
          
          {(() => {
            const customer = (sale.customerId ? state.customers?.find(c => String(c.id) === String(sale.customerId)) : null)
              || (sale.customerName ? { name: sale.customerName, phone: sale.customerPhone, pan: sale.customerPan, gst: sale.customerGst } : null);
            return customer ? (
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Customer: <strong>{customer.name}</strong> {customer.phone ? `(${customer.phone})` : ''}
                {(customer.pan || customer.gst) && (
                  <div>
                    {customer.pan && <span>PAN: {customer.pan} </span>}
                    {customer.gst && <span>GSTIN: {customer.gst}</span>}
                  </div>
                )}
              </div>
            ) : null;
          })()}

          {sale.vendorId && (() => {
            const vendor = state.vendors?.find(v => v.id === sale.vendorId);
            return vendor ? (
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Vendor: <strong>{vendor.name}</strong> ({vendor.phone})
                {(vendor.pan || vendor.gst) && (
                  <div>
                    {vendor.pan && <span>PAN: {vendor.pan} </span>}
                    {vendor.gst && <span>GSTIN: {vendor.gst}</span>}
                  </div>
                )}
              </div>
            ) : null;
          })()}
          
          <div className="receipt-divider"></div>

          {/* Items Table with MRP + Selling Price */}
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: '38%' }}>ITEM</th>
                <th className="right" style={{ width: '13%' }}>MRP</th>
                <th className="right" style={{ width: '14%' }}>RATE</th>
                <th className="center" style={{ width: '10%' }}>QTY</th>
                <th className="right" style={{ width: '14%' }}>SAVE</th>
                <th className="right" style={{ width: '11%' }}>AMT</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, i) => {
                const mrp = Number(item.mrp) || 0;
                const rate = Number(item.sellingPrice);
                const explicitDisc = item.discount || 0;
                // Auto-calculate discount% from MRP if no explicit discount set
                const mrpDiscPct = (mrp > rate && mrp > 0) ? ((mrp - rate) / mrp * 100) : 0;
                const displayDiscPct = explicitDisc > 0 ? explicitDisc : mrpDiscPct;
                const amt = (rate * item.qty) * (1 - explicitDisc / 100);
                const displayMrp = mrp > 0 ? mrp : rate;
                return (
                  <tr key={i}>
                    <td>
                      <div className="item-name">{item.name}</div>
                      {item.barcode && <div className="item-barcode">[{item.barcode}]</div>}
                    </td>
                    <td className="right">
                      <div className="item-mrp-strike">₹{displayMrp.toFixed(2)}</div>
                    </td>
                    <td className="right">
                      {isEditing ? (
                        <input 
                          type="number" 
                          step="any"
                          value={item.sellingPrice} 
                          onChange={e => handlePriceChange(i, Number(e.target.value))}
                          style={{ width: '55px', fontSize: '11px', textAlign: 'right', border: '1px solid #ccc', background: '#f9f9f9', padding: '1px' }}
                        />
                      ) : (
                        <span>₹{rate.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="center">{item.qty}</td>
                    <td className="right" style={{ color: displayDiscPct > 0 ? 'green' : 'inherit', fontWeight: displayDiscPct > 0 ? 'bold' : 'normal' }}>
                      {displayMrp > rate ? `₹${(displayMrp - rate).toFixed(2)}` : '—'}
                    </td>
                    <td className="right"><strong>₹{amt.toFixed(2)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="receipt-divider"></div>
          
          {/* Totals */}
          <div className="totals-section">
            <div className="receipt-row" style={{ fontSize: '12px' }}><span>Subtotal:</span><span>₹{currentSubtotal.toFixed(2)}</span></div>
            <div className="receipt-row" style={{ fontSize: '12px' }}><span>GST:</span><span>₹{currentGst.toFixed(2)}</span></div>
            {currentDiscount > 0 && <div className="receipt-row" style={{ fontSize: '12px', color: 'green' }}><span>Discount Saved:</span><span>-₹{currentDiscount.toFixed(2)}</span></div>}
            {(sale.freight || 0) > 0 && <div className="receipt-row" style={{ fontSize: '12px' }}><span>Freight/Shipping:</span><span>+₹{sale.freight.toFixed(2)}</span></div>}
            {(sale.labor || 0) > 0 && <div className="receipt-row" style={{ fontSize: '12px' }}><span>Labor Charges:</span><span>+₹{sale.labor.toFixed(2)}</span></div>}
            {sale.roundOff ? <div className="receipt-row" style={{ fontSize: '12px' }}><span>Round Off:</span><span>{sale.roundOff > 0 ? '+' : ''}₹{sale.roundOff.toFixed(2)}</span></div> : null}
          </div>
          
          <div className="receipt-divider" style={{ borderStyle: 'solid' }}></div>
          <div className="receipt-row" style={{ fontSize: '15px', fontWeight: 'bold' }}>
            <span>GRAND TOTAL:</span>
            <span>₹{currentGrandTotal.toFixed(2)}</span>
          </div>
          {['Debt', 'Credit'].includes(sale.paymentMode) && sale.cashPaid !== undefined && (
            <>
              <div className="receipt-row" style={{ fontSize: '13px', marginTop: '4px' }}>
                <span>Amount Paid:</span>
                <span>₹{Number(sale.cashPaid).toFixed(2)}</span>
              </div>
              <div className="receipt-row" style={{ fontSize: '13px', fontWeight: 'bold' }}>
                <span>Remaining Debt:</span>
                <span>₹{Math.max(0, currentGrandTotal - Number(sale.cashPaid)).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="receipt-divider" style={{ borderStyle: 'solid' }}></div>

          {/* Savings message */}
          {(() => {
            const totalMrp = currentItems.reduce((a, c) => a + (c.mrp || c.sellingPrice) * c.qty, 0);
            const savings = totalMrp - currentSubtotal;
            return savings > 0.5 ? (
              <div className="receipt-center" style={{ fontSize: '11px', margin: '6px 0' }}>
                🎉 You saved <strong>₹{savings.toFixed(2)}</strong> on MRP!
              </div>
            ) : null;
          })()}
          
          {/* QR Code - Sample */}
          <div className="receipt-center" style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>📱 SCAN TO PAY</div>
            <img 
              src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=UPI+Payment+Sample&color=000000&bgcolor=ffffff"
              alt="Sample QR Code" 
              style={{ width: '110px', height: '110px', border: '1px solid #eee', padding: '3px' }}
            />
            <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>PhonePe | BHIM UPI | GPay | Paytm</div>
          </div>

          <div className="receipt-center" style={{ fontSize: '11px', marginTop: '14px', borderTop: '1px dashed #000', paddingTop: '8px' }}>
            Thank you for shopping at {storeInfo.name}!<br />
            *** No Refund / No Exchange ***
          </div>

          {/* Wintogether Footer */}
          <div style={{ textAlign: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px dotted #ccc' }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '5px', letterSpacing: '0.5px' }}>Designed &amp; Developed by</div>
            <img
              src="/wintogether_logo.png"
              alt="Wintogether Technology"
              style={{ height: '24px', objectFit: 'contain', maxWidth: '160px', display: 'block', margin: '0 auto' }}
            />
          </div>
        </div>

        <div className="modal-footer">
          {isEditing ? (
            <>
              <button className="btn btn-ghost" onClick={() => { setIsEditing(false); setEditedItems(sale.items); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdits}>Save Changes</button>
            </>
          ) : (
            <>
              <button className="btn btn-danger" onClick={handleDeleteBill} title="Delete Bill completely">🗑️ Delete</button>
              <button className="btn btn-ghost" onClick={handleEditBill} title="Add or Remove Products">🛒 Edit Cart</button>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
              <button className="btn btn-primary" onClick={handlePrint}>🖨️ Print</button>
            </>
          )}
        </div>
      </div>

      {confirmAction && (
        <div className="modal-overlay" style={{ zIndex: 1100, backdropFilter: 'blur(4px)' }} onClick={() => setConfirmAction(null)}>
          <div className="modal" style={{ maxWidth: '340px', textAlign: 'center', padding: '30px 20px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '16px', lineHeight: 1 }}>
              {confirmAction.type === 'delete' ? '🗑️' : '🛒'}
            </div>
            <h3 style={{ marginBottom: '12px', fontSize: '1.25rem', fontWeight: 'bold' }}>
              {confirmAction.type === 'delete' ? 'Delete Bill?' : 'Edit Bill Cart?'}
            </h3>
            <p style={{ color: 'var(--text3)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>
              {confirmAction.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-ghost" style={{ flex: 1, padding: '12px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }} onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button 
                className={`btn ${confirmAction.type === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                style={{ flex: 1, padding: '12px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}
                onClick={confirmExecution}
              >
                Yes, {confirmAction.type === 'delete' ? 'Delete' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
