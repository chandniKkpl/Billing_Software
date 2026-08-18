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
    products: [], sales: [], purchases: [], customers: [], vendors: [], ledgerTransactions: [], accounts: [], assets: [],
    cart: [], editingSaleId: null, editingPurchaseId: null, lang: 'en', loading: true
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setState(prev => ({ ...prev, lang: localStorage.getItem('cs_lang') || 'en' }));
    }

    const collections = ['products', 'sales', 'purchases', 'customers', 'vendors', 'accounts', 'ledgerTransactions', 'assets', 'enquiries', 'warehouses'];
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

  // Auto WhatsApp Reminders
  useEffect(() => {
    if (state.loading || state.customers.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    const lastGlobalCheck = localStorage.getItem('cs_last_reminder_check');
    if (lastGlobalCheck === today) return; // Already checked today on this device
    
    state.customers.forEach(async (c) => {
      if (c.dueDate && c.dueDate <= today && (c.udhaarBalance > 0) && c.lastReminderSentAt !== today) {
        try {
          const msg = `Hello ${c.name}, this is a gentle reminder that your pending dues are ₹${c.udhaarBalance.toFixed(2)}. Please settle the amount by ${c.dueDate}. Thank you! - Cosmo Store`;
          
          const apiUrl = import.meta.env.VITE_WHATSAPP_API_URL;
          const apiKey = import.meta.env.VITE_WHATSAPP_API_KEY;
          
          if (apiUrl && apiKey && c.phone) {
            const res = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                to: c.phone,
                type: 'text',
                text: msg
              })
            });
            
            if (res.ok) {
              await setDoc(doc(db, 'customers', String(c.id)), { lastReminderSentAt: today }, { merge: true });
            }
          }
        } catch (err) {
          console.error("Failed to send auto-reminder to", c.name, err);
        }
      }
    });

    localStorage.setItem('cs_last_reminder_check', today);
  }, [state.loading, state.customers.length]);

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
      case 'SET_EDITING_PURCHASE':
        setState(prev => ({ ...prev, editingPurchaseId: action.payload }));
        break;
      case 'UPDATE_CART_ITEM':
        setState(prev => ({ ...prev, cart: prev.cart.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) }));
        break;
      case 'REMOVE_FROM_CART':
        setState(prev => ({ ...prev, cart: prev.cart.filter(c => c.id !== action.payload) }));
        break;
      case 'CLEAR_CART':
        setState(prev => ({ ...prev, cart: [], editingSaleId: null, editingPurchaseId: null }));
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

  const addEnquiry = async (enq) => {
    const id = enq.id || Date.now().toString();
    await setDoc(doc(db, 'enquiries', id), { ...enq, id, date: new Date().toISOString() });
  };
  const updateEnquiry = async (enq) => {
    await setDoc(doc(db, 'enquiries', String(enq.id)), enq, { merge: true });
  };
  const deleteEnquiry = async (id) => {
    await deleteDoc(doc(db, 'enquiries', String(id)));
  };

  const addAsset = async (asset) => {
    const id = asset.id || Date.now().toString();
    await setDoc(doc(db, 'assets', id), { ...asset, id, updatedAt: new Date().toISOString() });
  };
  const updateAsset = async (asset) => {
    await setDoc(doc(db, 'assets', String(asset.id)), { ...asset, updatedAt: new Date().toISOString() }, { merge: true });
  };
  const deleteAsset = async (id) => {
    await deleteDoc(doc(db, 'assets', String(id)));
  };

  const addWarehouse = async (wh) => {
    const id = wh.id || Date.now().toString();
    await setDoc(doc(db, 'warehouses', id), { ...wh, id });
  };
  const updateWarehouse = async (wh) => {
    await setDoc(doc(db, 'warehouses', String(wh.id)), wh, { merge: true });
  };
  const deleteWarehouse = async (id) => {
    await deleteDoc(doc(db, 'warehouses', String(id)));
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
      const oldWhId = oldSale.warehouseId || 'main';
      oldSale.items.forEach(item => {
        const product = state.products.find(p => p.id === item.id);
        if (product && product.itemType !== 'Service') {
           let whStock = { ...(product.warehouseStock || {}) };
           if (Object.keys(whStock).length === 0 && (product.stock || 0) > 0) whStock['main'] = product.stock;
           whStock[oldWhId] = (whStock[oldWhId] || 0) + item.qty;
           const newStock = Object.values(whStock).reduce((sum, val) => sum + val, 0);
           batch.set(doc(db, 'products', String(product.id)), { stock: newStock, warehouseStock: whStock }, { merge: true });
        }
      });
    }

    const whId = sale.warehouseId || 'main';
    sale.items.forEach(item => {
      const product = state.products.find(p => p.id === item.id);
      if (product && product.itemType !== 'Service') {
        let whStock = { ...(product.warehouseStock || {}) };
        if (Object.keys(whStock).length === 0 && (product.stock || 0) > 0) whStock['main'] = product.stock;
        
        // If updating the exact same warehouse, the revert above already added the old qty back
        // If different warehouse, old was added back to oldWhId, now deduct from new whId
        whStock[whId] = Math.max(0, (whStock[whId] || 0) - item.qty);
        const newStock = Object.values(whStock).reduce((sum, val) => sum + val, 0);
        batch.set(doc(db, 'products', String(product.id)), { stock: newStock, warehouseStock: whStock }, { merge: true });
      }
    });

    if (sale.paymentMode === 'Debt' && sale.customerId && existingIndex === -1) {
      const customer = state.customers.find(c => c.id === sale.customerId);
      if (customer) {
        const amountPaidNow = Number(sale.cashPaid) || 0;
        const newBalance = (customer.udhaarBalance || 0) + (sale.grandTotal - amountPaidNow);
        batch.set(doc(db, 'customers', String(customer.id)), { udhaarBalance: newBalance }, { merge: true });

        if (amountPaidNow > 0) {
          const txnId = `rect-${sale.id}`;
          batch.set(doc(db, 'ledgerTransactions', txnId), {
            id: txnId,
            date: sale.date || new Date().toISOString(),
            customerId: customer.id,
            type: 'Receive',
            amount: amountPaidNow,
            paymentMode: 'Cash',
            notes: 'Advance received against sale',
            saleId: sale.id
          });
        }
      }
    }

    const cleanSale = JSON.parse(JSON.stringify(sale, (k, v) => (v === undefined ? null : v)));
    batch.set(doc(db, 'sales', String(sale.id)), cleanSale);
    
    await batch.commit();
    dispatch({ type: 'CLEAR_CART' });
  };

  const completePurchase = async (purchase) => {
    const batch = writeBatch(db);
    
    const existingIndex = state.purchases.findIndex(p => p.id === purchase.id);
    if (existingIndex >= 0) {
      const oldPurchase = state.purchases[existingIndex];
      const oldWhId = oldPurchase.warehouseId || 'main';
      
      // Revert old stock (decrement)
      oldPurchase.items.forEach(item => {
        const product = state.products.find(p => p.id === item.id);
        if (product && product.itemType !== 'Service') {
          let whStock = { ...(product.warehouseStock || {}) };
          if (Object.keys(whStock).length === 0 && (product.stock || 0) > 0) whStock['main'] = product.stock;
          whStock[oldWhId] = Math.max(0, (whStock[oldWhId] || 0) - item.qty);
          const newStock = Object.values(whStock).reduce((sum, val) => sum + val, 0);
          batch.set(doc(db, 'products', String(product.id)), { stock: newStock, warehouseStock: whStock }, { merge: true });
        }
      });
      
      // Revert old vendor credit
      if (oldPurchase.paymentMode === 'Credit' && oldPurchase.vendorId) {
        const vendor = state.vendors.find(v => v.id === oldPurchase.vendorId);
        if (vendor) {
          const newBalance = (vendor.balance || 0) - (oldPurchase.grandTotal - (Number(oldPurchase.cashPaid) || 0));
          batch.set(doc(db, 'vendors', String(vendor.id)), { balance: newBalance }, { merge: true });
        }
      }
    }

    // Apply new stock (increment)
    const whId = purchase.warehouseId || 'main';
    purchase.items.forEach(item => {
      const product = state.products.find(p => p.id === item.id);
      if (product && product.itemType !== 'Service') {
        let whStock = { ...(product.warehouseStock || {}) };
        if (Object.keys(whStock).length === 0 && (product.stock || 0) > 0) whStock['main'] = product.stock;
        whStock[whId] = (whStock[whId] || 0) + item.qty;
        const newStock = Object.values(whStock).reduce((sum, val) => sum + val, 0);
        batch.set(doc(db, 'products', String(product.id)), { stock: newStock, warehouseStock: whStock }, { merge: true });
      }
    });

    // Net Vendor Balance Logic
    if (purchase.paymentMode === 'Credit' && purchase.vendorId) {
      const vendor = state.vendors.find(v => v.id === purchase.vendorId);
      if (vendor) {
        let newBalance = vendor.balance || 0;
        const amountPaidNow = Number(purchase.cashPaid) || 0;
        
        if (existingIndex >= 0) {
          const oldPurchase = state.purchases[existingIndex];
          if (oldPurchase.paymentMode === 'Credit' && oldPurchase.vendorId === vendor.id) {
            newBalance = newBalance - (oldPurchase.grandTotal - (Number(oldPurchase.cashPaid) || 0));
          }
        }
        
        newBalance = newBalance + (purchase.grandTotal - amountPaidNow);
        batch.set(doc(db, 'vendors', String(vendor.id)), { balance: newBalance }, { merge: true });
        
        if (amountPaidNow > 0 && existingIndex === -1) {
          const txnId = `pay-${purchase.id}`;
          batch.set(doc(db, 'ledgerTransactions', txnId), {
            id: txnId,
            date: purchase.date || new Date().toISOString(),
            vendorId: vendor.id,
            type: 'Payment',
            amount: amountPaidNow,
            paymentMode: 'Cash',
            notes: 'Advance given against purchase',
            purchaseId: purchase.id
          });
        }
      }
    } else if (existingIndex >= 0) {
      // If we changed FROM credit TO cash on the SAME vendor, the reversion already happened above,
      // but we need to ensure the final write respects it.
      const oldPurchase = state.purchases[existingIndex];
      if (oldPurchase.paymentMode === 'Credit' && oldPurchase.vendorId) {
        const vendor = state.vendors.find(v => v.id === oldPurchase.vendorId);
        if (vendor) {
          const newBalance = (vendor.balance || 0) - (oldPurchase.grandTotal - (Number(oldPurchase.cashPaid) || 0));
          batch.set(doc(db, 'vendors', String(vendor.id)), { balance: newBalance }, { merge: true });
        }
      }
    }

    // Save purchase record
    batch.set(doc(db, 'purchases', String(purchase.id)), purchase);
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

  const updatePurchase = async (purchaseId, updatedData) => {
    await setDoc(doc(db, 'purchases', String(purchaseId)), updatedData, { merge: true });
  };

  const deletePurchase = async (purchaseId) => {
    const purchase = state.purchases.find(p => p.id === purchaseId);
    if (!purchase) return;
    
    const batch = writeBatch(db);
    purchase.items.forEach(item => {
      const product = state.products.find(p => p.id === item.id);
      if (product) {
        batch.set(doc(db, 'products', String(product.id)), { stock: Math.max(0, (product.stock || 0) - item.qty) }, { merge: true });
      }
    });
    
    batch.delete(doc(db, 'purchases', String(purchaseId)));
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
    completePurchase,
    updatePurchase,
    deletePurchase,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addEnquiry, updateEnquiry, deleteEnquiry,
    addAsset, updateAsset, deleteAsset,
    addWarehouse, updateWarehouse, deleteWarehouse,
    addVendor, updateVendor, deleteVendor,
    addAccount, updateAccount, deleteAccount,
    addLedgerTransaction,
    setLang
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
