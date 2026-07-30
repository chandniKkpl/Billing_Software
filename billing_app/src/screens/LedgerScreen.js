import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { Plus, Edit2, Trash2, Briefcase, Users, Banknote, Landmark, TrendingUp, TrendingDown, X, MessageCircle, Calendar as CalendarIcon } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';

const accountTypes = [
  { id: 'Customer', icon: Users },
  { id: 'Vendor', icon: Briefcase },
  { id: 'Employee', icon: Users },
  { id: 'Cash', icon: Banknote },
  { id: 'Bank', icon: Landmark },
  { id: 'Income', icon: TrendingUp },
  { id: 'Expenditure', icon: TrendingDown },
];

const AccountStatement = ({ account, activeTab, state, setEditingAccount, setAccountForm, setShowAccountModal, setTxnForm, setShowTxnModal, handleDelete, t }) => {
  const statementData = useMemo(() => {
    if (!account) return { openingBalance: 0, txns: [], currentBalance: 0 };
    
    let combinedTxns = [];

    // 1. Get manual ledger transactions
    const manualTxns = (state.ledgerTransactions || []).filter(t => t.vendorId === account.id || t.customerId === account.id || t.accountId === account.id);
    manualTxns.forEach(t => {
      let drAmount = 0;
      let crAmount = 0;
      let vchType = 'Journal';
      let drAccountName = '';
      let crAccountName = '';
      let narration = t.notes || 'Being transaction recorded';
      
      if (['Payment', 'Spend', 'Expense', 'Borrow', 'Add', 'Debit Note'].includes(t.type)) {
        drAmount = t.amount;
        vchType = t.type;
        drAccountName = `${account.name} A/c`;
        crAccountName = `${t.paymentMode || 'Cash'} A/c`;
      } else {
        crAmount = t.amount;
        vchType = t.type;
        drAccountName = `${t.paymentMode || 'Cash'} A/c`;
        crAccountName = `${account.name} A/c`;
      }

      combinedTxns.push({
        id: t.id,
        date: t.date || new Date(parseInt(t.id)).toISOString(),
        drAccountName,
        crAccountName,
        narration,
        amount: t.amount,
        particulars: (drAmount > 0 ? `To ` : `By `) + (t.paymentMode || 'Cash') + ' A/c' + (t.notes ? ` (${t.notes})` : ''),
        vchType: vchType,
        vchNo: t.id.slice(-4),
        debit: drAmount,
        credit: crAmount
      });
    });

    // 2. Combine Sales data if it's a Customer
    if (activeTab === 'Customer' && state.sales) {
      const customerSales = state.sales.filter(s => String(s.customerId) === String(account.id));
      customerSales.forEach(sale => {
        // Sale Voucher (Debit)
        combinedTxns.push({
          id: `sale-${sale.id}`,
          date: sale.date || new Date().toISOString(),
          drAccountName: `${account.name} A/c`,
          crAccountName: `Sales A/c`,
          narration: `Being goods sold on credit`,
          amount: sale.grandTotal,
          particulars: 'To Sales A/c',
          vchType: 'Sales',
          vchNo: String(sale.id).slice(-4),
          debit: sale.grandTotal,
          credit: 0
        });

        // Receipt Voucher (Credit) if not Debt
        if (sale.paymentMode && sale.paymentMode !== 'Debt') {
          combinedTxns.push({
            id: `rect-${sale.id}`,
            date: sale.date || new Date().toISOString(),
            drAccountName: `${sale.paymentMode} A/c`,
            crAccountName: `${account.name} A/c`,
            narration: `Being payment received against sale`,
            amount: sale.grandTotal,
            particulars: `By ${sale.paymentMode} A/c`,
            vchType: 'Receipt',
            vchNo: String(sale.id).slice(-4),
            debit: 0,
            credit: sale.grandTotal
          });
        }
      });
    }

    // Sort chronologically
    combinedTxns.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let netChange = 0;
    combinedTxns.forEach(t => {
      netChange += t.debit;
      netChange -= t.credit;
    });

    const openingBalance = (account.balance || 0) - netChange;
    
    let runBal = openingBalance;
    const enrichedTxns = combinedTxns.map(t => {
      runBal += t.debit;
      runBal -= t.credit;
      return { ...t, runningBalance: runBal };
    });
    
    return { openingBalance, txns: [...enrichedTxns].reverse(), currentBalance: runBal }; 
  }, [account, state.ledgerTransactions, state.sales, activeTab]);
  
  const txnsForList = statementData.txns;

  return (
    <View style={styles.statementCard}>
      <View style={styles.statementHeader}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>{account.name}</Text>
          {account.phone && <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Ph: {account.phone}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
          <Text style={{ fontSize: 11, color: '#64748b' }}>{t('Closing Balance')}</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: statementData.currentBalance > 0 ? '#ef4444' : '#10b981' }}>
            ₹{Math.abs(statementData.currentBalance).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 15, paddingBottom: 10, paddingTop: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={styles.addTxnBtn} onPress={() => { setTxnForm({ targetAccount: account, type: activeTab === 'Customer' ? 'Receive' : 'Payment', amount: '', paymentMode: 'Cash' }); setShowTxnModal(true); }}>
          <Plus color="#fff" size={14} />
          <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 4, fontSize: 12 }}>{t('Add Entry')}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.tableHeader, { backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderColor: '#e2e8f0' }]}>
        <Text style={[styles.th, { flex: 0.8, color: '#475569' }]}>{t('Date')}</Text>
        <Text style={[styles.th, { flex: 2, color: '#475569' }]}>{t('Particulars')}</Text>
        <Text style={[styles.th, { flex: 0.5, textAlign: 'center', color: '#475569' }]}>{t('L.F.')}</Text>
        <Text style={[styles.th, { flex: 1, textAlign: 'right', color: '#475569' }]}>{t('Debit')}</Text>
        <Text style={[styles.th, { flex: 1, textAlign: 'right', color: '#475569' }]}>{t('Credit')}</Text>
      </View>

      {/* Opening Balance */}
      <View style={[styles.tr, { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderColor: '#e2e8f0' }]}>
        <Text style={[styles.td, { flex: 0.8, color: '#64748b' }]}>-</Text>
        <Text style={[styles.td, { flex: 2, fontStyle: 'italic', color: '#64748b', fontWeight: 'bold' }]}>{t('Opening Balance')}</Text>
        <Text style={[styles.td, { flex: 0.5, textAlign: 'center', color: '#64748b' }]}>-</Text>
        <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#64748b' }]}>-</Text>
        <Text style={[styles.td, { flex: 1, textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }]}>
          ₹{Math.abs(statementData.openingBalance).toFixed(0)}
        </Text>
      </View>

      {/* Transactions */}
      {txnsForList.map((item) => (
        <View key={item.id} style={{ borderBottomWidth: 1, borderColor: '#e2e8f0', paddingVertical: 8 }}>
          {/* Dr Row */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 10 }}>
            <Text style={[styles.td, { flex: 0.8, fontSize: 10, color: '#475569' }]}>{new Date(item.date).toLocaleDateString('en-GB')}</Text>
            <View style={{ flex: 2 }}>
              <Text style={[styles.td, { fontWeight: '600', fontSize: 11, color: '#0f172a' }]}>{item.drAccountName} <Text style={{fontWeight:'normal', color:'#64748b'}}>{t('Dr.')}</Text></Text>
            </View>
            <Text style={[styles.td, { flex: 0.5, textAlign: 'center', fontSize: 10, color: '#94a3b8' }]}>{item.vchNo}</Text>
            <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#0f172a', fontSize: 11, fontWeight: '500' }]}>{item.amount ? item.amount.toFixed(0) : ''}</Text>
            <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#0f172a', fontSize: 11 }]}></Text>
          </View>
          {/* Cr Row */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 10 }}>
            <Text style={[styles.td, { flex: 0.8, fontSize: 10 }]}></Text>
            <View style={{ flex: 2, paddingLeft: 15 }}>
              <Text style={[styles.td, { fontSize: 11, color: '#334155' }]}>To {item.crAccountName}</Text>
            </View>
            <Text style={[styles.td, { flex: 0.5, textAlign: 'center', fontSize: 10 }]}></Text>
            <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#0f172a', fontSize: 11 }]}></Text>
            <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#0f172a', fontSize: 11, fontWeight: '500' }]}>{item.amount ? item.amount.toFixed(0) : ''}</Text>
          </View>
          {/* Narration Row */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 10 }}>
            <Text style={[styles.td, { flex: 0.8, fontSize: 10 }]}></Text>
            <View style={{ flex: 2 }}>
              <Text style={[styles.td, { fontSize: 10, fontStyle: 'italic', color: '#64748b' }]}>{item.narration}</Text>
            </View>
            <Text style={[styles.td, { flex: 0.5, textAlign: 'center', fontSize: 10 }]}></Text>
            <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#0f172a', fontSize: 11 }]}></Text>
            <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#0f172a', fontSize: 11 }]}></Text>
          </View>
        </View>
      ))}

      {txnsForList.length === 0 && (
        <Text style={{ textAlign: 'center', marginVertical: 20, color: '#94a3b8' }}>{t('No transactions recorded.')}</Text>
      )}

      {/* Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.bActionBtn} onPress={() => {
          setEditingAccount(account);
          setAccountForm({
            name: account.name, phone: account.phone || '', balance: String(Math.abs(account.balance || 0)), balanceType: (account.balance || 0) < 0 ? 'Give' : 'Take', notes: account.notes || '', monthlySalary: String(account.monthlySalary || ''), salaryDate: account.salaryDate || '',
            interestRate: String(account.interestRate || '0'), 
            fromDate: account.fromDate || new Date().toISOString().split('T')[0], 
            dueDate: account.dueDate || ''
          });
          setShowAccountModal(true);
        }}>
          <Edit2 color="#64748b" size={14} />
          <Text style={{ color: '#64748b', marginLeft: 4, fontWeight: '600', fontSize: 12 }}>{t('Edit')}</Text>
        </TouchableOpacity>

        {(activeTab === 'Customer' || activeTab === 'Vendor') && (
          <TouchableOpacity style={styles.bActionBtn} onPress={() => {
            if (account.phone) {
              const message = activeTab === 'Customer' 
                ? `Hello ${account.name}, this is a gentle reminder regarding your pending balance of Rs. ${Math.abs(statementData.currentBalance).toFixed(2)}. Please arrange for payment by ${account.dueDate || 'at your earliest convenience'}. Thank you!\n\nRegards,\nCosmo Store`
                : `Hello ${account.name}, I am contacting you regarding our balance.\n\nRegards,\nCosmo Store`;
              Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}&phone=91${account.phone}`).catch(() => {
                Alert.alert("Error", "WhatsApp is not installed or could not be opened.");
              });
            } else {
              Alert.alert("Error", "No phone number added for this " + activeTab.toLowerCase() + ".");
            }
          }}>
            <MessageCircle color="#16a34a" size={14} />
            <Text style={{ color: '#16a34a', marginLeft: 4, fontWeight: '600', fontSize: 12 }}>{t('Remind')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.bActionBtn} onPress={() => handleDelete(account.id)}>
          <Trash2 color="#ef4444" size={14} />
        </TouchableOpacity>
      </View>
    </View>
  );
};


export default function LedgerScreen() {
  const { state, addVendor, updateVendor, deleteVendor, addCustomer, updateCustomer, deleteCustomer, addAccount, updateAccount, deleteAccount, addLedgerTransaction, t } = useApp();
  const [activeTab, setActiveTab] = useState('Customer');
  const [searchQuery, setSearchQuery] = useState('');

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', phone: '', balance: '0', balanceType: 'Take', interestRate: '0', fromDate: '', dueDate: '', notes: '', monthlySalary: '', salaryDate: '', pan: '', gst: '' });
  const [editingAccount, setEditingAccount] = useState(null);

  const [showTxnModal, setShowTxnModal] = useState(false);
  const [txnForm, setTxnForm] = useState({ targetAccount: null, type: 'Add', amount: '', paymentMode: 'Cash' });

  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState('fromDate');

  const getNormalizedList = () => {
    if (activeTab === 'Vendor') return state.vendors || [];
    if (activeTab === 'Customer') {
       return (state.customers || []).map(c => ({
         ...c,
         balance: c.udhaarBalance || 0,
         interestRate: c.interestRate || 0,
         fromDate: c.fromDate || '',
         dueDate: c.dueDate || ''
       }));
    }
    return (state.accounts || []).filter(a => a.type === activeTab);
  };

  let currentList = getNormalizedList();
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    currentList = currentList.filter(a => a.name?.toLowerCase().includes(q) || a.phone?.includes(q));
  }

  const handleSaveAccount = () => {
    if (!accountForm.name) return Alert.alert("Error", "Name is required");
    const rawBalance = Number(accountForm.balance) || 0;
    const computedBalance = accountForm.balanceType === 'Give' ? -Math.abs(rawBalance) : Math.abs(rawBalance);
    
    const payload = {
      ...accountForm,
      balance: computedBalance,
      interestRate: Number(accountForm.interestRate) || 0,
      fromDate: accountForm.fromDate,
      dueDate: accountForm.dueDate
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
    if (!txnForm.amount || Number(txnForm.amount) <= 0 || !txnForm.targetAccount) return Alert.alert("Error", "Valid amount required");
    
    addLedgerTransaction({
      vendorId: activeTab === 'Vendor' ? txnForm.targetAccount.id : null,
      customerId: activeTab === 'Customer' ? txnForm.targetAccount.id : null,
      accountId: !['Vendor', 'Customer'].includes(activeTab) ? txnForm.targetAccount.id : null,
      type: txnForm.type,
      amount: Number(txnForm.amount),
      paymentMode: txnForm.paymentMode,
    });

    if (activeTab === 'Customer') {
       let newBal = txnForm.targetAccount.balance;
       if (['Borrow', 'Receive', 'Credit Note', 'Income', 'Add'].includes(txnForm.type)) newBal += Number(txnForm.amount);
       if (['Payment', 'Spend', 'Debit Note', 'Expense', 'Deduct'].includes(txnForm.type)) newBal -= Number(txnForm.amount);
       updateCustomer({ ...txnForm.targetAccount, udhaarBalance: newBal });
    }
    setShowTxnModal(false);
  };

  const handleDelete = (id) => {
    Alert.alert("Confirm", "Are you sure you want to delete this account?", [
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
        <Text style={styles.headerTitle}>{t('Ledger (Khata)')}</Text>
        <TouchableOpacity 
          style={{ backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => {
            setEditingAccount(null);
            setAccountForm({ name: '', phone: '', balance: '0', interestRate: '0', fromDate: new Date().toISOString().split('T')[0], dueDate: '' });
            setShowAccountModal(true);
          }}
        >
          <Plus color="#fff" size={16} />
          <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 4, fontSize: 12 }}>New {activeTab}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
          {accountTypes.map(tab => {
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
                onPress={() => { setActiveTab(tab.id); setSearchQuery(''); }}
              >
                <Icon size={16} color={activeTab === tab.id ? '#FFF' : '#64748B'} />
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.id}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
        <TextInput
          style={{ backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, fontSize: 14, color: '#0F172A' }}
          placeholder={`Search ${activeTab} by name or phone...`}
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={currentList}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 10, paddingBottom: 100 }}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40, padding: 20, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' }}>
            <Briefcase size={40} color="#CBD5E1" style={{ marginBottom: 15 }} />
            <Text style={{ color: '#64748B', fontWeight: '500', fontSize: 16 }}>No {activeTab}s Found</Text>
            <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>{t('Click the + button to add one.')}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <AccountStatement 
            account={item} 
            activeTab={activeTab} 
            state={state} 
            setEditingAccount={setEditingAccount} 
            setAccountForm={setAccountForm} 
            setShowAccountModal={setShowAccountModal}
            setTxnForm={setTxnForm}
            setShowTxnModal={setShowTxnModal}
            handleDelete={handleDelete}
            t={t}
          />
        )}
      />

      {/* Account Modal (Create/Edit) */}
      <Modal visible={showAccountModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAccountModal(false)}>
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'left', 'right']}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editingAccount ? 'Edit' : 'Add'} {activeTab}</Text>
            <TouchableOpacity onPress={() => setShowAccountModal(false)} style={styles.closeBtn}><X size={22} color="#64748B" /></TouchableOpacity>
          </View>
          <ScrollView style={styles.formBody} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                {activeTab === 'Customer' ? 'Customer Name *' :
                 activeTab === 'Vendor' ? 'Vendor / Supplier Name *' :
                 activeTab === 'Employee' ? 'Employee Name *' :
                 activeTab === 'Cash' ? 'Cash Account Name *' :
                 activeTab === 'Bank' ? 'Bank Name *' :
                 activeTab === 'Income' ? 'Income Source / Category *' :
                 activeTab === 'Expenditure' ? 'Expense Category (e.g., Rent) *' : 'Name *'}
              </Text>
              <TextInput 
                style={styles.formInput} 
                placeholder={
                  activeTab === 'Customer' ? 'e.g., Rahul Kumar' :
                  activeTab === 'Vendor' ? 'e.g., Sharma Distributors' :
                  activeTab === 'Employee' ? 'e.g., Amit Singh' :
                  activeTab === 'Cash' ? 'e.g., Main Cash, Petty Cash' :
                  activeTab === 'Bank' ? 'e.g., HDFC Bank, SBI' :
                  activeTab === 'Income' ? 'e.g., Commission, Interest' :
                  activeTab === 'Expenditure' ? 'e.g., Rent, Electricity' : 'Enter Name'
                } 
                placeholderTextColor="#94A3B8" 
                value={accountForm.name} 
                onChangeText={t => setAccountForm(p => ({...p, name: t}))} 
              />
            </View>
            
            {['Customer', 'Vendor', 'Employee'].includes(activeTab) && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('Phone (Optional)')}</Text>
                <TextInput style={styles.formInput} placeholder={t('Enter Phone')} placeholderTextColor="#94A3B8" value={accountForm.phone} onChangeText={t => setAccountForm(p => ({...p, phone: t}))} keyboardType="numeric" />
              </View>
            )}

            {['Customer', 'Vendor'].includes(activeTab) && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('PAN No.')}</Text>
                  <TextInput style={styles.formInput} placeholder={t('ABCDE1234F')} placeholderTextColor="#94A3B8" value={accountForm.pan} onChangeText={t => setAccountForm(p => ({...p, pan: t}))} autoCapitalize="characters" />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('GST No.')}</Text>
                  <TextInput style={styles.formInput} placeholder={t('22AAAAA0000A1Z5')} placeholderTextColor="#94A3B8" value={accountForm.gst} onChangeText={t => setAccountForm(p => ({...p, gst: t}))} autoCapitalize="characters" />
                </View>
              </View>
            )}

            {activeTab === 'Bank' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('Account Number / Details')}</Text>
                <TextInput style={styles.formInput} placeholder={t('e.g. A/C 123456789')} placeholderTextColor="#94A3B8" value={accountForm.phone} onChangeText={t => setAccountForm(p => ({...p, phone: t}))} />
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>{t('Initial Balance (₹)')}</Text>
                <TextInput style={styles.formInput} placeholder="0.00" placeholderTextColor="#94A3B8" value={accountForm.balance} onChangeText={t => setAccountForm(p => ({...p, balance: t}))} keyboardType="numeric" />
              </View>
              {['Customer', 'Vendor', 'Employee'].includes(activeTab) && (
                <View style={[styles.formGroup, { flex: 1.5 }]}>
                  <Text style={styles.formLabel}>{t('Balance Type')}</Text>
                  <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 4 }}>
                    <TouchableOpacity 
                      style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: accountForm.balanceType === 'Take' ? '#FFF' : 'transparent', shadowColor: '#000', shadowOpacity: accountForm.balanceType === 'Take' ? 0.1 : 0, shadowRadius: 2, elevation: accountForm.balanceType === 'Take' ? 2 : 0 }}
                      onPress={() => setAccountForm(p => ({...p, balanceType: 'Take'}))}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: accountForm.balanceType === 'Take' ? '#2563EB' : '#64748B' }}>{t('Receivable')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: accountForm.balanceType === 'Give' ? '#FFF' : 'transparent', shadowColor: '#000', shadowOpacity: accountForm.balanceType === 'Give' ? 0.1 : 0, shadowRadius: 2, elevation: accountForm.balanceType === 'Give' ? 2 : 0 }}
                      onPress={() => setAccountForm(p => ({...p, balanceType: 'Give'}))}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: accountForm.balanceType === 'Give' ? '#EF4444' : '#64748B' }}>{t('Payable')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
            
            {['Customer', 'Vendor'].includes(activeTab) && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('Interest Rate (% / mo)')}</Text>
                  <TextInput style={styles.formInput} placeholder="0" placeholderTextColor="#94A3B8" value={accountForm.interestRate} onChangeText={t => setAccountForm(p => ({...p, interestRate: t}))} keyboardType="numeric" />
                </View>
              </View>
            )}

            {(['Customer', 'Vendor', 'Employee', 'Expenditure'].includes(activeTab)) && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {['Customer', 'Vendor', 'Employee'].includes(activeTab) && (
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>{activeTab === 'Employee' ? 'Joining Date' : 'From Date'}</Text>
                    <TouchableOpacity style={styles.dateInput} onPress={() => { setCalendarTarget('fromDate'); setShowCalendar(true); }}>
                      <CalendarIcon color="#64748b" size={18} />
                      <Text style={{ marginLeft: 8, color: accountForm.fromDate ? '#0F172A' : '#94A3B8' }}>{accountForm.fromDate || 'Select Date'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('Due Date (Reminder)')}</Text>
                  <TouchableOpacity style={styles.dateInput} onPress={() => { setCalendarTarget('dueDate'); setShowCalendar(true); }}>
                    <CalendarIcon color="#64748b" size={18} />
                    <Text style={{ marginLeft: 8, color: accountForm.dueDate ? '#0F172A' : '#94A3B8' }}>{accountForm.dueDate || 'Select Date'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'Employee' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('Monthly Salary (₹)')}</Text>
                  <TextInput style={styles.formInput} placeholder="0.00" placeholderTextColor="#94A3B8" value={accountForm.monthlySalary} onChangeText={t => setAccountForm(p => ({...p, monthlySalary: t}))} keyboardType="numeric" />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('Salary Date')}</Text>
                  <TextInput style={styles.formInput} placeholder={t('e.g. 5th')} placeholderTextColor="#94A3B8" value={accountForm.salaryDate} onChangeText={t => setAccountForm(p => ({...p, salaryDate: t}))} />
                </View>
              </View>
            )}

            {['Customer', 'Vendor', 'Employee'].includes(activeTab) && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('Notes / Remarks')}</Text>
                <TextInput style={[styles.formInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} multiline placeholder={t('Any extra information...')} placeholderTextColor="#94A3B8" value={accountForm.notes} onChangeText={t => setAccountForm(p => ({...p, notes: t}))} />
              </View>
            )}
            <TouchableOpacity style={styles.formSaveBtn} onPress={handleSaveAccount}>
              <Text style={styles.formSaveBtnText}>Save {activeTab}</Text>
            </TouchableOpacity>
            <View style={{ height: 150 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarContainer}>
            <Calendar
              onDayPress={day => {
                setAccountForm(p => ({ ...p, [calendarTarget]: day.dateString }));
                setShowCalendar(false);
              }}
              markedDates={{ [accountForm[calendarTarget]]: { selected: true, selectedColor: '#2563eb' } }}
              theme={{ todayTextColor: '#2563eb', arrowColor: '#2563eb' }}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCalendar(false)}>
              <Text style={styles.cancelBtnText}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Txn Modal */}
      <Modal visible={showTxnModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTxnModal(false)}>
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'left', 'right']}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{t('Add Transaction')}</Text>
            <TouchableOpacity onPress={() => setShowTxnModal(false)} style={styles.closeBtn}><X size={22} color="#64748B" /></TouchableOpacity>
          </View>
          <ScrollView style={styles.formBody} keyboardShouldPersistTaps="handled">
            <Text style={{ marginBottom: 20, fontSize: 16, color: '#475569', fontWeight: '500' }}>For: <Text style={{fontWeight: '700', color: '#0F172A'}}>{txnForm.targetAccount?.name}</Text></Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('Transaction Type')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {(() => {
                   let types = [];
                   if (['Customer', 'Vendor'].includes(activeTab)) {
                     types = ['Borrow', 'Payment', 'Receive', 'Credit Note', 'Debit Note'];
                   } else if (activeTab === 'Employee') {
                     types = ['Payment', 'Borrow', 'Receive'];
                   } else if (activeTab === 'Expenditure') {
                     types = ['Expense', 'Payment'];
                   } else if (activeTab === 'Income') {
                     types = ['Add', 'Receive'];
                   } else if (['Bank', 'Cash'].includes(activeTab)) {
                     types = ['Add', 'Deduct'];
                   }
                   if (types.length === 0) types = ['Add', 'Deduct'];

                   return types.map(t => (
                     <TouchableOpacity 
                       key={t} 
                       onPress={() => setTxnForm(p => ({...p, type: t}))}
                       style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: txnForm.type === t ? '#2563EB' : '#F1F5F9', borderRadius: 20, marginRight: 8 }}
                     >
                       <Text style={{ color: txnForm.type === t ? '#FFF' : '#475569', fontSize: 13, fontWeight: '600' }}>
                         {t === 'Payment' && activeTab === 'Employee' ? 'Pay Salary' : t === 'Borrow' && activeTab === 'Employee' ? 'Advance Given' : t === 'Receive' && activeTab === 'Employee' ? 'Return Advance' : t}
                       </Text>
                     </TouchableOpacity>
                   ));
                })()}
              </ScrollView>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('Amount (₹) *')}</Text>
              <TextInput style={styles.formInput} placeholder="0.00" placeholderTextColor="#94A3B8" value={txnForm.amount} onChangeText={t => setTxnForm(p => ({...p, amount: t}))} keyboardType="numeric" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('Payment Mode')}</Text>
              <TextInput style={styles.formInput} placeholder={t('e.g. Cash')} placeholderTextColor="#94A3B8" value={txnForm.paymentMode} onChangeText={t => setTxnForm(p => ({...p, paymentMode: t}))} />
            </View>
            
            <TouchableOpacity style={styles.formSaveBtn} onPress={handleSaveTxn}>
              <Text style={styles.formSaveBtnText}>{t('Save Entry')}</Text>
            </TouchableOpacity>
            <View style={{ height: 50 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 15, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 10 },
  tabBtnActive: { backgroundColor: '#2563eb' },
  tabText: { marginLeft: 6, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  
  statementCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  statementHeader: { padding: 15, backgroundColor: '#f8fafc', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  addTxnBtn: { flexDirection: 'row', backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 15, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  th: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
  tr: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 15, borderBottomWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff' },
  td: { fontSize: 12, color: '#0f172a' },
  
  bottomActions: { backgroundColor: '#f8fafc', flexDirection: 'row', borderTopWidth: 1, borderColor: '#e2e8f0', padding: 10, justifyContent: 'space-around' },
  bActionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  
  modalSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  formTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  closeBtn: { padding: 6, backgroundColor: '#F1F5F9', borderRadius: 10 },
  formBody: { padding: 20, backgroundColor: '#F8FAFC' },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: '600' },
  formInput: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', fontSize: 15, color: '#0F172A', fontWeight: '500' },
  dateInput: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center' },
  formSaveBtn: { backgroundColor: '#2563EB', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 16, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  formSaveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  calendarContainer: { width: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 10, overflow: 'hidden' },
  cancelBtn: { padding: 12, alignItems: 'center', borderTopWidth: 1, borderColor: '#e2e8f0', marginTop: 10 },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold' }
});
