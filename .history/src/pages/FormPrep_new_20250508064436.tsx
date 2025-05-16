import React, { useState } from 'react';
import {
  FiCheck, FiClock, FiX, FiUpload, FiRefreshCw, FiPlay
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';

// Import form service 
import { 
  processSingleVisit, 
  getFormAutomationStatus, 
  processBatchVisits, 
  getBatchAutomationStatus,
  cancelFormAutomation,
  FormAutomationStatus,
  BatchAutomationStatus
} from '../services/formService';
import { ENDPOINTS } from '../config/api';
import { getDispensersForWorkOrder } from '../services/dispenserService';
import workOrderData from '../data/scraped_content.json';

// Types
interface BatchJob {
  filePath: string;
  timestamp: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
  totalVisits: number;
  completedVisits: number;
  headless: boolean;
  jobId?: string;
}

// Component
const FormPrep: React.FC = () => {
  const { addToast } = useToast();
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Function to update the job status using the FormAutomationStatus type
  const updateJobStatus = (status: FormAutomationStatus) => {
    console.log('Updating job status:', status);
    // Implementation would go here
  };

  // Simplified render for testing
  return (
    <div className="container">
      <div className="grid">
        <div className="panel">
          <h2>Form Preparation</h2>
          {batchJobs.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {batchJobs.map((job, index) => (
                  <tr key={index}>
                    <td>{job.status}</td>
                    <td>{job.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormPrep; 
