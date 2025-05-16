import React from 'react';
import { FiCalendar } from 'react-icons/fi';
import { WorkWeekDates } from './ScheduleTypes';

interface WeekNavigatorProps {
  workWeekDates: WorkWeekDates;
  onNavigate: (date: Date) => void;
  onGoToCurrentWeek: () => void;
}

const WeekNavigator: React.FC<WeekNavigatorProps> = ({ workWeekDates, onNavigate, onGoToCurrentWeek }) => {
  const navigatePrevious = () => {
    const newStart = new Date(workWeekDates.currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    onNavigate(newStart);
  };

  const navigateNext = () => {
    const newStart = new Date(workWeekDates.currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    onNavigate(newStart);
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
          <FiCalendar className="mr-2 text-primary-500" />
          <span className="text-lg">
            Week of {workWeekDates.currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </h3>
      </div>
      <div className="flex items-center gap-2">
        <button 
          className="flex items-center gap-1 py-1.5 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          onClick={navigatePrevious}
          title="Previous Week"
        >
          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button 
          className="flex items-center gap-1 py-1.5 px-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors" 
          onClick={onGoToCurrentWeek}
          title="Go to Current Week"
        >
          <FiCalendar className="h-4 w-4" />
          <span className="text-sm font-medium">Today</span>
        </button>
        <button 
          className="flex items-center gap-1 py-1.5 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors" 
          onClick={navigateNext}
          title="Next Week"
        >
          <span className="text-sm font-medium">Next Week</span> 
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default WeekNavigator;