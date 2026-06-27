import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { showToast } from '../components/Toast';

const CATEGORIES = ['Lips', 'Face', 'Eyes', 'Skincare', 'Nails', 'Hair', 'Fragrance', 'Other'];
const EMPTY = { name: '', barcode: '', category: 'Skincare', brand: '', purchasedFrom: '', purchasePrice: '', sellingPrice: '', mrp: '', stock: '', gst: 18 };

function ProductModal({ product, allProducts, onSave, onClose, tx }) {
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
    onSave({ ...form, id: form.id || Date.now().toString(), sellingPrice: +form.sellingPrice, purchasePrice: +form.purchasePrice, mrp: +form.mrp, stock: +form.stock, gst: +form.gst });
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
              <label className="form-label">{tx.brand}</label>
              <input className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Purchased From (Supplier)</label>
              <input className="form-input" value={form.purchasedFrom || ''} onChange={e => set('purchasedFrom', e.target.value)} />
            </div>
          </div>
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
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">{tx.stock} (qty)</label>
              <input className="form-input" type="number" step="any" value={form.stock} onChange={e => set('stock', e.target.value)} style={{ background: 'rgba(5, 150, 105, 0.1)', fontWeight: 'bold' }} />
            </div>
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

export default function Inventory() {
  const { state, addProduct, updateProduct, deleteProduct } = useApp();
  const tx = useT(state.lang);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [modal, setModal] = useState(null); // null | 'add' | product obj

  const categories = ['All', ...CATEGORIES];

  const filtered = state.products.filter(p => {
    const q = search.toLowerCase();
    const matchCat = catFilter === 'All' || p.category === catFilter;
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.barcode?.includes(q);
    return matchCat && matchQ;
  });

  const handleSave = async (product) => {
    try {
      if (product.id && state.products.find(p => p.id === product.id)) {
        await updateProduct(product);
      } else {
        await addProduct(product);
      }
      showToast(product.id ? 'Product updated!' : 'Product added!', 'success');
      setModal(null);
    } catch (err) {
      showToast('Error saving product: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`${tx.confirmDelete}\n"${name}"`)) return;
    try {
      await deleteProduct(id);
      showToast('Product deleted', 'info');
    } catch (err) {
      showToast('Error deleting: ' + err.message, 'error');
    }
  };

  const getStockBadge = (stock) => {
    if (stock <= 0) return <span className="badge badge-red">Out of Stock</span>;
    if (stock <= 5) return <span className="badge badge-yellow">Low: {stock}</span>;
    return <span className="badge badge-green">{stock}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h2>📦 {tx.inventory}</h2>
        <button className="btn btn-primary" onClick={() => setModal('add')}>
          <Plus size={16} /> {tx.addProduct}
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="inv-toolbar">
            <div className="search-bar" style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input
                className="inv-search-input"
                type="text"
                placeholder={tx.searchProduct}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{filtered.length} products</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tx.name}</th>
                  <th>{tx.barcode}</th>
                  <th>{tx.brand}</th>
                  <th>Purchased From</th>
                  <th>{tx.mrp}</th>
                  <th>{tx.sellingPrice}</th>
                  <th>{tx.purchasePrice}</th>
                  <th>GST</th>
                  <th>{tx.stock}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>{tx.noProducts}</td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td><span style={{ fontWeight: 600 }}>{p.name}</span></td>
                    <td><code style={{ fontSize: '0.75rem', background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>{p.barcode || '—'}</code></td>
                    <td style={{ color: 'var(--text3)' }}>{p.brand || '—'}</td>
                    <td style={{ color: 'var(--text3)' }}>{p.purchasedFrom || '—'}</td>
                    <td>₹{p.mrp || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{p.sellingPrice}</td>
                    <td style={{ color: 'var(--text3)' }}>₹{p.purchasePrice || '—'}</td>
                    <td>{p.gst || 0}%</td>
                    <td>{getStockBadge(p.stock || 0)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(p)}>
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id, p.name)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <ProductModal
          product={modal === 'add' ? null : modal}
          allProducts={state.products}
          onSave={handleSave}
          onClose={() => setModal(null)}
          tx={tx}
        />
      )}
    </div>
  );
}
