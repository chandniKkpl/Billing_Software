import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Modal, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../store/AppContext';
import { TrendingUp, Package, AlertTriangle, IndianRupee, X, CheckCircle2, Edit2, Trash2, Printer, Clock, Bell, MessageCircle, ArrowRight, Menu } from 'lucide-react-native';
import RNPrint from 'react-native-print';
import { useNavigation } from '@react-navigation/native';
import { generateReceiptHTML } from '../utils/printUtils';
import Receipt from '../components/Receipt';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const getToday = () => new Date().toDateString();

export default function DashboardScreen() {
  const { state, deleteSale, editBill, setDrawerOpen, t } = useApp();
  const navigation = useNavigation();
  const [selectedBill, setSelectedBill] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const { todaySales, todayRevenue, totalRevenue, lowStock, oos, upcomingDues } = useMemo(() => {
    const todayStr = getToday();
    const ts = state.sales.filter(s => new Date(s.date).toDateString() === todayStr);
    const tr = ts.reduce((a, s) => a + s.grandTotal, 0);
    const totR = state.sales.reduce((a, s) => a + s.grandTotal, 0);
    
    const ls = state.products.filter(p => p.itemType !== 'Service' && (p.stock || 0) > 0 && (p.stock || 0) <= 5);
    const os = state.products.filter(p => p.itemType !== 'Service' && (p.stock || 0) === 0);
    
    const dues = state.customers.filter(c => (c.udhaarBalance || 0) > 0).map(c => ({
      id: c.id, name: c.name, phone: c.phone, balance: c.udhaarBalance,
      dueDate: c.dueDate ? new Date(c.dueDate) : null
    })).sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.balance - a.balance;
    }).slice(0, 5);

    return { todaySales: ts, todayRevenue: tr, totalRevenue: totR, lowStock: ls, oos: os, upcomingDues: dues };
  }, [state.sales, state.products, state.customers]);

  const allAccounts = [
    ...(state.customers || []).map(c => ({ ...c, type: 'Customer', balance: c.udhaarBalance || 0 })),
    ...(state.vendors || []).map(v => ({ ...v, type: 'Vendor' })),
    ...(state.accounts || [])
  ];

  const notificationDues = allAccounts
    .filter(a => {
      if (!a.dueDate || a.balance <= 0) return false;
      const daysLeft = Math.ceil((new Date(a.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 5;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  useEffect(() => {
    const checkDailyAlert = async () => {
      try {
        const lastDate = await AsyncStorage.getItem('lastNotificationDate');
        const todayStr = getToday();
        if (lastDate !== todayStr && notificationDues.length > 0) {
          Alert.alert(
            "Upcoming Dues Alert", 
            `You have ${notificationDues.length} accounts with dues approaching in 5 days or overdue!`,
            [
              { text: 'Later', style: 'cancel' },
              { text: 'View Dues', onPress: () => setShowNotifications(true) }
            ]
          );
          await AsyncStorage.setItem('lastNotificationDate', todayStr);
        }
      } catch(e) {}
    };
    if (notificationDues.length > 0) {
      checkDailyAlert();
    }
  }, [notificationDues.length]);

  const printSelectedBill = async () => {
    if (!selectedBill) return;
    const html = generateReceiptHTML(selectedBill);
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
            <Menu size={28} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={() => setShowNotifications(true)}>
          <Bell size={24} color="#475569" />
          {notificationDues.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notificationDues.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 15 }}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
            onPress={() => navigation.navigate('Enquiries')}
          >
            <MessageCircle size={18} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={{ color: '#2563EB', fontWeight: '600' }}>Enquiries</Text>
          </TouchableOpacity>
        </View>

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
                  <TouchableOpacity 
                    style={[styles.lowStockRow, { borderLeftWidth: 3, borderLeftColor: isOverdue ? '#DC2626' : '#F59E0B', paddingLeft: 10, paddingVertical: 12, alignItems: 'center' }]}
                    onPress={() => {
                      if (item.phone) {
                        const message = `Hello ${item.name}, this is a gentle reminder regarding your pending balance of Rs. ${item.balance.toFixed(2)}. Please arrange for payment by ${new Date(item.dueDate).toLocaleDateString()}. Thank you!\n\nRegards,\nCosmo Store`;
                        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}&phone=91${item.phone}`).catch(() => {
                          Alert.alert("Error", "WhatsApp not installed");
                        });
                      } else {
                        Alert.alert("Error", "No phone number saved for this account.");
                      }
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lowStockName}>{item.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.stockStatusBadge, { paddingHorizontal: 4, paddingVertical: 1, marginRight: 5, backgroundColor: item.type === 'Customer' ? '#DCFCE7' : '#FEF3C7' }]}>
                           <Text style={{ fontSize: 10, color: item.type === 'Customer' ? '#166534' : '#92400E' }}>{item.type}</Text>
                        </View>
                        <Text style={styles.lowStockCat}>₹{item.balance.toFixed(2)}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                       <Text style={{ fontSize: 12, fontWeight: 'bold', color: isOverdue ? '#DC2626' : '#D97706' }}>
                         {isOverdue ? 'Overdue!' : `${daysLeft} days left`}
                       </Text>
                       <Text style={{ fontSize: 10, color: '#64748B' }}>{new Date(item.dueDate).toLocaleDateString()}</Text>
                    </View>
                    <View style={{ backgroundColor: '#DCFCE7', padding: 8, borderRadius: 20 }}>
                      <MessageCircle size={18} color="#16A34A" />
                    </View>
                  </TouchableOpacity>
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
            <ScrollView contentContainerStyle={{ padding: 15, alignItems: 'center' }}>
              <Receipt sale={selectedBill} />
              
              <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 20 }}>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' }} onPress={printSelectedBill}>
                  <Printer size={18} color="#2563EB" />
                  <Text style={{ color: '#2563EB', fontWeight: 'bold', fontSize: 14 }}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#A7F3D0' }} onPress={handleEditBill}>
                  <Edit2 size={18} color="#059669" />
                  <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 14 }}>Edit Bill</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEF2F2', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FECACA' }} onPress={handleDeleteBill}>
                  <Trash2 size={18} color="#DC2626" />
                  <Text style={{ color: '#DC2626', fontWeight: 'bold', fontSize: 14 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifications(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeBtn}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {notificationDues.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#64748B', marginTop: 50, fontSize: 16 }}>No upcoming dues within 5 days. 🎉</Text>
            ) : (
              notificationDues.map((item, index) => {
                const daysLeft = Math.ceil((new Date(item.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysLeft < 0;
                return (
                  <View key={index} style={[styles.receiptCard, { marginBottom: 15, padding: 16 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A' }}>{item.name}</Text>
                        <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{item.type} • ₹{item.balance.toFixed(2)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                         <Text style={{ fontSize: 13, fontWeight: 'bold', color: isOverdue ? '#DC2626' : '#D97706' }}>
                           {isOverdue ? 'Overdue!' : `In ${daysLeft} Days`}
                         </Text>
                         <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Due: {new Date(item.dueDate).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={[styles.actionBtn, { marginTop: 15, backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]} onPress={() => {
                      if (item.phone) {
                        const message = `Hello ${item.name}, this is a gentle reminder regarding your pending balance of Rs. ${item.balance.toFixed(2)}. Please arrange for payment by ${item.dueDate}. Thank you!\n\nRegards,\nCosmo Store`;
                        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}&phone=91${item.phone}`).catch(() => {
                          Alert.alert("Error", "WhatsApp not installed");
                        });
                      } else {
                        Alert.alert("Error", "No phone number saved for this account.");
                      }
                    }}>
                      <MessageCircle size={18} color="#16A34A" />
                      <Text style={{ color: '#16A34A', fontWeight: 'bold' }}>Send WhatsApp Reminder</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 2, zIndex: 10 },
  title: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  dateText: { fontSize: 14, color: '#64748B', marginTop: 4, fontWeight: '500' },
  bellBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 12, position: 'relative' },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#FFF' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
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
  receiptScroll: { padding: 20, paddingBottom: 40 },
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
