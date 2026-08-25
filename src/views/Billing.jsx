import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { Search, Scan, Trash2, X, ShoppingBag } from 'lucide-react';
import Receipt from '../components/Receipt';
import { showToast } from '../components/Toast';
import ProductSearch from '../components/billing/ProductSearch';
import BillingCart from '../components/billing/BillingCart';
import CheckoutForm from '../components/billing/CheckoutForm';
import { buildSalePayload, calcSaleTotals } from '../lib/sales';

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
  const [dueDate, setDueDate] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [catFilter, setCatFilter] = useState('All');
  const barcodeRef = useRef();
  const [editingTotal, setEditingTotal] = useState(null); // { id, value }
  const [billDiscount, setBillDiscount] = useState({ type: 'none', value: 0, freight: '', labor: '' });
  const [roundOff, setRoundOff] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', pan: '', gst: '' });
  const [showOfferPopup, setShowOfferPopup] = useState(false);
  const [warehouseId, setWarehouseId] = useState('main');

  const selectedCustomer = state.customers?.find(c => c.id === selectedCustomerId);
  const warehouses = state.warehouses || [];
  const displayWarehouses = [
    { id: 'All', name: 'All Warehouses (Total)' },
    ...(warehouses.some(w => w.id === 'main') ? warehouses : [{id: 'main', name: 'Main Store'}, ...warehouses])
  ];

  useEffect(() => {
    if (selectedCustomer && selectedCustomer.type === 'old') {
      setShowOfferPopup(true);
    }
  }, [selectedCustomerId]);

  const lastSoldPrices = useMemo(() => {
    if (!selectedCustomerId) return {};
    const prices = {};
    const customerSales = state.sales.filter(s => s.customerId === selectedCustomerId).sort((a, b) => new Date(b.date) - new Date(a.date));
    customerSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!prices[item.id]) {
          prices[item.id] = item.sellingPrice;
        }
      });
    });
    return prices;
  }, [state.sales, selectedCustomerId]);

  const getAvailableStock = (prod) => {
    if (!prod) return 0;
    return warehouseId === 'All' ? (prod.stock || 0) : (prod.warehouseStock?.[warehouseId] || 0);
  };

  useEffect(() => {
    let adjusted = false;
    state.cart.forEach(item => {
      const prod = state.products.find(p => p.id === item.id);
      if (prod) {
        const available = getAvailableStock(prod);
        if (item.qty > available) {
          if (available === 0) {
            dispatch({ type: 'REMOVE_FROM_CART', payload: item.id });
          } else {
            dispatch({ type: 'UPDATE_CART_ITEM', payload: { id: item.id, qty: available } });
          }
          adjusted = true;
        }
      }
    });
    if (adjusted) {
      showToast('Cart adjusted due to warehouse stock limits', 'info');
    }
  }, [warehouseId]); // only run when warehouseId changes

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
      const available = getAvailableStock(product);
      const existing = state.cart.find(c => c.id === product.id);
      const newQty = (existing ? existing.qty : 0) + 1;
      
      if (available <= 0 || newQty > available) {
        showToast('Out of stock in selected warehouse!', 'error');
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
    const available = getAvailableStock(product);
    const existing = state.cart.find(c => c.id === product.id);
    const newQty = (existing ? existing.qty : 0) + 1;
    
    if (available <= 0 || newQty > available) {
      showToast('Out of stock in selected warehouse!', 'error');
      return;
    }
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
      if (prod) {
        const available = getAvailableStock(prod);
        if (newQty > available) {
          showToast('Not enough stock in selected warehouse!', 'error');
          return;
        }
      }
      dispatch({ type: 'UPDATE_CART_ITEM', payload: { id, qty: newQty } });
    }
  };

   const { subtotal, gst, grandTotal, discount } = calcSaleTotals(state.cart, billDiscount, roundOff);
  const change = cashPaid ? Math.max(0, parseFloat(cashPaid) - grandTotal) : 0;

  const generateBill = async () => {
    if (state.cart.length === 0) { showToast('Cart is empty!', 'error'); return; }
    if (warehouseId === 'All') { showToast('Please select a specific warehouse to dispatch from!', 'error'); return; }

    try {
      const sale = buildSalePayload({
        state,
        cart: state.cart,
        paymentMode,
        bankDetails,
        cashPaid,
        dueDate,
        selectedCustomerId,
        warehouseId,
        billDiscount,
        roundOff,
        editingSaleId: state.editingSaleId,
      });
      await completeSale(sale);
      setReceipt(sale);
      setPaymentMode('Cash');
      setBankDetails({ utr: '', chequeNo: '', bankName: '', date: new Date().toISOString().split('T')[0] });
      setBillDiscount({ type: 'none', value: 0, freight: '', labor: '' });
      setRoundOff('');
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
          <ProductSearch 
            tx={tx}
            search={search} setSearch={setSearch}
            barcode={barcode} setBarcode={setBarcode}
            barcodeRef={barcodeRef} handleBarcodeKey={handleBarcodeKey}
            handleBarcodeSubmit={handleBarcodeSubmit}
            filtered={filtered} addToCart={addToCart}
            lastSoldPrices={lastSoldPrices}
            warehouseId={warehouseId}
          />

          <div className="billing-right">
            <BillingCart 
              tx={tx}
              state={state} dispatch={dispatch}
              warehouseId={warehouseId} setWarehouseId={setWarehouseId}
              displayWarehouses={displayWarehouses}
              selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId}
              selectedCustomer={selectedCustomer}
              showNewCustomerForm={showNewCustomerForm} setShowNewCustomerForm={setShowNewCustomerForm}
              newCustomer={newCustomer} setNewCustomer={setNewCustomer}
              addCustomer={addCustomer} showToast={showToast}
              editingTotal={editingTotal} setEditingTotal={setEditingTotal}
              startEditTotal={startEditTotal} commitEditTotal={commitEditTotal} cancelEditTotal={cancelEditTotal}
            />
            
            <CheckoutForm 
              tx={tx} state={state}
              subtotal={subtotal} gst={gst} grandTotal={grandTotal} discount={discount}
              billDiscount={billDiscount} setBillDiscount={setBillDiscount}
              roundOff={roundOff} setRoundOff={setRoundOff}
              paymentMode={paymentMode} setPaymentMode={setPaymentMode}
              bankDetails={bankDetails} setBankDetails={setBankDetails}
              cashPaid={cashPaid} setCashPaid={setCashPaid} change={change}
              dueDate={dueDate} setDueDate={setDueDate}
              generateBill={generateBill}
            />
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
