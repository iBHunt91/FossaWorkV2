import React, { useState, useEffect } from 'react';
import { 
  FiPlay, FiCheck, FiX, FiUpload, FiInfo, 
  FiExternalLink, FiFileText, FiClipboard, FiSearch, 
  FiChevronDown, FiEye, FiRefreshCw, FiFilter,
  FiClock, FiMapPin, FiCheckCircle, FiXCircle
} from 'react-icons/fi';
// Import work order data from the local data file
// @ts-ignore
import workOrderData from '../data/scraped_content.json';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
// Import form service
import { 
  processSingleVisit, 
  getFormAutomationStatus, 
  processBatchVisits, 
  getBatchAutomationStatus,
  cancelFormAutomation,
  openUrlWithDebugMode
} from '../services/formService';
import { ENDPOINTS } from '../config/api';

// Add service for retrieving dispenser information
import { getDispensersForWorkOrder } from '../services/dispenserService';

// Storage keys for localStorage
const STORAGE_KEYS = {
  FORM_JOBS: 'form_prep_jobs',
  SINGLE_JOB_ID: 'form_prep_single_job_id',
  BATCH_JOB_ID: 'form_prep_batch_job_id',
  IS_POLLING_SINGLE: 'form_prep_is_polling_single',
  LAST_STATUS_UPDATE: 'form_prep_last_status_update',
  VISIT_URL: 'form_prep_visit_url'
};

// Helper functions for localStorage
const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
  }
};

const getFromStorage = (key: string, defaultValue: any) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
};

interface FormJob {
  url: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
  timestamp?: string;
  headless: boolean;
  storeName?: string;
  visitNumber?: string;
  dispenserCount?: number;
  startTime?: number; // Timestamp when automation started
  endTime?: number;   // Timestamp when automation completed
  // Flags for tracking state changes for toast notifications
  _statusChanged?: boolean;
  _completed?: boolean;
  _error?: boolean;
  jobId?: string; // Optional job ID
}

interface BatchJob {
  filePath: string;
  timestamp: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
  totalVisits: number;
  completedVisits: number;
  headless: boolean;
  jobId?: string; // Add optional job ID field to match usage in the code
}

// Add type definitions for service function returns
interface SingleProcessResult {
  success: boolean;
  message: string;
  jobId: string;
}

interface BatchProcessResult {
  success: boolean;
  message: string;
  jobId: string;
  totalVisits?: number;
}

interface WorkOrder {
  id: string;
  customer: {
    name: string;
    storeNumber: string;
    address: {
      street: string;
      intersection: string;
      cityState: string;
      county: string;
    };
  };
  services?: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string;
  }>;
  visits: {
    nextVisit: {
      visitId: string;
      date: string;
      time: string;
      url: string;
    };
  };
  dispensers?: Array<{
    title?: string;
    serial?: string;
    make?: string;
    model?: string;
    fields?: {
      [key: string]: string | undefined;
    };
  }>;
}

const FormPrepFixed: React.FC = () => {
  const { isDarkMode } = useTheme();
  // Initialize empty work orders array, it will be populated via API
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [visitUrl, setVisitUrl] = useState<string>(() => 
    getFromStorage(STORAGE_KEYS.VISIT_URL, ''));
  const [batchFilePath, setBatchFilePath] = useState<string>('data/scraped_content.json');
  // Use localStorage for persistent state between navigations
  const [formJobs, setFormJobs] = useState<FormJob[]>(() => 
    getFromStorage(STORAGE_KEYS.FORM_JOBS, []));
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isHeadless, setIsHeadless] = useState<boolean>(true);
  const [batchJobId, setBatchJobId] = useState<string | null>(() => 
    getFromStorage(STORAGE_KEYS.BATCH_JOB_ID, null));
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null);
  const [singleJobId, setSingleJobId] = useState<string | null>(() => 
    getFromStorage(STORAGE_KEYS.SINGLE_JOB_ID, null));
  const [pollingSingle, setPollingSingle] = useState<boolean>(() => 
    getFromStorage(STORAGE_KEYS.IS_POLLING_SINGLE, false));
  const [currentWeekIndex, setCurrentWeekIndex] = useState<number>(0);
  // New state variables for enhanced batch processing
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedVisits, setSelectedVisits] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string>('none');
  const [lastFailedBatch, setLastFailedBatch] = useState<BatchJob | null>(null);
  const [resumeBatch, setResumeBatch] = useState<boolean>(false);
  // New state for storing dispenser details 
  const [dispenserDetails, setDispenserDetails] = useState<Record<string, any>>({});
  const { addToast } = useToast();
  
  // Add required helper functions for the Recent Jobs section
  
  // Extract visit number from URL
  const extractVisitNumber = (url: string): string => {
    const match = url.match(/\/visit\/([^\/]+)/);
    return match ? match[1] : 'Unknown';
  };
  
  // Extract visit information including store name and dispenser count
  const extractVisitInfo = (url: string): { storeName: string; visitNumber: string; dispenserCount: number } => {
    const visitNumber = extractVisitNumber(url);
    
    // Default values
    let result = {
      storeName: 'Unknown Store',
      visitNumber,
      dispenserCount: 0
    };
    
    // Try to find matching work order
    if (workOrders && workOrders.length > 0) {
      for (const workOrder of workOrders) {
        if (workOrder.visits?.nextVisit?.url === url) {
          result = {
            storeName: workOrder.customer.name || 'Unknown Store',
            visitNumber,
            dispenserCount: workOrder.dispensers?.length || 0
          };
          break;
        }
      }
    }
    
    return result;
  };
  
  // Format duration between two timestamps
  const formatDuration = (startTime?: number, endTime?: number): string => {
    if (!startTime) return 'Not started';
    
    // Calculate duration 
    const durationMs = endTime ? (endTime - startTime) : (Date.now() - startTime);
    
    // Format nicely
    if (durationMs < 1000) {
      return 'Just now';
    } else if (durationMs < 60000) {
      return `${Math.floor(durationMs / 1000)}s`;
    } else if (durationMs < 3600000) {
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    } else {
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    }
  };
  
  // Simple placeholder component with tabs
  return (
    <div className="container mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Form Prep Fixed</h1>
      
      {/* Tabs section */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button 
          onClick={() => setActiveTab('single')}
          className={`px-4 py-2 font-medium ${activeTab === 'single' 
            ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          Single Form
        </button>
        
        <button 
          onClick={() => setActiveTab('batch')}
          className={`px-4 py-2 font-medium ${activeTab === 'batch' 
            ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          Batch Processing
        </button>
      </div>
      
      {/* Main content */}
      {isLoading ? (
        <div className="p-6 text-center">Loading...</div>
      ) : (
        activeTab === 'single' ? (
          <div className="space-y-6">
            {/* Recent Jobs Section */}
            {formJobs.length > 0 && (
              <div className="panel bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="panel-header mb-4">
                  <h2 className="panel-title text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-2">
                    <FiClock className="text-primary-500 dark:text-primary-400" />
                    <span>Recent Jobs</span>
                    
                    {/* Job count badges */}
                    <div className="flex items-center space-x-1 ml-2">
                      {formJobs.filter(job => job.status === 'running').length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium">
                          {formJobs.filter(job => job.status === 'running').length} running
                        </span>
                      )}
                      {formJobs.filter(job => job.status === 'completed').length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                          {formJobs.filter(job => job.status === 'completed').length} completed
                        </span>
                      )}
                      {formJobs.filter(job => job.status === 'error').length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
                          {formJobs.filter(job => job.status === 'error').length} failed
                        </span>
                      )}
                    </div>
                  </h2>
                </div>
                
                {/* Table to be populated with actual job data */}
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visit</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {/* Job rows will be generated here from formJobs array */}
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                          This table will show recent form automation jobs with detailed progress tracking
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            Batch processing will be implemented here
          </div>
        )
      )}
    </div>
  );
};

export default FormPrepFixed; 