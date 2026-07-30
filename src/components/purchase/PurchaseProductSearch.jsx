import { Search, Scan, Upload, Plus, Loader } from 'lucide-react';

export default function PurchaseProductSearch({
  tx,
  search, setSearch,
  barcode, setBarcode,
  barcodeRef, handleBarcodeKey, handleBarcodeSubmit,
  filtered, addToCart,
  fileInputRef, handleFileUpload, isParsing,
  setProductForm, setShowProductModal
}) {
  return (
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
          
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept=".csv, .xlsx, .jpg, .png, .jpeg, application/pdf"
            onChange={handleFileUpload} 
          />
          <button 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 15px' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
          >
            {isParsing ? <Loader size={16} className="spin" /> : <Upload size={16} />}
            Smart Parse Bill
          </button>
          <button className="btn btn-primary" style={{ padding: '0 15px', display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => {
            setProductForm({ name: '', brand: '', barcode: '', sellingPrice: '', mrp: '', purchasePrice: '', stock: '', gst: '' });
            setShowProductModal(true);
          }}>
            <Plus size={16} /> New Item
          </button>
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
  );
}
