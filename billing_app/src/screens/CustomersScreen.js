import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { Plus, Edit2, Trash2, X, Search, MessageCircle, Users, Menu } from 'lucide-react-native';

export default function CustomersScreen({ navigation }) {
  const { state, addCustomer, updateCustomer, deleteCustomer, t } = useApp();

  const [search, setSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', type: 'new', membershipTier: 'None', udhaarBalance: '0', dueDate: '', pan: '', gst: '' });

  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const filtered = state.customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  ) || [];

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      Alert.alert('Error', 'Name and phone are required');
      return;
    }
    try {
      const payload = {
        ...formData,
        udhaarBalance: Number(formData.udhaarBalance)
      };

      if (editingCustomer) {
        await updateCustomer({ ...editingCustomer, ...payload });
        Alert.alert('Success', 'Customer updated');
      } else {
        await addCustomer(payload);
        Alert.alert('Success', 'Customer added');
      }
      setShowModal(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSettlePayment = async () => {
    const amount = Number(paymentAmount);
    if (amount <= 0 || amount > paymentModal.udhaarBalance) {
      Alert.alert('Error', 'Invalid amount');
      return;
    }
    try {
      await updateCustomer({ ...paymentModal, udhaarBalance: paymentModal.udhaarBalance - amount });
      Alert.alert('Success', `Payment of ₹${amount} recorded`);
      setPaymentModal(null);
      setPaymentAmount('');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this customer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteCustomer(id);
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }
      }
    ]);
  };

  const openWhatsApp = (customer) => {
    if (!customer.phone || customer.udhaarBalance <= 0) return;
    const dueDateStr = customer.dueDate ? ` by ${customer.dueDate}` : ' at your earliest convenience';
    const msg = `Hello ${customer.name}, this is a gentle reminder that your pending dues are ₹${customer.udhaarBalance.toFixed(2)}. Please settle the amount${dueDateStr}. Thank you! - Cosmo Store`;
    const url = `whatsapp://send?phone=91${customer.phone.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Make sure WhatsApp is installed on your device');
    });
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', type: 'new', membershipTier: 'None', udhaarBalance: '0', dueDate: '', pan: '', gst: '' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ marginRight: 10 }}>
            <Menu size={24} color="#0F172A" />
          </TouchableOpacity>
          <Users size={24} color="#0F172A" style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>{t('Customers')}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setShowModal(true); }}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#94A3B8" style={{ marginLeft: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('Search customers...')}
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {filtered.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardName}>{c.name}</Text>
                <Text style={styles.cardPhone}>{c.phone}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: c.type === 'old' ? '#FEF3C7' : '#DCFCE7' }]}>
                <Text style={[styles.badgeText, { color: c.type === 'old' ? '#D97706' : '#16A34A' }]}>{c.type}</Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <Text style={styles.detailText}>Membership: <Text style={{ fontWeight: 'bold' }}>{c.membershipTier}</Text></Text>
            </View>

            <View style={styles.detailsRow}>
              <Text style={styles.detailText}>{t('Debt Balance:')} </Text>
              <Text style={[styles.debtText, { color: c.udhaarBalance > 0 ? '#EF4444' : '#64748B' }]}>
                ₹{c.udhaarBalance?.toFixed(2) || '0.00'}
              </Text>
            </View>

            {c.dueDate && c.udhaarBalance > 0 && (
              <Text style={styles.dueDateText}>Due: {c.dueDate}</Text>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => {
                setEditingCustomer(c);
                setFormData({ ...c, udhaarBalance: c.udhaarBalance?.toString() || '0' });
                setShowModal(true);
              }}>
                <Edit2 size={16} color="#64748B" />
              </TouchableOpacity>

              {c.udhaarBalance > 0 && (
                <>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: '#22C55E' }]} onPress={() => openWhatsApp(c)}>
                    <MessageCircle size={16} color="#22C55E" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: '#3B82F6', backgroundColor: '#EFF6FF', paddingHorizontal: 12 }]} onPress={() => { setPaymentModal(c); setPaymentAmount(c.udhaarBalance?.toString() || ''); }}>
                    <Text style={{ color: '#10B981', fontWeight: 'bold', marginLeft: 4 }}>{t('Record Payment')}</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(c.id)}>
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {filtered.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#64748B', marginTop: 20 }}>{t('No customers found')}</Text>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingCustomer ? t('Edit Customer') : t('Add Customer')}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#0F172A" /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalForm}>
            <Text style={styles.label}>{t('Name')} *</Text>
            <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} />

            <Text style={styles.label}>{t('Phone')} *</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" value={formData.phone} onChangeText={t => setFormData({ ...formData, phone: t })} />

            <Text style={styles.label}>{t('PAN No.')}</Text>
            <TextInput style={styles.input} value={formData.pan} onChangeText={t => setFormData({ ...formData, pan: t })} />

            <Text style={styles.label}>{t('GST No.')}</Text>
            <TextInput style={styles.input} value={formData.gst} onChangeText={t => setFormData({ ...formData, gst: t })} />

            <Text style={styles.label}>{t('Customer Type')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              <TouchableOpacity style={[styles.typeBtn, formData.type === 'new' && styles.typeBtnActive]} onPress={() => setFormData({ ...formData, type: 'new' })}>
                <Text style={[styles.typeBtnText, formData.type === 'new' && styles.typeBtnTextActive]}>{t('New')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, formData.type === 'old' && styles.typeBtnActive]} onPress={() => setFormData({ ...formData, type: 'old' })}>
                <Text style={[styles.typeBtnText, formData.type === 'old' && styles.typeBtnTextActive]}>{t('Old')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('Initial Debt Balance')} (₹)</Text>
            <TextInput style={[styles.input, editingCustomer && { backgroundColor: '#F1F5F9' }]} keyboardType="numeric" value={formData.udhaarBalance} editable={!editingCustomer} onChangeText={t => setFormData({ ...formData, udhaarBalance: t })} />

            <Text style={styles.label}>{t('Payment Due Date')}</Text>
            <TextInput style={styles.input} placeholder={t('YYYY-MM-DD')} placeholderTextColor="#64748B" value={formData.dueDate} onChangeText={t => setFormData({ ...formData, dueDate: t })} />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{t('Save')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={!!paymentModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.paymentBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Collect Payment')}</Text>
              <TouchableOpacity onPress={() => setPaymentModal(null)}><X size={20} color="#0F172A" /></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 14, color: '#333', marginBottom: 5 }}>{t('Customer')}: <Text style={{ fontWeight: 'bold' }}>{paymentModal?.name}</Text></Text>
            <Text style={{ fontSize: 14, color: '#333', marginBottom: 15 }}>{t('Total Dues')}: <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>₹{paymentModal?.udhaarBalance?.toFixed(2)}</Text></Text>

            <Text style={styles.label}>{t('Amount Paying Now')} (₹)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={paymentAmount} onChangeText={setPaymentAmount} autoFocus />

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#22C55E' }]} onPress={handleSettlePayment}>
              <Text style={styles.saveBtnText}>{t('Record Payment')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  addButton: { backgroundColor: '#2563EB', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 15, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, height: 40, paddingHorizontal: 10, fontSize: 15, color: '#0F172A' },
  listContent: { padding: 15, paddingTop: 0 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  cardPhone: { fontSize: 13, color: '#64748B', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  detailsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  detailText: { fontSize: 13, color: '#475569' },
  debtText: { fontSize: 14, fontWeight: 'bold' },
  dueDateText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, gap: 10 },
  actionBtn: { padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  modalForm: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, color: '#0F172A' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 15, backgroundColor: '#fff', color: '#0F172A' },
  typeBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  typeBtnText: { color: '#64748B', fontWeight: '500' },
  typeBtnTextActive: { color: '#3B82F6', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#2563EB', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  paymentBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20 }
});
