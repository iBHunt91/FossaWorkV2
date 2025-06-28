import { useState, useCallback } from 'react';
import { ToastItem, ToastType } from '../components/ToastContainer';

let toastCounter = 0;

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((
    type: ToastType,
    title: string,
    message?: string,
    duration?: number
  ) => {
    const id = `toast-${++toastCounter}`;
    const newToast: ToastItem = {
      id,
      type,
      title,
      message,
      duration
    };
    
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = {
    success: (title: string, message?: string, duration?: number) => 
      addToast('success', title, message, duration),
    error: (title: string, message?: string, duration?: number) => 
      addToast('error', title, message, duration),
    warning: (title: string, message?: string, duration?: number) => 
      addToast('warning', title, message, duration),
    info: (title: string, message?: string, duration?: number) => 
      addToast('info', title, message, duration),
  };

  return {
    toasts,
    toast,
    removeToast
  };
};