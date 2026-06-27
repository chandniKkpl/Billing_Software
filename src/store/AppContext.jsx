import { createContext, useContext, useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const AppContext = createContext(null);
const SECRET_KEY = 'cosmo_store_super_secret_key_2026';

function decryptData(key) {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(key);
    if (!data) return [];
    const bytes = CryptoJS.AES.decrypt(data, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (e) {
    try {
      const fallback = localStorage.getItem(key);
      return fallback ? JSON.parse(fallback) : [];
    } catch {
      return [];
    }
  }
}

export function AppProvider({ children }) {
  const [state, setState] = useState({
    products: [], sales: [], customers: [], vendors: [], ledgerTransactions: [], accounts: [],
    cart: [], editingSaleId: null, lang: 'en', loading: true
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setState(prev => ({ ...prev, lang: localStorage.getItem('cs_lang') || 'en' }));
    }

    const collections = ['products', 'sales', 'customers', 'vendors', 'accounts', 'ledgerTransactions'];
    const unsubs = collections.map(coll => {
      return onSnapshot(collection(db, coll), snap => {
        const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setState(prev => ({ ...prev, [coll]: data }));
      });
    });

    // Auto Migration from LocalStorage to Firebase
    if (typeof window !== 'undefined' && !localStorage.getItem('cs_firebase_migrated')) {
      setTimeout(async () => {
        try {
          const batch = writeBatch(db);
          let migratedAny = false;
          
          const migrateColl = (localKey, fbColl) => {
             const items = decryptData(localKey);
             items.forEach(item => {
               if (item && item.id) {
                 batch.set(doc(db, fbColl, String(item.id)), item);
                 migratedAny = true;
               }
             });
          };

          migrateColl('cs_products', 'products');
          migrateColl('cs_sales', 'sales');
          migrateColl('cs_customers', 'customers');
          migrateColl('cs_vendors', 'vendors');
          migrateColl('cs_accounts', 'accounts');
          migrateColl('cs_ledger', 'ledgerTransactions');

          if (migratedAny) {
            await batch.commit();
            console.log("Successfully migrated local data to Firebase");
          }
          localStorage.setItem('cs_firebase_migrated', 'true');
        } catch(err) {
          console.error("Migration failed", err);
        }
      }, 3000);
    }

    setState(prev => ({ ...prev, loading: false }));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  const dispatch = (action) => {
    switch (action.type) {
      case 'ADD_TO_CART': {
        setState(prev => {
          const existing = prev.cart.find(c => c.id === action.payload.id);
          if (existing) {
            return { ...prev, cart: prev.cart.map(c => c.id === action.payload.id ? { ...c, qty: c.qty + 1 } : c) };
          }
          return { ...prev, cart: [...prev.cart, { ...action.payload, qty: 1, discount: 0 }] };
        });
        break;
      }
      case 'SET_CART':
        setState(prev => ({ ...prev, cart: action.payload }));
        break;
      case 'SET_EDITING_SALE':
        setState(prev => ({ ...prev, editingSaleId: action.payload }));
        break;
      case 'UPDATE_CART_ITEM':
        setState(prev => ({ ...prev, cart: prev.cart.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) }));
        break;
      case 'REMOVE_FROM_CART':
        setState(prev => ({ ...prev, cart: prev.cart.filter(c => c.id !== action.payload) }));
        break;
      case 'CLEAR_CART':
        setState(prev => ({ ...prev, cart: [], editingSaleId: null }));
        break;
      case 'SET_LANG':
        localStorage.setItem('cs_lang', action.payload);
        setState(prev => ({ ...prev, lang: action.payload }));
        break;
      default:
        break;
    }
  };

  const addCustomer = async (customer) => {
    const id = customer.id || Date.now().toString();
    await setDoc(doc(db, 'customers', id), { ...customer, id, udhaarBalance: customer.udhaarBalance || 0 });
  };
  const updateCustomer = async (customer) => {
    await setDoc(doc(db, 'customers', String(customer.id)), customer, { merge: true });
  };
  const deleteCustomer = async (id) => {
    await deleteDoc(doc(db, 'customers', String(id)));
  };

  const addVendor = async (vendor) => {
    const id = vendor.id || Date.now().toString();
    await setDoc(doc(db, 'vendors', id), { ...vendor, id, balance: vendor.balance || 0 });
  };
  const updateVendor = async (vendor) => {
    await setDoc(doc(db, 'vendors', String(vendor.id)), vendor, { merge: true });
  };
  const deleteVendor = async (id) => {
    await deleteDoc(doc(db, 'vendors', String(id)));
  };

  const addAccount = async (acc) => {
    const id = acc.id || Date.now().toString();
    await setDoc(doc(db, 'accounts', id), { ...acc, id, balance: acc.balance || 0 });
  };
  const updateAccount = async (acc) => {
    await setDoc(doc(db, 'accounts', String(acc.id)), acc, { merge: true });
  };
  const deleteAccount = async (id) => {
    await deleteDoc(doc(db, 'accounts', String(id)));
  };

  const addLedgerTransaction = async (txn) => {
    const id = txn.id || Date.now().toString();
    const batch = writeBatch(db);
    
    const txnDoc = doc(db, 'ledgerTransactions', id);
    batch.set(txnDoc, { ...txn, id, date: txn.date || new Date().toISOString() });
    
    if (txn.vendorId) {
      const vendor = state.vendors.find(v => v.id === txn.vendorId);
      if (vendor) {
        let newBalance = vendor.balance;
        if (txn.type === 'Borrow') newBalance += txn.amount;
        if (txn.type === 'Payment') newBalance -= txn.amount;
        if (txn.type === 'Debit Note') newBalance -= txn.amount; 
        if (txn.type === 'Credit Note') newBalance += txn.amount; 
        batch.set(doc(db, 'vendors', String(vendor.id)), { balance: newBalance }, { merge: true });
      }
    }

    if (txn.accountId) {
      const acc = state.accounts.find(a => a.id === txn.accountId);
      if (acc) {
        let newBalance = acc.balance;
        if (['Borrow', 'Receive', 'Credit Note', 'Income', 'Add'].includes(txn.type)) newBalance += txn.amount;
        if (['Payment', 'Spend', 'Debit Note', 'Expense', 'Deduct'].includes(txn.type)) newBalance -= txn.amount;
        batch.set(doc(db, 'accounts', String(acc.id)), { balance: newBalance }, { merge: true });
      }
    }
    
    await batch.commit();
  };

  const addProduct = async (product) => {
    const id = product.id || Date.now().toString();
    await setDoc(doc(db, 'products', id), { ...product, id });
  };
  const updateProduct = async (product) => {
    await setDoc(doc(db, 'products', String(product.id)), product, { merge: true });
  };
  const deleteProduct = async (id) => {
    await deleteDoc(doc(db, 'products', String(id)));
  };

  const bulkAddProducts = async (products) => {
    const batch = writeBatch(db);
    products.forEach(p => {
      const id = p.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
      batch.set(doc(db, 'products', String(id)), { ...p, id }, { merge: true });
    });
    await batch.commit();
  };

  const completeSale = async (sale) => {
    const batch = writeBatch(db);
    const existingIndex = state.sales.findIndex(s => s.id === sale.id);
    
    if (existingIndex >= 0) {
      const oldSale = state.sales[existingIndex];
      oldSale.items.forEach(item => {
        const product = state.products.find(p => p.id === item.id);
        if (product) {
           const newStock = (product.stock || 0) + item.qty;
           batch.set(doc(db, 'products', String(product.id)), { stock: newStock }, { merge: true });
        }
      });
    }

    sale.items.forEach(item => {
      const product = state.products.find(p => p.id === item.id);
      if (product) {
        const baseStock = (existingIndex >= 0 && state.sales[existingIndex].items.find(i=>i.id===item.id)) 
                          ? (product.stock || 0) + state.sales[existingIndex].items.find(i=>i.id===item.id).qty 
                          : (product.stock || 0);
        const newStock = Math.max(0, baseStock - item.qty);
        batch.set(doc(db, 'products', String(product.id)), { stock: newStock }, { merge: true });
      }
    });

    if (sale.paymentMode === 'Debt' && sale.customerId && !existingIndex >= 0) {
      const customer = state.customers.find(c => c.id === sale.customerId);
      if (customer) {
        const newBalance = (customer.udhaarBalance || 0) + sale.grandTotal;
        batch.set(doc(db, 'customers', String(customer.id)), { udhaarBalance: newBalance }, { merge: true });
      }
    }

    batch.set(doc(db, 'sales', String(sale.id)), sale);
    
    await batch.commit();
    dispatch({ type: 'CLEAR_CART' });
  };

  const updateSale = async (saleId, updatedSaleData) => {
    await setDoc(doc(db, 'sales', String(saleId)), updatedSaleData, { merge: true });
  };

  const deleteSale = async (saleId) => {
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) return;
    
    const batch = writeBatch(db);
    sale.items.forEach(item => {
      const product = state.products.find(p => p.id === item.id);
      if (product) {
        batch.set(doc(db, 'products', String(product.id)), { stock: (product.stock || 0) + item.qty }, { merge: true });
      }
    });
    
    batch.delete(doc(db, 'sales', String(saleId)));
    await batch.commit();
  };

  const setLang = (l) => dispatch({ type: 'SET_LANG', payload: l });

  const value = {
    state,
    dispatch,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkAddProducts,
    completeSale,
    updateSale,
    deleteSale,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addVendor, updateVendor, deleteVendor,
    addAccount, updateAccount, deleteAccount,
    addLedgerTransaction,
    setLang
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
