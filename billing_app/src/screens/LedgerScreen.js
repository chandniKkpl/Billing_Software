import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { useApp } from '../store/AppContext';
import { Plus, Edit2, Trash2, Clock, Briefcase, Users, CreditCard, Banknote, Landmark, TrendingUp, TrendingDown } from 'lucide-react-native';

const accountTypes = [
  { id: 'Customer', icon: Users },
  { id: 'Vendor', icon: Briefcase },
  { id: 'Employee', icon: Users },
  { id: 'Cash', icon: Banknote },
  { id: 'Bank', icon: Landmark },
  { id: 'Income', icon: TrendingUp },
  { id: 'Expenditure', icon: TrendingDown },
];

export default function LedgerScreen() {
  const { state, addVendor, updateVendor, deleteVendor, addCustomer, updateCustomer, deleteCustomer, addAccount, updateAccount, deleteAccount, addLedgerTransaction } = useApp();
  const [activeTab, setActiveTab] = useState('Customer');
  
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', phone: '', balance: '0', interestRate: '0', dueDate: '' });
  const [editingAccount, setEditingAccount] = useState(null);

  const [showTxnModal, setShowTxnModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [txnForm, setTxnForm] = useState({ type: 'Add', amount: '', paymentMode: 'Cash' });

  const getNormalizedList = () => {
    if (activeTab === 'Vendor') return state.vendors || [];
    if (activeTab === 'Customer') {
       return (state.customers || []).map(c => ({
         ...c,
         balance: c.udhaarBalance || 0,
         interestRate: c.interestRate || 0,
         dueDate: c.dueDate || ''
       }));
    }
    return (state.accounts || []).filter(a => a.type === activeTab);
  };

  const currentList = getNormalizedList();

  const handleSaveAccount = () => {
    if (!accountForm.name) return Alert.alert("Error", "Name is required");
    const payload = {
      ...accountForm,
      balance: Number(accountForm.balance) || 0,
      interestRate: Number(accountForm.interestRate) || 0
    };
    if (editingAccount) {
      if (activeTab === 'Vendor') updateVendor({ ...editingAccount, ...payload });
      else if (activeTab === 'Customer') updateCustomer({ ...editingAccount, ...payload, udhaarBalance: payload.balance });
      else updateAccount({ ...editingAccount, ...payload });
    } else {
      if (activeTab === 'Vendor') addVendor(payload);
      else if (activeTab === 'Customer') addCustomer({ ...payload, udhaarBalance: payload.balance, type: 'old' });
      else addAccount({ ...payload, type: activeTab });
    }
    setShowAccountModal(false);
  };

  const handleSaveTxn = () => {
    if (!txnForm.amount || Number(txnForm.amount) <= 0) return Alert.alert("Error", "Valid amount required");
    
    addLedgerTransaction({
      vendorId: activeTab === 'Vendor' ? selectedAccount.id : undefined,
      customerId: activeTab === 'Customer' ? selectedAccount.id : undefined,
      accountId: !['Vendor', 'Customer'].includes(activeTab) ? selectedAccount.id : undefined,
      type: txnForm.type,
      amount: Number(txnForm.amount),
      paymentMode: txnForm.paymentMode,
    });

    if (activeTab === 'Customer') {
       let newBal = selectedAccount.balance;
       if (['Borrow', 'Receive', 'Credit Note', 'Income', 'Add'].includes(txnForm.type)) newBal += Number(txnForm.amount);
       if (['Payment', 'Spend', 'Debit Note', 'Expense', 'Deduct'].includes(txnForm.type)) newBal -= Number(txnForm.amount);
       updateCustomer({ ...selectedAccount, udhaarBalance: newBal });
    }
    setShowTxnModal(false);
  };

  const handleDelete = (id) => {
    Alert.alert("Confirm", "Are you sure you want to delete this?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
          if (activeTab === 'Vendor') deleteVendor(id);
          else if (activeTab === 'Customer') deleteCustomer(id);
          else deleteAccount(id);
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Universal Ledger</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setEditingAccount(null);
            setAccountForm({ name: '', phone: '', balance: '0', interestRate: '0', dueDate: '' });
            setShowAccountModal(true);
          }}
        >
          <Plus color="#fff" size={20} />
          <Text style={styles.addButtonText}>Add {activeTab}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 50, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'center' }}>
          {accountTypes.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Icon color={isActive ? '#fff' : '#64748b'} size={16} />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.id}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      <FlatList
        data={currentList}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={[styles.cardBalance, { color: item.balance > 0 ? '#ef4444' : '#10b981' }]}>
                ₹{item.balance.toFixed(2)}
              </Text>
            </View>
            <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 10 }}>{item.phone || 'No phone'}</Text>
            
            {item.dueDate && (
              <Text style={{ color: '#f59e0b', fontSize: 12, marginBottom: 10 }}>
                Due: {new Date(item.dueDate).toLocaleDateString()}
              </Text>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => {
                setEditingAccount(item);
                setAccountForm({
                  name: item.name, phone: item.phone || '', balance: String(item.balance),
                  interestRate: String(item.interestRate || '0'), dueDate: item.dueDate || ''
                });
                setShowAccountModal(true);
              }}>
                <Edit2 color="#64748b" size={16} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#eff6ff' }]} onPress={() => {
                setSelectedAccount(item);
                setTxnForm({ type: 'Add', amount: '', paymentMode: 'Cash' });
                setShowTxnModal(true);
              }}>
                <Text style={{ color: '#2563eb', fontWeight: 'bold' }}>Add Txn</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
                <Trash2 color="#ef4444" size={16} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={() => <Text style={{ textAlign: 'center', marginTop: 20, color: '#64748b' }}>No {activeTab}s found.</Text>}
      />

      {/* Account Modal */}
      <Modal visible={showAccountModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingAccount ? 'Edit' : 'Add'} {activeTab}</Text>
            <TextInput style={styles.input} placeholder="Name" value={accountForm.name} onChangeText={t => setAccountForm(p => ({...p, name: t}))} />
            <TextInput style={styles.input} placeholder="Phone (Optional)" value={accountForm.phone} onChangeText={t => setAccountForm(p => ({...p, phone: t}))} />
            <TextInput style={styles.input} placeholder="Balance (₹)" value={accountForm.balance} onChangeText={t => setAccountForm(p => ({...p, balance: t}))} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Interest Rate (%)" value={accountForm.interestRate} onChangeText={t => setAccountForm(p => ({...p, interestRate: t}))} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Due Date (YYYY-MM-DD)" value={accountForm.dueDate} onChangeText={t => setAccountForm(p => ({...p, dueDate: t}))} />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAccountModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAccount}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Txn Modal */}
      <Modal visible={showTxnModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Transaction</Text>
            <Text style={{ marginBottom: 15 }}>For: {selectedAccount?.name}</Text>
            
            <Text style={styles.label}>Transaction Type (Borrow, Payment, Add, Deduct)</Text>
            <TextInput style={styles.input} value={txnForm.type} onChangeText={t => setTxnForm(p => ({...p, type: t}))} />
            
            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput style={styles.input} placeholder="0.00" value={txnForm.amount} onChangeText={t => setTxnForm(p => ({...p, amount: t}))} keyboardType="numeric" />
            
            <Text style={styles.label}>Payment Mode (Cash, Bank, UPI)</Text>
            <TextInput style={styles.input} value={txnForm.paymentMode} onChangeText={t => setTxnForm(p => ({...p, paymentMode: t}))} />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTxnModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTxn}>
                <Text style={styles.saveBtnText}>Save Txn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 15, paddingTop: 50, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  addButton: { flexDirection: 'row', backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 6 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 10 },
  tabBtnActive: { backgroundColor: '#2563eb' },
  tabText: { marginLeft: 6, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  cardBalance: { fontSize: 16, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#fff', padding: 20, borderRadius: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#0f172a' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 6, marginBottom: 15, color: '#0f172a' },
  label: { fontSize: 12, color: '#64748b', marginBottom: 5 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { padding: 10, borderRadius: 6, backgroundColor: '#f1f5f9' },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
  saveBtn: { padding: 10, borderRadius: 6, backgroundColor: '#2563eb' },
  saveBtnText: { color: '#fff', fontWeight: 'bold' }
});
