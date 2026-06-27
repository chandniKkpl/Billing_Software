import { useState, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { showToast } from '../components/Toast';

const EXPECTED_COLS = ['Product Name', 'Barcode', 'Category', 'Brand', 'Purchased From', 'MRP', 'Selling Price', 'Purchase Price', 'Quantity', 'GST'];

function mapRow(row) {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name: row['Product Name'] || row['Name'] || '',
    barcode: String(row['Barcode'] || row['barcode'] || ''),
    category: row['Category'] || row['category'] || 'Other',
    brand: row['Brand'] || row['brand'] || '',
    purchasedFrom: row['Purchased From'] || row['Supplier'] || '',
    mrp: parseFloat(row['MRP'] || row['mrp'] || 0),
    sellingPrice: parseFloat(row['Selling Price'] || row['sellingPrice'] || row['SP'] || 0),
    purchasePrice: parseFloat(row['Purchase Price'] || row['purchasePrice'] || row['PP'] || 0),
    stock: parseInt(row['Quantity'] || row['Stock'] || row['qty'] || 0),
    gst: parseInt(row['GST'] || row['gst'] || 18),
  };
}

export default function ImportExcel() {
  const { bulkAddProducts } = useApp();
  const tx = useT(useApp().state.lang);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null); // { rows, errors }
  const [imported, setImported] = useState(false);
  const fileRef = useRef();

  const processFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xls', 'xlsx', 'csv'].includes(ext)) {
      showToast('Please upload .xls, .xlsx, or .csv file', 'error'); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        
        // Check if it's a Marg ERP CSV (starts with H,)
        if (ext === 'csv' && content.startsWith('H,')) {
          const lines = content.split('\n');
          let rows = [];
          lines.forEach(line => {
            const parts = line.split(',');
            if (parts[0] === 'T') {
              // Marg ERP T-line format:
              // [0]=T, [1]=compcode, [2]=company, [3]=itemcode, [4]=blank, [5]=name,
              // [6]=packing, [7]=brand, [8]=batch, [9]=expiry, [10]=free,
              // [11]=purchasePrice, [12]=mrp, [13]=blank, [14]=blank, [15]=qty
              const qty = parseInt(parts[15]) || 0;
              const purchasePrice = parseFloat(parts[11]) || 0;
              const mrp = parseFloat(parts[12]) || 0;
              rows.push({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                name: (parts[5] || '').trim(),
                barcode: (parts[3] || '').trim(),
                category: 'Other',
                brand: (parts[7] || '').trim(),
                purchasedFrom: (parts[2] || '').trim(),
                mrp,
                sellingPrice: mrp,       // MRP = selling price for Marg ERP
                purchasePrice,
                stock: qty,
                gst: 12
              });
            }
          });
          // Merge duplicate items (same barcode = same product, different batches → add qty)
          const merged = {};
          rows.forEach(r => {
            const key = r.barcode || r.name;
            if (merged[key]) {
              merged[key].stock += r.stock;
            } else {
              merged[key] = { ...r };
            }
          });
          rows = Object.values(merged).filter(r => r.name);
          const errors = rows.filter(r => !r.sellingPrice || r.sellingPrice <= 0);
          setResult({ rows, errors, total: rows.length });
          setImported(false);
          return;
        }

        // Check if it's Aryan Wellness / standard distributor CSV (has header row with 'billno')
        if (ext === 'csv' && content.toLowerCase().includes('billno') && content.toLowerCase().includes('qnty')) {
          const wb2 = XLSX.read(content, { type: 'binary' });
          const ws2 = wb2.Sheets[wb2.SheetNames[0]];
          const data2 = XLSX.utils.sheet_to_json(ws2, { defval: '' });
          let rows = data2.map(row => ({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: (row['itemdescription'] || row['name'] || '').toString().trim(),
            barcode: (row['itemcode'] || row['upc'] || '').toString().trim(),
            category: 'Other',
            brand: (row['companyname'] || row['manf'] || '').toString().trim(),
            purchasedFrom: (row['companyname'] || '').toString().trim(),
            mrp: parseFloat(row['mrp']) || 0,
            sellingPrice: parseFloat(row['mrp']) || parseFloat(row['rate']) || 0,
            purchasePrice: parseFloat(row['rate']) || 0,
            stock: parseInt(row['qnty']) || parseInt(row['quantity']) || 0,
            gst: parseFloat(row['sgstper'] ? row['sgstper'] * 2 : 12) || 12,
          })).filter(r => r.name);
          const errors = rows.filter(r => !r.sellingPrice || r.sellingPrice <= 0);
          setResult({ rows, errors, total: rows.length });
          setImported(false);
          return;
        }

        // Standard Excel/CSV parsing
        const wb = XLSX.read(content, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const rows = data.map(mapRow).filter(r => r.name);
        const errors = rows.filter(r => !r.sellingPrice || r.sellingPrice <= 0);
        setResult({ rows, errors, total: data.length });
        setImported(false);
      } catch (err) {
        showToast(tx.importError + ': ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    if (!result?.rows?.length) return;
    try {
      await bulkAddProducts(result.rows);
      showToast(`${result.rows.length} products imported!`, 'success');
      setImported(true);
    } catch (err) {
      showToast('Error importing: ' + err.message, 'error');
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      EXPECTED_COLS,
      ['Lakme Lipstick', '8901030874421', 'Lips', 'Lakme', 350, 299, 150, 50, 18],
      ['Maybelline Foundation', '3600531043568', 'Face', 'Maybelline', 799, 699, 400, 20, 18],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'wellpharmacy_template.xlsx');
  };

  return (
    <div>
      <div className="page-header">
        <h2>📊 {tx.importExcel}</h2>
        <button className="btn btn-ghost" onClick={downloadTemplate}>
          <Download size={16} /> Download Template
        </button>
      </div>

      <div className="page-content">
        {/* Instructions */}
        <div className="card" style={{ marginBottom: 20, background: 'rgba(5, 150, 105, 0.05)', borderColor: 'var(--border)' }}>
          <h3 style={{ marginBottom: 10, fontSize: '0.9rem' }}>📋 Required Excel Columns</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXPECTED_COLS.map(c => (
              <span key={c} className="badge badge-purple" style={{ fontSize: '0.75rem' }}>{c}</span>
            ))}
          </div>
          <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text3)' }}>
            Download the template above to get started. Existing products with same barcode will be updated.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className="drop-zone-icon">📂</div>
          <h3>{tx.dragDrop}</h3>
          <p>.xlsx · .xls · .csv supported</p>
          <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" style={{ display: 'none' }} onChange={e => processFile(e.target.files[0])} />
          <button className="btn btn-purple" style={{ marginTop: 16 }} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
            <Upload size={16} /> Browse File
          </button>
        </div>

        {/* Preview */}
        {result && (
          <div className="import-result">
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.95rem' }}>Preview: {result.rows.length} valid products found</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  {result.errors.length > 0 && (
                    <span className="badge badge-yellow"><AlertCircle size={12} /> {result.errors.length} warnings</span>
                  )}
                  {!imported ? (
                    <button className="btn btn-green" onClick={handleImport}>
                      <CheckCircle size={16} /> Import {result.rows.length} Products
                    </button>
                  ) : (
                    <span className="badge badge-green"><CheckCircle size={14} /> {tx.importSuccess}</span>
                  )}
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Barcode</th>
                      <th>Category</th>
                      <th>Brand</th>
                      <th>MRP</th>
                      <th>Selling Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td><code style={{ fontSize: '0.72rem' }}>{r.barcode || '—'}</code></td>
                        <td><span className="badge badge-purple">{r.category}</span></td>
                        <td style={{ color: 'var(--text3)' }}>{r.brand || '—'}</td>
                        <td>₹{r.mrp || '—'}</td>
                        <td style={{ color: 'var(--primary)', fontWeight: 600 }}>₹{r.sellingPrice}</td>
                        <td>{r.stock}</td>
                        <td>
                          {r.sellingPrice > 0
                            ? <span className="badge badge-green"><CheckCircle size={11} /> OK</span>
                            : <span className="badge badge-yellow"><AlertCircle size={11} /> No Price</span>
                          }
                        </td>
                      </tr>
                    ))}
                    {result.rows.length > 20 && (
                      <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '0.8rem' }}>...and {result.rows.length - 20} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
