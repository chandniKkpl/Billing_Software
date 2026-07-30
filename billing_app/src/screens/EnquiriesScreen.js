import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { Plus, Edit2, Trash2, X, CheckCircle, MessageCircle, ChevronLeft } from 'lucide-react-native';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function EnquiriesScreen({ navigation }) {
  const { state, t } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState(null);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [itemOfInterest, setItemOfInterest] = useState('');
  const [status, setStatus] = useState('Open');
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    if (!name) return Alert.alert('Error', 'Customer Name is required');
    
    const enquiryData = {
      name,
      phone,
      itemOfInterest,
      status,
      notes,
      date: new Date().toISOString()
    };
    
    const id = editingEnquiry ? editingEnquiry.id : Date.now().toString();
    
    try {
      await setDoc(doc(db, 'enquiries', id), enquiryData);
      setShowModal(false);
      resetForm();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this enquiry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'enquiries', id));
      }}
    ]);
  };

  const resetForm = () => {
    setEditingEnquiry(null);
    setName('');
    setPhone('');
    setItemOfInterest('');
    setStatus('Open');
    setNotes('');
  };

  const openEdit = (enq) => {
    setEditingEnquiry(enq);
    setName(enq.name);
    setPhone(enq.phone || '');
    setItemOfInterest(enq.itemOfInterest || '');
    setStatus(enq.status || 'Open');
    setNotes(enq.notes || '');
    setShowModal(true);
  };

  const enquiries = state.enquiries || [];
  const openEnquiries = enquiries.filter(e => e.status === 'Open').length;
  const closedEnquiries = enquiries.filter(e => e.status === 'Closed').length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10}}>
            <ChevronLeft size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Enquiries</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setShowModal(true); }}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Open</Text>
          <Text style={[styles.statValue, {color: '#EF4444'}]}>{openEnquiries}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Closed</Text>
          <Text style={[styles.statValue, {color: '#10B981'}]}>{closedEnquiries}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={[styles.statValue, {color: '#0F172A'}]}>{enquiries.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {enquiries.length === 0 ? (
          <Text style={styles.emptyText}>No enquiries found</Text>
        ) : (
          enquiries.sort((a,b) => new Date(b.date) - new Date(a.date)).map((enq) => (
            <View key={enq.id} style={styles.enquiryCard}>
              <View style={styles.enquiryHeader}>
                <Text style={styles.enquiryName}>{enq.name}</Text>
                <View style={[styles.badge, enq.status === 'Open' ? styles.badgeOpen : styles.badgeClosed]}>
                  <Text style={[styles.badgeText, enq.status === 'Open' ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                    {enq.status}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.detailText}>Phone: {enq.phone || '-'}</Text>
              <Text style={styles.detailText}>Interested In: {enq.itemOfInterest || '-'}</Text>
              <Text style={styles.dateText}>{new Date(enq.date).toLocaleDateString()}</Text>
              
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(enq)}>
                  <Edit2 size={18} color="#2563EB" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, {backgroundColor: '#FEF2F2'}]} onPress={() => handleDelete(enq.id)}>
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingEnquiry ? 'Edit Enquiry' : 'Add New Enquiry'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{maxHeight: 500}}>
              <Text style={styles.label}>Customer Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Rahul Kumar" />
              
              <Text style={styles.label}>Phone Number</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="e.g. 9876543210" keyboardType="phone-pad" />
              
              <Text style={styles.label}>Item / Service of Interest</Text>
              <TextInput style={styles.input} value={itemOfInterest} onChangeText={setItemOfInterest} placeholder="e.g. Paracetamol 500mg" />
              
              <Text style={styles.label}>Status</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity 
                  style={[styles.typeBtn, status === 'Open' && styles.typeBtnActive]} 
                  onPress={() => setStatus('Open')}
                >
                  <Text style={[styles.typeBtnText, status === 'Open' && styles.typeBtnTextActive]}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeBtn, status === 'Closed' && styles.typeBtnActive]} 
                  onPress={() => setStatus('Closed')}
                >
                  <Text style={[styles.typeBtnText, status === 'Closed' && styles.typeBtnTextActive]}>Closed</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, {height: 80}]} value={notes} onChangeText={setNotes} placeholder="Any extra details..." multiline />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <CheckCircle color="#fff" size={20} style={{marginRight: 8}} />
              <Text style={styles.saveBtnText}>Save Enquiry</Text>
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
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  statsContainer: { flexDirection: 'row', padding: 20, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  statLabel: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '700' },
  listContent: { padding: 20, paddingTop: 0 },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 40, fontSize: 16 },
  enquiryCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  enquiryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  enquiryName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeOpen: { backgroundColor: '#FEF2F2' },
  badgeClosed: { backgroundColor: '#ECFDF5' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextOpen: { color: '#EF4444' },
  badgeTextClosed: { color: '#10B981' },
  detailText: { fontSize: 14, color: '#475569', marginBottom: 4 },
  dateText: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  label: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16, color: '#0F172A' },
  typeSelector: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  typeBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  typeBtnText: { color: '#64748B', fontWeight: '500' },
  typeBtnTextActive: { color: '#2563EB', fontWeight: '600' },
  saveBtn: { backgroundColor: '#2563EB', flexDirection: 'row', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
