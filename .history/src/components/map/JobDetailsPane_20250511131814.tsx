import React, { useState, useRef, useContext } from 'react';
import { FiMapPin, FiHash, FiBriefcase, FiChevronsRight, FiClock, FiChevronDown, FiLoader, FiX } from 'react-icons/fi';
import { FaGasPump, FaRoute } from 'react-icons/fa';
import { GeocodedJob } from '../../types/job';
import { JobMapRef } from './JobMap';

interface JobDetailsPaneProps {
  selectedJob: GeocodedJob | null;
  jobs: GeocodedJob[];
  jobMapRef?: React.RefObject<JobMapRef | null>;
}

const JobDetailsPane: React.FC<JobDetailsPaneProps> = ({ selectedJob, jobs, jobMapRef }) => {
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [driveTimeInfo, setDriveTimeInfo] = useState<string | null>(null);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<GeocodedJob | null>(null);
  
  if (!selectedJob) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 text-center">
        <FiChevronsRight className="h-10 w-10 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
        <p className="text-gray-600 dark:text-gray-400">Select a job from the list or map to see details.</p>
      </div>
    );
  }

  // Attempt to get dispenser count
  let displayDispenserCount: string | number = 'N/A';

  if (typeof selectedJob.dispenserCount === 'number') {
    displayDispenserCount = selectedJob.dispenserCount;
    console.log(`JobDetailsPane: Dispenser count from selectedJob.dispenserCount: ${displayDispenserCount}`);
  } else {
    console.log(`JobDetailsPane: selectedJob.dispenserCount is not a number (value: ${selectedJob.dispenserCount}). Current selectedJob.dispensers:`, selectedJob.dispensers);
    console.log("JobDetailsPane: Attempting regex fallback for description/instructions.");
    let foundByRegex = false;
    if (selectedJob.description) {
      const numericMatch = selectedJob.description.match(/(\d+)\s*dispensers?/i);
      if (numericMatch && numericMatch[1]) {
        displayDispenserCount = numericMatch[1];
        console.log(`JobDetailsPane: Dispenser count from description (numeric regex): ${displayDispenserCount}`);
        foundByRegex = true;
      } else {
        const allMatch = selectedJob.description.match(/All\s*Dispensers?/i);
        if (allMatch) {
          displayDispenserCount = 'All';
          console.log(`JobDetailsPane: Dispenser count from description (found "All Dispensers"): ${displayDispenserCount}`);
          foundByRegex = true;
        }
      }
    }

    if (!foundByRegex && selectedJob.instructions) {
      const numericMatch = selectedJob.instructions.match(/(\d+)\s*dispensers?/i);
      if (numericMatch && numericMatch[1]) {
        displayDispenserCount = numericMatch[1];
        console.log(`JobDetailsPane: Dispenser count from instructions (numeric regex): ${displayDispenserCount}`);
      } else {
        const allMatch = selectedJob.instructions.match(/All\s*Dispensers?/i);
        if (allMatch) {
          displayDispenserCount = 'All';
          console.log(`JobDetailsPane: Dispenser count from instructions (found "All Dispensers"): ${displayDispenserCount}`);
        }
      }
    }
  }
  
  if (displayDispenserCount === 'N/A') {
      console.log("JobDetailsPane: Dispenser count remains N/A after all checks.");
      // Optionally log the selectedJob data if it's still N/A after all attempts
      // console.log("JobDetailsPane: Selected Job Data for N/A count:", JSON.stringify(selectedJob, null, 2));
  }
  
  // Get other jobs for routing (excluding the current job)
  const otherJobs = jobs.filter(job => job.id !== selectedJob.id);
  
  // Handle calculating a route to a destination
  const calculateRoute = async (destinationJob: GeocodedJob) => {
    if (!jobMapRef?.current || !selectedJob || !destinationJob) return;
    
    try {
      setIsCalculatingRoute(true);
      setSelectedDestination(destinationJob);
      const driveTime = await jobMapRef.current.showRouteBetweenJobs(selectedJob, destinationJob);
      setDriveTimeInfo(driveTime);
    } catch (error) {
      console.error('Error calculating route:', error);
      setDriveTimeInfo('Error calculating route');
    } finally {
      setIsCalculatingRoute(false);
      setIsRouteDropdownOpen(false);
    }
  };
  
  // Clear the route information
  const clearRoute = () => {
    setDriveTimeInfo(null);
    setSelectedDestination(null);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        {selectedJob.clientName || 'Job Details'}
      </h2>
      <div className="space-y-3">
        <div className="flex items-center">
          <FiHash className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Store Number</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{(selectedJob.storeNumber || 'N/A').replace('#', '')}</p>
          </div>
        </div>
        <div className="flex items-center">
          <FiBriefcase className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Visit Number</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedJob.visitId || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center">
          <FaGasPump className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Dispenser Count</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{displayDispenserCount}</p>
          </div>
        </div>
        <div className="flex items-start pt-2">
          <FiMapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedJob.address || 'N/A'}<br />
              {selectedJob.city || ''}{selectedJob.city && selectedJob.state ? ', ' : ''}{selectedJob.state || ''} {selectedJob.zipCode || ''}
            </p>
          </div>
        </div>
        
        {/* Drive Time Estimation Section */}
        <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-start">
            <FaRoute className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0 mt-0.5" />
            <div className="w-full">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Drive Time Estimation</p>
              
              {driveTimeInfo ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        To: {selectedDestination?.clientName}
                        {selectedDestination?.storeNumber ? ` (${selectedDestination.storeNumber})` : ''}
                      </p>
                      <div className="flex items-center mt-1">
                        <FiClock className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                        <p className="text-sm text-blue-600 dark:text-blue-400">{driveTimeInfo}</p>
                      </div>
                    </div>
                    <button
                      onClick={clearRoute}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      title="Clear route"
                    >
                      <FiX className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setIsRouteDropdownOpen(!isRouteDropdownOpen)}
                    className={`w-full text-left px-3 py-2 border ${isRouteDropdownOpen 
                      ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500' 
                      : 'border-gray-300 dark:border-gray-600'} 
                      rounded-lg flex items-center justify-between bg-white dark:bg-gray-700 
                      text-gray-700 dark:text-gray-300 text-sm`}
                    disabled={isCalculatingRoute}
                  >
                    <span>{isCalculatingRoute ? 'Calculating route...' : 'Calculate drive time to...'}</span>
                    {isCalculatingRoute ? (
                      <FiLoader className="h-4 w-4 animate-spin" />
                    ) : (
                      <FiChevronDown className={`h-4 w-4 transition-transform ${isRouteDropdownOpen ? 'transform rotate-180' : ''}`} />
                    )}
                  </button>
                  
                  {isRouteDropdownOpen && otherJobs.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                      {otherJobs.map(job => (
                        <button
                          key={job.id}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 
                                    text-gray-700 dark:text-gray-300 flex items-center justify-between"
                          onClick={() => calculateRoute(job)}
                        >
                          <span className="truncate">{job.clientName} {job.storeNumber ? `(${job.storeNumber})` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {isRouteDropdownOpen && otherJobs.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-4 text-center">
                      <p className="text-gray-500 dark:text-gray-400">No other jobs available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetailsPane; 