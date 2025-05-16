import React, { useState, useEffect } from 'react';
import { 
  FiCalendar, 
  FiChevronLeft, 
  FiChevronRight, 
  FiMap, 
  FiList, 
  FiInfo,
  FiMapPin
} from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { GeocodedJob } from '../../types/job';
import JobMap from './JobMap';
import JobList from './JobList';

interface JobFilterContainerProps {
  jobs: GeocodedJob[];
  className?: string;
}

const JobFilterContainer: React.FC<JobFilterContainerProps> = ({ jobs, className = '' }) => {
  // State for week navigation
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filteredJobs, setFilteredJobs] = useState<GeocodedJob[]>(jobs);
  const [selectedJob, setSelectedJob] = useState<GeocodedJob | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'split'>('split');
  
  // Helper functions for date calculations
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
  
  // Apply weekly filter to jobs
  useEffect(() => {
    const weekStart = getWeekStart(currentWeekDate);
    const weekEnd = getWeekEnd(currentWeekDate);
    
    const filtered = jobs.filter(job => {
      if (!job.scheduledDate) return false;
      
      const jobDate = new Date(job.scheduledDate);
      return jobDate >= weekStart && jobDate <= weekEnd;
    });
    
    setFilteredJobs(filtered);
  }, [jobs, currentWeekDate]);

  // If selected job is not in filtered jobs anymore, clear selection
  useEffect(() => {
    if (selectedJob && !filteredJobs.some(job => job.id === selectedJob.id)) {
      setSelectedJob(null);
    }
  }, [filteredJobs, selectedJob]);

  // Handle job selection
  const handleSelectJob = (job: GeocodedJob) => {
    setSelectedJob(job);
    
    // When in mobile view and a job is selected, switch to map if we're in list view
    if (viewMode === 'list' && window.innerWidth < 768) {
      setViewMode('map');
    }
  };
  
  // Helper functions for UI/UX
  const isCurrentWeek = () => {
    const today = new Date();
    const todayWeekStart = getWeekStart(today).getTime();
    const selectedWeekStart = getWeekStart(currentWeekDate).getTime();
    return todayWeekStart === selectedWeekStart;
  };
  
  const hasJobsAhead = () => {
    if (jobs.length === 0) return false;
    
    const weekEnd = getWeekEnd(currentWeekDate);
    return jobs.some(job => job.scheduledDate && new Date(job.scheduledDate) > weekEnd);
  };
  
  const hasJobsBefore = () => {
    if (jobs.length === 0) return false;
    
    const weekStart = getWeekStart(currentWeekDate);
    return jobs.some(job => job.scheduledDate && new Date(job.scheduledDate) < weekStart);
  };

  // Group jobs by day for the list view
  const jobsByDay = () => {
    const grouped: Record<string, GeocodedJob[]> = {};
    
    filteredJobs.forEach(job => {
      if (!job.scheduledDate) return;
      
      const dateStr = job.scheduledDate;
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(job);
    });
    
    // Convert to array and sort by date
    return Object.entries(grouped)
      .map(([date, jobs]) => ({ date, jobs }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };
  
  // Get day name (e.g., "Monday")
  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };
  
  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Navigation Header - Always visible */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm">
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
              
              {/* Date Picker Dropdown */}
              {showDatePicker && (
                <div className="absolute left-0 mt-1 z-30 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Week</h3>
                  </div>
                  <DatePicker
                    inline
                    selected={currentWeekDate}
                    onChange={(date: Date | null) => date && jumpToWeek(date)}
                    highlightDates={jobs.map(job => job.scheduledDate ? new Date(job.scheduledDate) : null).filter(Boolean) as Date[]}
                    dayClassName={date => {
                      const hasJobs = jobs.some(job => {
                        if (!job.scheduledDate) return false;
                        const jobDate = new Date(job.scheduledDate);
                        return jobDate.toDateString() === date.toDateString();
                      });
                      return hasJobs ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium" : "";
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
          
          {/* View Toggle - Only on mobile */}
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
          
          {/* Count Stats */}
          <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400">
            {filteredJobs.length > 0 ? (
              <div className="flex items-center">
                <span className="font-semibold text-gray-800 dark:text-gray-200 text-lg mr-1">
                  {filteredJobs.length}
                </span> 
                job{filteredJobs.length !== 1 && 's'} this week
              </div>
            ) : jobs.length > 0 ? (
              <span>No jobs scheduled this week</span>
            ) : (
              <span>No jobs available</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {/* Map Section */}
        {(viewMode === 'map' || viewMode === 'split') && (
          <div className={`
            ${viewMode === 'split' ? 'w-full md:w-2/3' : 'w-full'}
            ${viewMode === 'map' && viewMode !== 'split' ? 'h-full' : 'h-[60vh] md:h-auto'}
            relative
          `}>
            <JobMap 
              jobs={filteredJobs}
              selectedJob={selectedJob}
              onSelectJob={handleSelectJob}
            />
          </div>
        )}
        
        {/* Job List Section */}
        {(viewMode === 'list' || viewMode === 'split') && (
          <div className={`
            ${viewMode === 'split' ? 'w-full md:w-1/3 md:border-l border-gray-200 dark:border-gray-700' : 'w-full'}
            ${viewMode === 'list' && viewMode !== 'split' ? 'h-full' : 'h-[40vh] md:h-auto'}
            overflow-y-auto bg-white dark:bg-gray-800
          `}>
            {/* Mobile header */}
            <div className="md:hidden px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-gray-800 dark:text-gray-200">
                  {filteredJobs.length > 0 ? (
                    <>
                      <span className="font-bold">{filteredJobs.length}</span> job{filteredJobs.length !== 1 && 's'}
                    </>
                  ) : (
                    'No jobs'
                  )}
                </h3>
              </div>
            </div>
            
            {/* Job grouping by day */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredJobs.length > 0 ? (
                jobsByDay().map(({ date, jobs }) => (
                  <div key={date} className="bg-white dark:bg-gray-800">
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-750 sticky top-12 md:top-0 z-10">
                      <h3 className="font-medium text-gray-800 dark:text-gray-200">
                        {getDayName(date)}
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({jobs.length} job{jobs.length !== 1 && 's'})
                        </span>
                      </h3>
                    </div>
                    <JobList 
                      jobs={jobs}
                      selectedJob={selectedJob}
                      onSelectJob={handleSelectJob}
                    />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full mb-4">
                    <FiMapPin className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">No jobs scheduled</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-xs">
                    There are no jobs scheduled for the week of {formatWeekRange(currentWeekDate)}
                  </p>
                  
                  {jobs.length > 0 && (
                    <div className="mt-6 flex space-x-2">
                      {hasJobsBefore() && (
                        <button
                          onClick={() => moveWeek(-1)}
                          className="flex items-center px-3 py-2 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <FiChevronLeft className="mr-1 w-4 h-4" />
                          Previous Week
                        </button>
                      )}
                      
                      {hasJobsAhead() && (
                        <button
                          onClick={() => moveWeek(1)}
                          className="flex items-center px-3 py-2 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          Next Week
                          <FiChevronRight className="ml-1 w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobFilterContainer; 