import React from 'react';
import { Job } from '../../types/job';
import { format } from 'date-fns';

interface JobListProps {
  jobs: Job[];
  selectedJob: Job | null;
  onSelectJob: (job: Job) => void;
}

const JobList: React.FC<JobListProps> = ({ jobs, selectedJob, onSelectJob }) => {
  // Sort jobs by scheduled date (most recent first)
  const sortedJobs = [...jobs].sort((a, b) => {
    return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
  });
  
  return (
    <div className="job-list">
      <h2>Jobs ({jobs.length})</h2>
      
      {jobs.length === 0 ? (
        <div className="no-jobs">No jobs match the selected filters.</div>
      ) : (
        <ul className="job-items">
          {sortedJobs.map(job => (
            <li 
              key={job.id}
              className={`job-item ${selectedJob?.id === job.id ? 'selected' : ''}`}
              onClick={() => onSelectJob(job)}
            >
              <div className="job-item-header">
                <span className="job-title">{job.title}</span>
                <span className="job-date">
                  {format(new Date(job.scheduledDate), 'MMM d, yyyy')}
                </span>
              </div>
              
              <div className="job-item-location">
                <span className="job-address">
                  {job.address}, {job.city}, {job.state} {job.zipCode}
                </span>
              </div>
              
              <div className="job-item-details">
                <span className="job-time">
                  {job.startTime} - {job.endTime}
                </span>
                <span className="job-client">{job.clientName}</span>
                <span className={`job-status job-status-${job.status}`}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default JobList; 