import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Toast.css';
import { HiCheckCircle, HiExclamationCircle, HiInformationCircle, HiX } from 'react-icons/hi';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = ({ type = 'success', title, subtitle, duration = 3000 }) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, title, subtitle }]);
    setTimeout(() => removeToast(id), duration);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const icons = {
    success: <HiCheckCircle className="toast-icon text-success" />,
    error: <HiExclamationCircle className="toast-icon text-danger" />,
    warning: <HiExclamationCircle className="toast-icon text-warning" />,
    info: <HiInformationCircle className="toast-icon text-info" />
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              className={`toast-item toast-${toast.type}`}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="toast-content">
                {icons[toast.type]}
                <div className="toast-text">
                  <div className="toast-title">{toast.title}</div>
                  {toast.subtitle && <div className="toast-subtitle">{toast.subtitle}</div>}
                </div>
              </div>
              <button className="toast-close-btn" onClick={() => removeToast(toast.id)}>
                <HiX />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
