import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { TrendingUp, Package, AlertTriangle, IndianRupee, X, CheckCircle2, Edit2, Trash2, Printer, Clock } from 'lucide-react-native';
import RNPrint from 'react-native-print';
import { useNavigation } from '@react-navigation/native';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const getToday = () => new Date().toDateString();

export default function DashboardScreen() {
  const { state, deleteSale, editBill } = useApp();
  const navigation = useNavigation();
  const [selectedBill, setSelectedBill] = useState(null);

  const todaySales = state.sales.filter(s => new Date(s.date).toDateString() === getToday());
  const todayRevenue = todaySales.reduce((a, s) => a + s.grandTotal, 0);
  const totalRevenue = state.sales.reduce((a, s) => a + s.grandTotal, 0);
  const lowStock = state.products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5);
  const oos = state.products.filter(p => (p.stock || 0) === 0);

  const allAccounts = [
    ...(state.customers || []).map(c => ({ ...c, type: 'Customer', balance: c.udhaarBalance || 0 })),
    ...(state.vendors || []).map(v => ({ ...v, type: 'Vendor' })),
    ...(state.accounts || [])
  ];

  const upcomingDues = allAccounts
    .filter(a => a.dueDate && a.balance > 0)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const printSelectedBill = async () => {
    if (!selectedBill) return;
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
        <p><strong>Bill No:</strong> #${selectedBill.id.slice(-6).toUpperCase()}</p>
        <p><strong>Date:</strong> ${new Date(selectedBill.date).toLocaleString('en-IN')}</p>
        <p><strong>Payment:</strong> ${selectedBill.paymentMode}</p>
      </div>
      <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${selectedBill.items.map(i => `<tr><td>${i.name}<br><small style="color:#666">₹${i.sellingPrice}</small></td><td style="text-align:center">${i.qty}</td><td style="text-align:right">₹${(i.qty * i.sellingPrice).toFixed(2)}</td></tr>`).join('')}</tbody></table>
      <div class="tot">
        <p><span>Subtotal:</span><span>₹${selectedBill.subtotal.toFixed(2)}</span></p>
        <p><span>GST:</span><span>₹${selectedBill.gst.toFixed(2)}</span></p>
        ${selectedBill.discount > 0 ? `<p><span>Discount:</span><span>-₹${selectedBill.discount.toFixed(2)}</span></p>` : ''}
        <p class="gt"><span>Grand Total:</span><span>₹${selectedBill.grandTotal.toFixed(2)}</span></p>
      </div>
      <div class="foot">Thank you for shopping with us!</div>
    </body></html>`;
    try { await RNPrint.print({ html }); } catch (e) { Alert.alert('Print Error', e.message); }
  };

  const handleEditBill = () => {
    editBill(selectedBill);
    setSelectedBill(null);
    navigation.navigate('Billing');
  };

  const handleDeleteBill = () => {
    Alert.alert('Delete Bill', 'Are you sure you want to delete this bill? Stock will be restored.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteSale(selectedBill.id);
        setSelectedBill(null);
      }}
    ]);
  };

  const renderBill = ({ item }) => (
    <TouchableOpacity style={styles.billRow} onPress={() => setSelectedBill(item)} activeOpacity={0.7}>
      <View style={styles.billBadge}>
        <Text style={styles.billBadgeText}>#{item.id.slice(-6).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, paddingLeft: 12 }}>
        <Text style={styles.billAmount}>{fmt(item.grandTotal)}</Text>
        <Text style={styles.billDate}>{new Date(item.date).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      <View style={[styles.payModeBadge, item.paymentMode === 'Cash' ? styles.payCash : item.paymentMode === 'UPI' ? styles.payUpi : styles.payCard]}>
        <Text style={styles.payModeText}>{item.paymentMode}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderLowStock = ({ item }) => (
    <View style={styles.lowStockRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.lowStockName}>{item.name}</Text>
        <Text style={styles.lowStockCat}>{item.brand}</Text>
      </View>
      <View style={[styles.stockStatusBadge, item.stock === 0 ? styles.stockStatusOut : styles.stockStatusLow]}>
        <Text style={[styles.stockStatusText, item.stock === 0 ? styles.stockTextOut : styles.stockTextLow]}>
          {item.stock === 0 ? 'Out of Stock' : `${item.stock} left`}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 }]}>
            <IndianRupee size={20} color="#2563EB" style={styles.statIcon} />
            <Text style={styles.statLabel}>Today's Revenue</Text>
            <Text style={[styles.statValue, { color: '#1E3A8A' }]}>{fmt(todayRevenue)}</Text>
            <Text style={styles.statSub}>{todaySales.length} bills today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}>
            <TrendingUp size={20} color="#16A34A" style={styles.statIcon} />
            <Text style={styles.statLabel}>Total Revenue</Text>
            <Text style={[styles.statValue, { color: '#14532D' }]}>{fmt(totalRevenue)}</Text>
            <Text style={styles.statSub}>{state.sales.length} total bills</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1 }]}>
            <Package size={20} color="#475569" style={styles.statIcon} />
            <Text style={styles.statLabel}>Total Products</Text>
            <Text style={[styles.statValue, { color: '#0F172A' }]}>{state.products.length}</Text>
            <Text style={styles.statSub}>{oos.length} out of stock</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1 }]}>
            <AlertTriangle size={20} color="#D97706" style={styles.statIcon} />
            <Text style={styles.statLabel}>Stock Alerts</Text>
            <Text style={[styles.statValue, { color: '#78350F' }]}>{lowStock.length + oos.length}</Text>
            <Text style={styles.statSub}>Need restocking</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📜 Recent Bills</Text>
          {state.sales.length === 0 ? (
            <Text style={styles.emptyText}>No bills found</Text>
          ) : (
            <FlatList
              data={state.sales.slice(0, 5)}
              keyExtractor={item => item.id}
              renderItem={renderBill}
              scrollEnabled={false}
              nestedScrollEnabled={true}
            />
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⚠️ Low Stock Alerts</Text>
          {lowStock.length === 0 && oos.length === 0 ? (
            <Text style={[styles.emptyText, { color: '#16A34A' }]}>✅ All products are well stocked!</Text>
          ) : (
            <FlatList
              data={[...oos, ...lowStock].slice(0, 5)}
              keyExtractor={item => item.id.toString()}
              renderItem={renderLowStock}
              scrollEnabled={false}
              nestedScrollEnabled={true}
            />
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Clock size={18} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { marginBottom: 0, color: '#DC2626' }]}>Reminders & Dues</Text>
          </View>
          {upcomingDues.length === 0 ? (
            <Text style={[styles.emptyText, { color: '#16A34A' }]}>✅ No pending dues!</Text>
          ) : (
            <FlatList
              data={upcomingDues}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
              nestedScrollEnabled={true}
              renderItem={({ item }) => {
                const daysLeft = Math.ceil((new Date(item.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysLeft < 0;
                return (
                  <View style={[styles.lowStockRow, { borderLeftWidth: 3, borderLeftColor: isOverdue ? '#DC2626' : '#F59E0B', paddingLeft: 10 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lowStockName}>{item.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.stockStatusBadge, { paddingHorizontal: 4, paddingVertical: 1, marginRight: 5, backgroundColor: item.type === 'Customer' ? '#DCFCE7' : '#FEF3C7' }]}>
                           <Text style={{ fontSize: 10, color: item.type === 'Customer' ? '#166534' : '#92400E' }}>{item.type}</Text>
                        </View>
                        <Text style={styles.lowStockCat}>₹{item.balance.toFixed(2)}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                       <Text style={{ fontSize: 12, fontWeight: 'bold', color: isOverdue ? '#DC2626' : '#D97706' }}>
                         {isOverdue ? 'Overdue!' : `${daysLeft} days left`}
                       </Text>
                       <Text style={{ fontSize: 10, color: '#64748B' }}>{new Date(item.dueDate).toLocaleDateString()}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bill Details Modal */}
      <Modal visible={!!selectedBill} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedBill(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bill Details</Text>
            <TouchableOpacity onPress={() => setSelectedBill(null)} style={styles.closeBtn}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {selectedBill && (
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
                    <Text style={styles.receiptValue}>#{selectedBill.id.slice(-6).toUpperCase()}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Date:</Text>
                    <Text style={styles.receiptValue}>{new Date(selectedBill.date).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Payment:</Text>
                    <Text style={styles.receiptValue}>{selectedBill.paymentMode}</Text>
                  </View>
                </View>

                <View style={styles.receiptItems}>
                  {selectedBill.items.map(item => (
                    <View key={item.id} style={styles.receiptItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.receiptItemName}>{item.name}</Text>
                        <Text style={styles.receiptItemQty}>{item.qty} × ₹{item.sellingPrice}</Text>
                      </View>
                      <Text style={styles.receiptItemTotal}>₹{(item.qty * item.sellingPrice).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.receiptTotals}>
                  <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Subtotal</Text><Text style={styles.receiptValue}>₹{selectedBill.subtotal.toFixed(2)}</Text></View>
                  <View style={styles.receiptRow}><Text style={styles.receiptLabel}>GST</Text><Text style={styles.receiptValue}>₹{selectedBill.gst.toFixed(2)}</Text></View>
                  {selectedBill.discount > 0 && (
                    <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Discount</Text><Text style={[styles.receiptValue, { color: '#16A34A' }]}>-₹{selectedBill.discount.toFixed(2)}</Text></View>
                  )}
                  <View style={[styles.receiptRow, styles.receiptGrandTotalRow]}>
                    <Text style={styles.receiptGrandTotalLabel}>Grand Total</Text>
                    <Text style={styles.receiptGrandTotalValue}>₹{selectedBill.grandTotal.toFixed(2)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity style={styles.actionBtn} onPress={printSelectedBill}>
                  <Printer size={20} color="#2563EB" />
                  <Text style={[styles.actionBtnText, { color: '#2563EB' }]}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={handleEditBill}>
                  <Edit2 size={20} color="#059669" />
                  <Text style={[styles.actionBtnText, { color: '#059669' }]}>Edit Bill</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]} onPress={handleDeleteBill}>
                  <Trash2 size={20} color="#DC2626" />
                  <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 2, zIndex: 10 },
  title: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  dateText: { fontSize: 14, color: '#64748B', marginTop: 4, fontWeight: '500' },
  scrollContent: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { width: '48%', padding: 16, borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  statIcon: { marginBottom: 8 },
  statLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  statValue: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginVertical: 6 },
  statSub: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  sectionCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0F172A' },
  
  billRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  billBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  billBadgeText: { color: '#475569', fontWeight: 'bold', fontSize: 12 },
  billAmount: { fontSize: 16, fontWeight: '800', color: '#2563EB' },
  billDate: { fontSize: 12, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  payModeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  payCash: { backgroundColor: '#DCFCE7' },
  payUpi: { backgroundColor: '#F3E8FF' },
  payCard: { backgroundColor: '#FEF9C3' },
  payModeText: { fontSize: 12, fontWeight: '700', color: '#334155' },

  lowStockRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  lowStockName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  lowStockCat: { fontSize: 13, color: '#64748B', marginTop: 4 },
  stockStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  stockStatusLow: { backgroundColor: '#FEF9C3' },
  stockStatusOut: { backgroundColor: '#FEE2E2' },
  stockStatusText: { fontSize: 12, fontWeight: '800' },
  stockTextLow: { color: '#854D0E' },
  stockTextOut: { color: '#991B1B' },
  
  emptyText: { textAlign: 'center', color: '#94A3B8', marginVertical: 24, fontStyle: 'italic', fontWeight: '500' },

  // Modal Styles
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  closeBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 10 },
  receiptScroll: { padding: 20, alignItems: 'center', paddingBottom: 40 },
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
  
  actionButtonsContainer: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 20, gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  actionBtnText: { fontWeight: '700', fontSize: 14 }
});
