import { Trash2, ShoppingBag, X, Plus } from 'lucide-react';

export default function PurchaseCart({
  tx, state, dispatch,
  warehouseId, setWarehouseId, displayWarehouses,
  selectedVendorId, setSelectedVendorId,
  showNewVendorForm, setShowNewVendorForm,
  newVendor, setNewVendor, addVendor, showToast,
  updateQty
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
        <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '4px' }}>Receive to Warehouse:</div>
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

      {/* Vendor Selection */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 15px', borderBottom: '1px solid var(--border)' }}>
        <select className="form-input" value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} style={{ flex: 1 }}>
          <option value="">Walk-in Vendor</option>
          {state.vendors?.map(v => (
            <option key={v.id} value={v.id}>{v.name} {v.phone ? `(${v.phone})` : ''}</option>
          ))}
        </select>
        <button className="btn btn-ghost" onClick={() => setShowNewVendorForm(!showNewVendorForm)}>
          {showNewVendorForm ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {showNewVendorForm && (
        <div style={{ background: 'var(--bg2)', padding: 15, borderRadius: 8, marginTop: 10 }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>New Vendor</h4>
          <input className="form-input" placeholder="Vendor Name *" value={newVendor.name} onChange={e => setNewVendor({ ...newVendor, name: e.target.value })} style={{ marginBottom: 10 }} />
          <input className="form-input" placeholder="Phone" value={newVendor.phone} onChange={e => setNewVendor({ ...newVendor, phone: e.target.value })} style={{ marginBottom: 10 }} />
          <input className="form-input" placeholder="PAN No." value={newVendor.pan} onChange={e => setNewVendor({ ...newVendor, pan: e.target.value })} style={{ marginBottom: 10 }} />
          <input className="form-input" placeholder="GST No." value={newVendor.gst} onChange={e => setNewVendor({ ...newVendor, gst: e.target.value })} style={{ marginBottom: 10 }} />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={async () => {
            if (!newVendor.name) { showToast('Name required', 'error'); return; }
            const id = Date.now().toString();
            await addVendor({ ...newVendor, id });
            setSelectedVendorId(id);
            setShowNewVendorForm(false);
            setNewVendor({ name: '', phone: '', pan: '', gst: '' });
            showToast('Vendor added!', 'success');
          }}>Save Vendor</button>
        </div>
      )}

      {selectedVendorId && state.purchases?.filter(p => p.vendorId === selectedVendorId).length > 0 && (
        <div style={{ padding: '10px 15px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text3)', marginBottom: '8px' }}>Recent Purchases from Vendor</div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {state.purchases.filter(p => p.vendorId === selectedVendorId).sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map(p => (
              <div key={p.id} style={{ background: 'var(--bg2)', padding: '8px', borderRadius: '6px', minWidth: '120px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{new Date(p.date).toLocaleDateString()}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>₹{p.grandTotal.toFixed(2)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>Bill #{p.purchaseBillNo || p.id.slice(-6)}</div>
              </div>
            ))}
          </div>
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
          <div key={item.id} className="cart-item" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <div className="cart-item-info">
                <div className="cart-item-name" style={{ fontWeight: 'bold' }}>{item.name}</div>
              </div>
              <button className="cart-remove" onClick={() => dispatch({ type: 'REMOVE_FROM_CART', payload: item.id })} style={{ position: 'relative', background: 'transparent' }}>
                <X size={18} color="var(--danger)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '60px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '2px' }}>Rate (₹)</div>
                <input 
                  type="number" className="form-input" style={{ padding: '6px', fontSize: '0.85rem' }} 
                  value={item.purchasePrice !== undefined ? item.purchasePrice : item.sellingPrice} 
                  onChange={e => dispatch({ type: 'UPDATE_CART_ITEM', payload: { id: item.id, purchasePrice: parseFloat(e.target.value) || 0 } })} 
                />
              </div>
              <div style={{ flex: 1, minWidth: '60px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '2px' }}>Sale (₹)</div>
                <input 
                  type="number" className="form-input" style={{ padding: '6px', fontSize: '0.85rem' }} 
                  value={item.sellingPrice || ''} 
                  onChange={e => dispatch({ type: 'UPDATE_CART_ITEM', payload: { id: item.id, sellingPrice: parseFloat(e.target.value) || 0 } })} 
                />
              </div>
              <div style={{ flex: 1, minWidth: '50px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '2px' }}>GST %</div>
                <input 
                  type="number" className="form-input" style={{ padding: '6px', fontSize: '0.85rem' }} 
                  value={item.gst || ''} 
                  onChange={e => dispatch({ type: 'UPDATE_CART_ITEM', payload: { id: item.id, gst: parseFloat(e.target.value) || 0 } })} 
                />
              </div>
              <div style={{ flex: 1, minWidth: '50px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '2px' }}>Disc %</div>
                <input 
                  type="number" className="form-input" style={{ padding: '6px', fontSize: '0.85rem' }} 
                  value={item.discount || ''} 
                  onChange={e => dispatch({ type: 'UPDATE_CART_ITEM', payload: { id: item.id, discount: parseFloat(e.target.value) || 0 } })} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <div className="cart-qty" style={{ margin: 0 }}>
                <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                <span className="qty-num">{item.qty}</span>
                <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
              </div>
              
              <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1rem' }}>
                Total: ₹{(((Number(item.purchasePrice) || Number(item.sellingPrice) || 0) * item.qty) * (1 - (Number(item.discount) || 0)/100)).toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
