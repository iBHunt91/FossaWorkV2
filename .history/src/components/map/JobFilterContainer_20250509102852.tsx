import React, { useState, useEffect } from 'react';
import { FiCalendar, FiX } from 'react-icons/fi';
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
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filteredJobs, setFilteredJobs] = useState<GeocodedJob[]>(jobs);
  const [activeFilter, setActiveFilter] = useState<'day' | 'week' | 'all'>('all');
  const [selectedJob, setSelectedJob] = useState<GeocodedJob | null>(null);
  
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
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };
  
  const moveWeek = (weeks: number) => {
    const currentDate = dateFilter || new Date();
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setDateFilter(newDate);
    setActiveFilter('week');
  };
  
  // Apply date filter to jobs
  useEffect(() => {
    if (!dateFilter) {
      setFilteredJobs(jobs);
      return;
    }
    
    let filtered: GeocodedJob[];
    
    if (activeFilter === 'day') {
      // Filter by specific day
      const filterDate = new Date(dateFilter);
      // Reset time to start of day for comparison
      filterDate.setHours(0, 0, 0, 0);
      
      filtered = jobs.filter(job => {
        if (!job.scheduledDate) return false;
        
        const jobDate = new Date(job.scheduledDate);
        jobDate.setHours(0, 0, 0, 0);
        
        return jobDate.getTime() === filterDate.getTime();
      });
    } else if (activeFilter === 'week') {
      // Filter by week
      const weekStart = getWeekStart(dateFilter);
      const weekEnd = getWeekEnd(dateFilter);
      
      filtered = jobs.filter(job => {
        if (!job.scheduledDate) return false;
        
        const jobDate = new Date(job.scheduledDate);
        return jobDate >= weekStart && jobDate <= weekEnd;
      });
    } else {
      // Show all jobs
      filtered = jobs;
    }
    
    setFilteredJobs(filtered);
    console.log(`Filtered jobs from ${jobs.length} to ${filtered.length} for ${activeFilter} filter`);
  }, [jobs, dateFilter, activeFilter]);

  // If selected job is not in filtered jobs anymore, clear selection
  useEffect(() => {
    if (selectedJob && !filteredJobs.some(job => job.id === selectedJob.id)) {
      setSelectedJob(null);
    }
  }, [filteredJobs, selectedJob]);

  // Handle job selection
  const handleSelectJob = (job: GeocodedJob) => {
    setSelectedJob(job);
  };
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Date Filter Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Filter Type Buttons */}
          <div className="flex space-x-2">
            <button 
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${activeFilter === 'day' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
              onClick={() => {
                setDateFilter(dateFilter || new Date());
                setActiveFilter('day');
              }}
            >
              Day
            </button>
            <button 
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${activeFilter === 'week' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
              onClick={() => {
                setDateFilter(dateFilter || new Date());
                setActiveFilter('week');
              }}
            >
              Week
            </button>
            <button 
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${activeFilter === 'all' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
              onClick={() => {
                setDateFilter(null);
                setActiveFilter('all');
              }}
            >
              All Jobs
            </button>
          </div>
          
          {/* Week Navigation - Shows only when week filter is active */}
          {activeFilter === 'week' && (
            <div className="flex items-center space-x-4 ml-0 md:ml-4">
              <button 
                className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                onClick={() => moveWeek(-1)}
              >
                &larr; Prev Week
              </button>
              <span className="text-sm font-medium">
                {dateFilter ? formatWeekRange(dateFilter) : formatWeekRange(new Date())}
              </span>
              <button 
                className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                onClick={() => moveWeek(1)}
              >
                Next Week &rarr;
              </button>
            </div>
          )}
          
          {/* Date Display/Picker */}
          <div className="ml-0 md:ml-auto flex items-center">
            <div className="relative">
              <button 
                className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-md ${showDateFilter ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                onClick={() => setShowDateFilter(!showDateFilter)}
              >
                <FiCalendar className="h-3.5 w-3.5" />
                <span>
                  {activeFilter === 'day' && dateFilter 
                    ? dateFilter.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) 
                    : 'Choose Date'
                  }
                </span>
              </button>
              
              {/* Date Picker Popover */}
              {showDateFilter && (
                <div className="absolute right-0 mt-1 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
                  <DatePicker
                    inline
                    selected={dateFilter || new Date()}
                    onChange={(date: Date | null) => {
                      setDateFilter(date);
                      setShowDateFilter(false);
                      setActiveFilter('day');
                    }}
                    highlightDates={jobs.map(job => job.scheduledDate ? new Date(job.scheduledDate) : null).filter(Boolean) as Date[]}
                    dayClassName={date => {
                      // Highlight days that have jobs
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
            
            {/* Clear Filter */}
            {activeFilter !== 'all' && (
              <button
                onClick={() => {
                  setDateFilter(null);
                  setActiveFilter('all');
                }}
                className="ml-2 text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
              >
                <FiX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Filter Status */}
        {activeFilter !== 'all' && filteredJobs.length !== jobs.length && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Showing {filteredJobs.length} of {jobs.length} jobs 
            {activeFilter === 'day' && dateFilter ? ` for ${dateFilter.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'})}` : ''}
            {activeFilter === 'week' && dateFilter ? ` for week of ${getWeekStart(dateFilter).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}` : ''}
          </div>
        )}
      </div>
      
      {/* Layout for Map and List */}
      <div className="flex flex-col md:flex-row flex-grow h-full overflow-hidden">
        {/* Map Section - Takes 2/3 of the space on larger screens */}
        <div className="relative w-full md:w-2/3 h-96 md:h-auto">
          <JobMap 
            jobs={filteredJobs}
            selectedJob={selectedJob}
            onSelectJob={handleSelectJob}
          />
        </div>
        
        {/* Job List Section - Takes 1/3 of the space on larger screens */}
        <div className="w-full md:w-1/3 overflow-y-auto border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700">
          <JobList 
            jobs={filteredJobs}
            selectedJob={selectedJob}
            onSelectJob={handleSelectJob}
          />
        </div>
      </div>
    </div>
  );
};

export default JobFilterContainer; 