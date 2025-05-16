import React from 'react';
import { FiMapPin, FiHash, FiBriefcase, FiTool, FiChevronsRight } from 'react-icons/fi';
import { GeocodedJob } from '../../types/job';

interface JobDetailsPaneProps {
  selectedJob: GeocodedJob | null;
}

const JobDetailsPane: React.FC<JobDetailsPaneProps> = ({ selectedJob }) => {
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

  // Fallback if still N/A - consider removing for production if not desired
  // if (displayDispenserCount === 'N/A') displayDispenserCount = '-'; 

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
          <FiTool className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" />
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
      </div>
    </div>
  );
};

export default JobDetailsPane; 