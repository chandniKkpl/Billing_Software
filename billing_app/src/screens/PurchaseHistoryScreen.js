import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, SafeAreaView, StyleSheet, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Menu, X, Search, Calendar, FileText, IndianRupee, Plus } from 'lucide-react-native';
import { useApp } from '../store/AppContext';

export default function PurchaseHistoryScreen() {
  const navigation = useNavigation();
  const { state, dispatch, deletePurchase, t } = useApp();
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sort purchases newest first
  let purchases = [...(state.purchases || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filter based on search query (vendor name, payment mode, etc.)
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    purchases = purchases.filter(item => {
      const vendor = state.vendors.find(v => v.id === item.vendorId);
      const vName = vendor ? vendor.name.toLowerCase() : 'unknown vendor';
      const pMode = (item.paymentMode || '').toLowerCase();
      return vName.includes(q) || pMode.includes(q);
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ marginRight: 16 }}>
              <Menu size={28} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.title}>{t('Purchase History')}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => { dispatch({ type: 'CLEAR_CART' }); navigation.navigate('Purchase Entry'); }} 
            style={{ backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
          >
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>{t('Add')}</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#94A3B8" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("Search by vendor name or payment mode...")}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <FlatList
          data={purchases}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 50 }}>{t('No purchases found.')}</Text>}
          renderItem={({ item }) => {
            const vendor = state.vendors.find(v => v.id === item.vendorId);
            return (
              <TouchableOpacity 
                style={styles.card}
                onPress={() => setSelectedHistory(item)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 }} numberOfLines={1}>
                      {vendor ? vendor.name : 'Unknown Vendor'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Calendar size={14} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 13, color: '#64748B' }}>{new Date(item.date).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#16A34A' }}>₹{Number(item.grandTotal).toFixed(2)}</Text>
                    <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: '#475569', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.paymentMode}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <FileText size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>{item.items?.length || 0} {t('items purchased')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity onPress={() => setSelectedHistory(item)}>
                      <Text style={{ fontSize: 13, color: '#2563EB', fontWeight: '600' }}>{t('View')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        dispatch({ type: 'SET_CART', payload: item.items });
                        dispatch({ type: 'SET_EDITING_PURCHASE', payload: item.id });
                        navigation.navigate('Purchase Entry');
                    }}>
                      <Text style={{ fontSize: 13, color: '#F59E0B', fontWeight: '600' }}>{t('Edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        Alert.alert('Delete Purchase', 'Are you sure you want to delete this purchase? Stock will be reduced.', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deletePurchase(item.id) }
                        ]);
                    }}>
                      <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '600' }}>{t('Delete')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      </View>

      {/* ── History Detail Modal ── */}
      <Modal visible={!!selectedHistory} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedHistory(null)}>
        {selectedHistory && (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={[styles.header, { borderBottomWidth: 1 }]}>
              <Text style={styles.title}>{t('Purchase Details')}</Text>
              <TouchableOpacity onPress={() => setSelectedHistory(null)} style={styles.closeBtn}>
                <X size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' }}>
               <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>Vendor: {state.vendors.find(v => v.id === selectedHistory.vendorId)?.name || 'Unknown'}</Text>
               <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 5 }}>Date: {new Date(selectedHistory.date).toLocaleString()}</Text>
               <Text style={{ fontSize: 14, color: '#64748B' }}>Payment: {selectedHistory.paymentMode}</Text>
            </View>
            <FlatList
              data={selectedHistory.items}
              keyExtractor={(it, idx) => idx.toString()}
              contentContainerStyle={{ padding: 15 }}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#0F172A' }}>{item.name}</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Qty: {item.qty} × ₹{item.sellingPrice}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#0F172A' }}>₹{(item.qty * item.sellingPrice).toFixed(2)}</Text>
                </View>
              )}
            />
            <View style={{ padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#E2E8F0' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: '#64748B' }}>{t('Subtotal')}</Text>
                <Text style={{ fontSize: 14, fontWeight: 'bold' }}>₹{Number(selectedHistory.subtotal).toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: '#64748B' }}>{t('Discount')}</Text>
                <Text style={{ fontSize: 14, color: '#16A34A', fontWeight: 'bold' }}>-₹{Number(selectedHistory.discount || 0).toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderColor: '#F1F5F9' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{t('Grand Total')}</Text>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#2563EB' }}>₹{Number(selectedHistory.grandTotal).toFixed(2)}</Text>
              </View>
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 2 },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A', margin: 0, padding: 0 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3, borderWidth: 1, borderColor: '#F8FAFC' },
  closeBtn: { padding: 6, backgroundColor: '#F1F5F9', borderRadius: 10 }
});
