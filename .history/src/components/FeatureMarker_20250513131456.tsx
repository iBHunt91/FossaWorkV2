import React, { useState } from 'react';
import { FiBell, FiX } from 'react-icons/fi';

interface FeatureMarkerProps {
  id: string;
  title: string;
  description: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  icon?: React.ReactNode;
  dismissable?: boolean;
  onDismiss?: () => void;
}

const FeatureMarker: React.FC<FeatureMarkerProps> = ({
  id,
  title,
  description,
  position = 'top-right',
  className = '',
  icon,
  dismissable = true,
  onDismiss,
}) => {
  const [expanded, setExpanded] = useState(false);
  
  // Check if this feature has been seen
  const localStorageKey = `feature_${id}_seen`;
  const [seen, setSeen] = useState(() => {
    return localStorage.getItem(localStorageKey) === 'true';
  });
  
  if (seen) {
    return null;
  }
  
  const handleDismiss = () => {
    if (dismissable) {
      localStorage.setItem(localStorageKey, 'true');
      setSeen(true);
      if (onDismiss) onDismiss();
    }
  };
  
  // Position classes
  const positionClasses = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'bottom-right': 'bottom-0 right-0',
  };
  
  return (
    <div className={`absolute z-10 m-2 ${positionClasses[position]} ${className}`}>
      {expanded ? (
        <div className="bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800 rounded-lg shadow-lg p-3 animate-fadeIn max-w-[250px]">
          <div className="flex justify-between items-start">
            <h4 className="font-medium text-primary-800 dark:text-primary-300 flex items-center">
              {icon || <FiBell className="mr-1.5 text-primary-600 dark:text-primary-400" />}
              {title}
            </h4>
            {dismissable && (
              <button
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 -mr-1 -mt-1"
              >
                <FiX size={16} />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {description}
          </p>
          <div className="flex justify-end mt-2">
            <button
              onClick={() => setExpanded(false)}
              className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-800 text-primary-800 dark:text-primary-200 rounded hover:bg-primary-200 dark:hover:bg-primary-700"
            >
              Got it
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => setExpanded(true)}
          className="h-6 w-6 flex items-center justify-center bg-primary-500 hover:bg-primary-600 text-white rounded-full cursor-pointer shadow-md animate-pulse"
        >
          <span className="text-xs font-bold">!</span>
        </div>
      )}
    </div>
  );
};

export default FeatureMarker; 