import { Trash2, ShoppingBag, X } from 'lucide-react';

export default function BillingCart({
  tx,
  state, dispatch,
  warehouseId, setWarehouseId, displayWarehouses,
  selectedCustomerId, setSelectedCustomerId,
  showNewCustomerForm, setShowNewCustomerForm,
  newCustomer, setNewCustomer, selectedCustomer,
  addCustomer, showToast,
  editingTotal, setEditingTotal,
  startEditTotal, commitEditTotal, cancelEditTotal
}) {
  return (
    <div className="cart-card">
      <div className="cart-header">
        <h3>🛒 {tx.cart}</h3>
        {state.cart.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={() => dispatch({ type: 'CLEAR_CART' })}>
            <Trash2 size={13} /> {tx.clearCart}
          </button>
        )}
      </div>

      {/* Warehouse Selection */}
      <div style={{ padding: '10px 15px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg2)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '4px' }}>Dispatch from Warehouse:</div>
        <select 
          className="form-input" 
          value={warehouseId} 
          onChange={e => setWarehouseId(e.target.value)}
          style={{ width: '100%', fontSize: '0.85rem', padding: '6px' }}
        >
          {displayWarehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Customer Selection */}
      <div style={{ padding: '10px 15px', borderBottom: showNewCustomerForm ? 'none' : '1px solid var(--border)' }}>
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
        <div style={{ background: 'var(--bg2)', padding: 15, borderRadius: 8, marginTop: 10 }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>New Customer</h4>
          <input className="form-input" placeholder="Customer Name *" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} style={{ marginBottom: 10 }} />
          <input className="form-input" placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} style={{ marginBottom: 10 }} />
          <input className="form-input" placeholder="PAN No." value={newCustomer.pan} onChange={e => setNewCustomer({ ...newCustomer, pan: e.target.value })} style={{ marginBottom: 10 }} />
          <input className="form-input" placeholder="GST No." value={newCustomer.gst} onChange={e => setNewCustomer({ ...newCustomer, gst: e.target.value })} style={{ marginBottom: 10 }} />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={async () => {
            if (!newCustomer.name) { showToast('Name required', 'error'); return; }
            const id = Date.now().toString();
            await addCustomer({ ...newCustomer, id, type: 'new', udhaarBalance: 0, membershipTier: 'None' });
            setSelectedCustomerId(id);
            setShowNewCustomerForm(false);
            setNewCustomer({ name: '', phone: '', pan: '', gst: '' });
            showToast('Customer added!', 'success');
          }}>Save Customer</button>
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
              <input 
                type="number" 
                step="any"
                style={{ width: '60px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                value={item.qty}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0) {
                    dispatch({ type: 'UPDATE_CART_ITEM', payload: { id: item.id, qty: val } });
                  } else if (e.target.value === '') {
                    dispatch({ type: 'UPDATE_CART_ITEM', payload: { id: item.id, qty: '' } });
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === '' || parseFloat(e.target.value) === 0) {
                    dispatch({ type: 'REMOVE_FROM_CART', payload: item.id });
                  }
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text3)', marginLeft: '4px' }}>Qty</span>
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
  );
}
