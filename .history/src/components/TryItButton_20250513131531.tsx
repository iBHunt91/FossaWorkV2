import React, { useState } from 'react';
import { FiPlayCircle, FiCheckCircle, FiLoader, FiAlertCircle, FiXCircle } from 'react-icons/fi';

interface TryItButtonProps {
  id: string; // Unique identifier for this interactive element
  label?: string;
  completedLabel?: string;
  action: () => Promise<void>;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  resetable?: boolean;
  onComplete?: () => void;
}

const TryItButton: React.FC<TryItButtonProps> = ({
  id,
  label = 'Try It',
  completedLabel = 'Completed',
  action,
  className = '',
  size = 'md',
  resetable = true,
  onComplete,
}) => {
  // Status can be: 'idle', 'loading', 'success', 'error'
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(() => {
    // Check local storage to see if this has been completed before
    return localStorage.getItem(`tryit_${id}_completed`) === 'true' ? 'success' : 'idle';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const handleAction = async () => {
    if (status === 'loading') return;
    
    // If it was successful and we're clicking again, reset if allowed
    if (status === 'success' && resetable) {
      setStatus('idle');
      localStorage.removeItem(`tryit_${id}_completed`);
      return;
    }
    
    setStatus('loading');
    setErrorMessage(null);
    
    try {
      await action();
      setStatus('success');
      localStorage.setItem(`tryit_${id}_completed`, 'true');
      if (onComplete) onComplete();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
      console.error('Try It action failed:', error);
    }
  };
  
  // Size variants
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };
  
  // Status variants
  const getButtonClasses = () => {
    const baseClasses = `${sizeClasses[size]} rounded font-medium flex items-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2`;
    
    switch (status) {
      case 'idle':
        return `${baseClasses} bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400`;
      case 'loading':
        return `${baseClasses} bg-blue-400 text-white cursor-not-allowed`;
      case 'success':
        return `${baseClasses} ${resetable ? 'bg-green-500 hover:bg-green-600' : 'bg-green-500'} text-white focus:ring-green-400`;
      case 'error':
        return `${baseClasses} bg-red-500 hover:bg-red-600 text-white focus:ring-red-400`;
    }
  };
  
  const getIcon = () => {
    switch (status) {
      case 'idle':
        return <FiPlayCircle className="mr-1.5" />;
      case 'loading':
        return <FiLoader className="mr-1.5 animate-spin" />;
      case 'success':
        return <FiCheckCircle className="mr-1.5" />;
      case 'error':
        return <FiAlertCircle className="mr-1.5" />;
    }
  };
  
  const getLabel = () => {
    switch (status) {
      case 'idle':
        return label;
      case 'loading':
        return 'Working...';
      case 'success':
        return resetable ? `${completedLabel} (Click to Reset)` : completedLabel;
      case 'error':
        return 'Failed - Try Again';
    }
  };
  
  return (
    <div className={`inline-block ${className}`}>
      <button
        onClick={handleAction}
        className={getButtonClasses()}
        disabled={status === 'loading'}
      >
        {getIcon()}
        {getLabel()}
      </button>
      
      {status === 'error' && errorMessage && (
        <div className="mt-2 text-xs text-red-500 flex items-start">
          <FiXCircle className="mr-1 mt-0.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

export default TryItButton; 