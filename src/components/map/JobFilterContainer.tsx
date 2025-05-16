import React, { useState, useEffect } from 'react';
import { 
  FiChevronLeft, 
  FiChevronRight, 
  FiInfo,
  FiMapPin
} from 'react-icons/fi';
import 'react-datepicker/dist/react-datepicker.css';
import { GeocodedJob } from '../../types/job';
import JobMap from './JobMap';
import JobList from './JobList';
import JobFilterHeader from './JobFilterHeader';

interface JobFilterContainerProps {
  jobs: GeocodedJob[];
  className?: string;
}

const JobFilterContainer: React.FC<JobFilterContainerProps> = ({ jobs, className = '' }) => {
  // State for week navigation
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
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
  
  // Re-add formatWeekRange for the empty state text
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

  // Re-add for empty state navigation
  const moveWeekInContainer = (weeks: number) => {
    const newDate = new Date(currentWeekDate);
    newDate.setDate(currentWeekDate.getDate() + (weeks * 7));
    setCurrentWeekDate(newDate);
  };

  const hasJobsAheadInContainer = () => {
    if (jobs.length === 0) return false;
    const weekEnd = getWeekEnd(currentWeekDate);
    return jobs.some(job => job.scheduledDate && new Date(job.scheduledDate) > weekEnd);
  };
  
  const hasJobsBeforeInContainer = () => {
    if (jobs.length === 0) return false;
    const weekStart = getWeekStart(currentWeekDate);
    return jobs.some(job => job.scheduledDate && new Date(job.scheduledDate) < weekStart);
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
      <JobFilterHeader 
        currentWeekDate={currentWeekDate}
        setCurrentWeekDate={setCurrentWeekDate}
        allJobs={jobs}
        viewMode={viewMode}
        setViewMode={setViewMode as (mode: 'map' | 'list') => void}
        filteredJobsCount={filteredJobs.length}
        totalJobsCount={jobs.length}
      />
      
      {/* Content Area */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {/* Map Section */}
        {(viewMode === 'map' || viewMode === 'split') && (
          <div className={`
            ${viewMode === 'split' ? 'w-full md:w-2/3' : 'w-full'}
            ${viewMode === 'map' ? 'h-full' : 'h-[60vh] md:h-auto'}
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
            ${viewMode === 'list' ? 'h-full' : 'h-[40vh] md:h-auto'}
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
                      {hasJobsBeforeInContainer() && (
                        <button
                          onClick={() => moveWeekInContainer(-1)}
                          className="flex items-center px-3 py-2 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <FiChevronLeft className="mr-1 w-4 h-4" />
                          Previous Week
                        </button>
                      )}
                      
                      {hasJobsAheadInContainer() && (
                        <button
                          onClick={() => moveWeekInContainer(1)}
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