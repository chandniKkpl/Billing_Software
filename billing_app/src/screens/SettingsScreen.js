import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Database, AlertTriangle, Trash2, Landmark, ChevronRight, BookOpen, MapPin } from 'lucide-react-native';
import { db } from '../firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen() {
  const [resetting, setResetting] = useState(false);
  const navigation = useNavigation();

  const segments = [
    { id: 'sales', label: 'Sales Records', description: 'Clears all sales history.' },
    { id: 'purchases', label: 'Purchase Records', description: 'Clears all purchase invoices.' },
    { id: 'ledgerTransactions', label: 'Ledger Transactions', description: 'Clears all manual payments and receipts.' },
    { id: 'customers', label: 'Customers', description: 'Deletes all customer data and balances.' },
    { id: 'vendors', label: 'Vendors', description: 'Deletes all vendor data and balances.' },
    { id: 'products', label: 'Inventory (Products)', description: 'Clears all products and stock.' },
    { id: 'accounts', label: 'Accounts (Banks, Cash, Emp)', description: 'Clears all custom accounts.' }
  ];

  const handleResetSegment = (segmentId, label) => {
    Alert.alert(
      "Warning",
      `Are you sure you want to permanently delete all data in '${label}'?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              const snap = await getDocs(collection(db, segmentId));
              const batch = writeBatch(db);
              let count = 0;
              snap.docs.forEach((doc) => {
                batch.delete(doc.ref);
                count++;
              });
              if (count > 0) {
                await batch.commit();
                Alert.alert('Success', `Successfully deleted ${count} records.`);
              } else {
                Alert.alert('Info', `No records found in ${label}.`);
              }
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setResetting(false);
            }
          }
        }
      ]
    );
  };

  const handleResetAll = () => {
    Alert.alert(
      "EXTREME WARNING",
      "Are you sure you want to completely FACTORY RESET the app? ALL DATA (Sales, Products, Customers, Ledger) will be wiped out.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "FACTORY RESET", 
          style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              for (const segment of segments) {
                const snap = await getDocs(collection(db, segment.id));
                const batch = writeBatch(db);
                snap.docs.forEach((doc) => {
                  batch.delete(doc.ref);
                });
                await batch.commit();
              }
              Alert.alert('Success', 'Factory reset complete. App is now completely clean.');
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setResetting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('Settings')}</Text>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Assets')}>
          <View style={styles.menuLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#F3E8FF' }]}>
              <BookOpen size={20} color="#9333EA" />
            </View>
            <Text style={styles.menuText}>{t('Asset Master')}</Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Warehouses')}>
          <View style={styles.menuLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
              <MapPin size={20} color="#EA580C" />
            </View>
            <Text style={styles.menuText}>{t('Warehouses')}</Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 }}>
            <Database size={24} color="#2563EB" />
            <Text style={styles.cardTitle}>{t('Data Reset Segments')}</Text>
          </View>
          <Text style={styles.cardDesc}>
            {t('Individually reset specific segments. Data cannot be recovered once deleted.')}
          </Text>

          {segments.map((seg) => (
            <View key={seg.id} style={styles.segmentItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.segmentLabel}>{seg.label}</Text>
                <Text style={styles.segmentDesc}>{seg.description}</Text>
              </View>
              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={() => handleResetSegment(seg.id, seg.label)}
                disabled={resetting}
              >
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 }}>
            <AlertTriangle size={24} color="#EF4444" />
            <Text style={[styles.cardTitle, { color: '#EF4444' }]}>{t('Danger Zone')}</Text>
          </View>
          <Text style={[styles.cardDesc, { color: '#EF4444', fontWeight: '500' }]}>
            {t('Permanently delete ALL data in the application and restore it to a factory-fresh state.')}
          </Text>

          <TouchableOpacity 
            style={[styles.resetAllBtn, resetting && { opacity: 0.5 }]}
            onPress={handleResetAll}
            disabled={resetting}
          >
            <Text style={styles.resetAllBtnText}>
              {resetting ? 'Resetting Data...' : '⚠️ Factory Reset All Data'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', marginLeft: 10 },
  menuItem: { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05 },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuText: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  container: { padding: 15 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  cardDesc: { fontSize: 13, color: '#64748B', marginBottom: 15 },
  segmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9'
  },
  segmentLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginBottom: 4 },
  segmentDesc: { fontSize: 12, color: '#64748B' },
  deleteBtn: {
    padding: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginLeft: 10
  },
  resetAllBtn: {
    backgroundColor: '#EF4444',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  resetAllBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16
  }
});
