import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { PackageSearch, Plus, Search, X, Edit2, Trash2, Camera as CameraIcon } from 'lucide-react-native';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission } from 'react-native-vision-camera';

const EMPTY_FORM = {
  name: '', brand: '', barcode: '',
  sellingPrice: '', mrp: '', purchasePrice: '',
  stock: '', gst: '',
};

export default function InventoryScreen() {
  const { state, addProduct, updateProduct, deleteProduct } = useApp();
  const [search, setSearch] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const lastScan = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  // Pulse animation for scanner
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
          setTimeout(() => handleScannedBarcode(scannedCode), 200);
        }
      }
    },
  });

  const handleScannedBarcode = (code) => {
    const existingProduct = state.products.find(p => p.barcode === code);
    if (existingProduct) {
      // Product exists → open edit modal
      openEditModal(existingProduct);
    } else {
      // New product → open add modal with barcode pre-filled
      setEditingProduct(null);
      setFormData({ ...EMPTY_FORM, barcode: code });
      setModalVisible(true);
    }
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

  const filteredProducts = useMemo(() => {
    if (!search) return state.products;
    const q = search.toLowerCase();
    return state.products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    );
  }, [state.products, search]);

  const set = (key, val) => setFormData(f => ({ ...f, [key]: val }));

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      brand: product.brand || '',
      barcode: product.barcode || '',
      sellingPrice: product.sellingPrice?.toString() || '',
      mrp: product.mrp?.toString() || '',
      purchasePrice: product.purchasePrice?.toString() || '',
      stock: product.stock?.toString() || '',
      gst: product.gst?.toString() || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.sellingPrice || !formData.barcode) {
      Alert.alert('Validation Error', 'Name, Barcode and Selling Price are required.');
      return;
    }
    const payload = {
      ...formData,
      sellingPrice: parseFloat(formData.sellingPrice) || 0,
      mrp: parseFloat(formData.mrp) || 0,
      purchasePrice: parseFloat(formData.purchasePrice) || 0,
      stock: parseInt(formData.stock) || 0,
      gst: parseFloat(formData.gst) || 0,
    };
    if (editingProduct) {
      await updateProduct({ ...payload, id: editingProduct.id });
    } else {
      await addProduct(payload);
    }
    setModalVisible(false);
  };

  const handleDelete = (id) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProduct(id) },
    ]);
  };

  const renderProduct = useCallback(({ item }) => {
    const margin = item.sellingPrice && item.purchasePrice
      ? ((item.sellingPrice - item.purchasePrice) / item.sellingPrice * 100).toFixed(0)
      : null;

    return (
      <View style={styles.productCard}>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          {item.brand ? <Text style={styles.productBrand}>{item.brand}</Text> : null}
          <Text style={styles.productBarcode}>{item.barcode}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.sellPrice}>₹{item.sellingPrice}</Text>
            {item.mrp ? <Text style={styles.mrpPrice}>MRP ₹{item.mrp}</Text> : null}
            {item.purchasePrice ? <Text style={styles.buyPrice}>Buy ₹{item.purchasePrice}</Text> : null}
            {margin ? <View style={styles.marginBadge}><Text style={styles.marginText}>{margin}% margin</Text></View> : null}
          </View>
        </View>
        <View style={styles.productDetails}>
          <View style={[
            styles.stockBadge,
            item.stock <= 0 ? styles.stockOut : (item.stock <= 5 ? styles.stockLow : styles.stockOk)
          ]}>
            <Text style={[
              styles.stockText,
              item.stock <= 0 ? styles.stockTextOut : (item.stock <= 5 ? styles.stockTextLow : styles.stockTextOk)
            ]}>
              {item.stock || 0} in stock
            </Text>
          </View>
          {item.gst ? <Text style={styles.gstText}>GST {item.gst}%</Text> : null}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
              <Edit2 size={16} color="#2563EB" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={[styles.actionBtn, styles.deleteBtn]}>
              <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>{state.products.length} products</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.scanButton} onPress={openCamera}>
            <CameraIcon size={20} color="#2563EB" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, brand, barcode..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={20} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={item => item.id.toString()}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContainer}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={7}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <PackageSearch size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>{search ? 'No products found' : 'Inventory is empty'}</Text>
            <TouchableOpacity style={styles.emptyScanBtn} onPress={openCamera}>
              <CameraIcon size={18} color="#2563EB" />
              <Text style={styles.emptyScanText}>Scan Barcode to Add</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Scanner Modal */}
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
          <View style={sc.overlay}>
            <View style={sc.topMask} />
            <View style={sc.middleRow}>
              <View style={sc.sideMask} />
              <Animated.View style={[sc.target, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[sc.corner, sc.tl]} /><View style={[sc.corner, sc.tr]} />
                <View style={[sc.corner, sc.bl]} /><View style={[sc.corner, sc.br]} />
                <Text style={sc.scanHint}>Align barcode inside the box</Text>
              </Animated.View>
              <View style={sc.sideMask} />
            </View>
            <View style={sc.bottomMask}>
              <Text style={sc.scanLabel}>📷  Scan product barcode</Text>
              <Text style={sc.scanSub}>Existing → Edit  •  New → Add Product</Text>
              <TouchableOpacity style={sc.closeBtn} onPress={() => setIsScannerOpen(false)}>
                <X size={22} color="#FFF" />
                <Text style={sc.closeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add Product'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Barcode */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Barcode *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.barcode}
                  onChangeText={v => set('barcode', v)}
                  placeholder="Enter or scan barcode"
                  placeholderTextColor="#CBD5E1"
                />
              </View>

              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Product Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={v => set('name', v)}
                  placeholder="e.g. Colgate Toothpaste 200g"
                  placeholderTextColor="#CBD5E1"
                />
              </View>

              {/* Brand */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Brand</Text>
                <TextInput
                  style={styles.input}
                  value={formData.brand}
                  onChangeText={v => set('brand', v)}
                  placeholder="e.g. Colgate"
                  placeholderTextColor="#CBD5E1"
                />
              </View>

              {/* MRP + Purchase Price */}
              <Text style={styles.sectionLabel}>Pricing</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>MRP (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.mrp}
                    onChangeText={v => set('mrp', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Purchase Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.purchasePrice}
                    onChangeText={v => set('purchasePrice', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
              </View>

              {/* Selling Price + Stock */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Selling Price (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.sellingPrice}
                    onChangeText={v => set('sellingPrice', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Stock (qty)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.stock}
                    onChangeText={v => set('stock', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
              </View>

              {/* GST */}
              <View style={[styles.inputGroup, { width: '48%' }]}>
                <Text style={styles.label}>GST %</Text>
                <TextInput
                  style={styles.input}
                  value={formData.gst}
                  onChangeText={v => set('gst', v)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#CBD5E1"
                />
              </View>

              {/* Live margin & GST preview */}
              {formData.sellingPrice && (formData.purchasePrice || formData.gst) ? (
                <View style={styles.previewBox}>
                  {formData.purchasePrice ? (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Estimated Margin</Text>
                      <Text style={styles.previewValue}>
                        ₹{(parseFloat(formData.sellingPrice) - parseFloat(formData.purchasePrice)).toFixed(2)}
                        {'  '}
                        ({((parseFloat(formData.sellingPrice) - parseFloat(formData.purchasePrice)) / parseFloat(formData.sellingPrice) * 100).toFixed(1)}%)
                      </Text>
                    </View>
                  ) : null}
                  {formData.gst ? (
                    <>
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>GST Amount ({formData.gst}%)</Text>
                        <Text style={styles.previewValue}>+ ₹{((parseFloat(formData.sellingPrice) * parseFloat(formData.gst)) / 100).toFixed(2)}</Text>
                      </View>
                      <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: '#BBF7D0', paddingTop: 8, marginTop: 4 }]}>
                        <Text style={styles.previewTotalLabel}>Final Price (inc. GST)</Text>
                        <Text style={styles.previewTotalValue}>₹{(parseFloat(formData.sellingPrice) + (parseFloat(formData.sellingPrice) * parseFloat(formData.gst)) / 100).toFixed(2)}</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 50 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* Scanner overlay styles */
const MASK = 'rgba(0,0,0,0.65)';
const sc = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, flex: 1 },
  topMask: { flex: 1, backgroundColor: MASK },
  middleRow: { flexDirection: 'row', height: 260 },
  sideMask: { flex: 1, backgroundColor: MASK },
  target: { width: 260, height: 260, justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#3B82F6', borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', position: 'absolute', bottom: -28 },
  bottomMask: { flex: 1, backgroundColor: MASK, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scanLabel: { color: '#FFF', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
  scanSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, marginTop: 6 },
  closeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 2 },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  scanButton: { padding: 10, backgroundColor: '#EFF6FF', borderRadius: 12 },
  addButton: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addButtonText: { color: '#FFFFFF', fontWeight: '700' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', margin: 16, paddingHorizontal: 16, borderRadius: 16, height: 52, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: '#0F172A' },

  listContainer: { paddingHorizontal: 16, paddingBottom: 24 },
  productCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  productInfo: { flex: 2, justifyContent: 'center' },
  productName: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
  productBrand: { color: '#64748B', fontSize: 13, marginBottom: 4, fontWeight: '500' },
  productBarcode: { color: '#94A3B8', fontSize: 12, letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 },

  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sellPrice: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  mrpPrice: { fontSize: 12, color: '#94A3B8', textDecorationLine: 'line-through', fontWeight: '500' },
  buyPrice: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  marginBadge: { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  marginText: { color: '#16A34A', fontSize: 11, fontWeight: '700' },

  productDetails: { flex: 1, alignItems: 'flex-end', justifyContent: 'space-between' },
  stockBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  stockOk: { backgroundColor: '#DCFCE7' },
  stockLow: { backgroundColor: '#FEF9C3' },
  stockOut: { backgroundColor: '#FEE2E2' },
  stockText: { fontSize: 12, fontWeight: '800' },
  stockTextOk: { color: '#16A34A' },
  stockTextLow: { color: '#CA8A04' },
  stockTextOut: { color: '#DC2626' },
  gstText: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 6 },

  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 8, backgroundColor: '#EFF6FF', borderRadius: 8 },
  deleteBtn: { backgroundColor: '#FEF2F2' },

  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 14 },
  emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
  emptyScanBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyScanText: { color: '#2563EB', fontWeight: '700', fontSize: 14 },

  // Modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  cancelBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 10 },
  modalBody: { padding: 20, backgroundColor: '#F8FAFC' },
  sectionLabel: { fontSize: 13, color: '#2563EB', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 6 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, color: '#475569', marginBottom: 5, fontWeight: '600' },
  input: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', fontSize: 15, color: '#0F172A', fontWeight: '500' },

  previewBox: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0', gap: 6 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLabel: { color: '#15803D', fontWeight: '600', fontSize: 13 },
  previewValue: { color: '#15803D', fontWeight: '600', fontSize: 13 },
  previewTotalLabel: { color: '#16A34A', fontWeight: '800', fontSize: 15 },
  previewTotalValue: { color: '#16A34A', fontWeight: '900', fontSize: 17 },

  saveButton: { backgroundColor: '#2563EB', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
