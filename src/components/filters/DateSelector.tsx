import React from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { WorkWeekDateRanges } from './FilterTypes';
import FilterUtils from './FilterUtils';

interface DateSelectorProps {
  currentWeek: Date;
  setCurrentWeek: React.Dispatch<React.SetStateAction<Date>>;
  dateRanges: WorkWeekDateRanges;
}

/**
 * Component for selecting and navigating dates
 * Allows users to select specific weeks and navigate between weeks
 * Updated styling to match Schedule.tsx design patterns
 */
const DateSelector: React.FC<DateSelectorProps> = ({ 
  currentWeek, 
  setCurrentWeek,
  dateRanges
}) => {
  // Go to previous week
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(currentWeek.getDate() - 7);
    setCurrentWeek(newDate);
  };

  // Go to next week
  const goToNextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(currentWeek.getDate() + 7);
    setCurrentWeek(newDate);
  };

  // Reset to current week
  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  // Handle date change from date picker
  const handleDateChange = (date: Date) => {
    setCurrentWeek(date);
  };

  return (
    <div className="flex items-center space-x-2">
      <button 
        className="p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
        onClick={goToPreviousWeek} 
        title="Previous Week"
      >
        <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <div className="relative">
        <DatePicker
          selected={currentWeek}
          onChange={handleDateChange}
          dateFormat="MMM d, yyyy"
          className="p-2 pr-10 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
        />
        <FiCalendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
      </div>
      
      <button
        onClick={goToCurrentWeek}
        className="px-2 sm:px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs sm:text-sm font-medium transition-colors hover:bg-primary-200 dark:hover:bg-primary-800/50"
      >
        Today
      </button>
      
      <button 
        className="p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
        onClick={goToNextWeek} 
        title="Next Week"
      >
        <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      
      <div className="hidden md:block text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium">Week: </span>
        {FilterUtils.formatDateRange(dateRanges.currentWeekStart, dateRanges.currentWeekEnd)}
      </div>
    </div>
  );
};

export default DateSelector;