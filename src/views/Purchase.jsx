import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { Search, Scan, Trash2, X, ShoppingBag, Plus, Upload, Loader } from 'lucide-react';
import Receipt from '../components/Receipt';
import { showToast } from '../components/Toast';
import PurchaseProductSearch from '../components/purchase/PurchaseProductSearch';
import PurchaseCart from '../components/purchase/PurchaseCart';
import PurchaseForm from '../components/purchase/PurchaseForm';
import * as XLSX from 'xlsx';
import { ai } from '../firebase';
import { getGenerativeModel } from 'firebase/ai';

function calcTotals(cart, billDiscount = { type: 'none', value: 0 }) {
  let subtotal = 0;
  let gst = 0;
  cart.forEach(c => {
    const qty = Number(c.qty) || 0;
    const rate = Number(c.purchasePrice) || Number(c.sellingPrice) || 0;
    const itemGstPct = Number(c.gst) || 0;
    const itemDiscPct = Number(c.discount) || 0;
    
    let base = rate * qty;
    let discAmount = base * (itemDiscPct / 100);
    let afterDisc = base - discAmount;
    
    subtotal += afterDisc;
    gst += afterDisc * (itemGstPct / 100);
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

export default function Purchase() {
  const { state, dispatch, completePurchase, addVendor, deletePurchase, addProduct } = useApp();
  const tx = useT(state.lang);
  const [view, setView] = useState('list'); // 'list' or 'form'
  const [listSearch, setListSearch] = useState('');
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
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', pan: '', gst: '' });
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseBillNo, setPurchaseBillNo] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef();
  const [warehouseId, setWarehouseId] = useState('main');
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', brand: '', barcode: '', sellingPrice: '', mrp: '', purchasePrice: '', stock: '', gst: '' });

  const selectedVendor = state.vendors?.find(v => v.id === selectedVendorId);
  const warehouses = state.warehouses || [];
  const displayWarehouses = warehouses.some(w => w.id === 'main') ? warehouses : [{id: 'main', name: 'Main Store'}, ...warehouses];

  useEffect(() => {
    if (state.editingPurchaseId) {
      const p = state.purchases.find(x => x.id === state.editingPurchaseId);
      if (p) {
        setPaymentMode(p.paymentMode);
        setSelectedVendorId(p.vendorId || '');
        setWarehouseId(p.warehouseId || 'main');
        setBillDiscount(p.billDiscount || { type: 'none', value: 0 });
        setPurchaseDate(p.date ? p.date.split('T')[0] : new Date().toISOString().split('T')[0]);
        setPurchaseBillNo(p.purchaseBillNo || '');
        if (p.paymentMode === 'Cash') setCashPaid(p.cashPaid?.toString() || '');
      }
    }
  }, [state.editingPurchaseId, state.purchases]);

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

  const handleProductSave = async () => {
    if (!productForm.name || !productForm.sellingPrice) {
      showToast('Name and Selling Price are required', 'error');
      return;
    }
    const newProduct = {
      id: Date.now().toString(),
      name: productForm.name,
      brand: productForm.brand || '',
      barcode: productForm.barcode || '',
      sellingPrice: parseFloat(productForm.sellingPrice) || 0,
      mrp: parseFloat(productForm.mrp) || 0,
      purchasePrice: parseFloat(productForm.purchasePrice) || 0,
      stock: parseInt(productForm.stock) || 0,
      gst: parseFloat(productForm.gst) || 0,
      category: 'General'
    };
    await addProduct(newProduct);
    
    // Auto add to cart if stock > 0, else we just add it to cart with qty=1 anyway for purchase
    dispatch({ type: 'ADD_TO_CART', payload: { ...newProduct, qty: 1 } });
    showToast(`${newProduct.name} saved and added to cart!`, 'success');
    setShowProductModal(false);
  };

  const processParsedItems = (items) => {
    let count = 0;
    let addedProductsCount = 0;
    items.forEach((item, idx) => {
      if (!item.name) return;
      let existingProd = state.products?.find(p => p.name.toLowerCase().trim() === item.name.toLowerCase().trim());
      
      if (!existingProd) {
        // Create new product if it doesn't exist
        existingProd = {
          id: `prod_${Date.now()}_${idx}`,
          name: item.name,
          brand: '',
          barcode: '',
          sellingPrice: item.sp || item.purchasePrice || 0,
          mrp: item.mrp || item.purchasePrice || 0,
          purchasePrice: item.purchasePrice || 0,
          stock: 0,
          gst: item.gst || 0,
          category: 'General'
        };
        addProduct(existingProd);
        addedProductsCount++;
      }
      
      const cartItem = {
        id: existingProd.id,
        name: existingProd.name,
        sellingPrice: existingProd.purchasePrice || item.purchasePrice || 0,
        mrp: existingProd.mrp || item.mrp || 0,
        qty: parseFloat(item.qty) || 1,
        unit: existingProd.unit || 'Pcs',
        gst: existingProd.gst || item.gst || 0
      };
      
      dispatch({ type: 'ADD_TO_CART', payload: cartItem });
      count++;
    });
    
    let msg = `Added ${count} items to cart!`;
    if (addedProductsCount > 0) msg += ` (Created ${addedProductsCount} new products)`;
    showToast(msg, 'success');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    showToast('Parsing file...', 'info');

    try {
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const items = data.map(r => {
          const keys = Object.keys(r);
          
          // exact match helper
          const getExact = (possibleKeys) => {
            for (let pk of possibleKeys) {
              const match = keys.find(k => k.toLowerCase().trim() === pk.toLowerCase());
              if (match) return r[match];
            }
            return null;
          };
          
          // partial match helper
          const getPartial = (possibleKeys, excludeKeys = []) => {
            for (let pk of possibleKeys) {
              const match = keys.find(k => {
                const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanPk = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (cleanK.includes(cleanPk)) {
                  // check exclusions
                  for (let ex of excludeKeys) {
                    if (cleanK.includes(ex.toLowerCase().replace(/[^a-z0-9]/g, ''))) return false;
                  }
                  return true;
                }
                return false;
              });
              if (match) return r[match];
            }
            return null;
          };
          
          let name = getPartial(['item name', 'product name']) || 
                     getExact(['item', 'product', 'name', 'particulars', 'description']) || 
                     getPartial(['item', 'product', 'particular', 'desc'], ['vendor', 'customer', 'shop', 'company']) || 
                     r['Customer'];
                     
          let qty = getExact(['qty', 'quantity']) || getPartial(['qty', 'quantity']);
          
          let purchasePrice = getExact(['rate', 'pp', 'purchase price', 'cost']) || 
                              getPartial(['rate', 'pp', 'purchaseprice', 'cost']) ||
                              getExact(['price', 'amount', 'unit price']) ||
                              getPartial(['price', 'amount', 'unit']);

          let mrp = getExact(['mrp']) || getPartial(['mrp']);
          let sp = getExact(['sp', 'selling price', 'sale price']) || getPartial(['sp', 'sellingprice']);
          let gst = getExact(['gst', 'tax', 'cgst', 'sgst', 'igst']) || getPartial(['gst', 'tax']);

          return {
            name,
            qty: parseFloat(qty || 1),
            purchasePrice: parseFloat(purchasePrice || 0),
            mrp: parseFloat(mrp || 0),
            sp: parseFloat(sp || 0),
            gst: parseFloat(gst || 0)
          };
        }).filter(item => item.name);
        
        if (items.length === 0) {
          showToast('Could not find item data in CSV. Check column names.', 'error');
        } else {
          processParsedItems(items);
        }
      } else if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          const base64Full = reader.result;
          const base64Data = base64Full.split(',')[1];
          
          try {
            const model = getGenerativeModel(ai, { model: 'gemini-1.5-flash-latest' });
            const prompt = `You are an invoice parser. Analyze this purchase bill and extract the list of items.
Return ONLY a valid JSON object starting with { "items": [...] }. Do not include markdown formatting like \`\`\`json.
Each item in the array must have:
- "name": string (Product name)
- "qty": number (Quantity purchased)
- "purchasePrice": number (Unit price)`;

            const result = await model.generateContent([
              prompt,
              { inlineData: { data: base64Data, mimeType: file.type } }
            ]);
            const text = result.response.text();
            const jsonStr = text.replace(/```json\n?|```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            if (parsed.items && Array.isArray(parsed.items)) {
              processParsedItems(parsed.items);
            } else {
              throw new Error('Invalid JSON format from AI');
            }
          } catch (aiErr) {
            console.error(aiErr);
            showToast('AI could not parse the image accurately', 'error');
          } finally {
            setIsParsing(false);
          }
        };
        return; // wait for reader
      } else {
        showToast('Unsupported file type. Use CSV, Excel, Image, or PDF.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error parsing file', 'error');
    }
    
    setIsParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addToCart = (product) => {
    dispatch({ type: 'ADD_TO_CART', payload: product });
    showToast(`${product.name} added!`, 'info');
  };

  const updateQty = (id, delta) => {
    const item = state.cart.find(c => c.id === id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) dispatch({ type: 'REMOVE_FROM_CART', payload: id });
    else {
      dispatch({ type: 'UPDATE_CART_ITEM', payload: { id, qty: newQty } });
    }
  };

  const { subtotal, gst, grandTotal, discount } = calcTotals(state.cart, billDiscount);
  const change = cashPaid ? Math.max(0, parseFloat(cashPaid) - grandTotal) : 0;

  const generatePurchase = async () => {
    if (state.cart.length === 0) { showToast('Cart is empty!', 'error'); return; }
    
    const isEditing = !!state.editingPurchaseId;
    const existingPurchase = isEditing ? state.purchases.find(x => x.id === state.editingPurchaseId) : null;
    
    const purchaseId = isEditing ? state.editingPurchaseId : Date.now().toString();
    const saveDate = purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString();

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

    const purchase = {
      id: purchaseId,
      date: saveDate,
      purchaseBillNo,
      items: state.cart,
      subtotal, gst, grandTotal, discount,
      billDiscount,
      paymentMode,
      bankInfo: finalBankInfo,
      vendorId: selectedVendorId || null,
      cashPaid: paymentMode === 'Cash' ? (parseFloat(cashPaid) || grandTotal) : (paymentMode === 'Credit' ? (parseFloat(cashPaid) || 0) : grandTotal),
      warehouseId
    };
    if (paymentMode === 'Credit' && !selectedVendorId) {
      showToast('Please select a vendor for Credit purchase', 'error');
      return;
    }
    try {
      await completePurchase(purchase);
      setReceipt(purchase);
      setPaymentMode('Cash');
      setBankDetails({ utr: '', chequeNo: '', bankName: '', date: new Date().toISOString().split('T')[0] });
      setCashPaid('');
      setPurchaseBillNo('');
      setShowNewVendorForm(false);
      showToast('Purchase generated successfully!', 'success');
    } catch (err) {
      showToast('Error generating purchase: ' + err.message, 'error');
    }
  };

  const handleEditPurchase = (p) => {
    dispatch({ type: 'SET_CART', payload: p.items });
    dispatch({ type: 'SET_EDITING_PURCHASE', payload: p.id });
    setView('form');
  };

  const renderList = () => {
    const filteredPurchases = state.purchases?.filter(p => {
      const q = listSearch.toLowerCase();
      const vendor = state.vendors?.find(v => v.id === p.vendorId);
      return !q || 
             (p.purchaseBillNo && p.purchaseBillNo.toLowerCase().includes(q)) ||
             (vendor && vendor.name.toLowerCase().includes(q));
    }).sort((a,b) => new Date(b.date) - new Date(a.date)) || [];

    return (
      <div>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>🛒 Purchase List</h2>
          <button className="btn btn-primary" onClick={() => {
            dispatch({ type: 'CLEAR_CART' });
            setView('form');
          }}>
            <Plus size={16} /> Add Purchase
          </button>
        </div>

        <div className="page-content">
          <div style={{ background: 'var(--card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div className="search-bar" style={{ width: '300px', margin: 0 }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by Bill No. or Vendor..."
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text3)' }}>
                    <th style={{ padding: '10px 15px' }}>Date</th>
                    <th style={{ padding: '10px 15px' }}>Bill No.</th>
                    <th style={{ padding: '10px 15px' }}>Vendor</th>
                    <th style={{ padding: '10px 15px' }}>Store</th>
                    <th style={{ padding: '10px 15px', width: '25%' }}>Items</th>
                    <th style={{ padding: '10px 15px', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '10px 15px' }}>Payment</th>
                    <th style={{ padding: '10px 15px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>No purchases found</td>
                    </tr>
                  ) : filteredPurchases.map(p => {
                    const vendor = state.vendors?.find(v => v.id === p.vendorId);
                    const store = warehouses.find(w => w.id === p.warehouseId)?.name || (p.warehouseId === 'main' ? 'Main Store' : 'Main Store');
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 15px' }}>{new Date(p.date).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>{p.purchaseBillNo || '-'}</td>
                        <td style={{ padding: '12px 15px' }}>{vendor ? vendor.name : 'Walk-in Vendor'}</td>
                        <td style={{ padding: '12px 15px' }}>{store}</td>
                        <td style={{ padding: '12px 15px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                            {(p.items || []).map((item, idx) => (
                               <div key={idx} style={{ fontSize: '0.75rem', color: '#475569', background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px' }}>
                                 {item.name} <strong>x{item.qty}</strong> @ ₹{item.purchasePrice || 0}
                                 {item.mrp ? ` (MRP: ₹${item.mrp})` : ''}
                               </div>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>{p.grandTotal?.toFixed(2)}</td>
                        <td style={{ padding: '12px 15px' }}>
                          <span className={`badge ${p.paymentMode === 'Credit' ? 'badge-red' : 'badge-green'}`}>
                            {p.paymentMode}
                          </span>
                        </td>
                        <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" title="View Receipt" onClick={() => setReceipt(p)}><ShoppingBag size={14} /></button>
                            <button className="btn btn-ghost" title="Edit Purchase" onClick={() => handleEditPurchase(p)}>✏️</button>
                            <button className="btn btn-ghost" title="Delete Purchase" onClick={() => {
                              if (window.confirm('Delete this purchase? This will reduce stock accordingly.')) {
                                deletePurchase(p.id).then(() => showToast('Purchase deleted', 'success')).catch(e => showToast(e.message, 'error'));
                              }
                            }}><Trash2 size={14} style={{ color: 'red' }} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}
      </div>
    );
  };

  const renderForm = () => {
    return (
      <div>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { dispatch({ type: 'CLEAR_CART' }); setView('list'); }}>← Back</button>
            <h2>🛒 {state.editingPurchaseId ? 'Edit Purchase Entry' : 'New Purchase Entry'}</h2>
          </div>
          {state.editingPurchaseId && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => {
                dispatch({ type: 'CLEAR_CART' });
                setView('list');
                showToast('Edit cancelled', 'info');
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>

      <div className="page-content">
        <div className="billing-layout">
          {/* LEFT PANEL */}
          <PurchaseProductSearch 
            tx={tx}
            search={search} setSearch={setSearch}
            barcode={barcode} setBarcode={setBarcode}
            barcodeRef={barcodeRef} handleBarcodeKey={handleBarcodeKey}
            handleBarcodeSubmit={handleBarcodeSubmit}
            filtered={filtered} addToCart={addToCart}
            fileInputRef={fileInputRef} handleFileUpload={handleFileUpload}
            isParsing={isParsing}
            setProductForm={setProductForm} setShowProductModal={setShowProductModal}
          />

          <div className="billing-right">
            <PurchaseCart 
              tx={tx} state={state} dispatch={dispatch}
              warehouseId={warehouseId} setWarehouseId={setWarehouseId}
              displayWarehouses={displayWarehouses}
              selectedVendorId={selectedVendorId} setSelectedVendorId={setSelectedVendorId}
              showNewVendorForm={showNewVendorForm} setShowNewVendorForm={setShowNewVendorForm}
              newVendor={newVendor} setNewVendor={setNewVendor}
              addVendor={addVendor} showToast={showToast}
              updateQty={updateQty}
            />
            
            <PurchaseForm 
              tx={tx} state={state}
              subtotal={subtotal} gst={gst} grandTotal={grandTotal} discount={discount}
              billDiscount={billDiscount} setBillDiscount={setBillDiscount}
              paymentMode={paymentMode} setPaymentMode={setPaymentMode}
              bankDetails={bankDetails} setBankDetails={setBankDetails}
              cashPaid={cashPaid} setCashPaid={setCashPaid} change={change}
              purchaseDate={purchaseDate} setPurchaseDate={setPurchaseDate}
              purchaseBillNo={purchaseBillNo} setPurchaseBillNo={setPurchaseBillNo}
              generatePurchase={generatePurchase}
            />
          </div>
        </div>
      </div>

      {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}

      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>➕ New Product</h3>
              <button className="modal-close" onClick={() => setShowProductModal(false)}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Product Name *</label>
                <input className="form-input" placeholder="e.g. Paracetamol 500mg" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Barcode</label>
                <input className="form-input" placeholder="Scan or type barcode" value={productForm.barcode} onChange={e => setProductForm({ ...productForm, barcode: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Brand</label>
                <input className="form-input" placeholder="Brand name" value={productForm.brand} onChange={e => setProductForm({ ...productForm, brand: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Purchase Price (₹)</label>
                <input type="number" className="form-input" placeholder="0" value={productForm.purchasePrice} onChange={e => setProductForm({ ...productForm, purchasePrice: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Selling Price (₹) *</label>
                <input type="number" className="form-input" placeholder="0" value={productForm.sellingPrice} onChange={e => setProductForm({ ...productForm, sellingPrice: e.target.value })} />
              </div>
              <div>
                <label className="form-label">MRP (₹)</label>
                <input type="number" className="form-input" placeholder="0" value={productForm.mrp} onChange={e => setProductForm({ ...productForm, mrp: e.target.value })} />
              </div>
              <div>
                <label className="form-label">GST %</label>
                <input type="number" className="form-input" placeholder="0" value={productForm.gst} onChange={e => setProductForm({ ...productForm, gst: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleProductSave}>Save & Add to Cart</button>
            </div>
          </div>
        </div>
      )}

    </div>
    );
  };

  return view === 'list' ? renderList() : renderForm();
}
