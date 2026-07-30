import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { Plus, Edit2, Trash2, CheckCircle, X, Search } from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import AssetModal from '../components/modals/AssetModal';

export default function Assets() {
  const { state } = useApp();
  const tx = useT(state.lang);
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [name, setName] = useState('');
  const [type, setType] = useState('Fixed');
  const [value, setValue] = useState('');
  const [dateAcquired, setDateAcquired] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || !value) return alert('Name and Value are required');
    
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
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this asset?')) {
      await deleteDoc(doc(db, 'assets', id));
    }
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

  const filteredAssets = state.assets.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalFixed = filteredAssets.filter(a => a.type === 'Fixed').reduce((acc, a) => acc + a.value, 0);
  const totalCurrent = filteredAssets.filter(a => a.type === 'Current').reduce((acc, a) => acc + a.value, 0);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>🏛 {tx.assets || 'Asset Master'}</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={18} /> Add Asset
        </button>
      </div>

      <div className="page-content">
        <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-title">Fixed Assets</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>₹{totalFixed.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Current Assets</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>₹{totalCurrent.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Assets</div>
          <div className="stat-value" style={{ color: '#0F172A' }}>₹{(totalFixed + totalCurrent).toFixed(2)}</div>
        </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px 15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <Search size={18} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search assets by name..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', marginLeft: '10px', width: '100%', fontSize: '14px' }}
            />
          </div>
        </div>

        <div className="card">
          <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Date Acquired</th>
              <th style={{ textAlign: 'right' }}>Value (₹)</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>No assets found</td></tr>
            ) : (
              filteredAssets.map(asset => (
                <tr key={asset.id}>
                  <td style={{ fontWeight: 600 }}>{asset.name}</td>
                  <td>
                    <span className={`badge ${asset.type === 'Fixed' ? 'badge-blue' : 'badge-green'}`}>
                      {asset.type}
                    </span>
                  </td>
                  <td>{new Date(asset.dateAcquired).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{asset.value.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-icon" onClick={() => openEdit(asset)}>
                      <Edit2 size={16} color="var(--primary)" />
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(asset.id)}>
                      <Trash2 size={16} color="var(--red)" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AssetModal 
        show={showModal} 
        editingAsset={editingAsset} 
        name={name} 
        setName={setName} 
        type={type} 
        setType={setType} 
        value={value} 
        setValue={setValue} 
        dateAcquired={dateAcquired} 
        setDateAcquired={setDateAcquired} 
        handleSave={handleSave} 
        onClose={() => setShowModal(false)} 
      />
      </div>
    </div>
  );
}
