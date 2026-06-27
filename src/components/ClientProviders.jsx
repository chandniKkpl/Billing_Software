"use client";

import { useState, useEffect } from 'react';
import { AppProvider } from '../store/AppContext';
import { ToastProvider } from './Toast';
import Sidebar from './Sidebar';
import Login from '../views/Login';

export default function ClientProviders({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem('cs_auth_session')) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('cs_auth_session', 'true');
  };

  if (!mounted) return null; // Prevent hydration mismatch

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <Login onLogin={handleLogin} />
      </ToastProvider>
    );
  }

  return (
    <AppProvider>
      <ToastProvider>
        <div className="app-shell">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </ToastProvider>
    </AppProvider>
  );
}
