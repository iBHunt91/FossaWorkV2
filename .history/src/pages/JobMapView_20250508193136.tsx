import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiMapPin, FiFilter, FiRefreshCw, FiList, FiMap, FiX, FiCheck } from 'react-icons/fi';
import JobMap from '../components/map/JobMap';
import JobList from '../components/map/JobList';
import { fetchJobs } from '../services/jobService';
import { GeocodedJob } from '../types/job';

const JobMapView: React.FC = () => {
  const [jobs, setJobs] = useState<GeocodedJob[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<GeocodedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<GeocodedJob | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(['scheduled', 'in-progress']);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Extract available service types from jobs
  const availableServiceTypes = useMemo(() => {
    if (!jobs.length) return [];
    
    const types = new Set<string>();
    jobs.forEach(job => {
      if (job.serviceTypes && job.serviceTypes.length > 0) {
        job.serviceTypes.forEach((type: string) => types.add(type));
      }
    });
    
    return Array.from(types).sort();
  }, [jobs]);

  // Set default service types when available types change
  useEffect(() => {
    if (availableServiceTypes.length > 0 && serviceTypeFilter.length === 0) {
      setServiceTypeFilter([...availableServiceTypes]);
    }
  }, [availableServiceTypes]);

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

  // Toggle status in filter
  const toggleStatus = (status: string) => {
    if (statusFilter.includes(status)) {
      setStatusFilter(statusFilter.filter(s => s !== status));
    } else {
      setStatusFilter([...statusFilter, status]);
    }
  };
  
  // Toggle service type in filter
  const toggleServiceType = (type: string) => {
    if (serviceTypeFilter.includes(type)) {
      setServiceTypeFilter(serviceTypeFilter.filter(t => t !== type));
    } else {
      setServiceTypeFilter([...serviceTypeFilter, type]);
    }
  };

  // Clear all service type filters
  const clearServiceTypeFilters = () => {
    setServiceTypeFilter([]);
  };
  
  // Select all service types
  const selectAllServiceTypes = () => {
    setServiceTypeFilter([...availableServiceTypes]);
  };

  // Filter jobs based on all filters
  const applyFilters = useCallback(() => {
    if (!jobs.length) return;
    
    // Filter by status
    let statusFiltered = [...jobs];
    if (statusFilter.length > 0) {
      statusFiltered = jobs.filter(job => 
        statusFilter.includes(job.status)
      );
    }

    // Filter by service type
    let serviceFiltered = statusFiltered;
    if (serviceTypeFilter.length > 0) {
      serviceFiltered = statusFiltered.filter(job => 
        job.serviceTypes?.some((type: string) => serviceTypeFilter.includes(type)) ?? true
      );
    }

    setFilteredJobs(serviceFiltered);
  }, [jobs, statusFilter, serviceTypeFilter]);

  // Apply filter when any filter changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Handle job selection (either from map or list)
  const handleJobSelect = (job: GeocodedJob) => {
    setSelectedJob(job);
  };

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

  // All possible status options
  const statusOptions = ['scheduled', 'in-progress', 'completed', 'cancelled'];

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
            <button
              className="px-3 py-1.5 flex items-center gap-1 bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66] rounded-md"
              onClick={toggleFilter}
              title="Toggle Filters"
            >
              <FiFilter className="h-4 w-4" />
              Filters
            </button>
            
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
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md flex items-center gap-2 transition-colors"
              onClick={refreshJobs}
              disabled={isRefreshing}
              title="Refresh Jobs"
            >
              <FiRefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      {/* Filter Panel - conditionally rendered */}
      {isFilterOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <FiFilter className="mr-2 text-primary-500" />
              Filter Jobs
            </h3>
            <button 
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={toggleFilter}
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
          
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status filter section */}
            <div className="filter-section">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <FiFilter className="mr-2 h-4 w-4 text-primary-500" />
                Job Status
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map(status => (
                  <div 
                    key={status}
                    className={`flex items-center p-2 rounded-md cursor-pointer ${
                      statusFilter.includes(status) 
                        ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800' 
                        : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => toggleStatus(status)}
                  >
                    <div className={`h-4 w-4 rounded mr-2 flex items-center justify-center ${
                      statusFilter.includes(status) ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500'
                    }`}>
                      {statusFilter.includes(status) && <FiCheck className="h-3 w-3" />}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Service type filter section */}
            {availableServiceTypes.length > 0 && (
              <div className="filter-section">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                    <FiFilter className="mr-2 h-4 w-4 text-primary-500" />
                    Service Type
                  </h4>
                  <div className="flex items-center gap-2">
                    <button 
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                      onClick={selectAllServiceTypes}
                      disabled={serviceTypeFilter.length === availableServiceTypes.length}
                    >
                      Select All
                    </button>
                    <button 
                      className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      onClick={clearServiceTypeFilters}
                      disabled={serviceTypeFilter.length === 0}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                <div className="max-h-48 overflow-y-auto pr-2">
                  {availableServiceTypes.map(type => (
                    <div 
                      key={type}
                      className={`flex items-center p-2 mb-1 rounded-md cursor-pointer ${
                        serviceTypeFilter.includes(type) 
                          ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800' 
                          : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => toggleServiceType(type)}
                    >
                      <div className={`h-4 w-4 rounded mr-2 flex items-center justify-center ${
                        serviceTypeFilter.includes(type) ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500'
                      }`}>
                        {serviceTypeFilter.includes(type) && <FiCheck className="h-3 w-3" />}
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            
            <div className="h-[700px]">
              <JobMap 
                jobs={filteredJobs} 
                selectedJob={selectedJob}
                onSelectJob={handleJobSelect}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* No jobs overlay */}
      {filteredJobs.length === 0 && (
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-900/70 flex items-center justify-center z-20 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-md w-full text-center">
            <FiFilter className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">No jobs match your filters</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Try adjusting your filters or refreshing the data</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md"
                onClick={() => {
                  setStatusFilter(['scheduled', 'in-progress']);
                  setServiceTypeFilter(availableServiceTypes);
                }}
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