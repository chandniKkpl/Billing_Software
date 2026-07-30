import { Search, Scan } from 'lucide-react';

export default function ProductSearch({
  tx,
  search, setSearch,
  barcode, setBarcode,
  barcodeRef, handleBarcodeKey, handleBarcodeSubmit,
  filtered, addToCart, lastSoldPrices
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
              {lastSoldPrices[p.id] !== undefined && (
                <div style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 'bold' }}>
                  Last Sold: ₹{lastSoldPrices[p.id]}
                </div>
              )}
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
