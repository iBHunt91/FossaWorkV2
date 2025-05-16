import React from 'react';
import { FiMapPin, FiHash, FiUser } from 'react-icons/fi';
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
        <FiMapPin className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p>No jobs match your current filters</p>
      </div>
    );
  }

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
          <div className="mb-2">
            <h3 className="text-sm font-medium text-gray-800 dark:text-white truncate">
              {job.clientName}
            </h3>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center truncate">
              <FiMapPin className="mr-1.5 flex-shrink-0 h-3.5 w-3.5" />
              <span className="truncate">{job.address}</span>
            </div>
            
            {job.storeNumber && (
              <div className="text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md flex items-center">
                <FiHash className="mr-1 h-3 w-3" />
                {job.storeNumber}
              </div>
            )}
          </div>
          
          {job.clientId && job.clientId !== job.storeNumber && (
            <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <FiUser className="mr-1.5 flex-shrink-0 h-3.5 w-3.5" />
              <span>ID: {job.clientId}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default JobList; 