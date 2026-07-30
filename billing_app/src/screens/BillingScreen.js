import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Alert, Modal, ScrollView, Animated, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import {
  ScanLine, Trash2, X, Plus, Minus, Camera as CameraIcon,
  CheckCircle2, Search, Package,
} from 'lucide-react-native';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission } from 'react-native-vision-camera';
import RNPrint from 'react-native-print';
import { generateReceiptHTML } from '../utils/printUtils';
import Receipt from '../components/Receipt';
import DatePickerModal from '../components/DatePickerModal';
import { Calendar as CalendarIcon } from 'lucide-react-native';

/* ─────────────────────────────────────────────────────────── */
/*  New-product / edit-product inline form (used from billing)  */
/* ─────────────────────────────────────────────────────────── */
function ProductFormModal({ visible, onClose, onSave, initialBarcode, existingProduct }) {
  const emptyForm = { name: '', brand: '', barcode: '', sellingPrice: '', mrp: '', purchasePrice: '', stock: '', gst: '', hsnCode: '' };
  const [form, setForm] = useState(emptyForm);
  const { t } = useApp();

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
          hsnCode: existingProduct.hsnCode || '',
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
            <Text style={pf.label}>{t('Barcode *')}</Text>
            <TextInput style={pf.input} value={form.barcode} onChangeText={v => set('barcode', v)} />
          </View>
          {/* Name */}
          <View style={pf.group}>
            <Text style={pf.label}>{t('Product Name *')}</Text>
            <TextInput style={pf.input} value={form.name} onChangeText={v => set('name', v)} />
          </View>
          {/* Brand & HSN */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>{t('Brand')}</Text>
              <TextInput style={pf.input} value={form.brand} onChangeText={v => set('brand', v)} />
            </View>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>{t('HSN Code')}</Text>
              <TextInput style={pf.input} value={form.hsnCode} onChangeText={v => set('hsnCode', v)} />
            </View>
          </View>
          {/* MRP + Purchase Price */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>{t('MRP (₹)')}</Text>
              <TextInput style={pf.input} value={form.mrp} onChangeText={v => set('mrp', v)} keyboardType="numeric" />
            </View>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>{t('Purchase Price (₹)')}</Text>
              <TextInput style={pf.input} value={form.purchasePrice} onChangeText={v => set('purchasePrice', v)} keyboardType="numeric" />
            </View>
          </View>
          {/* Selling Price + Stock */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>{t('Selling Price (₹) *')}</Text>
              <TextInput style={pf.input} value={form.sellingPrice} onChangeText={v => set('sellingPrice', v)} keyboardType="numeric" />
            </View>
            <View style={[pf.group, { flex: 1 }]}>
              <Text style={pf.label}>{t('Stock')}</Text>
              <TextInput style={pf.input} value={form.stock} onChangeText={v => set('stock', v)} keyboardType="numeric" />
            </View>
          </View>
          {/* GST */}
          <View style={[pf.group, { width: '48%' }]}>
            <Text style={pf.label}>{t('GST %')}</Text>
            <TextInput style={pf.input} value={form.gst} onChangeText={v => set('gst', v)} keyboardType="numeric" />
          </View>

          {/* GST Preview */}
          {form.sellingPrice && form.gst ? (
            <View style={pf.previewBox}>
              <View style={pf.previewRow}>
                <Text style={pf.previewLabel}>{t('Base Selling Price')}</Text>
                <Text style={pf.previewValue}>₹{parseFloat(form.sellingPrice).toFixed(2)}</Text>
              </View>
              <View style={pf.previewRow}>
                <Text style={pf.previewLabel}>GST Amount ({form.gst}%)</Text>
                <Text style={pf.previewValue}>+ ₹{((parseFloat(form.sellingPrice) * parseFloat(form.gst)) / 100).toFixed(2)}</Text>
              </View>
              <View style={[pf.previewRow, { borderTopWidth: 1, borderTopColor: '#BBF7D0', paddingTop: 8, marginTop: 4 }]}>
                <Text style={pf.previewTotalLabel}>{t('Final Price (inc. GST)')}</Text>
                <Text style={pf.previewTotalValue}>₹{(parseFloat(form.sellingPrice) + (parseFloat(form.sellingPrice) * parseFloat(form.gst)) / 100).toFixed(2)}</Text>
              </View>
            </View>
          ) : null}
          <TouchableOpacity style={pf.saveBtn} onPress={handleSave}>
            <Text style={pf.saveBtnText}>{existingProduct ? 'Update Product' : 'Save & Add to Cart'}</Text>
          </TouchableOpacity>
          <View style={{ height: 150 }} />
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
  const { state, dispatch, completeSale, addProduct, updateProduct, addCustomer, t } = useApp();
  const [barcode, setBarcode] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [billDiscount, setBillDiscount] = useState({ type: 'none', value: '0' });
  const [customerId, setCustomerId] = useState('');
  const [bankInfo, setBankInfo] = useState('');
  const [bankDate, setBankDate] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [cashPaid, setCashPaid] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [walkinName, setWalkinName] = useState('');
  const [walkinPan, setWalkinPan] = useState('');
  const [walkinGst, setWalkinGst] = useState('');
  const [freightCharges, setFreightCharges] = useState('');
  const [laborCharges, setLaborCharges] = useState('');
  const [roundOff, setRoundOff] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' });
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [warehouseId, setWarehouseId] = useState('main');
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);

  const warehouses = state.warehouses || [];
  const displayWarehouses = warehouses.some(w => w.id === 'main') ? warehouses : [{id: 'main', name: 'Main Store'}, ...warehouses];

  // Camera state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState(null);

  // Product form modal (new or edit)
  const [productFormVisible, setProductFormVisible] = useState(false);

  const lastSoldPrices = useMemo(() => {
    if (!customerId) return {};
    const prices = {};
    const customerSales = (state.sales || []).filter(s => s.customerId === customerId).sort((a, b) => new Date(b.date) - new Date(a.date));
    customerSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        if (!prices[item.id]) {
          prices[item.id] = item.sellingPrice;
        }
      });
    });
    return prices;
  }, [state.sales, customerId]);
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
    let subtotal = 0, gst = 0, totalWeight = 0;
    state.cart.forEach(c => {
      const qty = Number(c.qty) || 0;
      const price = Number(c.sellingPrice) || 0;
      const gstPct = Number(c.gst) || 0;
      const wt = Number(c.weight) || 0;
      subtotal += price * qty;
      gst += price * qty * (gstPct / 100);
      totalWeight += wt * qty;
    });
    let discount = 0;
    const val = Number(billDiscount.value) || 0;
    if (billDiscount.type === 'percent') discount = (subtotal + gst) * (val / 100);
    else if (billDiscount.type === 'flat') discount = val;

    const freight = Number(freightCharges) || 0;
    const labor = Number(laborCharges) || 0;

    return { subtotal, gst, totalWeight, grandTotal: Math.max(0, subtotal + gst - discount) + freight + labor, discount, freight, labor };
  }, [state.cart, billDiscount, freightCharges, laborCharges]);

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

    const _cashPaid = paymentMode === 'Debt' ? (parseFloat(cashPaid) || 0) : totals.grandTotal;
    const finalBankInfo = paymentMode === 'Cheque' ? bankInfo : (['Bank', 'UPI', 'RTGS/NEFT'].includes(paymentMode) ? `Date: ${bankDate}, UTR/Txn: ${utrNumber}` : '');

    const sale = {
      id: saleId, 
      date: saleDate, 
      items: state.cart,
      subtotal: totals.subtotal, 
      gst: totals.gst,
      grandTotal: totals.grandTotal, 
      discount: totals.discount,
      freight: totals.freight, 
      labor: totals.labor,
      roundOff: totals.roundOff,
      billDiscount, 
      paymentMode, 
      cashPaid: _cashPaid,
      bankInfo: finalBankInfo,
      bankDate: bankDate || null,
      utrNumber: utrNumber || null,
      customerId: customerId || null,
      dueDate: dueDate || null,
      walkinName: walkinName || null,
      walkinPan: walkinPan || null,
      walkinGst: walkinGst || null,
      warehouseId
    };

    try {
      await completeSale(sale);
      setReceiptSale(sale);
      setBillDiscount({ type: 'none', value: '0' });
      setBankInfo('');
      setBankDate('');
      setUtrNumber('');
      setCashPaid('');
      setDueDate('');
      setShowCheckoutModal(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const printBill = async () => {
    if (!receiptSale) return;
    const html = generateReceiptHTML(receiptSale);
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

    const handlePress = () => {
      if (outOfStock) return;
      if (inCart) {
        updateQty(item.id, 1);
      } else {
        addProductToCart(item);
      }
    };

    return (
      <TouchableOpacity 
        style={[styles.productGridItem, outOfStock && styles.productListItemDisabled, inCart && { borderColor: '#2563EB', borderWidth: 1.5 }]} 
        onPress={handlePress}
        disabled={outOfStock}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.productListName, outOfStock && { color: '#CBD5E1' }]} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productListSub}>{item.brand ? `${item.brand} • ` : ''}Stock: {item.stock}</Text>
          <Text style={[styles.productListPrice, { marginTop: 4, color: outOfStock ? '#CBD5E1' : '#0F172A' }]}>₹{item.sellingPrice}</Text>
          {lastSoldPrices[item.id] !== undefined && (
            <Text style={{ fontSize: 11, color: '#2563EB', marginTop: 2, fontWeight: 'bold' }}>Last Sold: ₹{lastSoldPrices[item.id]}</Text>
          )}
        </View>
        
        {inCart ? (
          <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{inCart.qty} in cart</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [state.cart, addProductToCart, updateQty]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowCustomerModal(true)}>
            <Text style={styles.title}>{t('Billing POS')}</Text>
            <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>
              {customerId ? `For: ${state.customers?.find(c => c.id === customerId)?.name}` : 'Tap to select customer'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCheckoutModal(true)} style={{ position: 'relative', padding: 5 }}>
             <Package size={28} color="#0F172A" />
             {state.cart.length > 0 && (
               <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                 <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{state.cart.length}</Text>
               </View>
             )}
          </TouchableOpacity>
        </View>

        {/* ── Barcode / Search row ── */}
        <View style={styles.barcodeSection}>
          <TouchableOpacity onPress={openCamera} style={styles.cameraBtn}>
            <CameraIcon size={22} color="#2563EB" />
          </TouchableOpacity>
          <TextInput
            style={styles.barcodeInput}
            placeholder={t('Search products or scan...')}
            value={productSearch}
            onChangeText={(txt) => { setProductSearch(txt); setBarcode(txt); }}
            onSubmitEditing={handleBarcodeSubmit}
            returnKeyType="search"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* ── Product Grid ── */}
        <View style={{ flex: 1, paddingHorizontal: 12, marginTop: 10 }}>
          <FlatList
            data={filteredProducts}
            keyExtractor={item => item.id.toString()}
            renderItem={renderProductItem}
            numColumns={2}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 100 }}
            columnWrapperStyle={{ gap: 12 }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', padding: 20 }}>{t('No products found')}</Text>}
          />
        </View>

        {/* ── Sticky Bottom Checkout Bar ── */}
        {state.cart.length > 0 && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 15, borderTopWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>{state.cart.length} Items</Text>
              <Text style={{ color: '#0F172A', fontSize: 22, fontWeight: '900' }}>₹{totals.grandTotal.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={{ backgroundColor: '#2563EB', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 }} onPress={() => setShowCheckoutModal(true)}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>{t('View Cart')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Checkout Modal ── */}
      <Modal visible={showCheckoutModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCheckoutModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.header, { borderBottomWidth: 1 }]}>
            <Text style={styles.title}>{t('Cart & Checkout')}</Text>
            <TouchableOpacity onPress={() => setShowCheckoutModal(false)} style={styles.closeBtn}>
              <X size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Cart List */}
          <View style={[styles.cartContainer, { flex: 1, margin: 0, borderRadius: 0 }]}>
            <FlatList
              data={state.cart}
              keyExtractor={item => item.id.toString()}
              renderItem={renderCartItem}
              contentContainerStyle={{ paddingBottom: 150 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyCart}>
                  <ScanLine size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>{t('Cart is empty')}</Text>
                </View>
              }
            />
          </View>

          {/* Totals Card */}
          <View style={[styles.totalsCard, { marginHorizontal: 0, marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopWidth: 1, borderColor: '#E2E8F0', paddingBottom: 30, maxHeight: '60%' }]}>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('Subtotal')}</Text>
              <Text style={styles.totalValue}>₹{totals.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('GST')}</Text>
              <Text style={styles.totalValue}>₹{totals.gst.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.totalLabel}>{t('Freight/Shipping')}</Text>
                <TextInput style={[styles.discountInput, { height: 40, marginTop: 5 }]} value={freightCharges} onChangeText={setFreightCharges} keyboardType="numeric" placeholder="0.00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.totalLabel}>{t('Labor Charges')}</Text>
                <TextInput style={[styles.discountInput, { height: 40, marginTop: 5 }]} value={laborCharges} onChangeText={setLaborCharges} keyboardType="numeric" placeholder="0.00" />
              </View>
            </View>

            <View style={[styles.totalRow, { marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 }]}>
              <Text style={styles.grandTotalLabel}>{t('Grand Total')}</Text>
              <Text style={styles.grandTotalValue}>₹{totals.grandTotal.toFixed(2)}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, backgroundColor: '#f1f5f9', padding: 8, borderRadius: 6 }}>
              <Text style={{ fontSize: 13, color: '#475569', fontWeight: 'bold' }}>
                Dispatch from: {warehouseId ? displayWarehouses.find(w => w.id === warehouseId)?.name : 'Main Store'}
              </Text>
              <TouchableOpacity style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 }} onPress={() => setShowWarehouseModal(true)}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{t('Change')}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 10, zIndex: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 5 }}>{t('Customer Name')}</Text>
              <TextInput 
                style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', padding: 8, borderRadius: 6, fontSize: 13, color: '#0F172A' }} 
                placeholder={t('Search or Enter New Customer')} 
                placeholderTextColor="#94A3B8" 
                value={customerId ? (state.customers.find(c => c.id === customerId)?.name || walkinName) : walkinName} 
                onChangeText={(txt) => {
                   setWalkinName(txt);
                   if (customerId) setCustomerId('');
                }} 
                onFocus={() => setShowCustomerDropdown(true)}
              />
              {showCustomerDropdown && (
                 <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, maxHeight: 180, marginTop: 4, elevation: 2 }}>
                   <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                     {(state.customers||[]).filter(c => c.name.toLowerCase().includes(walkinName.toLowerCase())).map(c => (
                        <TouchableOpacity key={c.id} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }} onPress={() => {
                          setCustomerId(c.id);
                          setWalkinName(c.name);
                          setWalkinPan(c.pan || '');
                          setWalkinGst(c.gstNo || c.gst || '');
                          setShowCustomerDropdown(false);
                        }}>
                          <Text style={{ color: '#0f172a', fontWeight: 'bold', fontSize: 13 }}>{c.name}</Text>
                          <Text style={{ color: '#64748b', fontSize: 11 }}>{c.phone || 'No phone'} | Bal: ₹{c.udhaarBalance?.toFixed(2)||'0.00'}</Text>
                        </TouchableOpacity>
                     ))}
                     <TouchableOpacity style={{ padding: 10, backgroundColor: '#EFF6FF', borderBottomWidth: 1, borderBottomColor: '#DBEAFE' }} onPress={() => {
                         setCustomerForm({ name: '', phone: '', pan: '', gstNo: '' });
                         setShowCustomerDropdown(false);
                         setShowCustomerModal(true);
                     }}>
                       <Text style={{ color: '#2563EB', fontWeight: 'bold', fontSize: 13 }}>{t('+ Add New Customer')}</Text>
                     </TouchableOpacity>
                     {!(state.customers||[]).some(c => c.name.toLowerCase() === walkinName.toLowerCase()) && walkinName.length > 0 && (
                        <TouchableOpacity style={{ padding: 10, backgroundColor: '#f0fdf4', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }} onPress={() => {
                            setCustomerForm(p => ({...p, name: walkinName}));
                            setShowCustomerDropdown(false);
                            setShowCustomerModal(true);
                        }}>
                          <Text style={{ color: '#16a34a', fontWeight: 'bold', fontSize: 13 }}>+ Add "{walkinName}" to Database</Text>
                        </TouchableOpacity>
                     )}
                     <TouchableOpacity style={{ padding: 10, backgroundColor: '#f8fafc' }} onPress={() => setShowCustomerDropdown(false)}>
                        <Text style={{ color: '#475569', fontWeight: 'bold', fontSize: 13 }}>
                          {walkinName.length > 0 ? `✓ Use "${walkinName}" as Walk-in` : 'Close List'}
                        </Text>
                     </TouchableOpacity>
                   </ScrollView>
                 </View>
              )}
              
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <TextInput 
                  style={{ flex: 1, backgroundColor: (customerId && state.customers.find(c=>c.id===customerId)?.pan) ? '#f1f5f9' : '#fff', borderWidth: 1, borderColor: '#cbd5e1', padding: 8, borderRadius: 6, fontSize: 13, color: '#0F172A' }} 
                  placeholder={t('PAN Number')} placeholderTextColor="#94A3B8" 
                  value={walkinPan} onChangeText={setWalkinPan} autoCapitalize="characters" 
                  editable={!(customerId && state.customers.find(c=>c.id===customerId)?.pan)}
                />
                <TextInput 
                  style={{ flex: 1, backgroundColor: (customerId && (state.customers.find(c=>c.id===customerId)?.gstNo || state.customers.find(c=>c.id===customerId)?.gst)) ? '#f1f5f9' : '#fff', borderWidth: 1, borderColor: '#cbd5e1', padding: 8, borderRadius: 6, fontSize: 13, color: '#0F172A' }} 
                  placeholder={t('GST Number')} placeholderTextColor="#94A3B8" 
                  value={walkinGst} onChangeText={setWalkinGst} autoCapitalize="characters" 
                  editable={!(customerId && (state.customers.find(c=>c.id===customerId)?.gstNo || state.customers.find(c=>c.id===customerId)?.gst))}
                />
              </View>
            </View>

            {paymentMode === 'Debt' && (
               <View style={{ marginBottom: 10, gap: 10 }}>
                 <View>
                   <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 5 }}>{t('Amount Paid Now (Advance)')}</Text>
                   <TextInput 
                     style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6, fontSize: 13, color: '#0F172A' }}
                     placeholder="0.00"
                     placeholderTextColor="#94A3B8"
                     keyboardType="decimal-pad"
                     value={cashPaid}
                     onChangeText={setCashPaid}
                   />
                 </View>
                 <View>
                   <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 5 }}>{t('Remaining Balance (Udhaar)')}</Text>
                   <View style={{ padding: 10, backgroundColor: '#FEF2F2', borderRadius: 6, borderWidth: 1, borderColor: '#FECACA' }}>
                     <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#EF4444' }}>
                       ₹{Math.max(0, totals.grandTotal - (parseFloat(cashPaid) || 0)).toFixed(2)}
                     </Text>
                   </View>
                 </View>
                 <View>
                   <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 5 }}>{t('Payment Due Date (Optional)')}</Text>
                   <TouchableOpacity 
                     style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6 }}
                     onPress={() => { setDatePickerTarget('dueDate'); setShowDatePicker(true); }}
                   >
                     <CalendarIcon size={16} color="#64748B" style={{ marginRight: 8 }} />
                     <Text style={{ fontSize: 13, color: dueDate ? '#0F172A' : '#94A3B8' }}>{dueDate || 'YYYY-MM-DD'}</Text>
                   </TouchableOpacity>
                 </View>
               </View>
            )}
            
            {(paymentMode === 'Cheque' || paymentMode === 'RTGS/NEFT' || paymentMode === 'Bank' || paymentMode === 'UPI') && (
               <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                 <TouchableOpacity 
                   style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6 }}
                   onPress={() => { setDatePickerTarget('bankDate'); setShowDatePicker(true); }}
                 >
                   <CalendarIcon size={16} color="#64748B" style={{ marginRight: 8 }} />
                   <Text style={{ fontSize: 13, color: bankDate ? '#0F172A' : '#94A3B8' }}>{bankDate || 'Date (YYYY-MM-DD)'}</Text>
                 </TouchableOpacity>
                 <TextInput 
                   style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6, fontSize: 13, color: '#0F172A' }}
                   placeholder={paymentMode === 'UPI' ? "UPI Number" : "Transaction/UTR No."}
                   placeholderTextColor="#94A3B8"
                   value={utrNumber}
                   onChangeText={setUtrNumber}
                 />
               </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={styles.paymentModes}>
                {['Cash', 'UPI', 'Bank', 'Debt', 'Cheque', 'RTGS/NEFT'].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.paymentBtn, paymentMode === m && styles.paymentBtnActive]}
                    onPress={() => {
                       setPaymentMode(m);
                       if (m === 'Debt' && !customerId && !walkinName) {
                           // focus walkinName if you want, but for now just let them be
                       }
                    }}
                  >
                    <Text style={[styles.paymentBtnText, paymentMode === m && styles.paymentBtnTextActive]}>
                      {m === 'Cash' ? '💵' : m === 'UPI' ? '📱' : m === 'Bank' ? '💳' : m === 'Debt' ? '📝' : '🏦'} {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            </ScrollView>

            <View style={styles.footerActions}>
              <TouchableOpacity style={styles.clearButton} onPress={() => { dispatch({ type: 'CLEAR_CART' }); setShowCheckoutModal(false); setCustomerId(''); setWalkinName(''); setWalkinPan(''); setWalkinGst(''); }}>
                <Trash2 size={20} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payButton, state.cart.length === 0 && { opacity: 0.5 }]}
                onPress={generateBill}
                disabled={state.cart.length === 0}
              >
                <Text style={styles.payButtonText}>{t('Generate Bill')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Warehouse Selection Modal ── */}
      <Modal visible={showWarehouseModal} animationType="slide" transparent={true} onRequestClose={() => setShowWarehouseModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A' }}>{t('Select Warehouse')}</Text>
              <TouchableOpacity onPress={() => setShowWarehouseModal(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {displayWarehouses.map(wh => (
                <TouchableOpacity 
                  key={wh.id} 
                  style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: warehouseId === wh.id ? '#EFF6FF' : '#FFF', borderRadius: 8 }}
                  onPress={() => {
                    setWarehouseId(wh.id);
                    setShowWarehouseModal(false);
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: warehouseId === wh.id ? '700' : '500', color: warehouseId === wh.id ? '#2563EB' : '#0F172A' }}>
                    {wh.name} {wh.id === 'main' ? '(Default)' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                <Text style={scan.scanHint}>{t('Align barcode inside the box')}</Text>
              </Animated.View>
              <View style={scan.sideMask} />
            </View>
            <View style={scan.bottomMask}>
              <Text style={scan.scanLabel}>{t('📷  Auto-scanning…')}</Text>
              <TouchableOpacity style={scan.closeBtn} onPress={() => setIsScannerOpen(false)}>
                <X size={22} color="#FFF" />
                <Text style={scan.closeBtnText}>{t('Cancel')}</Text>
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
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{t('Select or Add Customer')}</Text>
              <TouchableOpacity onPress={() => setShowCustomerModal(false)}><X size={24} color="#64748B" /></TouchableOpacity>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              <TextInput style={{ flex: 1, borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6, color: '#0F172A' }} placeholder={t('New Customer Name')} placeholderTextColor="#94A3B8" value={customerForm.name} onChangeText={t => setCustomerForm(p => ({...p, name: t}))} />
              <TextInput style={{ flex: 1, borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6, color: '#0F172A' }} placeholder={t('Phone (opt)')} placeholderTextColor="#94A3B8" value={customerForm.phone} onChangeText={t => setCustomerForm(p => ({...p, phone: t}))} keyboardType="numeric" />
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
              contentContainerStyle={{ paddingBottom: 150 }}
              keyboardShouldPersistTaps="handled"
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
            <Text style={styles.receiptTitle}>{t('Bill Generated!')}</Text>
            <TouchableOpacity onPress={() => setReceiptSale(null)}>
              <X size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.receiptScroll} contentContainerStyle={{ padding: 15, alignItems: 'center' }}>
            <Receipt sale={receiptSale} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
              <TouchableOpacity style={styles.printBtn} onPress={printBill}>
                <Text style={styles.printBtnText}>{t('Print Bill')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneBtn} onPress={() => setReceiptSale(null)}>
                <Text style={styles.doneBtnText}>{t('Done')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {/* ── Date Picker Modal ── */}
      <DatePickerModal 
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(date) => {
          if (datePickerTarget === 'bankDate') setBankDate(date);
          else if (datePickerTarget === 'dueDate') setDueDate(date);
          setShowDatePicker(false);
        }}
      />
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
  productGridItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 90,
    justifyContent: 'space-between',
  },
  closeBtn: { padding: 6, backgroundColor: '#F1F5F9', borderRadius: 10 },
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
  receiptScroll: { padding: 20 },
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
