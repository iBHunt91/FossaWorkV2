import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { FiInfo, FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  duration?: number;
  preventDuplicates?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  position: string;
  createdAt: number;
}

interface ToastContextType {
  toasts: ToastProps[];
  addToast: (type: ToastType, message: string, durationOrOptions?: number | ToastOptions) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  // Clean up toasts after their duration expires
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts(currentToasts => 
        currentToasts.filter(toast => {
          // Keep toasts with Infinity duration or those that haven't expired
          return toast.duration === Infinity || now - toast.createdAt < toast.duration;
        })
      );
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const addToast = useCallback((type: ToastType, message: string, durationOrOptions?: number | ToastOptions) => {
    const now = Date.now();
    
    // Default options
    let duration = 5000;
    let preventDuplicates = true;
    let position = 'bottom-right';
    
    // Parse options
    if (typeof durationOrOptions === 'number') {
      duration = durationOrOptions;
    } else if (durationOrOptions) {
      duration = durationOrOptions.duration ?? 5000;
      preventDuplicates = durationOrOptions.preventDuplicates ?? true;
      position = durationOrOptions.position ?? 'bottom-right';
    }
    
    setToasts(prev => {
      // Check for duplicates if preventDuplicates is enabled
      if (preventDuplicates) {
        const isDuplicate = prev.some(toast => 
          toast.type === type && toast.message === message && now - toast.createdAt < 3000
        );
        
        if (isDuplicate) {
          return prev;
        }
      }
      
      const id = Math.random().toString(36).substring(2, 9);
      return [...prev, { id, type, message, duration, position, createdAt: now }];
    });
  }, [setToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, [setToasts]);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, [setToasts]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{
  toasts: ToastProps[];
  removeToast: (id: string) => void;
}> = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  // Group toasts by position
  const positionMap: Record<string, ToastProps[]> = {};
  toasts.forEach(toast => {
    if (!positionMap[toast.position]) {
      positionMap[toast.position] = [];
    }
    positionMap[toast.position].push(toast);
  });

  // Render toast groups by position
  return (
    <>
      {Object.entries(positionMap).map(([position, positionToasts]) => {
        const positionClass = getPositionClass(position);
        
        return (
          <div key={position} className={`fixed ${positionClass} z-50 flex flex-col gap-2 transition-all`}>
            {positionToasts.map(toast => (
              <Toast key={toast.id} toast={toast} removeToast={removeToast} />
            ))}
          </div>
        );
      })}
    </>
  );
};

const getPositionClass = (position: string): string => {
  switch (position) {
    case 'top-right':
      return 'top-4 right-4';
    case 'top-left':
      return 'top-4 left-4';
    case 'bottom-left':
      return 'bottom-4 left-4';
    case 'bottom-center':
      return 'bottom-4 left-1/2 transform -translate-x-1/2';
    case 'top-center':
      return 'top-4 left-1/2 transform -translate-x-1/2';
    case 'bottom-right':
    default:
      return 'bottom-4 right-4';
  }
};

const Toast: React.FC<{
  toast: ToastProps;
  removeToast: (id: string) => void;
}> = ({ toast, removeToast }) => {
  const { id, type, message } = toast;

  const bgColor = {
    success: 'bg-green-100/90 dark:bg-green-800/80 border-green-500',
    error: 'bg-red-100/90 dark:bg-red-800/80 border-red-500',
    warning: 'bg-amber-100/90 dark:bg-amber-800/80 border-amber-500',
    info: 'bg-blue-100/90 dark:bg-blue-800/80 border-blue-500',
  };

  const textColor = {
    success: 'text-green-800 dark:text-green-100',
    error: 'text-red-800 dark:text-red-100',
    warning: 'text-amber-800 dark:text-amber-100',
    info: 'text-blue-800 dark:text-blue-100',
  };

  const icons = {
    success: <FiCheckCircle className="h-5 w-5" />,
    error: <FiAlertCircle className="h-5 w-5" />,
    warning: <FiAlertCircle className="h-5 w-5" />,
    info: <FiInfo className="h-5 w-5" />,
  };

  return (
    <div
      className={`flex w-80 items-center justify-between rounded-lg border-l-4 p-4 shadow-lg backdrop-blur-sm animate-fadeIn ${bgColor[type]}`}
      role="alert"
    >
      <div className="flex items-center">
        <span className={`mr-2 ${textColor[type]}`}>{icons[type]}</span>
        <span className={`text-sm font-medium ${textColor[type]}`}>{message}</span>
      </div>
      <button
        onClick={() => removeToast(id)}
        className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full ${textColor[type]} hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none`}
        aria-label="Close"
      >
        <FiX className="h-4 w-4" />
      </button>
    </div>
  );
}; 