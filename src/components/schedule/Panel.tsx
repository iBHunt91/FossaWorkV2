import React from 'react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({ children, className = '', title, icon, action }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {title && (
        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
            {icon && <span className="mr-2">{icon}</span>}
            {title}
          </h3>
          {action && action}
        </div>
      )}
      {children}
    </div>
  );
};

export default Panel;