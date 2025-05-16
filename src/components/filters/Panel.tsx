import React, { ReactNode } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface PanelProps {
  id: string;
  title: string;
  icon: ReactNode;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
  className?: string;
  count?: number;
}

/**
 * Reusable panel component with collapsible functionality
 * Used to create consistent UI sections throughout the filters page
 * Updated styling to match Schedule.tsx design patterns
 */
const Panel: React.FC<PanelProps> = ({
  id,
  title,
  icon,
  expanded,
  onToggle,
  children,
  className = '',
  count
}) => {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Panel Header - Aligned with guide's panel header style */}
      <div 
        className="bg-gray-50 dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer"
        onClick={() => onToggle(id)}
      >
        <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
          <span className="mr-2 text-primary-500">{icon}</span>
          {title}
          {count !== undefined && (
            <span className="ml-2 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              {count}
            </span>
          )}
        </h4>
        <div>
          {expanded ? (
            <FiChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <FiChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </div>
      </div>
      
      {/* Panel Content */}
      {expanded && (
        <div className="p-2 sm:p-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default Panel;