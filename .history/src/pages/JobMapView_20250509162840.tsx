import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiMapPin, FiFilter, FiRefreshCw, FiList, FiMap, FiX, FiCalendar } from 'react-icons/fi';
import JobMap from '../components/map/JobMap';
import JobList from '../components/map/JobList';
import { fetchJobs } from '../services/jobService';
import { GeocodedJob } from '../types/job';
import { format, addDays, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

const JobMapView: React.FC = () => {
  const [jobs, setJobs] = useState<GeocodedJob[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<GeocodedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<GeocodedJob | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [displayedDate, setDisplayedDate] = useState<Date>(new Date());

  // Helper to format date range for display
  const formatDateRange = (start: Date, end: Date): string => {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  const currentWeekStart = startOfWeek(displayedDate, { weekStartsOn: 0 });
  const currentWeekEnd = endOfWeek(displayedDate, { weekStartsOn: 0 });

  const handlePreviousWeek = () => {
    setDisplayedDate(prevDate => subDays(prevDate, 7));
  };

  const handleNextWeek = () => {
    setDisplayedDate(prevDate => addDays(prevDate, 7));
  };

  const handleToday = () => {
    setDisplayedDate(new Date());
  };

  // Fetch jobs on component mount
  useEffect(() => {
    const getJobs = async () => {
      try {
        setIsLoading(true);
        const jobData = await fetchJobs();
        setJobs(jobData);
        setFilteredJobs(jobData);
        
        // Auto-select first job if available
        if (jobData.length > 0 && !selectedJob) {
          setSelectedJob(jobData[0]);
        }
      } catch (err) {
        setError('Failed to fetch job data. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    getJobs();
  }, []);

  // Refresh jobs data
  const refreshJobs = async () => {
    try {
      setIsRefreshing(true);
      const jobData = await fetchJobs();
      setJobs(jobData);
      
      // Preserve selected job if it still exists
      if (selectedJob) {
        const stillExists = jobData.find((job: GeocodedJob) => job.id === selectedJob.id);
        if (!stillExists && jobData.length > 0) {
          setSelectedJob(jobData[0]);
        }
      } else if (jobData.length > 0) {
        setSelectedJob(jobData[0]);
      }
    } catch (err) {
      setError('Failed to refresh job data. Please try again later.');
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter jobs based on week
  const applyFilters = useCallback(() => {
    if (!jobs.length) return;
    
    // Filter jobs for the currently displayed week
    const weekStart = startOfWeek(displayedDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(displayedDate, { weekStartsOn: 0 });
    
    const filteredByDate = jobs.filter(job => {
      const jobDate = new Date(job.scheduledDate);
      return jobDate >= weekStart && jobDate <= weekEnd;
    });
    
    setFilteredJobs(filteredByDate);
  }, [jobs, displayedDate]);

  // Apply filter when any filter changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Handle job selection (either from map or list)
  const handleJobSelect = useCallback((job: GeocodedJob) => {
    setSelectedJob(job);
  }, []);

  // Memoize jobs for the map, ensuring they have coordinates
  const jobsForMap = useMemo(() => {
    return filteredJobs.filter(job => job.coordinates && typeof job.coordinates.latitude === 'number' && typeof job.coordinates.longitude === 'number');
  }, [filteredJobs]);

  // Toggle view mode
  const toggleViewMode = (mode: 'split' | 'map' | 'list') => {
    setViewMode(mode);
  };

  // Toggle filter panel
  const toggleFilter = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FiRefreshCw className="h-10 w-10 mx-auto mb-4 text-primary-500 animate-spin" />
            <p className="text-gray-700 dark:text-gray-300">Loading job map...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <FiRefreshCw className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="mb-4">{error}</p>
          <button 
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md"
            onClick={refreshJobs}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 text-white rounded-xl shadow-lg mb-6 flex flex-col overflow-hidden border border-gray-700 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between p-4 gap-3">
          <div className="flex items-center gap-2">
            <FiMapPin className="text-primary-400 h-5 w-5" />
            <h1 className="text-lg font-semibold">Job Map</h1>
            <span className="text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2.5 py-0.5 rounded-md ml-2">
              {filteredJobs.length} jobs
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Week Navigation Controls */}
            <div className="flex items-center gap-1 bg-[#2d3c55] p-1 rounded-md">
              <button
                onClick={handlePreviousWeek}
                className="px-2 py-1 text-gray-300 hover:bg-[#3a4a66] rounded-md"
                title="Previous Week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 text-sm text-gray-300 hover:bg-[#3a4a66] rounded-md whitespace-nowrap"
                title="Current Week"
              >
                Today
              </button>
              <button
                onClick={handleNextWeek}
                className="px-2 py-1 text-gray-300 hover:bg-[#3a4a66] rounded-md"
                title="Next Week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="text-sm text-gray-300 whitespace-nowrap">
              {formatDateRange(currentWeekStart, currentWeekEnd)}
            </div>

            <button
              onClick={refreshJobs}
              className="px-3 py-1.5 flex items-center gap-1 bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66] rounded-md"
              disabled={isRefreshing}
            >
              <FiRefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Filter Panel - conditionally rendered */}
      {isFilterOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <FiCalendar className="mr-2 text-primary-500" />
              Date Filters
            </h3>
            <button 
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={toggleFilter}
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
          
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDateFilter('day')}
                className={`px-4 py-2 rounded-md ${
                  dateFilter === 'day' 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-4 py-2 rounded-md ${
                  dateFilter === 'week' 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setDateFilter('month')}
                className={`px-4 py-2 rounded-md ${
                  dateFilter === 'month' 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setDateFilter('year')}
                className={`px-4 py-2 rounded-md ${
                  dateFilter === 'year' 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                This Year
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-4 py-2 rounded-md ${
                  dateFilter === 'all' 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All Jobs
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div className={`grid grid-cols-1 ${viewMode === 'split' ? 'lg:grid-cols-3 gap-6' : 'gap-0'}`}>
        {(viewMode === 'split' || viewMode === 'list') && (
          <div className={`${viewMode === 'split' ? 'lg:col-span-1' : 'w-full'} flex flex-col gap-6`}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden flex-1">
              <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <FiList className="mr-2 text-primary-500" />
                  Job List
                </h3>
              </div>
              
              <div className="overflow-y-auto max-h-[600px]">
                <JobList 
                  jobs={filteredJobs}
                  selectedJob={selectedJob}
                  onSelectJob={handleJobSelect}
                />
              </div>
            </div>
          </div>
        )}
        
        {(viewMode === 'split' || viewMode === 'map') && (
          <div className={`${viewMode === 'split' ? 'lg:col-span-2' : 'w-full'} bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden`}>
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                <FiMapPin className="mr-2 text-primary-500" />
                Map View
              </h3>
            </div>
            
            <div className="h-[700px] relative">
              <JobMap 
                jobs={jobsForMap} 
                selectedJob={selectedJob}
                onSelectJob={handleJobSelect}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* No jobs overlay */}
      {jobsForMap.length === 0 && (
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-900/70 flex items-center justify-center z-20 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-md w-full text-center">
            <FiFilter className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">No jobs match your filters</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Try adjusting your date filter or refreshing the data</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md"
                onClick={() => setDateFilter('all')}
              >
                Reset Filters
              </button>
              <button 
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md"
                onClick={refreshJobs}
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobMapView; 