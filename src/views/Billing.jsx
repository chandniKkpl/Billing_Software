import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { Search, Scan, Trash2, X, ShoppingBag } from 'lucide-react';
import Receipt from '../components/Receipt';
import { showToast } from '../components/Toast';

function calcTotals(cart, billDiscount = { type: 'none', value: 0 }) {
  let subtotal = 0;
  let gst = 0;
  
  cart.forEach(c => {
    const qty = Number(c.qty) || 0;
    const price = Number(c.sellingPrice) || 0;
    const itemGstPct = Number(c.gst) || 0;
    subtotal += price * qty;
    gst += (price * qty) * (itemGstPct / 100);
  });

  let discount = 0;
  const val = Number(billDiscount.value) || 0;
  if (billDiscount.type === 'percent') {
    discount = (subtotal + gst) * (val / 100);
  } else if (billDiscount.type === 'flat') {
    discount = val;
  }

  const grandTotal = Math.max(0, subtotal + gst - discount);
  return { subtotal, gst, grandTotal, discount };
}

export default function Billing() {
  const { state, dispatch, completeSale, addCustomer } = useApp();
  const tx = useT(state.lang);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [bankDetails, setBankDetails] = useState({
    utr: '',
    chequeNo: '',
    bankName: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [cashPaid, setCashPaid] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [catFilter, setCatFilter] = useState('All');
  const barcodeRef = useRef();
  const [editingTotal, setEditingTotal] = useState(null); // { id, value }
  const [billDiscount, setBillDiscount] = useState({ type: 'none', value: 0 });
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [showOfferPopup, setShowOfferPopup] = useState(false);

  const selectedCustomer = state.customers?.find(c => c.id === selectedCustomerId);

  useEffect(() => {
    if (selectedCustomer && selectedCustomer.type === 'old') {
      setShowOfferPopup(true);
    }
  }, [selectedCustomerId]);

  const startEditTotal = (item) => {
    setEditingTotal({ id: item.id, value: (item.sellingPrice * item.qty).toFixed(0) });
  };

  const commitEditTotal = (item) => {
    if (!editingTotal) return;
    const newTotal = parseFloat(editingTotal.value);
    if (!isNaN(newTotal) && newTotal >= 0 && item.qty > 0) {
      const newUnitPrice = newTotal / item.qty;
      dispatch({ type: 'UPDATE_CART_ITEM', payload: { id: item.id, sellingPrice: newUnitPrice } });
      showToast(`Total updated to ₹${newTotal}`, 'success');
    }
    setEditingTotal(null);
  };

  const cancelEditTotal = () => {
    setEditingTotal(null);
  };

  const categories = ['All', ...new Set(state.products.map(p => p.category).filter(Boolean))];

  const filtered = state.products.filter(p => {
    const q = search.toLowerCase();
    const matchCat = catFilter === 'All' || p.category === catFilter;
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.barcode?.includes(q);
    return matchCat && matchQ;
  });

  // Keep barcode input focused for scanner
  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
        barcodeRef.current?.focus();
      }
    }, 1000);
    return () => clearInterval(focusInterval);
  }, []);

  // Barcode scanner: auto-submit on Enter or after 13 chars
  const handleBarcodeKey = (e) => {
    if (e.key === 'Enter') {
      handleBarcodeSubmit();
    }
  };

  const handleBarcodeSubmit = () => {
    const code = barcode.trim();
    if (!code) return;
    const product = state.products.find(p => p.barcode === code);
    if (product) {
      if (product.stock <= 0) {
        showToast('Out of stock!', 'error');
      } else {
        dispatch({ type: 'ADD_TO_CART', payload: product });
        showToast(`${product.name} Added!`, 'success');
      }
    } else {
      showToast(tx.barcodeNotFound, 'error');
    }
    setBarcode('');
    setTimeout(() => barcodeRef.current?.focus(), 10);
  };

  const addToCart = (product) => {
    if (!product.stock || product.stock <= 0) { showToast('Out of stock!', 'error'); return; }
    dispatch({ type: 'ADD_TO_CART', payload: product });
    showToast(`${product.name} added!`, 'info');
  };

  const updateQty = (id, delta) => {
    const item = state.cart.find(c => c.id === id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) dispatch({ type: 'REMOVE_FROM_CART', payload: id });
    else {
      const prod = state.products.find(p => p.id === id);
      if (prod && newQty > prod.stock) { showToast('Not enough stock!', 'error'); return; }
      dispatch({ type: 'UPDATE_CART_ITEM', payload: { id, qty: newQty } });
    }
  };

  const { subtotal, gst, grandTotal, discount } = calcTotals(state.cart, billDiscount);
  const change = cashPaid ? Math.max(0, parseFloat(cashPaid) - grandTotal) : 0;

  const generateBill = async () => {
    if (state.cart.length === 0) { showToast('Cart is empty!', 'error'); return; }
    
    // If editing an existing sale, keep the old ID and date, else create new
    const existingSale = state.editingSaleId ? state.sales.find(s => s.id === state.editingSaleId) : null;
    const saleId = existingSale ? existingSale.id : Date.now().toString();
    const saleDate = existingSale ? existingSale.date : new Date().toISOString();

    let finalBankInfo = '';
    if (['RTGS', 'NEFT'].includes(paymentMode)) {
      if (!bankDetails.utr || !bankDetails.date) {
        return showToast(`Please enter UTR Number and Date for ${paymentMode}`, 'error');
      }
      finalBankInfo = `UTR: ${bankDetails.utr} | Date: ${bankDetails.date}`;
    } else if (paymentMode === 'Cheque') {
      if (!bankDetails.chequeNo || !bankDetails.bankName || !bankDetails.date) {
        return showToast('Please enter Cheque Number, Bank Name, and Date', 'error');
      }
      finalBankInfo = `Chq: ${bankDetails.chequeNo} | Bank: ${bankDetails.bankName} | Date: ${bankDetails.date}`;
    }

    const sale = {
      id: saleId,
      date: saleDate,
      items: state.cart,
      subtotal, gst, grandTotal, discount,
      billDiscount,
      paymentMode,
      bankInfo: finalBankInfo,
      customerId: selectedCustomerId || null,
      cashPaid: paymentMode === 'Cash' ? parseFloat(cashPaid) || grandTotal : 0,
    };
    if (paymentMode === 'Debt' && !selectedCustomerId) {
      showToast('Please select a customer for Debt', 'error');
      return;
    }
    try {
      await completeSale(sale);
      setReceipt(sale);
      setPaymentMode('Cash');
      setBankDetails({ utr: '', chequeNo: '', bankName: '', date: new Date().toISOString().split('T')[0] });
      setCashPaid('');
      setShowNewCustomerForm(false);
      showToast(state.editingSaleId ? 'Bill updated successfully!' : 'Bill generated successfully!', 'success');
    } catch (err) {
      showToast('Error generating bill: ' + err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>🛒 {tx.billing}</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
          {state.cart.length} items in cart
        </span>
      </div>

      <div className="page-content">
        <div className="billing-layout">
          {/* LEFT PANEL */}
          <div className="billing-left">
            {/* Barcode Input */}
            <div className="barcode-bar">
              <Scan size={20} color="var(--primary)" />
              <input
                ref={barcodeRef}
                autoFocus
                type="text"
                placeholder={tx.scanBarcode + ' (Enter to add)'}
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                onKeyDown={handleBarcodeKey}
              />
              <button className="btn btn-primary btn-sm" onClick={handleBarcodeSubmit}>Add</button>
            </div>

            {/* Product Grid */}
            <div className="product-search-wrap" style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div className="search-bar" style={{ flex: 1, margin: 0 }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder={tx.searchProduct}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="product-grid">
                {filtered.map(p => (
                  <div
                    key={p.id}
                    className={`product-chip ${!p.stock || p.stock <= 0 ? 'oos' : ''}`}
                    onClick={() => addToCart(p)}
                    title={p.barcode}
                  >
                    <span className={`product-chip-stock badge ${p.stock <= 0 ? 'badge-red' : p.stock <= 5 ? 'badge-yellow' : 'badge-green'}`}>
                      {p.stock <= 0 ? '✕' : p.stock}
                    </span>
                    <div className="product-chip-name">{p.name}</div>
                    <div className="product-chip-brand">{p.brand}</div>
                    <div className="product-chip-price">₹{p.sellingPrice}</div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: '0.85rem' }}>
                    No products found
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="billing-right">
            {/* Cart */}
            <div className="cart-card">
              <div className="cart-header">
                <h3>🛒 {tx.cart}</h3>
                {state.cart.length > 0 && (
                  <button className="btn btn-danger btn-sm" onClick={() => dispatch({ type: 'CLEAR_CART' })}>
                    <Trash2 size={13} /> {tx.clearCart}
                  </button>
                )}
              </div>

              {/* Customer Selection */}
              <div style={{ padding: '10px 15px', borderBottom: 'showNewCustomerForm ? "none" : "1px solid var(--border)"' }}>
                <select 
                  className="form-input" 
                  value={selectedCustomerId} 
                  onChange={e => {
                    if (e.target.value === 'NEW') {
                      setShowNewCustomerForm(true);
                      setSelectedCustomerId('');
                    } else {
                      setShowNewCustomerForm(false);
                      setSelectedCustomerId(e.target.value);
                    }
                  }}
                >
                  <option value="">-- Select Customer (Optional) --</option>
                  <option value="NEW" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>+ Add New Customer</option>
                  {state.customers?.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.phone} {c.type === 'old' ? '(Old)' : ''}</option>
                  ))}
                </select>
                {selectedCustomer && selectedCustomer.udhaarBalance > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: '4px' }}>
                    Pending Dues: ₹{selectedCustomer.udhaarBalance.toFixed(2)}
                  </div>
                )}
              </div>

              {showNewCustomerForm && (
                <div style={{ padding: '0 15px 10px 15px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
                  <input className="form-input" placeholder="Name" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} style={{ flex: 1, padding: '6px', fontSize: '0.8rem' }} />
                  <input className="form-input" placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} style={{ flex: 1, padding: '6px', fontSize: '0.8rem' }} />
                  <button className="btn btn-primary btn-sm" style={{ padding: '0 10px' }} onClick={async () => {
                    if (!newCustomer.name) return showToast('Name is required', 'error');
                    const id = Date.now().toString();
                    await addCustomer({ id, name: newCustomer.name, phone: newCustomer.phone, type: 'new', udhaarBalance: 0 });
                    setSelectedCustomerId(id);
                    setShowNewCustomerForm(false);
                    setNewCustomer({ name: '', phone: '' });
                    showToast('Customer added successfully', 'success');
                  }}>Save</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '0 8px' }} onClick={() => setShowNewCustomerForm(false)}>✕</button>
                </div>
              )}

              <div className="cart-items">
                {state.cart.length === 0 && (
                  <div className="cart-empty">
                    <ShoppingBag size={40} strokeWidth={1.5} style={{ opacity: 0.3 }} />
                    <p style={{ fontSize: '0.82rem' }}>Scan or click a product to add</p>
                  </div>
                )}
                {state.cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-price">₹{item.sellingPrice % 1 === 0 ? item.sellingPrice : item.sellingPrice.toFixed(2)} each</div>
                    </div>
                    <div className="cart-qty">
                      <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                      <span className="qty-num">{item.qty}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                    </div>
                    {editingTotal?.id === item.id ? (
                      <input
                        className="cart-price-edit-input"
                        type="number"
                        min="0"
                        step="any"
                        autoFocus
                        value={editingTotal.value}
                        onChange={e => setEditingTotal({ id: item.id, value: e.target.value })}
                        onBlur={() => commitEditTotal(item)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEditTotal(item);
                          if (e.key === 'Escape') cancelEditTotal();
                        }}
                      />
                    ) : (
                      <div
                        className="cart-item-total editable-total"
                        title="Click to edit total amount"
                        onClick={() => startEditTotal(item)}
                      >
                        ₹{(item.sellingPrice * item.qty).toFixed(0)} ✏️
                      </div>
                    )}
                    <button className="cart-remove" onClick={() => dispatch({ type: 'REMOVE_FROM_CART', payload: item.id })}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals + Payment */}
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
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '0.7rem' }} onClick={() => setBillDiscount({ type: 'percent', value: 5 })}>Bulk 5%</button>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '0.7rem' }} onClick={() => setBillDiscount({ type: 'percent', value: 10 })}>Bulk 10%</button>
                </div>
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
          </div>
        </div>
      </div>

      {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}

      {/* Offer Popup for Old Customers */}
      {showOfferPopup && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowOfferPopup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎁</div>
            <h3 style={{ color: 'var(--primary)', marginBottom: '10px' }}>Special Offers Available!</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>
              <strong>{selectedCustomer.name}</strong> is a loyal old customer.
              <br/><br/>
              Apply Bulk 10% discount or let them know about our "Buy 2 Get 1" running offers on cosmetics!
            </p>
            <button className="btn btn-primary btn-block" onClick={() => setShowOfferPopup(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
