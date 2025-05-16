import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

interface BeforeAfterProps {
  before: React.ReactNode;
  after: React.ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  direction?: 'horizontal' | 'vertical';
  showDivider?: boolean;
  showToggle?: boolean;
}

const BeforeAfterView: React.FC<BeforeAfterProps> = ({
  before,
  after,
  beforeLabel = 'Before',
  afterLabel = 'After',
  className = '',
  direction = 'horizontal',
  showDivider = true,
  showToggle = true,
}) => {
  const [showAfter, setShowAfter] = useState(true);
  
  // Determine container classes based on direction
  const containerClasses = direction === 'horizontal'
    ? 'flex flex-col md:flex-row'
    : 'flex flex-col';
    
  // Determine content classes based on direction
  const contentClasses = direction === 'horizontal'
    ? 'flex-1 p-4'
    : 'w-full p-4';
    
  // Determine divider classes based on direction
  const dividerClasses = direction === 'horizontal'
    ? 'border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700'
    : 'border-t border-gray-200 dark:border-gray-700';
    
  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 ${className}`}>
      {/* Header with toggle button */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Example Comparison
        </h3>
        {showToggle && (
          <button
            onClick={() => setShowAfter(!showAfter)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none flex items-center text-xs"
          >
            {showAfter ? (
              <>
                <FiEyeOff className="mr-1" /> Hide After
              </>
            ) : (
              <>
                <FiEye className="mr-1" /> Show After
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Content container */}
      <div className={containerClasses}>
        {/* Before content */}
        <div className={contentClasses}>
          <div className="mb-2 flex items-center">
            <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded">
              {beforeLabel}
            </span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/20 rounded p-3 border border-gray-100 dark:border-gray-800">
            {before}
          </div>
        </div>
        
        {/* Divider (if enabled) */}
        {showDivider && <div className={dividerClasses}></div>}
        
        {/* After content (conditionally shown) */}
        {showAfter && (
          <div className={contentClasses}>
            <div className="mb-2 flex items-center">
              <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                {afterLabel}
              </span>
            </div>
            <div className="bg-green-50 dark:bg-green-900/10 rounded p-3 border border-green-100 dark:border-green-800/30">
              {after}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BeforeAfterView; 