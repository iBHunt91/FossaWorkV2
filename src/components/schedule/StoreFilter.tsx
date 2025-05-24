import React from 'react';
import { FiX } from 'react-icons/fi';
import { StoreFilter as StoreFilterType } from './ScheduleTypes';

interface StoreFilterProps {
  activeFilter: StoreFilterType;
  onFilterChange: (filter: StoreFilterType) => void;
}

const StoreFilter: React.FC<StoreFilterProps> = ({ activeFilter, onFilterChange }) => {
  const filters: { value: StoreFilterType; label: string; className: string; dotColor: string; borderColor: string }[] = [
    { 
      value: 'all', 
      label: 'All',
      className: 'bg-gray-100 dark:bg-gray-900/50 text-gray-800 dark:text-gray-300 font-medium border-gray-300 dark:border-gray-600',
      dotColor: 'bg-gray-400',
      borderColor: 'border-gray-400'
    },
    { 
      value: '7-eleven', 
      label: '7-Eleven',
      className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium border-green-500',
      dotColor: 'bg-green-500',
      borderColor: 'border-green-500'
    },
    { 
      value: 'circle-k', 
      label: 'Circle K',
      className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium border-red-500',
      dotColor: 'bg-red-500',
      borderColor: 'border-red-500'
    },
    { 
      value: 'wawa', 
      label: 'Wawa',
      className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium border-purple-500',
      dotColor: 'bg-purple-500',
      borderColor: 'border-purple-500'
    },
    { 
      value: 'other', 
      label: 'Other',
      className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium border-blue-500',
      dotColor: 'bg-blue-500',
      borderColor: 'border-blue-500'
    },
  ];

  return (
    <div className="bg-gray-50 dark:bg-gray-800/80 p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center flex-wrap gap-1 sm:gap-2">
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mr-1 sm:mr-2">Filter:</span>
        {filters.map(({ value, label, className, dotColor, borderColor }) => (
          <button 
            key={value} 
            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm flex items-center gap-1.5 transition-all border-2 ${
              activeFilter === value 
                ? `${className} ${borderColor}` 
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border-transparent'
            }`} 
            onClick={() => onFilterChange(value)}
          >
            {value !== 'all' && (
              <span className={`h-2 w-2 rounded-full ${dotColor}`}></span>
            )}
            {label}
          </button>
        ))}
      </div>
      {activeFilter !== 'all' && (
        <button 
          className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center" 
          onClick={() => onFilterChange('all')}
        >
          <FiX className="h-3.5 w-3.5 mr-1" /> Clear Filter
        </button>
      )}
    </div>
  );
};

export default StoreFilter;