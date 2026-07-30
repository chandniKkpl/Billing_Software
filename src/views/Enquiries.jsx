"use client";
import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { useT } from '../i18n/translations';
import { Plus, Edit2, Trash2, CheckCircle, X, MessageCircle } from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { showToast } from '../components/Toast';
import EnquiryModal from '../components/modals/EnquiryModal';

export default function Enquiries() {
  const { state } = useApp();
  const tx = useT(state.lang);
  const [showModal, setShowModal] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState(null);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [itemOfInterest, setItemOfInterest] = useState('');
  const [status, setStatus] = useState('Open'); // Open, Closed
  const [notes, setNotes] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name) return showToast('Name is required', 'error');
    
    const enquiryData = {
      name,
      phone,
      itemOfInterest,
      status,
      notes,
      date: new Date().toISOString(),
    };
    
    const id = editingEnquiry ? editingEnquiry.id : Date.now().toString();
    
    try {
      await setDoc(doc(db, 'enquiries', id), enquiryData);
      showToast(editingEnquiry ? 'Enquiry updated' : 'Enquiry added', 'success');
      setShowModal(false);
      resetForm();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this enquiry?')) {
      await deleteDoc(doc(db, 'enquiries', id));
      showToast('Enquiry deleted', 'info');
    }
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
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><MessageCircle size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> {tx.enquiries || 'Enquiries'}</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={18} /> Add Enquiry
        </button>
      </div>

      <div className="page-content">
        <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-title">Open Enquiries</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{openEnquiries}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Closed Enquiries</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{closedEnquiries}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Total Enquiries</div>
            <div className="stat-value" style={{ color: '#0F172A' }}>{enquiries.length}</div>
          </div>
        </div>

        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Interested In</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>No enquiries found</td></tr>
              ) : (
                enquiries.sort((a,b) => new Date(b.date) - new Date(a.date)).map(enq => (
                  <tr key={enq.id}>
                    <td>{new Date(enq.date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600 }}>{enq.name}</td>
                    <td>{enq.phone || '-'}</td>
                    <td>{enq.itemOfInterest || '-'}</td>
                    <td>
                      <span className={`badge ${enq.status === 'Open' ? 'badge-red' : 'badge-green'}`}>
                        {enq.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-icon" onClick={() => openEdit(enq)}>
                        <Edit2 size={16} color="var(--primary)" />
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(enq.id)}>
                        <Trash2 size={16} color="var(--red)" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <EnquiryModal 
          show={showModal} 
          editingEnquiry={editingEnquiry} 
          name={name} 
          setName={setName} 
          phone={phone} 
          setPhone={setPhone} 
          itemOfInterest={itemOfInterest} 
          setItemOfInterest={setItemOfInterest} 
          status={status} 
          setStatus={setStatus} 
          notes={notes} 
          setNotes={setNotes} 
          handleSave={handleSave} 
          onClose={() => setShowModal(false)} 
        />
      </div>
    </div>
  );
}
