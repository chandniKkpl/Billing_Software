import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Alert, Modal, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import {
  ScanLine, Trash2, X, Plus, Minus, Camera as CameraIcon,
  CheckCircle2, Search, Package,
} from 'lucide-react-native';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission } from 'react-native-vision-camera';
import RNPrint from 'react-native-print';

/* ─────────────────────────────────────────────────────────── */
/*  New-product / edit-product inline form (used from billing)  */
/* ─────────────────────────────────────────────────────────── */
function ProductFormModal({ visible, onClose, onSave, initialBarcode, existingProduct }) {
  const emptyForm = { name: '', brand: '', barcode: '', sellingPrice: '', mrp: '', purchasePrice: '', stock: '', gst: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (visible) {
      if (existingProduct) {
        setForm({
          name: existingProduct.name || '',
          brand: existingProduct.brand || '',
          barcode: existingProduct.barcode || '',
          sellingPrice: existingProduct.sellingPrice?.toString() || '',
          mrp: existingProduct.mrp?.toString() || '',
          purchasePrice: existingProduct.purchasePrice?.toString() || '',
          stock: existingProduct.stock?.toString() || '',
          gst: existingProduct.gst?.toString() || '',
        });
      } else {
        setForm({ ...emptyForm, barcode: initialBarcode || '' });
      }
    }
  }, [visible, existingProduct, initialBarcode]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    if (!form.name || !form.sellingPrice || !form.barcode) {
      Alert.alert('Validation Error', 'Name, Barcode and Selling Price are required.');
      return;
    }
    onSave({
      ...form,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      mrp: parseFloat(form.mrp) || 0,
      purchasePrice: parseFloat(form.purchasePrice) || 0,
      stock: parseInt(form.stock) || 0,
      gst: parseFloat(form.gst) || 0,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
        <View style={pf.header}>
          <Text style={pf.title}>{existingProduct ? 'Edit Product' : 'New Product'}</Text>
          <TouchableOpacity onPress={onClose} style={pf.closeBtn}>
            <X size={22} color="#64748B" />
          </TouchableOpacity>
        </View>
        <ScrollView style={pf.body} keyboardShouldPersistTaps="handled">
          {/* Barcode */}
          <View style={pf.group}>
            <Text style={pf.label}>Barcode *</Text>
            <TextInput style={pf.input} value={form.barcode} onChangeText={v => set('barcode', v)} />
          </View>
          {/* Name */}
          <View style={pf.group}>
            <Text style={pf.label}>Product Name *</Text>
            <TextInput style={pf.input} value={form.name} onChangeText={v => set('name', v)} />
          </View>
          {/* Brand */}
          <View style={pf.group}>
            <Text style={pf.label}>Brand</Text>
            <TextInput style={pf.input} value={form.brand} onChangeText={v => set('brand', v)} />
          </View>
          {/* MRP + Purchase Price */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>MRP (₹)</Text>
              <TextInput style={pf.input} value={form.mrp} onChangeText={v => set('mrp', v)} keyboardType="numeric" />
            </View>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>Purchase Price (₹)</Text>
              <TextInput style={pf.input} value={form.purchasePrice} onChangeText={v => set('purchasePrice', v)} keyboardType="numeric" />
            </View>
          </View>
          {/* Selling Price + Stock */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>Selling Price (₹) *</Text>
              <TextInput style={pf.input} value={form.sellingPrice} onChangeText={v => set('sellingPrice', v)} keyboardType="numeric" />
            </View>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>Stock</Text>
              <TextInput style={pf.input} value={form.stock} onChangeText={v => set('stock', v)} keyboardType="numeric" />
            </View>
          </View>
          {/* GST */}
          <View style={[pf.group, { width: '48%' }]}>
            <Text style={pf.label}>GST %</Text>
            <TextInput style={pf.input} value={form.gst} onChangeText={v => set('gst', v)} keyboardType="numeric" />
          </View>

          {/* GST Preview */}
          {form.sellingPrice && form.gst ? (
            <View style={pf.previewBox}>
              <View style={pf.previewRow}>
                <Text style={pf.previewLabel}>Base Selling Price</Text>
                <Text style={pf.previewValue}>₹{parseFloat(form.sellingPrice).toFixed(2)}</Text>
              </View>
              <View style={pf.previewRow}>
                <Text style={pf.previewLabel}>GST Amount ({form.gst}%)</Text>
                <Text style={pf.previewValue}>+ ₹{((parseFloat(form.sellingPrice) * parseFloat(form.gst)) / 100).toFixed(2)}</Text>
              </View>
              <View style={[pf.previewRow, { borderTopWidth: 1, borderTopColor: '#BBF7D0', paddingTop: 8, marginTop: 4 }]}>
                <Text style={pf.previewTotalLabel}>Final Price (inc. GST)</Text>
                <Text style={pf.previewTotalValue}>₹{(parseFloat(form.sellingPrice) + (parseFloat(form.sellingPrice) * parseFloat(form.gst)) / 100).toFixed(2)}</Text>
              </View>
            </View>
          ) : null}
          <TouchableOpacity style={pf.saveBtn} onPress={handleSave}>
            <Text style={pf.saveBtnText}>{existingProduct ? 'Update Product' : 'Save & Add to Cart'}</Text>
          </TouchableOpacity>
          <View style={{ height: 50 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const pf = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  closeBtn: { padding: 6, backgroundColor: '#F1F5F9', borderRadius: 10 },
  body: { padding: 20, backgroundColor: '#F8FAFC' },
  group: { marginBottom: 14 },
  label: { fontSize: 13, color: '#475569', marginBottom: 5, fontWeight: '600' },
  input: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', fontSize: 15, color: '#0F172A', fontWeight: '500' },
  saveBtn: { backgroundColor: '#2563EB', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 16, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  previewBox: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0', gap: 6 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLabel: { color: '#15803D', fontWeight: '600', fontSize: 13 },
  previewValue: { color: '#15803D', fontWeight: '600', fontSize: 13 },
  previewTotalLabel: { color: '#16A34A', fontWeight: '800', fontSize: 15 },
  previewTotalValue: { color: '#16A34A', fontWeight: '900', fontSize: 17 },
});

/* ─────────────────────────────────────────────────────────── */
/*  Main BillingScreen                                          */
/* ─────────────────────────────────────────────────────────── */
export default function BillingScreen() {
  const { state, dispatch, completeSale, addProduct, updateProduct, addCustomer } = useApp();
  const [barcode, setBarcode] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [billDiscount, setBillDiscount] = useState({ type: 'none', value: '0' });
  const [customerId, setCustomerId] = useState('');
  const [bankInfo, setBankInfo] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' });

  // Camera state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);

  // Product form modal (new or edit)
  const [productFormVisible, setProductFormVisible] = useState(false);
  const [formBarcode, setFormBarcode] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);

  // Scanner cooldown to avoid duplicate scans
  const lastScan = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  // Pulse animation for scanner target
  useEffect(() => {
    if (isScannerOpen) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
    return () => pulseAnim.stopAnimation();
  }, [isScannerOpen]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'upc-e', 'upc-a', 'code-128', 'code-39', 'code-93'],
    onCodeScanned: (codes) => {
      const now = Date.now();
      if (codes.length > 0 && now - lastScan.current > 1500) {
        lastScan.current = now;
        const scannedCode = codes[0].value;
        if (scannedCode) {
          setIsScannerOpen(false);
          setTimeout(() => processBarcode(scannedCode), 200);
        }
      }
    },
  });

  // ── Totals ──────────────────────────────────────────────
  const totals = useMemo(() => {
    let subtotal = 0, gst = 0;
    state.cart.forEach(c => {
      const qty = Number(c.qty) || 0;
      const price = Number(c.sellingPrice) || 0;
      const gstPct = Number(c.gst) || 0;
      subtotal += price * qty;
      gst += price * qty * (gstPct / 100);
    });
    let discount = 0;
    const val = Number(billDiscount.value) || 0;
    if (billDiscount.type === 'percent') discount = (subtotal + gst) * (val / 100);
    else if (billDiscount.type === 'flat') discount = val;
    return { subtotal, gst, grandTotal: Math.max(0, subtotal + gst - discount), discount };
  }, [state.cart, billDiscount]);

  // ── Filtered product list for browse ─────────────────────
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    if (!q) return state.products;
    return state.products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    );
  }, [state.products, productSearch]);

  // ── Barcode processing ────────────────────────────────────
  const processBarcode = useCallback((code) => {
    const product = state.products.find(p => p.barcode === code);
    if (product) {
      // Existing product → add to cart + option to edit
      if (product.stock <= 0) {
        // Out of stock → open edit form to update stock
        Alert.alert(
          'Out of Stock',
          `${product.name} is out of stock. Edit product?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Edit Product', onPress: () => { setEditingProduct(product); setFormBarcode(code); setProductFormVisible(true); } },
          ]
        );
      } else {
        dispatch({ type: 'ADD_TO_CART', payload: product });
      }
      setBarcode('');
    } else {
      // Product not found → show alert
      Alert.alert('Not Found', 'No product found with this barcode.');
      setBarcode('');
    }
  }, [state.products, dispatch]);

  const handleBarcodeSubmit = () => {
    const code = barcode.trim();
    if (!code) return;
    processBarcode(code);
  };

  const openCamera = async () => {
    let perm = hasPermission;
    if (!perm) {
      perm = await requestPermission();
      if (!perm) {
        Alert.alert('Permission Denied', 'Camera permission is required to scan barcodes.');
        return;
      }
    }
    if (!device) {
      Alert.alert('Camera Error', 'No camera found on this device.');
      return;
    }
    setIsScannerOpen(true);
  };

  // ── Product form save ─────────────────────────────────────
  const handleProductFormSave = async (formData) => {
    if (editingProduct) {
      await updateProduct({ ...formData, id: editingProduct.id });
      Alert.alert('Updated', `${formData.name} has been updated.`);
    } else {
      const id = Date.now().toString();
      await addProduct({ ...formData, id });
      // Add to cart after saving
      if (formData.stock > 0) {
        dispatch({ type: 'ADD_TO_CART', payload: { ...formData, id } });
      }
    }
    setProductFormVisible(false);
  };

  // ── Cart helpers ──────────────────────────────────────────
  const updateQty = useCallback((id, delta) => {
    const item = state.cart.find(c => c.id === id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      dispatch({ type: 'REMOVE_FROM_CART', payload: id });
    } else {
      const prod = state.products.find(p => p.id === id);
      if (prod && newQty > prod.stock) { Alert.alert('Not enough stock!'); return; }
      dispatch({ type: 'UPDATE_CART_ITEM', payload: { id, qty: newQty } });
    }
  }, [state.cart, state.products, dispatch]);

  const addProductToCart = useCallback((product) => {
    if (product.stock <= 0) {
      Alert.alert('Out of Stock', `${product.name} is out of stock.`);
      return;
    }
    dispatch({ type: 'ADD_TO_CART', payload: product });
    setProductSearch('');
  }, [dispatch]);

  // ── Generate bill ─────────────────────────────────────────
  const generateBill = async () => {
    if (state.cart.length === 0) { Alert.alert('Cart is empty!'); return; }
    const saleId = state.editingSaleId || Date.now().toString();
    const saleDate = state.editingSaleId
      ? state.sales.find(s => s.id === state.editingSaleId)?.date || new Date().toISOString()
      : new Date().toISOString();
    const sale = {
      id: saleId, date: saleDate, items: state.cart,
      subtotal: totals.subtotal, gst: totals.gst,
      grandTotal: totals.grandTotal, discount: totals.discount,
      billDiscount, paymentMode, cashPaid: totals.grandTotal,
      customerId, bankInfo,
    };
    try {
      await completeSale(sale);
      setReceiptSale(sale);
      setBillDiscount({ type: 'none', value: '0' });
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const printBill = async () => {
    if (!receiptSale) return;
    const html = `<html><head><style>
      body{font-family:Helvetica,Arial,sans-serif;padding:20px;color:#333}
      h1{text-align:center;color:#000;margin-bottom:5px}
      .sub{text-align:center;color:#666;font-size:14px;margin-bottom:30px;letter-spacing:2px;text-transform:uppercase}
      .det{border-bottom:2px dashed #ccc;padding-bottom:20px;margin-bottom:20px}
      .det p{margin:5px 0;font-size:14px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th,td{text-align:left;padding:10px 0;border-bottom:1px solid #eee}
      th{color:#666;font-size:12px;text-transform:uppercase}
      .tot{width:100%;max-width:300px;float:right;margin-bottom:40px}
      .tot p{display:flex;justify-content:space-between;margin:8px 0;font-size:14px}
      .gt{font-size:20px!important;font-weight:bold;border-top:2px solid #000;padding-top:10px;margin-top:10px!important}
      .foot{clear:both;text-align:center;margin-top:50px;font-size:12px;color:#888}
    </style></head><body>
      <h1>Cosmo Store</h1><div class="sub">Retail Invoice</div>
      <div class="det">
        <p><strong>Bill No:</strong> #${receiptSale.id.slice(-6).toUpperCase()}</p>
        <p><strong>Date:</strong> ${new Date(receiptSale.date).toLocaleString('en-IN')}</p>
        <p><strong>Payment:</strong> ${receiptSale.paymentMode}</p>
      </div>
      <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${receiptSale.items.map(i => {
        const sav = i.mrp && i.mrp > i.sellingPrice ? i.mrp - i.sellingPrice : 0;
        const pct = sav > 0 ? Math.round((sav / i.mrp) * 100) : 0;
        return `<tr><td>${i.name}<br><small style="color:#666">₹${i.sellingPrice}${ i.mrp ? ` <span style="text-decoration:line-through;color:#aaa">MRP ₹${i.mrp}</span>` : '' }</small>${ sav > 0 ? `<br><small style="color:green;font-weight:bold">Save ₹${sav % 1 === 0 ? sav : sav.toFixed(2)} (${pct}% off)</small>` : '' }</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">₹${(i.qty * i.sellingPrice).toFixed(2)}</td></tr>`;
      }).join('')}</tbody></table>
      <div class="tot">
        <p><span>Subtotal:</span><span>₹${receiptSale.subtotal.toFixed(2)}</span></p>
        <p><span>GST:</span><span>₹${receiptSale.gst.toFixed(2)}</span></p>
        ${receiptSale.discount > 0 ? `<p><span>Discount:</span><span>-₹${receiptSale.discount.toFixed(2)}</span></p>` : ''}
        <p class="gt"><span>Grand Total:</span><span>₹${receiptSale.grandTotal.toFixed(2)}</span></p>
      </div>
      <div class="foot">Thank you for shopping with us!</div>
    </body></html>`;
    try { await RNPrint.print({ html }); } catch (e) { Alert.alert('Print Error', e.message); }
  };

  // ── Renderers ─────────────────────────────────────────────
  const renderCartItem = useCallback(({ item }) => {
    const saving = item.mrp && item.mrp > item.sellingPrice ? item.mrp - item.sellingPrice : 0;
    const discountPct = saving > 0 ? Math.round((saving / item.mrp) * 100) : 0;
    return (
      <View style={styles.cartItem}>
        <View style={styles.cartItemInfo}>
          <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Text style={styles.cartItemPrice}>₹{item.sellingPrice}</Text>
            {item.mrp ? <Text style={styles.mrpText}>₹{item.mrp}</Text> : null}
          </View>
          {saving > 0 ? (
            <View style={styles.savingBadge}>
              <Text style={styles.savingText}>Save ₹{saving.toFixed(saving % 1 === 0 ? 0 : 2)} ({discountPct}% off)</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.qtyContainer}>
          <TouchableOpacity onPress={() => updateQty(item.id, -1)} style={styles.qtyBtn}>
            <Minus size={14} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.qty}</Text>
          <TouchableOpacity onPress={() => updateQty(item.id, 1)} style={styles.qtyBtn}>
            <Plus size={14} color="#0F172A" />
          </TouchableOpacity>
        </View>
        <Text style={styles.totalText}>₹{(item.sellingPrice * item.qty).toFixed(2)}</Text>
        <TouchableOpacity style={styles.removeBtn} onPress={() => dispatch({ type: 'REMOVE_FROM_CART', payload: item.id })}>
          <X size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  }, [updateQty, dispatch]);

  const renderProductItem = useCallback(({ item }) => {
    const inCart = state.cart.find(c => c.id === item.id);
    const outOfStock = item.stock <= 0;
    return (
      <TouchableOpacity
        style={[styles.productListItem, outOfStock && styles.productListItemDisabled]}
        onPress={() => addProductToCart(item)}
        disabled={outOfStock}
        activeOpacity={0.7}
      >
        <View style={styles.productListIcon}>
          <Package size={18} color={outOfStock ? '#CBD5E1' : '#2563EB'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.productListName, outOfStock && { color: '#CBD5E1' }]} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productListSub}>{item.brand ? `${item.brand} • ` : ''}Stock: {item.stock}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.productListPrice}>₹{item.sellingPrice}</Text>
          {inCart && <View style={styles.inCartBadge}><Text style={styles.inCartText}>In Cart</Text></View>}
        </View>
      </TouchableOpacity>
    );
  }, [state.cart, addProductToCart]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Billing</Text>
        <Text style={styles.itemCount}>{state.cart.length} items</Text>
      </View>

      {/* ── Barcode / Search row ── */}
      <View style={styles.barcodeSection}>
        <TouchableOpacity onPress={openCamera} style={styles.cameraBtn}>
          <CameraIcon size={22} color="#2563EB" />
        </TouchableOpacity>
        <TextInput
          style={styles.barcodeInput}
          placeholder="Scan or enter barcode"
          value={barcode}
          onChangeText={setBarcode}
          onSubmitEditing={handleBarcodeSubmit}
          returnKeyType="done"
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleBarcodeSubmit}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* ── Product browse panel ── */}
      <View style={styles.productPanel}>
          <TextInput
            style={styles.productSearchInput}
            placeholder="Search products..."
            placeholderTextColor="#94A3B8"
            value={productSearch}
            onChangeText={setProductSearch}
            autoFocus
          />
          <FlatList
            data={filteredProducts}
            keyExtractor={item => item.id.toString()}
            renderItem={renderProductItem}
            style={{ maxHeight: 260 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: '#94A3B8', padding: 20 }}>No products found</Text>
            }
          />
        </View>

      {/* ── Cart ── */}
      <View style={styles.cartContainer}>
        <FlatList
          data={state.cart}
          keyExtractor={item => item.id.toString()}
          renderItem={renderCartItem}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyCart}>
              <ScanLine size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>Scan or search to add items</Text>
            </View>
          }
        />
      </View>

      {/* ── Totals card ── */}
      <View style={styles.totalsCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>₹{totals.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>GST</Text>
          <Text style={styles.totalValue}>₹{totals.gst.toFixed(2)}</Text>
        </View>



        <View style={[styles.totalRow, { marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 }]}>
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalValue}>₹{totals.grandTotal.toFixed(2)}</Text>
        </View>

        {paymentMode === 'Debt' && (
           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, backgroundColor: '#f1f5f9', padding: 8, borderRadius: 6 }}>
             <Text style={{ fontSize: 13, color: '#475569', fontWeight: 'bold' }}>
               Customer: {customerId ? state.customers.find(c => c.id === customerId)?.name : 'None Selected'}
             </Text>
             <TouchableOpacity style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 }} onPress={() => setShowCustomerModal(true)}>
               <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Change</Text>
             </TouchableOpacity>
           </View>
        )}
        
        {(paymentMode === 'Cheque' || paymentMode === 'RTGS/NEFT' || paymentMode === 'Bank') && (
           <TextInput 
             style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 13 }}
             placeholder={paymentMode === 'Cheque' ? "Cheque No, Bank Name, Date" : "UTR Number, Date"}
             value={bankInfo}
             onChangeText={setBankInfo}
           />
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={styles.paymentModes}>
            {['Cash', 'UPI', 'Bank', 'Debt', 'Cheque', 'RTGS/NEFT'].map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.paymentBtn, paymentMode === m && styles.paymentBtnActive]}
                onPress={() => {
                   setPaymentMode(m);
                   if (m === 'Debt' && !customerId) setShowCustomerModal(true);
                }}
              >
                <Text style={[styles.paymentBtnText, paymentMode === m && styles.paymentBtnTextActive]}>
                  {m === 'Cash' ? '💵' : m === 'UPI' ? '📱' : m === 'Bank' ? '💳' : m === 'Debt' ? '📝' : '🏦'} {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footerActions}>
          <TouchableOpacity style={styles.clearButton} onPress={() => dispatch({ type: 'CLEAR_CART' })}>
            <Trash2 size={20} color="#EF4444" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.payButton, state.cart.length === 0 && { opacity: 0.5 }]}
            onPress={generateBill}
            disabled={state.cart.length === 0}
          >
            <Text style={styles.payButtonText}>Generate Bill</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scanner Modal ── */}
      <Modal visible={isScannerOpen} animationType="fade" onRequestClose={() => setIsScannerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {device != null && (
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isScannerOpen}
              codeScanner={codeScanner}
            />
          )}
          {/* Dark overlay with transparent centre */}
          <View style={scan.overlay}>
            <View style={scan.topMask} />
            <View style={scan.middleRow}>
              <View style={scan.sideMask} />
              <Animated.View style={[scan.target, { transform: [{ scale: pulseAnim }] }]}>
                {/* Corner brackets */}
                <View style={[scan.corner, scan.tl]} /><View style={[scan.corner, scan.tr]} />
                <View style={[scan.corner, scan.bl]} /><View style={[scan.corner, scan.br]} />
                <Text style={scan.scanHint}>Align barcode inside the box</Text>
              </Animated.View>
              <View style={scan.sideMask} />
            </View>
            <View style={scan.bottomMask}>
              <Text style={scan.scanLabel}>📷  Auto-scanning…</Text>
              <TouchableOpacity style={scan.closeBtn} onPress={() => setIsScannerOpen(false)}>
                <X size={22} color="#FFF" />
                <Text style={scan.closeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Product Form Modal ── */}
      <ProductFormModal
        visible={productFormVisible}
        onClose={() => setProductFormVisible(false)}
        onSave={handleProductFormSave}
        initialBarcode={formBarcode}
        existingProduct={editingProduct}
      />

      {/* ── Customer Select / Add Modal ── */}
      <Modal visible={showCustomerModal} animationType="slide" transparent={true} onRequestClose={() => setShowCustomerModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Select or Add Customer</Text>
              <TouchableOpacity onPress={() => setShowCustomerModal(false)}><X size={24} color="#64748B" /></TouchableOpacity>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              <TextInput style={{ flex: 1, borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6 }} placeholder="New Customer Name" value={customerForm.name} onChangeText={t => setCustomerForm(p => ({...p, name: t}))} />
              <TextInput style={{ flex: 1, borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6 }} placeholder="Phone (opt)" value={customerForm.phone} onChangeText={t => setCustomerForm(p => ({...p, phone: t}))} keyboardType="numeric" />
              <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 6 }} onPress={async () => {
                if (!customerForm.name) return Alert.alert('Error', 'Name required');
                const id = Date.now().toString();
                await addCustomer({ id, name: customerForm.name, phone: customerForm.phone, udhaarBalance: 0 });
                setCustomerId(id);
                setCustomerForm({ name: '', phone: '' });
                setShowCustomerModal(false);
              }}>
                <Plus size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <FlatList 
              data={state.customers}
              keyExtractor={item => String(item.id)}
              renderItem={({item}) => (
                 <TouchableOpacity style={{ padding: 15, borderBottomWidth: 1, borderColor: '#f1f5f9' }} onPress={() => { setCustomerId(item.id); setShowCustomerModal(false); }}>
                   <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
                   <Text style={{ fontSize: 12, color: '#64748b' }}>{item.phone || 'No phone'} | Bal: ₹{item.udhaarBalance?.toFixed(2) || '0.00'}</Text>
                 </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Receipt Modal ── */}
      <Modal visible={!!receiptSale} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReceiptSale(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptTitle}>Bill Generated!</Text>
            <TouchableOpacity onPress={() => setReceiptSale(null)}>
              <X size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.receiptScroll}>
            <View style={styles.receiptCard}>
              <View style={styles.receiptTop}>
                <CheckCircle2 size={48} color="#16A34A" style={{ marginBottom: 12 }} />
                <Text style={styles.storeName}>Cosmo Store</Text>
                <Text style={styles.receiptSubtitle}>Retail Invoice</Text>
              </View>

              <View style={styles.receiptDetails}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Bill No:</Text>
                  <Text style={styles.receiptValue}>#{receiptSale?.id.slice(-6).toUpperCase()}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Date:</Text>
                  <Text style={styles.receiptValue}>{receiptSale ? new Date(receiptSale.date).toLocaleString('en-IN') : ''}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Payment:</Text>
                  <Text style={styles.receiptValue}>{receiptSale?.paymentMode}</Text>
                </View>
              </View>

              <View style={styles.receiptItems}>
                {receiptSale?.items.map(item => {
                  const saving = item.mrp && item.mrp > item.sellingPrice ? item.mrp - item.sellingPrice : 0;
                  const discountPct = saving > 0 ? Math.round((saving / item.mrp) * 100) : 0;
                  return (
                    <View key={item.id} style={styles.receiptItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.receiptItemName}>{item.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.receiptItemQty}>{item.qty} × ₹{item.sellingPrice}</Text>
                          {item.mrp ? <Text style={[styles.receiptItemQty, { textDecorationLine: 'line-through', color: '#94A3B8' }]}>MRP ₹{item.mrp}</Text> : null}
                        </View>
                        {saving > 0 ? (
                          <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '700', marginTop: 2 }}>
                            Save ₹{saving.toFixed(saving % 1 === 0 ? 0 : 2)} ({discountPct}% off)
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.receiptItemTotal}>₹{(item.qty * item.sellingPrice).toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.receiptTotals}>
                <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Subtotal</Text><Text style={styles.receiptValue}>₹{receiptSale?.subtotal.toFixed(2)}</Text></View>
                <View style={styles.receiptRow}><Text style={styles.receiptLabel}>GST</Text><Text style={styles.receiptValue}>₹{receiptSale?.gst.toFixed(2)}</Text></View>
                {receiptSale?.discount > 0 && (
                  <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Discount</Text><Text style={[styles.receiptValue, { color: '#16A34A' }]}>-₹{receiptSale.discount.toFixed(2)}</Text></View>
                )}
                <View style={[styles.receiptRow, styles.receiptGrandTotalRow]}>
                  <Text style={styles.receiptGrandTotalLabel}>Grand Total</Text>
                  <Text style={styles.receiptGrandTotalValue}>₹{receiptSale?.grandTotal.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity style={styles.printBtn} onPress={printBill}>
                <Text style={styles.printBtnText}>Print Bill</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneBtn} onPress={() => setReceiptSale(null)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Scanner overlay styles                                      */
/* ─────────────────────────────────────────────────────────── */
const MASK = 'rgba(0,0,0,0.65)';
const scan = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, flex: 1 },
  topMask: { flex: 1, backgroundColor: MASK },
  middleRow: { flexDirection: 'row', height: 260 },
  sideMask: { flex: 1, backgroundColor: MASK },
  target: {
    width: 260, height: 260,
    justifyContent: 'center', alignItems: 'center',
  },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#3B82F6', borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', position: 'absolute', bottom: -28 },
  bottomMask: { flex: 1, backgroundColor: MASK, alignItems: 'center', justifyContent: 'center', gap: 20 },
  scanLabel: { color: '#FFF', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30 },
  closeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

/* ─────────────────────────────────────────────────────────── */
/*  Main styles                                                 */
/* ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 2 },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  itemCount: { fontSize: 14, color: '#64748B', fontWeight: '600' },

  barcodeSection: { flexDirection: 'row', padding: 12, backgroundColor: '#FFFFFF', alignItems: 'center', marginBottom: 0, marginHorizontal: 16, marginTop: 14, borderRadius: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1, gap: 8 },
  cameraBtn: { padding: 11, backgroundColor: '#EFF6FF', borderRadius: 12 },
  barcodeInput: { flex: 1, backgroundColor: '#F1F5F9', padding: 13, borderRadius: 12, fontSize: 15, color: '#0F172A', fontWeight: '500' },
  addButton: { backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12 },
  addButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  browseBtn: { padding: 11, backgroundColor: '#F1F5F9', borderRadius: 12 },
  browseBtnActive: { backgroundColor: '#EFF6FF' },

  // Product browse panel
  productPanel: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 4, overflow: 'hidden' },
  productSearchInput: { margin: 12, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, fontSize: 15, color: '#0F172A' },
  productListItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 12 },
  productListItemDisabled: { opacity: 0.45 },
  productListIcon: { width: 36, height: 36, backgroundColor: '#EFF6FF', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  productListName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  productListSub: { fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  productListPrice: { fontSize: 15, fontWeight: '800', color: '#2563EB' },
  inCartBadge: { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  inCartText: { fontSize: 11, color: '#16A34A', fontWeight: '700' },

  cartContainer: { flex: 1, marginTop: 12 },
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 50, gap: 14 },
  emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '500' },
  emptyBrowseBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBrowseBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 14 },

  cartItem: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 14, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, alignItems: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  cartItemInfo: { flex: 1, paddingRight: 8 },
  cartItemName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cartItemPrice: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
  mrpText: { color: '#94A3B8', textDecorationLine: 'line-through', fontSize: 12 },
  savingBadge: { marginTop: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  savingText: { color: '#15803D', fontSize: 11, fontWeight: '700' },

  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 4 },
  qtyBtn: { padding: 8 },
  qtyText: { fontWeight: '700', minWidth: 22, textAlign: 'center', color: '#0F172A' },

  totalText: { fontSize: 15, fontWeight: '800', width: 72, textAlign: 'right', color: '#0F172A' },
  removeBtn: { padding: 6, marginLeft: 8 },

  totalsCard: { backgroundColor: '#FFFFFF', padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  totalValue: { fontWeight: '700', fontSize: 14, color: '#0F172A' },
  grandTotalLabel: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  grandTotalValue: { fontSize: 22, fontWeight: '900', color: '#2563EB' },

  discountRow: { flexDirection: 'row', marginTop: 10, marginBottom: 14, gap: 10 },
  discountBtn: { flex: 1, padding: 9, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
  discountBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  discountBtnText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  discountBtnTextActive: { color: '#2563EB', fontWeight: '700' },

  paymentModes: { flexDirection: 'row', marginTop: 14, marginBottom: 16, gap: 10 },
  paymentBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
  paymentBtnActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  paymentBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  paymentBtnTextActive: { color: '#FFFFFF' },

  footerActions: { flexDirection: 'row', gap: 14 },
  clearButton: { backgroundColor: '#FEF2F2', padding: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center', width: 56 },
  payButton: { backgroundColor: '#2563EB', flex: 1, padding: 17, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  payButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },

  // Receipt
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  receiptTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  receiptScroll: { padding: 20, alignItems: 'center' },
  receiptCard: { width: '100%', backgroundColor: '#FFFFFF', padding: 24, borderRadius: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  receiptTop: { alignItems: 'center', marginBottom: 20, paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: '#F1F5F9', borderStyle: 'dashed' },
  storeName: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  receiptSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  receiptDetails: { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: '#F1F5F9', borderStyle: 'dashed' },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  receiptLabel: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  receiptValue: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  receiptItems: { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: '#F1F5F9', borderStyle: 'dashed' },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  receiptItemName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  receiptItemQty: { fontSize: 13, color: '#64748B' },
  receiptItemTotal: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  receiptTotals: { marginTop: 8 },
  receiptGrandTotalRow: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  receiptGrandTotalLabel: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  receiptGrandTotalValue: { fontSize: 22, fontWeight: '900', color: '#2563EB' },
  modalActionButtons: { flexDirection: 'row', width: '100%', gap: 12, marginTop: 20 },
  printBtn: { flex: 1, backgroundColor: '#EFF6FF', padding: 17, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#2563EB' },
  printBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 15 },
  doneBtn: { flex: 1, backgroundColor: '#0F172A', padding: 17, borderRadius: 14, alignItems: 'center' },
  doneBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
