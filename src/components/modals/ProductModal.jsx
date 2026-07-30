import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { showToast } from '../Toast';

const EMPTY = { name: '', barcode: '', itemType: 'Goods', category: 'Hardware', brand: '', purchasedFrom: '', purchasePrice: '', sellingPrice: '', mrp: '', stock: '', gst: 18, godown: 'Main' };

export default function ProductModal({ product, allProducts, warehouses, onSave, onClose, tx }) {
  const [form, setForm] = useState(product || EMPTY);
  const barcodeRef = useRef();

  useEffect(() => {
    setTimeout(() => barcodeRef.current?.focus(), 100);
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submit
      const code = e.target.value.trim();
      if (!code) return;
      
      const existing = allProducts.find(p => p.barcode === code);
      if (existing && (!form.id || form.id !== existing.id)) {
        setForm(existing);
        showToast('Existing product found! Details loaded.', 'info');
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.sellingPrice) { showToast('Name & selling price required', 'error'); return; }
    onSave({ ...form, id: form.id || Date.now().toString(), sellingPrice: +form.sellingPrice, purchasePrice: +form.purchasePrice, mrp: +form.mrp, stock: +form.stock, gst: +form.gst, godown: form.godown || 'Main' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{form.id ? tx.editProduct : tx.addProduct}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{tx.barcode} (Scan now)</label>
              <input 
                ref={barcodeRef}
                className="form-input" 
                value={form.barcode} 
                onChange={e => set('barcode', e.target.value)} 
                onKeyDown={handleBarcodeScan}
                placeholder="Scan or type barcode..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">{tx.name} *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Item Type</label>
              <select className="form-input" value={form.itemType || 'Goods'} onChange={e => set('itemType', e.target.value)}>
                <option value="Goods">📦 Goods</option>
                <option value="Service">🔧 Service</option>
              </select>
            </div>
          </div>
          {(!form.itemType || form.itemType === 'Goods') && (
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{tx.brand}</label>
                <input className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Purchased From (Supplier)</label>
                <input className="form-input" value={form.purchasedFrom || ''} onChange={e => set('purchasedFrom', e.target.value)} />
              </div>
            </div>
          )}
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">{tx.mrp} (₹)</label>
              <input className="form-input" type="number" step="any" value={form.mrp} onChange={e => set('mrp', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{tx.sellingPrice} (₹) *</label>
              <input className="form-input" type="number" step="any" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{tx.purchasePrice} (₹)</label>
              <input className="form-input" type="number" step="any" value={form.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            {(!form.itemType || form.itemType === 'Goods') && (
              <>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{tx.stock} (Qty)</label>
                  <input className="form-input" type="number" step="any" value={form.stock} onChange={e => set('stock', e.target.value)} style={{ background: 'rgba(5, 150, 105, 0.1)', fontWeight: 'bold' }} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Warehouse</label>
                  <select className="form-input" value={form.godown || 'main'} onChange={e => set('godown', e.target.value)}>
                    <option value="main">Main Store</option>
                    {(warehouses || []).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">GST (%)</label>
              <select className="form-input" value={form.gst !== undefined ? form.gst : 18} onChange={e => set('gst', Number(e.target.value))}>
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{tx.cancel}</button>
            <button type="submit" className="btn btn-primary">{tx.save}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
