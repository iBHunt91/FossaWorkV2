import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
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

  // Fetch jobs on component mount
  useEffect(() => {
    const getJobs = async () => {
      try {
        setIsLoading(true);
        const jobData = await fetchJobs();
        setJobs(jobData);
        setFilteredJobs(jobData);
      } catch (err) {
        setError('Failed to fetch job data. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    getJobs();
  }, []);

  // Filter jobs based on selected date filter
  const applyDateFilter = useCallback(() => {
    if (!jobs.length) return;
    
    const now = new Date();
    let filtered: Job[];

    switch (filterType) {
      case 'day':
        const today = format(now, 'yyyy-MM-dd');
        filtered = jobs.filter(job => 
          format(new Date(job.scheduledDate), 'yyyy-MM-dd') === today
        );
        break;
      
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        filtered = jobs.filter(job => {
          const jobDate = new Date(job.scheduledDate);
          return jobDate >= weekStart && jobDate <= weekEnd;
        });
        break;
      
      case 'month':
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        filtered = jobs.filter(job => {
          const jobDate = new Date(job.scheduledDate);
          return jobDate.getMonth() === currentMonth && 
                 jobDate.getFullYear() === currentYear;
        });
        break;

      case 'all':
        if (customDateRange[0] && customDateRange[1]) {
          filtered = jobs.filter(job => {
            const jobDate = new Date(job.scheduledDate);
            return jobDate >= customDateRange[0]! && jobDate <= customDateRange[1]!;
          });
        } else {
          filtered = [...jobs];
        }
        break;
        
      default:
        filtered = [...jobs];
    }

    setFilteredJobs(filtered);
  }, [jobs, filterType, customDateRange]);

  // Apply filter when filter type or custom date range changes
  useEffect(() => {
    applyDateFilter();
  }, [applyDateFilter]);

  // Handle job selection (either from map or list)
  const handleJobSelect = (job: Job) => {
    setSelectedJob(job);
  };

  if (isLoading) {
    return <div className="job-map-loading">Loading job map...</div>;
  }

  if (error) {
    return <div className="job-map-error">{error}</div>;
  }

  return (
    <div className="job-map-container">
      <h1>Job Map View</h1>
      
      <div className="job-map-controls">
        <DateFilter 
          filterType={filterType}
          setFilterType={setFilterType}
          customDateRange={customDateRange}
          setCustomDateRange={setCustomDateRange}
        />
      </div>
      
      <div className="job-map-content">
        <div className="job-map-wrapper">
          <JobMap 
            jobs={filteredJobs} 
            selectedJob={selectedJob}
            onSelectJob={handleJobSelect}
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
    </div>
  );
};

export default JobMapView; 