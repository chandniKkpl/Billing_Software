import React, { useState, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { Search, FileText, Edit } from 'lucide-react-native';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function SalesReportScreen() {
  const { state, editBill } = useApp();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');

  const handleEdit = (item) => {
    editBill(item);
    navigation.navigate('Billing');
  };

  const filteredSales = useMemo(() => {
    return state.sales.filter(s => {
      const matchSearch = !search || s.id.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.sales, search]);

  const totalRevenue = useMemo(() => filteredSales.reduce((sum, s) => sum + s.grandTotal, 0), [filteredSales]);

  const renderSale = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>#{item.id.slice(-6).toUpperCase()}</Text>
        </View>
        <Text style={styles.date}>{new Date(item.date).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      
      <View style={styles.cardBody}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemsLabel}>{item.items.length} Items</Text>
          <Text style={styles.paymentMode}>{item.paymentMode}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.amount}>{fmt(item.grandTotal)}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
            <Edit size={14} color="#2563EB" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sales Report</Text>
      </View>
      
      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Total Revenue (Filtered)</Text>
        <Text style={styles.summaryValue}>{fmt(totalRevenue)}</Text>
        <Text style={styles.summarySub}>{filteredSales.length} total bills</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#94A3B8" style={{ marginRight: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Bill ID..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredSales}
        keyExtractor={item => item.id}
        renderItem={renderSale}
        contentContainerStyle={styles.listContainer}
        initialNumToRender={10}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FileText size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No sales found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0', zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 2 },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  
  summaryBox: { backgroundColor: '#2563EB', margin: 16, padding: 24, borderRadius: 20, alignItems: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  summaryLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  summaryValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', marginVertical: 8 },
  summarySub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, borderRadius: 16, height: 52, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  searchInput: { flex: 1, fontSize: 16, color: '#0F172A', fontWeight: '500' },
  
  listContainer: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, marginBottom: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 12 },
  badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { color: '#475569', fontWeight: 'bold', fontSize: 12 },
  date: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemsLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  paymentMode: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '500' },
  amount: { fontSize: 22, fontWeight: '900', color: '#16A34A' },
  
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#94A3B8', marginTop: 16, fontSize: 16, fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 10 },
  editBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 13, marginLeft: 4 }
});
