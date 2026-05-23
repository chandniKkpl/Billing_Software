import { useState, useCallback } from 'react';

let toastId = 0;
let setToastsGlobal = null;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  setToastsGlobal = setToasts;
  return (
    <>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}

export function showToast(msg, type = 'success', duration = 2500) {
  if (!setToastsGlobal) return;
  const id = ++toastId;
  setToastsGlobal(prev => [...prev, { id, msg, type }]);
  setTimeout(() => setToastsGlobal(prev => prev.filter(t => t.id !== id)), duration);
}
