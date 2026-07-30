import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { Plus, Edit2, Trash2, X, CheckCircle, MapPin, ChevronLeft } from 'lucide-react-native';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function WarehousesScreen({ navigation }) {
  const { state, t } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingWh, setEditingWh] = useState(null);
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const handleSave = async () => {
    if (!name) return Alert.alert('Error', 'Warehouse Name is required');
    
    const whData = {
      name,
      address,
      updatedAt: new Date().toISOString()
    };
    
    const id = editingWh ? editingWh.id : Date.now().toString();
    if (!editingWh) {
      whData.id = id;
    }
    
    try {
      await setDoc(doc(db, 'warehouses', id), whData, { merge: true });
      setShowModal(false);
      resetForm();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (id) => {
    if (id === 'main') return Alert.alert('Error', 'Cannot delete the main warehouse');
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this warehouse?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'warehouses', id));
      }}
    ]);
  };

  const resetForm = () => {
    setEditingWh(null);
    setName('');
    setAddress('');
  };

  const openEdit = (wh) => {
    setEditingWh(wh);
    setName(wh.name);
    setAddress(wh.address || '');
    setShowModal(true);
  };

  const warehouses = state.warehouses || [];
  const displayWarehouses = warehouses.some(w => w.id === 'main') ? warehouses : [{id: 'main', name: 'Main Store', address: 'Primary Location'}, ...warehouses];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10}}>
            <ChevronLeft size={24} color="#0F172A" />
          </TouchableOpacity>
          <MapPin size={24} color="#0F172A" style={{marginRight: 8}} />
          <Text style={styles.headerTitle}>Warehouses</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setShowModal(true); }}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {displayWarehouses.map((wh) => {
          const whProducts = (state.products || []).filter(p => p.warehouseStock && p.warehouseStock[wh.id] > 0);
          return (
            <View key={wh.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{wh.name}</Text>
                {wh.id === 'main' && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Default</Text>
                  </View>
                )}
              </View>
              
              <Text style={styles.detailText}>{wh.address || 'No address'}</Text>

              {whProducts.length > 0 && (
                <View style={{ marginTop: 12, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 }}>Stock Items:</Text>
                  {whProducts.map(p => (
                    <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: '#334155', flex: 1 }} numberOfLines={1}>{p.name}</Text>
                      <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>{p.warehouseStock[wh.id]} {p.unit || 'pcs'}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(wh)}>
                  <Edit2 size={18} color="#2563EB" />
                </TouchableOpacity>
                {wh.id !== 'main' && (
                  <TouchableOpacity style={[styles.iconBtn, {backgroundColor: '#FEF2F2'}]} onPress={() => handleDelete(wh.id)}>
                    <Trash2 size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingWh ? 'Edit Warehouse' : 'Add Warehouse'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{maxHeight: 500}}>
              <Text style={styles.label}>Warehouse Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Godown 2" />
              
              <Text style={styles.label}>Location / Address</Text>
              <TextInput style={[styles.input, {height: 80}]} value={address} onChangeText={setAddress} placeholder="e.g. Main Market, Delhi" multiline />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <CheckCircle color="#fff" size={20} style={{marginRight: 8}} />
              <Text style={styles.saveBtnText}>Save Warehouse</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  listContent: { padding: 20 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#D97706' },
  detailText: { fontSize: 14, color: '#475569', marginBottom: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  label: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16, color: '#0F172A' },
  saveBtn: { backgroundColor: '#2563EB', flexDirection: 'row', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
