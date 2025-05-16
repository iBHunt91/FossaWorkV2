import React from 'react';
import { format } from 'date-fns';
import { FiClock, FiMapPin, FiFile, FiUser, FiCalendar } from 'react-icons/fi';
import { GeocodedJob } from '../../types/job';

interface JobListProps {
  jobs: GeocodedJob[];
  selectedJob: GeocodedJob | null;
  onSelectJob: (job: GeocodedJob) => void;
}

const JobList: React.FC<JobListProps> = ({ jobs, selectedJob, onSelectJob }) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg m-4">
        <FiFile className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p>No jobs match your current filters</p>
      </div>
    );
  }

  // Get status color class
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'in-progress':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {jobs.map(job => (
        <div 
          key={job.id}
          className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
            selectedJob?.id === job.id ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500 dark:ring-primary-400' : ''
          }`}
          onClick={() => onSelectJob(job)}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-800 dark:text-white truncate">
              {job.clientName}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-md ${getStatusColor(job.status)}`}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </span>
          </div>
          
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 flex items-center">
            <FiMapPin className="mr-1 flex-shrink-0" />
            <span className="truncate">{job.address}, {job.city}, {job.state}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center text-gray-500 dark:text-gray-400">
              <FiCalendar className="mr-1" />
              <span>
                {format(new Date(job.scheduledDate), 'MMM d, yyyy')}
              </span>
            </div>
            
            <div className="flex items-center text-gray-500 dark:text-gray-400">
              <FiClock className="mr-1" />
              <span>{job.startTime}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default JobList; 