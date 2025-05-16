import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';
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
  // Default to current week
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filteredJobs, setFilteredJobs] = useState<GeocodedJob[]>(jobs);
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
  
  // Move week forward or backward
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
    
    // If filtered jobs are empty but we have jobs, move forward until we find jobs
    if (filtered.length === 0 && jobs.length > 0) {
      // Don't auto-advance, just show the empty state
    }
    
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
  };
  
  // Determine the current week status compared to today
  const isCurrentWeek = () => {
    const today = new Date();
    const todayWeekStart = getWeekStart(today).getTime();
    const selectedWeekStart = getWeekStart(currentWeekDate).getTime();
    return todayWeekStart === selectedWeekStart;
  };
  
  // Find week with jobs ahead of current selection
  const hasJobsAhead = () => {
    if (jobs.length === 0) return false;
    
    const weekEnd = getWeekEnd(currentWeekDate);
    return jobs.some(job => job.scheduledDate && new Date(job.scheduledDate) > weekEnd);
  };
  
  // Find week with jobs before current selection
  const hasJobsBefore = () => {
    if (jobs.length === 0) return false;
    
    const weekStart = getWeekStart(currentWeekDate);
    return jobs.some(job => job.scheduledDate && new Date(job.scheduledDate) < weekStart);
  };
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Weekly Navigation Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between">
          {/* Week Navigation Controls */}
          <div className="flex items-center space-x-1">
            <button 
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              onClick={() => moveWeek(-1)}
              disabled={!hasJobsBefore()}
              aria-label="Previous Week"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center px-4 py-2 space-x-2 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
              >
                <FiCalendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium">
                  {formatWeekRange(currentWeekDate)}
                </span>
                {isCurrentWeek() && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md">Current</span>
                )}
              </button>
              
              {showDatePicker && (
                <div className="absolute mt-1 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
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
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              onClick={() => moveWeek(1)}
              disabled={!hasJobsAhead()}
              aria-label="Next Week"
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* Week Stats */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredJobs.length > 0 ? (
              <span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{filteredJobs.length}</span> {filteredJobs.length === 1 ? 'job' : 'jobs'} this week
              </span>
            ) : jobs.length > 0 ? (
              <span>No jobs scheduled this week</span>
            ) : (
              <span>No jobs available</span>
            )}
          </div>
        </div>
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