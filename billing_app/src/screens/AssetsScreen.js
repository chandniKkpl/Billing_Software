import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { Plus, Edit2, Trash2, X, CheckCircle } from 'lucide-react-native';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function AssetsScreen({ navigation }) {
  const { state, t } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  
  const [name, setName] = useState('');
  const [type, setType] = useState('Fixed');
  const [value, setValue] = useState('');
  const [dateAcquired, setDateAcquired] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = async () => {
    if (!name || !value) return Alert.alert('Error', 'Name and Value are required');
    
    const assetData = {
      name,
      type,
      value: parseFloat(value),
      dateAcquired,
      updatedAt: new Date().toISOString()
    };
    
    const id = editingAsset ? editingAsset.id : Date.now().toString();
    
    try {
      await setDoc(doc(db, 'assets', id), assetData);
      setShowModal(false);
      resetForm();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this asset?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'assets', id));
      }}
    ]);
  };

  const resetForm = () => {
    setEditingAsset(null);
    setName('');
    setType('Fixed');
    setValue('');
    setDateAcquired(new Date().toISOString().split('T')[0]);
  };

  const openEdit = (asset) => {
    setEditingAsset(asset);
    setName(asset.name);
    setType(asset.type || 'Fixed');
    setValue(asset.value.toString());
    setDateAcquired(asset.dateAcquired || new Date().toISOString().split('T')[0]);
    setShowModal(true);
  };

  const totalFixed = state.assets.filter(a => a.type === 'Fixed').reduce((acc, a) => acc + a.value, 0);
  const totalCurrent = state.assets.filter(a => a.type === 'Current').reduce((acc, a) => acc + a.value, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏛 Asset Master</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowModal(true); }}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Fixed Assets</Text>
          <Text style={[styles.statValue, { color: '#2563EB' }]}>₹{totalFixed.toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Current Assets</Text>
          <Text style={[styles.statValue, { color: '#16A34A' }]}>₹{totalCurrent.toFixed(2)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {state.assets.length === 0 ? (
          <Text style={styles.emptyText}>No assets found. Tap + to add.</Text>
        ) : (
          state.assets.map(asset => (
            <View key={asset.id} style={styles.assetCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.assetName}>{asset.name}</Text>
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  <View style={[styles.badge, { backgroundColor: asset.type === 'Fixed' ? '#DBEAFE' : '#DCFCE7' }]}>
                    <Text style={{ fontSize: 11, color: asset.type === 'Fixed' ? '#1E40AF' : '#166534' }}>{asset.type}</Text>
                  </View>
                  <Text style={styles.dateText}>{new Date(asset.dateAcquired).toLocaleDateString()}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center', marginRight: 15 }}>
                <Text style={styles.assetValue}>₹{asset.value.toFixed(2)}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => openEdit(asset)} style={styles.actionIcon}>
                  <Edit2 size={18} color="#2563EB" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(asset.id)} style={styles.actionIcon}>
                  <Trash2 size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Asset Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Office Furniture" />

            <Text style={styles.inputLabel}>Asset Type</Text>
            <View style={{ flexDirection: 'row', marginBottom: 15 }}>
              <TouchableOpacity 
                style={[styles.typeBtn, type === 'Fixed' && styles.typeBtnActive]} 
                onPress={() => setType('Fixed')}
              >
                <Text style={[styles.typeBtnText, type === 'Fixed' && { color: '#2563EB' }]}>Fixed Asset</Text>
              </TouchableOpacity>
              <View style={{ width: 10 }} />
              <TouchableOpacity 
                style={[styles.typeBtn, type === 'Current' && styles.typeBtnActive]} 
                onPress={() => setType('Current')}
              >
                <Text style={[styles.typeBtnText, type === 'Current' && { color: '#2563EB' }]}>Current Asset</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Value (₹)</Text>
            <TextInput style={styles.input} value={value} onChangeText={setValue} keyboardType="numeric" placeholder="0.00" />

            <Text style={styles.inputLabel}>Date Acquired (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={dateAcquired} onChangeText={setDateAcquired} />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <CheckCircle size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Save Asset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  addBtn: { backgroundColor: '#2563EB', padding: 10, borderRadius: 8 },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  statLabel: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  list: { padding: 16 },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 40 },
  assetCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05 },
  assetName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  dateText: { fontSize: 12, color: '#94A3B8' },
  assetValue: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: { padding: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 15, color: '#0F172A' },
  typeBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  typeBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  saveBtn: { backgroundColor: '#2563EB', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
