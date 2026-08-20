"use client";

import { useState, useEffect } from 'react';
import { AppProvider } from '../store/AppContext';
import { ToastProvider } from './Toast';
import Sidebar from './Sidebar';
import Login from '../views/Login';
import VoiceAssistant from './VoiceAssistant';

export default function ClientProviders({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const session = localStorage.getItem('cs_auth_session') || sessionStorage.getItem('cs_auth_session');
    if (session) {
      setIsAuthenticated(true);
    }

    // Register Service Worker for offline PWA support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch((err) => {
            console.warn('ServiceWorker registration failed: ', err);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('cs_auth_session', 'true');
    localStorage.setItem('cs_auth_session', 'true');
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
        <VoiceAssistant />
      </ToastProvider>
    </AppProvider>
  );
}
