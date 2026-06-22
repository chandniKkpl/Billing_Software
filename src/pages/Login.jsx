import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { showToast } from '../components/Toast';
import CryptoJS from 'crypto-js';

export default function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  
  useEffect(() => {
    // Check if a PIN is already set
    const storedPinHash = localStorage.getItem('cs_auth_pin');
    if (!storedPinHash) {
      setIsSetup(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin.length < 4) {
      showToast('PIN must be at least 4 digits', 'error');
      return;
    }

    const hashedPin = CryptoJS.SHA256(pin).toString();

    if (isSetup) {
      // Set new PIN
      localStorage.setItem('cs_auth_pin', hashedPin);
      showToast('PIN set successfully!', 'success');
      onLogin();
    } else {
      // Verify PIN
      const storedPinHash = localStorage.getItem('cs_auth_pin');
      if (hashedPin === storedPinHash) {
        onLogin();
      } else {
        showToast('Incorrect PIN', 'error');
        setPin('');
      }
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)' }}>
      <div style={{ background: 'var(--bg1)', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '360px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ background: 'var(--primary)', color: 'white', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={32} />
          </div>
        </div>
        <h2 style={{ marginBottom: '10px' }}>{isSetup ? 'Set Security PIN' : 'Enter Security PIN'}</h2>
        <p style={{ color: 'var(--text3)', fontSize: '0.9rem', marginBottom: '30px' }}>
          {isSetup ? 'Create a new PIN to secure your billing software.' : 'Please enter your PIN to access Cosmo Store.'}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="form-input"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder={isSetup ? 'Enter a 4+ digit PIN' : 'Enter PIN'}
            autoFocus
            style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px', marginBottom: '20px' }}
          />
          <button type="submit" className="btn btn-primary btn-block btn-lg">
            {isSetup ? 'Save & Continue' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
