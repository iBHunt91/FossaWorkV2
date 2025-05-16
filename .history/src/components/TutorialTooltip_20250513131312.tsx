import React, { useState, useRef, useEffect } from 'react';
import { FiHelpCircle, FiX } from 'react-icons/fi';

interface TutorialTooltipProps {
  content: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

const TutorialTooltip: React.FC<TutorialTooltipProps> = ({
  content,
  title,
  position = 'top',
  children,
  className = '',
  showIcon = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  
  // Handle clicks outside the tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isVisible &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);
  
  // Handle escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isVisible && event.key === 'Escape') {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isVisible]);
  
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 translate-y-2 mt-2',
    left: 'right-full top-1/2 transform -translate-x-2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform translate-x-2 -translate-y-1/2 ml-2',
  };
  
  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 -mt-[6px] border-t-amber-100 dark:border-t-amber-800 border-r-transparent border-b-transparent border-l-transparent',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 -mb-[6px] border-b-amber-100 dark:border-b-amber-800 border-r-transparent border-t-transparent border-l-transparent',
    left: 'left-full top-1/2 transform -translate-y-1/2 -ml-[6px] border-l-amber-100 dark:border-l-amber-800 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 transform -translate-y-1/2 -mr-[6px] border-r-amber-100 dark:border-r-amber-800 border-t-transparent border-b-transparent border-l-transparent',
  };
  
  return (
    <div className={`inline-flex relative ${className}`}>
      <div 
        ref={triggerRef} 
        className="cursor-pointer group inline-flex items-center"
        onClick={() => setIsVisible(!isVisible)}
      >
        {children}
        {showIcon && (
          <span className="ml-1 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300">
            <FiHelpCircle size={16} />
          </span>
        )}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]}`}
        >
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 p-3 rounded-lg shadow-lg max-w-xs w-64 text-sm">
            <div className="flex justify-between items-start mb-1">
              {title && <h4 className="font-semibold text-amber-800 dark:text-amber-300">{title}</h4>}
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 -mt-1 -mr-1"
              >
                <FiX size={16} />
              </button>
            </div>
            <p className="text-gray-700 dark:text-gray-300">{content}</p>
          </div>
          <div className={`absolute w-3 h-3 border-[6px] ${arrowClasses[position]}`}></div>
        </div>
      )}
    </div>
  );
};

export default TutorialTooltip; 