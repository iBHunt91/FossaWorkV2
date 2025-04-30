import { useCallback } from 'react';
import { useToast } from '../context/ToastContext';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  duration?: number;
  preventDuplicates?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

/**
 * Enhanced hook for handling toast notifications throughout the app
 * Provides standardized message formats for common operations
 */
export const useToastNotification = () => {
  const { addToast, removeToast, clearToasts } = useToast();

  // Generic toast notification with standard options
  const showToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions) => {
      return addToast(type, message, options);
    },
    [addToast]
  );

  // Success notifications
  const showSuccess = useCallback(
    (message: string, options?: ToastOptions) => {
      return addToast('success', message, options?.duration);
    },
    [addToast]
  );

  // Error notifications
  const showError = useCallback(
    (message: string, options?: ToastOptions) => {
      return addToast('error', message, options?.duration);
    },
    [addToast]
  );

  // Info notifications
  const showInfo = useCallback(
    (message: string, options?: ToastOptions) => {
      return addToast('info', message, options?.duration);
    },
    [addToast]
  );

  // Warning notifications
  const showWarning = useCallback(
    (message: string, options?: ToastOptions) => {
      return addToast('warning', message, options?.duration);
    },
    [addToast]
  );

  // Standardized notifications for common actions
  const notifyActionStarted = useCallback(
    (action: string, options?: ToastOptions) => {
      return addToast('info', `Starting ${action}...`, options);
    },
    [addToast]
  );

  const notifyActionCompleted = useCallback(
    (action: string, options?: ToastOptions) => {
      return addToast('success', `${action} completed successfully`, options);
    },
    [addToast]
  );

  const notifyActionFailed = useCallback(
    (action: string, error: unknown, options?: ToastOptions) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return addToast('error', `${action} failed: ${errorMessage}`, options);
    },
    [addToast]
  );

  // Data-related notifications
  const notifyDataLoaded = useCallback(
    (itemType: string, count: number, options?: ToastOptions) => {
      return addToast(
        'success', 
        `Loaded ${count} ${itemType}${count !== 1 ? 's' : ''}`, 
        options
      );
    },
    [addToast]
  );

  const notifyFilterApplied = useCallback(
    (filter: string, count: number, options?: ToastOptions) => {
      return addToast(
        'info', 
        `Found ${count} item${count !== 1 ? 's' : ''} for ${filter}`, 
        options
      );
    },
    [addToast]
  );

  const notifyNavigated = useCallback(
    (destination: string, options?: ToastOptions) => {
      return addToast('info', `Showing ${destination}`, { ...options, duration: 2000 });
    },
    [addToast]
  );

  return {
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    notifyActionStarted,
    notifyActionCompleted,
    notifyActionFailed,
    notifyDataLoaded,
    notifyFilterApplied,
    notifyNavigated,
    removeToast,
    clearToasts
  };
};

export default useToastNotification; 