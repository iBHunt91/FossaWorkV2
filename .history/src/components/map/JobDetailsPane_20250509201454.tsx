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
  let dispenserCount: string | number = 'N/A';

  if (selectedJob.dispensers && Array.isArray(selectedJob.dispensers) && selectedJob.dispensers.length > 0) {
    dispenserCount = selectedJob.dispensers.length;
    console.log(`Dispenser count from dispensers array: ${dispenserCount}`);
  } else if (selectedJob.services && Array.isArray(selectedJob.services)) {
    const meterCalibrationService = selectedJob.services.find(
      (service: { type?: string; quantity?: number }) =>
        service.type && service.type.toLowerCase().includes('meter calibration')
    );
    if (meterCalibrationService && typeof meterCalibrationService.quantity === 'number') {
      dispenserCount = meterCalibrationService.quantity;
      console.log(`Dispenser count from 'Meter Calibration' service quantity: ${dispenserCount}`);
    } else {
      // Fallback to regex checks if specific service not found or quantity is not a number
      console.log("Meter Calibration service not found or quantity invalid, falling back to regex checks.");
      if (selectedJob.description) {
        const dispenserMatch = selectedJob.description.match(/(\d+)\s*dispenser/i);
        if (dispenserMatch && dispenserMatch[1]) {
          dispenserCount = dispenserMatch[1];
          console.log(`Dispenser count from description: ${dispenserCount}`);
        }
      }
      if (dispenserCount === 'N/A' && selectedJob.instructions) {
        const dispenserMatch = selectedJob.instructions.match(/(\d+)\s*dispenser/i);
        if (dispenserMatch && dispenserMatch[1]) {
          dispenserCount = dispenserMatch[1];
          console.log(`Dispenser count from instructions: ${dispenserCount}`);
        }
      }
    }
  } else {
    // Fallback to regex if neither dispensers array nor services array is present
    console.log("Dispensers array and services array not found, falling back to regex checks for description/instructions.");
    if (selectedJob.description) {
      const dispenserMatch = selectedJob.description.match(/(\d+)\s*dispenser/i);
      if (dispenserMatch && dispenserMatch[1]) {
        dispenserCount = dispenserMatch[1];
        console.log(`Dispenser count from description (fallback): ${dispenserCount}`);
      }
    }
    if (dispenserCount === 'N/A' && selectedJob.instructions) {
      const dispenserMatch = selectedJob.instructions.match(/(\d+)\s*dispenser/i);
      if (dispenserMatch && dispenserMatch[1]) {
        dispenserCount = dispenserMatch[1];
        console.log(`Dispenser count from instructions (fallback): ${dispenserCount}`);
      }
    }
  }

  // Final fallback if count is still N/A
  if (dispenserCount === 'N/A') {
    console.log("Dispenser count remains N/A after all checks.");
  }

  // Fallback if still N/A - consider removing for production if not desired
  // if (dispenserCount === 'N/A') dispenserCount = '-'; 

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
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedJob.storeNumber || 'N/A'}</p>
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
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{dispenserCount}</p>
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