import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FiMapPin, FiFilter, FiRefreshCw, FiList, FiMap, FiX, FiCalendar, FiMaximize } from 'react-icons/fi';
import JobMap, { JobMapRef } from '../components/map/JobMap';
import JobList from '../components/map/JobList';
import JobDetailsPane from '../components/map/JobDetailsPane';
import { fetchJobs } from '../services/jobService';
import { GeocodedJob, Job } from '../types/job';
import { format, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';

const JobMapView: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<GeocodedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<GeocodedJob | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [displayedDate, setDisplayedDate] = useState<Date>(new Date());
  const jobMapRef = useRef<JobMapRef>(null);
  const [flyToEnabled, setFlyToEnabled] = useState<boolean>(true);

  // Helper to format date range for display
  const formatDateRange = (start: Date, end: Date): string => {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  const currentWeekStart = startOfWeek(displayedDate, { weekStartsOn: 0 });
  const currentWeekEnd = endOfWeek(displayedDate, { weekStartsOn: 0 });

  // Determine if the displayed week is the actual current week
  const today = new Date();
  const actualCurrentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const isViewingActualCurrentWeek = currentWeekStart.toDateString() === actualCurrentWeekStart.toDateString();

  const todayButtonText = isViewingActualCurrentWeek ? "Current Week" : "Go to Current Week";
  const todayButtonTitle = isViewingActualCurrentWeek ? "Viewing Current Week" : "Go to Current Week";

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
        // We'll filter the jobs in the applyFilters effect
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
      // The applyFilters effect will update filteredJobs
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
    
    // First filter by date, then ensure we only include jobs with coordinates (GeocodedJob)
    const filtered = jobs
      .filter(job => {
        const jobDate = new Date(job.scheduledDate);
        return jobDate >= weekStart && jobDate <= weekEnd;
      })
      .filter((job): job is GeocodedJob => 
        job.coordinates !== undefined && 
        typeof job.coordinates.latitude === 'number' && 
        typeof job.coordinates.longitude === 'number'
      );
    
    setFilteredJobs(filtered);
    
    // Auto-select first job if available and none is selected
    if (filtered.length > 0 && !selectedJob) {
      setSelectedJob(filtered[0]);
    }
  }, [jobs, displayedDate]);

  // Apply filter when any filter changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Handle job selection (either from map or list)
  const handleJobSelect = useCallback((job: GeocodedJob, source: 'list' | 'map') => {
    setSelectedJob(job);
    if (source === 'map') {
      setFlyToEnabled(true); // Always enable flyTo when a map marker is clicked
    }
    // If source is 'list', flyToEnabled remains as it was (respecting a prior 'View All' click)
  }, []); // Dependencies: setSelectedJob is stable, setFlyToEnabled is stable.

  // Memoize jobs for the map, ensuring they have coordinates
  const jobsForMap = useMemo(() => {
    return filteredJobs;
  }, [filteredJobs]);

  // Toggle view mode
  const toggleViewMode = (mode: 'split' | 'map' | 'list') => {
    setViewMode(mode);
    // If switching to map or split view, ensure map resizes after a brief delay
    if (mode === 'map' || mode === 'split') {
      setTimeout(() => {
        jobMapRef.current?.triggerResize();
      }, 100); // Delay to allow layout to update
    }
  };

  // Effect to resize map when viewMode changes, ensuring it resizes correctly
  // This is particularly important when the map container might change size or visibility
  useEffect(() => {
    if (viewMode === 'map' || viewMode === 'split') {
        // Using a timeout ensures that the resize call happens after the DOM has updated
        // and the map container has its final dimensions for the new view mode.
        const timer = setTimeout(() => {
            console.log(`JobMapView: viewMode changed to ${viewMode}, attempting to resize map.`);
            jobMapRef.current?.triggerResize();
        }, 150); // A slightly longer delay might be needed for complex layouts
        return () => clearTimeout(timer);
    }
  }, [viewMode]);

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
    <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 text-white rounded-xl shadow-lg mb-6 flex flex-col overflow-hidden border border-gray-700 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between p-3 gap-2">
          <div className="flex items-baseline gap-2 min-w-0 shrink">
            <FiMapPin className="text-primary-400 h-5 w-5 self-center" />
            <h1 className="text-lg font-semibold min-w-0">Job Map</h1>
            <span className="text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-md ml-2 mt-px">
              {filteredJobs.length} jobs
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
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
                className="px-3 py-1 text-sm text-gray-300 hover:bg-[#3a4a66] rounded-md"
                title={todayButtonTitle}
              >
                {todayButtonText}
              </button>
              <button
                onClick={handleNextWeek}
                className="px-2 py-1 text-gray-300 hover:bg-[#3a4a66] rounded-md"
                title="Next Week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="text-sm text-gray-300">
              {formatDateRange(currentWeekStart, currentWeekEnd)}
            </div>
            
            <div className="flex rounded-md overflow-hidden border border-gray-700">
              <button 
                className={`px-3 py-1.5 flex items-center gap-1 ${viewMode === 'split' ? 'bg-blue-600 text-white' : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'}`}
                onClick={() => toggleViewMode('split')}
                title="Split View"
              >
                <FiList className="h-4 w-4" />
                <FiMap className="h-4 w-4" />
              </button>
              <button 
                className={`px-3 py-1.5 flex items-center gap-1 ${viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'}`}
                onClick={() => toggleViewMode('map')}
                title="Map View"
              >
                <FiMap className="h-4 w-4" />
              </button>
              <button 
                className={`px-3 py-1.5 flex items-center gap-1 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'}`}
                onClick={() => toggleViewMode('list')}
                title="List View"
              >
                <FiList className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => {
                jobMapRef.current?.fitToAllMarkers();
                setFlyToEnabled(false); // Disable flyTo when viewing all
              }}
              className="px-3 py-1.5 flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md"
              title="View All Jobs on Map"
            >
              <FiMaximize className="h-4 w-4" />
              <span>View All</span>
            </button>

            <button
              onClick={refreshJobs}
              className="px-3 py-1.5 flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white rounded-md"
              disabled={isRefreshing}
            >
              <FiRefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* New scrollable container for content below header */}
      <div className="flex-1 overflow-y-auto">
        {/* Top section: Main content (List and Map) - removed flex-grow */}
        <div className={`grid grid-cols-1 ${viewMode === 'split' ? 'lg:grid-cols-3 gap-6' : 'gap-0'} mb-6`}>
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
                    onSelectJob={(job) => handleJobSelect(job, 'list')}
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
                  ref={jobMapRef}
                  jobs={jobsForMap} 
                  selectedJob={selectedJob}
                  onSelectJob={(job) => handleJobSelect(job, 'map')}
                  enableFlyTo={flyToEnabled}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom section: Job Details Pane */}
        <div className="mt-0"> {/* Ensure no extra top margin if the top section has mb-6 */}
          <JobDetailsPane selectedJob={selectedJob} />
        </div>
      </div>
    </div>
  );
};

export default JobMapView; 