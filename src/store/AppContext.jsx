import { createContext, useContext, useReducer, useEffect } from 'react';
import CryptoJS from 'crypto-js';

const AppContext = createContext(null);
const SECRET_KEY = 'cosmo_store_super_secret_key_2026';

function encryptData(data) {
  try {
    return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
  } catch (e) {
    return '[]';
  }
}

function decryptData(key) {
  try {
    const data = localStorage.getItem(key);
    if (!data) return [];
    const bytes = CryptoJS.AES.decrypt(data, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (e) {
    // Fallback if data is not encrypted (e.g. from previous version)
    try {
      const fallback = localStorage.getItem(key);
      return fallback ? JSON.parse(fallback) : [];
    } catch {
      return [];
    }
  }
}

const initialState = {
  products: decryptData('cs_products'),
  sales: decryptData('cs_sales'),
  cart: [],
  editingSaleId: null,
  lang: localStorage.getItem('cs_lang') || 'en',
  loading: false
};

function reducer(state, action) {
  let newState;
  switch (action.type) {
    case 'SET_PRODUCTS':
      newState = { ...state, products: action.payload };
      localStorage.setItem('cs_products', encryptData(action.payload));
      return newState;
    case 'SET_SALES':
      newState = { ...state, sales: action.payload };
      localStorage.setItem('cs_sales', encryptData(action.payload));
      return newState;
    case 'ADD_TO_CART': {
      const existing = state.cart.find(c => c.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map(c =>
            c.id === action.payload.id ? { ...c, qty: c.qty + 1 } : c
          ),
        };
      }
      return { ...state, cart: [...state.cart, { ...action.payload, qty: 1, discount: 0 }] };
    }
    case 'SET_CART':
      return { ...state, cart: action.payload };
    case 'SET_EDITING_SALE':
      return { ...state, editingSaleId: action.payload };
    case 'UPDATE_CART_ITEM':
      return {
        ...state,
        cart: state.cart.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c),
      };
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter(c => c.id !== action.payload) };
    case 'CLEAR_CART':
      return { ...state, cart: [], editingSaleId: null };
    case 'SET_LANG':
      localStorage.setItem('cs_lang', action.payload);
      return { ...state, lang: action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const syncProducts = (newProds) => {
    dispatch({ type: 'SET_PRODUCTS', payload: newProds });
  };

  const syncSales = (newSales) => {
    dispatch({ type: 'SET_SALES', payload: newSales });
  };

  const addProduct = async (product) => {
    const id = product.id || Date.now().toString();
    const newProds = [...state.products, { ...product, id }];
    syncProducts(newProds);
  };

  const updateProduct = async (product) => {
    const newProds = state.products.map(p => p.id === product.id ? product : p);
    syncProducts(newProds);
  };

  const deleteProduct = async (id) => {
    const newProds = state.products.filter(p => p.id !== id);
    syncProducts(newProds);
  };

  const bulkAddProducts = async (products) => {
    const existing = [...state.products];
    products.forEach(p => {
      const idx = existing.findIndex(ex => ex.barcode === p.barcode && p.barcode);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...p };
      } else {
        existing.push(p);
      }
    });
    syncProducts(existing);
  };

  const completeSale = async (sale) => {
    const existingIndex = state.sales.findIndex(s => s.id === sale.id);
    let newSales = [...state.sales];
    let newProducts = [...state.products];
    
    // If editing existing sale, restore stock first
    if (existingIndex >= 0) {
      const oldSale = newSales[existingIndex];
      oldSale.items.forEach(item => {
        const pIdx = newProducts.findIndex(p => p.id === item.id);
        if (pIdx >= 0) {
          newProducts[pIdx] = { ...newProducts[pIdx], stock: (newProducts[pIdx].stock || 0) + item.qty };
        }
      });
      newSales[existingIndex] = sale;
    } else {
      newSales = [sale, ...newSales];
    }

    // Deduct new stock
    sale.items.forEach(item => {
      const pIdx = newProducts.findIndex(p => p.id === item.id);
      if (pIdx >= 0) {
        newProducts[pIdx] = { ...newProducts[pIdx], stock: Math.max(0, (newProducts[pIdx].stock || 0) - item.qty) };
      }
    });

    syncSales(newSales);
    syncProducts(newProducts);
    dispatch({ type: 'CLEAR_CART' });
  };

  const updateSale = async (saleId, updatedSaleData) => {
    const newSales = state.sales.map(s => {
      if (s.id === saleId) {
        return { ...s, ...updatedSaleData };
      }
      return s;
    });
    syncSales(newSales);
  };

  const deleteSale = async (saleId) => {
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) return;
    
    // Restore stock
    let newProducts = [...state.products];
    sale.items.forEach(item => {
      const pIdx = newProducts.findIndex(p => p.id === item.id);
      if (pIdx >= 0) {
        newProducts[pIdx] = { ...newProducts[pIdx], stock: (newProducts[pIdx].stock || 0) + item.qty };
      }
    });
    
    const newSales = state.sales.filter(s => s.id !== saleId);
    syncProducts(newProducts);
    syncSales(newSales);
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
    setLang
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
