import React from 'react';
import { FiList, FiCalendar, FiGrid } from 'react-icons/fi';
import { ViewMode } from './ScheduleTypes';

interface ViewSelectorProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const ViewSelector: React.FC<ViewSelectorProps> = ({ activeView, onViewChange }) => {
  const views: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'weekly', icon: <FiList />, label: 'Weekly' },
    { mode: 'calendar', icon: <FiCalendar />, label: 'Calendar' },
    { mode: 'compact', icon: <FiGrid />, label: 'Compact' },
  ];

  return (
    <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2">
      {views.map(({ mode, icon, label }) => (
        <button
          key={mode}
          onClick={() => onViewChange(mode)}
          className={`flex items-center gap-1.5 py-2 px-4 rounded-md text-sm font-medium transition-colors 
            ${activeView === mode 
              ? 'bg-primary-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
};

export default ViewSelector;