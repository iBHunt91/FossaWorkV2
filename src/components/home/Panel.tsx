import React from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';

interface PanelProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: (id: string) => void;
}

const Panel: React.FC<PanelProps> = ({ id, title, icon, children, expanded, onToggle }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        className="px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
        onClick={() => onToggle(id)}
      >
        <div className="flex items-center space-x-2">
          <span className="text-primary-600 dark:text-primary-400">{icon}</span>
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          {expanded ? (
            <FiChevronDown className="h-5 w-5" />
          ) : (
            <FiChevronRight className="h-5 w-5" />
          )}
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
};

export default Panel;
