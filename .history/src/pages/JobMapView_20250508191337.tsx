import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { FiMapPin, FiCalendar, FiFilter, FiRefreshCw, FiList, FiMap } from 'react-icons/fi';
import JobMap from '../components/map/JobMap';
import DateFilter from '../components/map/DateFilter';
import JobList from '../components/map/JobList';
import { fetchJobs } from '../services/jobService';
import { Job } from '../types/job';
import '../styles/JobMapView.css';

const JobMapView: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [customDateRange, setCustomDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [statusFilter, setStatusFilter] = useState<string[]>(['scheduled', 'in-progress']);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Extract available service types from jobs
  const availableServiceTypes = useMemo(() => {
    if (!jobs.length) return [];
    
    const types = new Set<string>();
    jobs.forEach(job => {
      if (job.serviceTypes && job.serviceTypes.length > 0) {
        job.serviceTypes.forEach(type => types.add(type));
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
        const stillExists = jobData.find(job => job.id === selectedJob.id);
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

  // Filter jobs based on all filters
  const applyFilters = useCallback(() => {
    if (!jobs.length) return;
    
    // Filter by date
    const now = new Date();
    let dateFiltered: Job[];

    switch (filterType) {
      case 'day':
        const today = format(now, 'yyyy-MM-dd');
        dateFiltered = jobs.filter(job => 
          format(new Date(job.scheduledDate), 'yyyy-MM-dd') === today
        );
        break;
      
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        dateFiltered = jobs.filter(job => {
          const jobDate = new Date(job.scheduledDate);
          return jobDate >= weekStart && jobDate <= weekEnd;
        });
        break;
      
      case 'month':
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        dateFiltered = jobs.filter(job => {
          const jobDate = new Date(job.scheduledDate);
          return jobDate.getMonth() === currentMonth && 
                 jobDate.getFullYear() === currentYear;
        });
        break;

      case 'all':
        if (customDateRange[0] && customDateRange[1]) {
          dateFiltered = jobs.filter(job => {
            const jobDate = new Date(job.scheduledDate);
            return jobDate >= customDateRange[0]! && jobDate <= customDateRange[1]!;
          });
        } else {
          dateFiltered = [...jobs];
        }
        break;
        
      default:
        dateFiltered = [...jobs];
    }

    // Filter by status
    let statusFiltered = dateFiltered;
    if (statusFilter.length > 0) {
      statusFiltered = dateFiltered.filter(job => 
        statusFilter.includes(job.status)
      );
    }

    // Filter by service type
    let serviceFiltered = statusFiltered;
    if (serviceTypeFilter.length > 0) {
      serviceFiltered = statusFiltered.filter(job => 
        job.serviceTypes?.some(type => serviceTypeFilter.includes(type)) ?? true
      );
    }

    setFilteredJobs(serviceFiltered);
  }, [jobs, filterType, customDateRange, statusFilter, serviceTypeFilter]);

  // Apply filter when any filter changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Handle job selection (either from map or list)
  const handleJobSelect = (job: Job) => {
    setSelectedJob(job);
  };

  // Toggle view mode
  const toggleViewMode = (mode: 'split' | 'map' | 'list') => {
    setViewMode(mode);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="job-map-container">
        <div className="job-map-loading">
          <FiRefreshCw className="loading-icon animate-spin" />
          <p>Loading job map...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="job-map-container">
        <div className="job-map-error">
          <p>{error}</p>
          <button 
            className="retry-button"
            onClick={refreshJobs}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="job-map-container">
      <div className="job-map-header">
        <div className="job-map-title">
          <h1><FiMapPin className="icon-title" /> Job Map</h1>
          <span className="job-count">{filteredJobs.length} jobs</span>
        </div>
        
        <div className="job-map-actions">
          <div className="view-toggle">
            <button 
              className={`view-toggle-btn ${viewMode === 'split' ? 'active' : ''}`} 
              onClick={() => toggleViewMode('split')}
              title="Split View"
            >
              <FiList className="view-icon left" />
              <FiMap className="view-icon right" />
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'map' ? 'active' : ''}`} 
              onClick={() => toggleViewMode('map')}
              title="Map View"
            >
              <FiMap className="view-icon" />
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} 
              onClick={() => toggleViewMode('list')}
              title="List View"
            >
              <FiList className="view-icon" />
            </button>
          </div>
          
          <button 
            className="refresh-btn"
            onClick={refreshJobs}
            disabled={isRefreshing}
            title="Refresh Jobs"
          >
            <FiRefreshCw className={`refresh-icon ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      
      <div className={`job-map-content ${viewMode}`}>
        {(viewMode === 'split' || viewMode === 'list') && (
          <div className="filter-and-list">
            <div className="job-filter-wrapper">
              <DateFilter 
                filterType={filterType}
                setFilterType={setFilterType}
                customDateRange={customDateRange}
                setCustomDateRange={setCustomDateRange}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                serviceTypeFilter={serviceTypeFilter}
                setServiceTypeFilter={setServiceTypeFilter}
                availableServiceTypes={availableServiceTypes}
              />
            </div>
            
            <div className="job-list-wrapper">
              <JobList 
                jobs={filteredJobs}
                selectedJob={selectedJob}
                onSelectJob={handleJobSelect}
              />
            </div>
          </div>
        )}
        
        {(viewMode === 'split' || viewMode === 'map') && (
          <div className="job-map-wrapper">
            <JobMap 
              jobs={filteredJobs} 
              selectedJob={selectedJob}
              onSelectJob={handleJobSelect}
            />
          </div>
        )}
      </div>
      
      {filteredJobs.length === 0 && (
        <div className="no-jobs-overlay">
          <div className="no-jobs-message">
            <FiFilter className="no-jobs-icon" />
            <h3>No jobs match your filters</h3>
            <p>Try adjusting your filters or refreshing the data</p>
            <div className="no-jobs-actions">
              <button 
                className="reset-filters-btn"
                onClick={() => {
                  setFilterType('all');
                  setCustomDateRange([null, null]);
                  setStatusFilter(['scheduled', 'in-progress']);
                  setServiceTypeFilter(availableServiceTypes);
                }}
              >
                Reset Filters
              </button>
              <button 
                className="refresh-data-btn"
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