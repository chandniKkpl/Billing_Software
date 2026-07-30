import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { showToast } from '../components/Toast';

const CATEGORIES = ['Lips', 'Face', 'Eyes', 'Skincare', 'Nails', 'Hair', 'Fragrance', 'Other'];
const EMPTY = { name: '', barcode: '', itemType: 'Goods', category: 'Hardware', brand: '', purchasedFrom: '', purchasePrice: '', sellingPrice: '', mrp: '', stock: '', gst: 18, godown: 'Main' };

import ProductModal from '../components/modals/ProductModal';
export default function Inventory() {
  const { state, addProduct, updateProduct, deleteProduct } = useApp();
  const tx = useT(state.lang);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [whFilter, setWhFilter] = useState('All');
  const [modal, setModal] = useState(null); // null | 'add' | product obj

  const categories = ['All', ...CATEGORIES];
  const warehouses = state.warehouses || [];

  const filtered = state.products.filter(p => {
    const q = search.toLowerCase();
    const matchCat = catFilter === 'All' || p.category === catFilter;
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.barcode?.includes(q);
    
    let matchWh = true;
    if (whFilter !== 'All') {
      // For specific warehouse, only show if it has stock > 0
      const whStock = p.warehouseStock?.[whFilter] || 0;
      matchWh = whStock > 0;
    }
    
    return matchCat && matchQ && matchWh;
  });

  const handleSave = async (product) => {
    try {
      if (product.itemType !== 'Service' && product.stock !== undefined && product.stock !== '') {
        const whId = product.godown || 'main';
        product.warehouseStock = { [whId]: Number(product.stock) };
        product.stock = Number(product.stock);
      }

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
            <select className="form-input" style={{ width: 180 }} value={whFilter} onChange={e => setWhFilter(e.target.value)}>
              <option value="All">All Warehouses (Total)</option>
              <option value="main">Main Store</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
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
                  <th style={{ width: '220px' }}>{whFilter === 'All' ? 'Stock Breakdown' : 'Stock'}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>{tx.noProducts}</td></tr>
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
                    <td>
                      {p.itemType === 'Service' ? (
                        <span className="badge badge-yellow">Service</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {whFilter === 'All' ? (
                            <>
                              <div style={{ fontWeight: 600 }}>Total: {getStockBadge(p.stock)}</div>
                              {p.warehouseStock && Object.keys(p.warehouseStock).map(whId => {
                                 const qty = p.warehouseStock[whId];
                                 if (qty <= 0) return null;
                                 const whName = warehouses.find(w => w.id === whId)?.name || (whId === 'main' ? 'Main Store' : whId);
                                 return <div key={whId} style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{whName}: {qty}</div>
                              })}
                            </>
                          ) : (
                            <div style={{ fontWeight: 600 }}>{getStockBadge(p.warehouseStock?.[whFilter] || 0)}</div>
                          )}
                        </div>
                      )}
                    </td>
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
          warehouses={warehouses}
          onSave={handleSave}
          onClose={() => setModal(null)}
          tx={tx}
        />
      )}
    </div>
  );
}
