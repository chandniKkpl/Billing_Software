import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { showToast } from '../components/Toast';
import { Trash2, AlertTriangle, Database } from 'lucide-react';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

export default function Settings() {
  const { state, dispatch } = useApp();
  const [resetting, setResetting] = useState(false);

  // Define the segments that can be reset
  const segments = [
    { id: 'sales', label: 'Sales Records (All Bills)', description: 'Clears all sales history.' },
    { id: 'purchases', label: 'Purchase Records', description: 'Clears all purchase invoices.' },
    { id: 'ledgerTransactions', label: 'Ledger Transactions', description: 'Clears all manual payments and receipts.' },
    { id: 'customers', label: 'Customers', description: 'Deletes all customer data and balances.' },
    { id: 'vendors', label: 'Vendors', description: 'Deletes all vendor data and balances.' },
    { id: 'products', label: 'Inventory (Products)', description: 'Clears all products and stock.' }
  ];

  const handleResetSegment = async (segmentId) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete all data in '${segmentId}'? This action CANNOT be undone.`)) {
      return;
    }

    setResetting(true);
    try {
      const snap = await getDocs(collection(db, segmentId));
      const batch = writeBatch(db);
      
      let count = 0;
      snap.docs.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });

      if (count > 0) {
        await batch.commit();
        showToast(`Successfully deleted ${count} records from ${segmentId}.`, 'success');
      } else {
        showToast(`No records found in ${segmentId}.`, 'info');
      }
    } catch (error) {
      console.error(error);
      showToast(`Error clearing ${segmentId}: ` + error.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleResetAll = async () => {
    if (!window.confirm(`⚠️ EXTREME WARNING ⚠️\n\nAre you sure you want to completely FACTORY RESET the app? ALL DATA (Sales, Products, Customers, Ledger) will be wiped out.\n\nType 'CONFIRM' to proceed.`)) {
      return;
    }
    const input = window.prompt("Type CONFIRM to factory reset:");
    if (input !== 'CONFIRM') {
      showToast('Reset aborted.', 'info');
      return;
    }

    setResetting(true);
    try {
      for (const segment of segments) {
        const snap = await getDocs(collection(db, segment.id));
        const batch = writeBatch(db);
        snap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      
      // Also clear accounts
      const accSnap = await getDocs(collection(db, 'accounts'));
      const accBatch = writeBatch(db);
      accSnap.docs.forEach((doc) => accBatch.delete(doc.ref));
      await accBatch.commit();

      showToast('Factory reset complete. App is now completely clean.', 'success');
    } catch (error) {
      console.error(error);
      showToast(`Error during factory reset: ` + error.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>⚙️ Settings & Data Reset</h2>
        <p style={{ margin: 0, color: 'var(--text3)' }}>Manage your application data and segments.</p>
      </div>

      <div className="card" style={{ maxWidth: '800px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <Database size={24} color="var(--primary)" />
          <h3 style={{ margin: 0 }}>Data Reset Segments</h3>
        </div>
        <p style={{ color: 'var(--text3)', marginBottom: '20px', fontSize: '0.9rem' }}>
          You can individually reset specific segments of your application. Use this carefully, as data cannot be recovered once deleted.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {segments.map((seg) => (
            <div key={seg.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '15px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#0F172A' }}>{seg.label}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>{seg.description}</p>
                </div>
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ color: 'var(--red)', backgroundColor: '#fee2e2', padding: '6px' }}
                  onClick={() => handleResetSegment(seg.id)}
                  disabled={resetting}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ maxWidth: '800px', backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <AlertTriangle size={24} color="var(--red)" />
          <h3 style={{ margin: 0, color: 'var(--red)' }}>Danger Zone</h3>
        </div>
        <p style={{ color: 'var(--red)', marginBottom: '20px', fontSize: '0.9rem', fontWeight: '500' }}>
          The action below will permanently delete ALL data in the application and restore it to a factory-fresh state.
        </p>
        
        <button 
          className="btn btn-primary" 
          style={{ backgroundColor: 'var(--red)', width: '100%' }}
          onClick={handleResetAll}
          disabled={resetting}
        >
          {resetting ? 'Resetting Data...' : '⚠️ Factory Reset All Data'}
        </button>
      </div>
    </div>
  );
}
