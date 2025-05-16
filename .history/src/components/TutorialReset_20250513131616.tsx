import React, { useState } from 'react';
import { FiRefreshCw, FiCheck, FiLoader, FiAlertCircle } from 'react-icons/fi';

interface TutorialResetProps {
  className?: string;
  variant?: 'button' | 'link';
  size?: 'sm' | 'md' | 'lg';
  onReset?: () => void;
  showConfirmation?: boolean;
}

const TutorialReset: React.FC<TutorialResetProps> = ({
  className = '',
  variant = 'button',
  size = 'md',
  onReset,
  showConfirmation = true,
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // Size variants for buttons
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };
  
  const handleReset = async () => {
    setStatus('loading');
    
    try {
      // Clear all localStorage items that start with 'tutorial_', 'tryit_', 'feature_', or 'tour_'
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tutorial_') || key.startsWith('tryit_') || 
            key.startsWith('feature_') || key.startsWith('tour_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Use the fetch API to trigger a server-side reset
      const response = await fetch('/api/reset-tutorial-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset tutorial data');
      }
      
      setStatus('success');
      
      // Call onReset callback if provided
      if (onReset) {
        onReset();
      }
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Failed to reset tutorial data:', error);
      setStatus('error');
      
      // Reset back to idle after a delay
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  };
  
  const handleClick = () => {
    if (showConfirmation) {
      setShowDialog(true);
    } else {
      handleReset();
    }
  };
  
  // For the button styling
  const getButtonClasses = () => {
    const baseClasses = `${sizeClasses[size]} rounded font-medium inline-flex items-center justify-center transition-all`;
    
    if (variant === 'link') {
      return `${baseClasses} text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline focus:outline-none`;
    }
    
    switch (status) {
      case 'idle':
        return `${baseClasses} bg-primary-100 dark:bg-primary-900/50 hover:bg-primary-200 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700`;
      case 'loading':
        return `${baseClasses} bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 opacity-75 cursor-not-allowed`;
      case 'success':
        return `${baseClasses} bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800`;
      case 'error':
        return `${baseClasses} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800`;
    }
  };
  
  // Get the appropriate icon based on status
  const getIcon = () => {
    switch (status) {
      case 'idle':
        return <FiRefreshCw className="mr-1.5" />;
      case 'loading':
        return <FiLoader className="mr-1.5 animate-spin" />;
      case 'success':
        return <FiCheck className="mr-1.5" />;
      case 'error':
        return <FiAlertCircle className="mr-1.5" />;
    }
  };
  
  // Get the appropriate text based on status
  const getText = () => {
    switch (status) {
      case 'idle':
        return 'Reset Tutorial Data';
      case 'loading':
        return 'Resetting...';
      case 'success':
        return 'Reset Complete';
      case 'error':
        return 'Reset Failed';
    }
  };
  
  return (
    <>
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className={`${getButtonClasses()} ${className}`}
        aria-label="Reset tutorial data"
      >
        {getIcon()}
        {getText()}
      </button>
      
      {/* Confirmation Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6 mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Reset Tutorial Data
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              This will restore all tutorial data to its original state and clear any progress
              you've made. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDialog(false);
                  handleReset();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TutorialReset; 