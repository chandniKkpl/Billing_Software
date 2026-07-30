"use client";
import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { Plus, Edit2, Trash2, CheckCircle, X, MapPin } from 'lucide-react';
import WarehouseModal from '../components/modals/WarehouseModal';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { showToast } from '../components/Toast';

export default function Warehouses() {
  const { state } = useApp();
  const tx = useT(state.lang);
  const [showModal, setShowModal] = useState(false);
  const [editingWh, setEditingWh] = useState(null);
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name) return showToast('Warehouse Name is required', 'error');
    
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
      showToast(editingWh ? 'Warehouse updated' : 'Warehouse added', 'success');
      setShowModal(false);
      resetForm();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (id === 'main') {
      return showToast('Cannot delete the main warehouse', 'error');
    }
    if(window.confirm('Are you sure you want to delete this warehouse?')) {
      await deleteDoc(doc(db, 'warehouses', id));
      showToast('Warehouse deleted', 'info');
    }
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
  // Ensure Main Store exists virtually if not in DB
  const displayWarehouses = warehouses.some(w => w.id === 'main') ? warehouses : [{id: 'main', name: 'Main Store', address: 'Primary Location'}, ...warehouses];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>🏢 {tx.warehouses || 'Warehouses'}</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={18} /> Add Warehouse
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Warehouse Name</th>
                <th>Address</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayWarehouses.map(wh => {
                const whProducts = (state.products || []).filter(p => p.warehouseStock && p.warehouseStock[wh.id] > 0);
                
                return (
                  <tr key={wh.id}>
                    <td style={{ fontWeight: 600, verticalAlign: 'top' }}>
                      {wh.name} {wh.id === 'main' && <span className="badge badge-yellow" style={{marginLeft: 8}}>Default</span>}
                      {whProducts.length > 0 && (
                        <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text2)', fontWeight: 'normal' }}>
                          <div style={{ marginBottom: 4, fontWeight: '600' }}>Stock Items:</div>
                          <ul style={{ paddingLeft: 16, marginTop: 0, marginBottom: 0 }}>
                            {whProducts.map(p => (
                              <li key={p.id} style={{ marginBottom: 2 }}>{p.name} <span style={{ color: 'var(--text3)' }}>({p.warehouseStock[wh.id]} {p.unit || 'pcs'})</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </td>
                    <td style={{ verticalAlign: 'top' }}>{wh.address || '-'}</td>
                    <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                      <button className="btn-icon" onClick={() => openEdit(wh)}>
                        <Edit2 size={16} color="var(--primary)" />
                      </button>
                      {wh.id !== 'main' && (
                        <button className="btn-icon" onClick={() => handleDelete(wh.id)}>
                          <Trash2 size={16} color="var(--red)" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <WarehouseModal 
          show={showModal} 
          editingWh={editingWh} 
          name={name} 
          setName={setName} 
          address={address} 
          setAddress={setAddress} 
          handleSave={handleSave} 
          onClose={() => setShowModal(false)} 
        />
      </div>
    </div>
  );
}
