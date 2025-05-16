import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FiMapPin, FiFilter, FiRefreshCw, FiList, FiMap, FiX, FiCalendar, FiMaximize, FiNavigation, FiArrowRight } from 'react-icons/fi';
import JobMap, { JobMapRef } from '../components/map/JobMap';
import JobList from '../components/map/JobList';
import JobDetailsPane from '../components/map/JobDetailsPane';
import { fetchJobs } from '../services/jobService';
import { GeocodedJob, Job } from '../types/job';
import { format, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
import routingService from '../services/routingService';

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
  const [isViewAllMode, setIsViewAllMode] = useState<boolean>(false);
  
  // Routing mode state
  const [isRoutingMode, setIsRoutingMode] = useState<boolean>(false);
  const [routeOrigin, setRouteOrigin] = useState<GeocodedJob | null>(null);
  const [routeDestination, setRouteDestination] = useState<GeocodedJob | null>(null);
  const [routeCalculating, setRouteCalculating] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<{duration: number; distance: number} | null>(null);
  
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
      setRouteOrigin(filtered[0]); // Set as default origin for routing
    }
    
    // Reset routing if jobs have changed significantly
    setRouteDestination(null);
    setRouteInfo(null);
    
    setFlyToEnabled(true); // Re-enable flyTo when filters change
  }, [jobs, displayedDate]);

  // Apply filter when any filter changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Handle job selection (either from map or list)
  const handleJobSelect = useCallback((job: GeocodedJob, source: 'list' | 'map') => {
    setSelectedJob(job);
    
    // In routing mode, set origin or destination based on selection
    if (isRoutingMode) {
      if (!routeOrigin) {
        setRouteOrigin(job);
      } else if (!routeDestination || routeDestination.id === job.id) {
        setRouteDestination(job);
      } else {
        // If both are already set, update the destination
        setRouteDestination(job);
        setRouteInfo(null); // Clear previous route info
      }
    }
    
    if (source === 'map') {
      setFlyToEnabled(true); // Always enable flyTo when a map marker is clicked
      setIsViewAllMode(false); // Exit view all mode when selecting directly from map
    }
    // If source is 'list', flyToEnabled remains as it was (respecting a prior 'View All' click)
  }, [isRoutingMode, routeOrigin, routeDestination]); // Added new dependencies

  // Calculate route between origin and destination
  const calculateRoute = useCallback(async () => {
    if (!routeOrigin || !routeDestination || !jobMapRef.current) return;
    
    try {
      setRouteCalculating(true);
      const driveTime = await jobMapRef.current.showRouteBetweenJobs(routeOrigin, routeDestination);
      if (driveTime) {
        // For simplicity, we're getting route details from routingService again
        // In a production app, you might want to return more details from showRouteBetweenJobs
        const routeDetails = await routingService.calculateDriveTime(routeOrigin, routeDestination);
        setRouteInfo({
          duration: routeDetails.duration,
          distance: routeDetails.distance
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    } finally {
      setRouteCalculating(false);
    }
  }, [routeOrigin, routeDestination]);

  // Effect to calculate route when origin and destination are both set
  useEffect(() => {
    if (isRoutingMode && routeOrigin && routeDestination && 
        routeOrigin.id !== routeDestination.id) {
      calculateRoute();
    }
  }, [isRoutingMode, routeOrigin, routeDestination, calculateRoute]);

  // Toggle routing mode on/off
  const toggleRoutingMode = () => {
    const newRoutingMode = !isRoutingMode;
    setIsRoutingMode(newRoutingMode);
    
    if (newRoutingMode) {
      // When entering routing mode, set the current selected job as origin
      if (selectedJob) {
        setRouteOrigin(selectedJob);
      }
      setRouteDestination(null);
      setRouteInfo(null);
    } else {
      // When exiting routing mode, clear any routes from the map
      if (jobMapRef.current) {
        // This assumes you've added a clearRoute method to JobMapRef
        // If not, you'll need to implement this
      }
    }
  };

  // Clear the current route
  const clearRoute = () => {
    setRouteDestination(null);
    setRouteInfo(null);
    // Clear the route from map (this would need to be implemented in JobMap)
  };

  // Swap origin and destination
  const swapOriginDestination = () => {
    if (routeOrigin && routeDestination) {
      const temp = routeOrigin;
      setRouteOrigin(routeDestination);
      setRouteDestination(temp);
      setRouteInfo(null); // Route will be recalculated via effect
    }
  };
  
  // Memoize jobs for the map, ensuring they have coordinates
  const jobsForMap = useMemo(() => {
    return filteredJobs;
  }, [filteredJobs]);

  // Toggle view mode
  const toggleViewMode = (mode: 'split' | 'map' | 'list') => {
    setViewMode(mode);
    // If switching to map or split view, ensure map resizes and re-enable flyTo
    if (mode === 'map' || mode === 'split') {
      setFlyToEnabled(true);
      setIsViewAllMode(false);
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
                if (isViewAllMode) {
                  // Switch to "Focus Selected" mode
                  setFlyToEnabled(true);
                  setIsViewAllMode(false);
                  if (selectedJob) {
                    // Use setTimeout to ensure state updates first
                    setTimeout(() => {
                      // Fake a selection event to trigger focusing on the selected job
                      handleJobSelect(selectedJob, 'map');
                    }, 50);
                  }
                } else {
                  // Switch to "View All" mode
                  jobMapRef.current?.fitToAllMarkers();
                  setFlyToEnabled(false); // Disable flyTo when viewing all
                  setIsViewAllMode(true); // Set view all mode
                }
              }}
              className={`px-3 py-1.5 flex items-center gap-1 rounded-md ${
                isViewAllMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title={isViewAllMode ? "Focus on Selected Job" : "View All Jobs on Map"}
            >
              {isViewAllMode ? (
                <>
                  <FiMapPin className="h-4 w-4" />
                  <span>Focus Selected</span>
                </>
              ) : (
                <>
                  <FiMaximize className="h-4 w-4" />
                  <span>View All</span>
                </>
              )}
            </button>

            <button
              onClick={toggleRoutingMode}
              className={`px-3 py-1.5 flex items-center gap-1 rounded-md ${
                isRoutingMode 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title={isRoutingMode ? "Exit Routing Mode" : "Enter Routing Mode"}
            >
              <FiNavigation className="h-4 w-4" />
              <span>Routing</span>
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
        {/* Routing Panel - Only visible in routing mode */}
        {isRoutingMode && (
          <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 px-4 py-3">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center">
                <FiNavigation className="mr-2 text-green-600 dark:text-green-400" />
                Route Planning
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                {/* Origin selector */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origin</label>
                  <select
                    value={routeOrigin?.id || ''}
                    onChange={(e) => {
                      const selectedJob = filteredJobs.find(job => job.id === e.target.value);
                      setRouteOrigin(selectedJob || null);
                      setRouteInfo(null); // Clear route info when origin changes
                    }}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-3 text-sm"
                  >
                    <option value="">Select a starting point</option>
                    {filteredJobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.clientName} {job.storeNumber ? `(${job.storeNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Swap button */}
                <div className="col-span-1 md:col-span-auto flex justify-center items-center pt-4">
                  <button
                    onClick={swapOriginDestination}
                    disabled={!routeOrigin || !routeDestination}
                    className={`p-2 rounded-full ${
                      routeOrigin && routeDestination
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/40'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    }`}
                    title="Swap origin and destination"
                  >
                    <FiArrowRight className="h-5 w-5 transform rotate-90" />
                  </button>
                </div>
                
                {/* Destination selector */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination</label>
                  <select
                    value={routeDestination?.id || ''}
                    onChange={(e) => {
                      const selectedJob = filteredJobs.find(job => job.id === e.target.value);
                      setRouteDestination(selectedJob || null);
                      setRouteInfo(null); // Clear route info when destination changes
                    }}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-3 text-sm"
                  >
                    <option value="">Select a destination</option>
                    {filteredJobs
                      .filter(job => !routeOrigin || job.id !== routeOrigin.id) // Filter out the origin job
                      .map(job => (
                        <option key={job.id} value={job.id}>
                          {job.clientName} {job.storeNumber ? `(${job.storeNumber})` : ''}
                        </option>
                      ))
                    }
                  </select>
                </div>
                
                {/* Route info display */}
                <div className="col-span-1">
                  {routeCalculating ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-pulse flex items-center">
                        <FiLoader className="h-5 w-5 text-blue-500 dark:text-blue-400 animate-spin mr-2" />
                        <span className="text-gray-600 dark:text-gray-300">Calculating...</span>
                      </div>
                    </div>
                  ) : routeInfo ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 h-full flex flex-col justify-center">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                          {routingService.formatDriveTime(routeInfo.duration)}
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400">
                          {Math.round(routeInfo.distance / 1609.34)} miles
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <span className="text-gray-500 dark:text-gray-400 text-sm italic">
                        {routeOrigin && routeDestination ? 
                          'Calculating route...' : 
                          'Select origin and destination to calculate route'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Clear route button */}
              {(routeOrigin || routeDestination) && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={clearRoute}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    Clear route
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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

        {/* Bottom section: Job Details Pane - Only shown when not in routing mode */}
        {!isRoutingMode && (
          <div className="mt-0"> {/* Ensure no extra top margin if the top section has mb-6 */}
            <JobDetailsPane 
              selectedJob={selectedJob} 
              jobs={filteredJobs}
              jobMapRef={jobMapRef}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default JobMapView; 