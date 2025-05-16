import React, { useState } from 'react';
import { 
  FiCalendar, 
  FiChevronLeft, 
  FiChevronRight, 
  FiMap, 
  FiList 
} from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; // Ensure this is imported
import { GeocodedJob } from '../../types/job';

// Helper functions (initially copied from JobFilterContainer)
const getWeekStart = (date: Date = new Date()): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekEnd = (date: Date = new Date()): Date => {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

const formatWeekRange = (date: Date = new Date()): string => {
  const weekStart = getWeekStart(date);
  const weekEnd = getWeekEnd(date);
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const startYear = weekStart.getFullYear();
  const endYear = weekEnd.getFullYear();
  
  if (startYear !== endYear) {
    return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
  } else if (startMonth !== endMonth) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  } else {
    return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
  }
};

interface JobFilterHeaderProps {
  currentWeekDate: Date;
  setCurrentWeekDate: (date: Date) => void;
  allJobs?: GeocodedJob[]; // Made optional for dashboard use
  viewMode?: 'map' | 'list' | 'split'; // Made optional
  setViewMode?: (mode: 'map' | 'list') => void; // Made optional
  filteredJobsCount?: number; // Made optional
  totalJobsCount?: number; // Made optional
  usageContext?: 'dashboard' | 'jobMap'; // New prop
}

const JobFilterHeader: React.FC<JobFilterHeaderProps> = ({
  currentWeekDate,
  setCurrentWeekDate,
  allJobs = [], // Default to empty array
  viewMode = 'list', // Default value
  setViewMode = () => {}, // Default empty fn
  filteredJobsCount = 0, // Default value
  totalJobsCount = 0, // Default value
  usageContext = 'jobMap' // Default to jobMap for existing uses
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Navigate weeks
  const moveWeek = (weeks: number) => {
    const newDate = new Date(currentWeekDate);
    newDate.setDate(currentWeekDate.getDate() + (weeks * 7));
    setCurrentWeekDate(newDate);
  };

  // Jump to specific week
  const jumpToWeek = (date: Date) => {
    setCurrentWeekDate(date);
    setShowDatePicker(false);
  };
  
  const isCurrentWeek = () => {
    const today = new Date();
    const todayWeekStart = getWeekStart(today).getTime();
    const selectedWeekStart = getWeekStart(currentWeekDate).getTime();
    return todayWeekStart === selectedWeekStart;
  };

  const hasJobsAhead = () => {
    if (!allJobs || allJobs.length === 0) return false;
    const weekEnd = getWeekEnd(currentWeekDate);
    return allJobs.some(job => job.scheduledDate && new Date(job.scheduledDate) > weekEnd);
  };

  const hasJobsBefore = () => {
    if (!allJobs || allJobs.length === 0) return false;
    const weekStart = getWeekStart(currentWeekDate);
    return allJobs.some(job => job.scheduledDate && new Date(job.scheduledDate) < weekStart);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm ${usageContext === 'dashboard' ? 'rounded-lg' : ''}`}>
      <div className="container mx-auto flex items-center justify-between">
        {/* Week Navigator */}
        <div className="flex items-center gap-2">
          <button 
            className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
            onClick={() => moveWeek(-1)}
            disabled={!hasJobsBefore()}
            aria-label="Previous Week"
            title="Previous Week"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center px-4 py-2 gap-2 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-650 border border-gray-200 dark:border-gray-600"
              title="Select a different week"
            >
              <FiCalendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {formatWeekRange(currentWeekDate)}
              </span>
              {isCurrentWeek() && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md font-medium">
                  Current
                </span>
              )}
            </button>
            
            {showDatePicker && (
              <div className="absolute left-0 mt-1 z-30 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Week</h3>
                </div>
                <DatePicker
                  inline
                  selected={currentWeekDate}
                  onChange={(date: Date | null) => date && jumpToWeek(date)}
                  highlightDates={allJobs.map(job => job.scheduledDate ? new Date(job.scheduledDate) : null).filter(Boolean) as Date[]}
                  dayClassName={date => {
                    const hasJobsThisDay = allJobs.some(job => {
                      if (!job.scheduledDate) return false;
                      const jobDate = new Date(job.scheduledDate);
                      return jobDate.toDateString() === date.toDateString();
                    });
                    return hasJobsThisDay ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium" : "";
                  }}
                />
              </div>
            )}
          </div>
          
          <button 
            className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
            onClick={() => moveWeek(1)}
            disabled={!hasJobsAhead()}
            aria-label="Next Week"
            title="Next Week"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        {/* View Toggle - Only on mobile AND if not in dashboard context */}
        {usageContext !== 'dashboard' && (
          <div className="flex md:hidden">
            <div className="bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg flex space-x-0.5">
              <button
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'map' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                onClick={() => setViewMode('map')}
                aria-label="Map view"
                title="Map view"
              >
                <FiMap className="w-4 h-4" />
              </button>
              <button
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                onClick={() => setViewMode('list')}
                aria-label="List view"
                title="List view"
              >
                <FiList className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Count Stats - Only if not in dashboard context */}
        {usageContext !== 'dashboard' && (
          <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400">
            {filteredJobsCount > 0 ? (
              <div className="flex items-center">
                <span className="font-semibold text-gray-800 dark:text-gray-200 text-lg mr-1">
                  {filteredJobsCount}
                </span> 
                job{filteredJobsCount !== 1 && 's'} this week
              </div>
            ) : totalJobsCount > 0 ? (
              <span>No jobs scheduled this week</span>
            ) : (
              <span>No jobs available</span>
            )}
          </div>
        )}

        {/* If dashboard context, add a flexible spacer if no other elements are on the right */}
        {usageContext === 'dashboard' && (
          <div className="flex-grow"></div> // Acts as a spacer
        )}
      </div>
    </div>
  );
};

export default JobFilterHeader; 