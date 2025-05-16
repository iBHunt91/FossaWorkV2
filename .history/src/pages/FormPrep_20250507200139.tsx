import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiChevronRight, FiArrowRight, FiCalendar, FiCheck, FiClock, FiX, FiAlertTriangle,
  FiInfo, FiUpload, FiRefreshCw, FiPlay, FiMapPin, FiFileText, FiCheckCircle, FiXCircle, FiLoader
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { PageContainer } from '../components/PageContainer';
import { electron } from '../electron';

// Define constants
const STORAGE_KEYS = {
  VISIT_URL: 'formprep_url',
  FORM_JOBS: 'formprep_jobs',
  SELECTED_WEEK: 'formprep_selected_week',
  FILTER_TYPE: 'formprep_filter_type',
  FILTERED_TYPE: 'formprep_filtered_type',
  VISIBLE_COLS: 'formprep_visible_cols',
  ACTIVE_TAB: 'formprep_active_tab',
  LAST_STATUS_UPDATE: 'formprep_last_status_update',
  BATCH_JOB_ID: 'formprep_batch_job_id',
  SINGLE_JOB_ID: 'formprep_single_job_id',
  IS_POLLING_SINGLE: 'formprep_is_polling_single',
  IS_POLLING_BATCH: 'formprep_is_polling_batch',
  SEARCH_TERM: 'formprep_search_term',
  HEADLESS_MODE: 'formprep_headless_mode',
  RESUME_BATCH: 'formprep_resume_batch',
  SELECTED_VISITS: 'formprep_selected_visits',
  PREVIEW_DATA: 'formprep_preview_data',
  GROUP_BY: 'formprep_group_by',
};

// Utility functions for local storage
const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

const getFromStorage = (key: string, defaultValue: any) => {
  try {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  } catch (error) {
    console.error(`Error retrieving ${key} from localStorage:`, error);
    return defaultValue;
  }
};

// Interface definitions
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

// Main component
const FormPrep: React.FC<{}> = () => {
  // State declarations
  const [visitUrl, setVisitUrl] = useState<string>(
    getFromStorage(STORAGE_KEYS.VISIT_URL, ''));
    
  const [formJobs, setFormJobs] = useState<FormJob[]>(
    getFromStorage(STORAGE_KEYS.FORM_JOBS, []));
    
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [batchJobId, setBatchJobId] = useState<string | null>(
    getFromStorage(STORAGE_KEYS.BATCH_JOB_ID, null));
    
  const [singleJobId, setSingleJobId] = useState<string | null>(
    getFromStorage(STORAGE_KEYS.SINGLE_JOB_ID, null));
    
  const [isPolling, setIsPolling] = useState<boolean>(
    getFromStorage(STORAGE_KEYS.IS_POLLING_SINGLE, false));
    
  const [isBatchPolling, setIsBatchPolling] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>(
    getFromStorage(STORAGE_KEYS.SEARCH_TERM, ''));
    
  const [activeTab, setActiveTab] = useState<string>(
    getFromStorage(STORAGE_KEYS.ACTIVE_TAB, 'single'));
    
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedVisits, setSelectedVisits] = useState<string[]>([]);
  const [isHeadless, setIsHeadless] = useState<boolean>(
    getFromStorage(STORAGE_KEYS.HEADLESS_MODE, true));
    
  const [resumeBatch, setResumeBatch] = useState<boolean>(
    getFromStorage(STORAGE_KEYS.RESUME_BATCH, false));
    
  const [lastFailedBatch, setLastFailedBatch] = useState<any>(null);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [groupBy, setGroupBy] = useState<string>(
    getFromStorage(STORAGE_KEYS.GROUP_BY, 'date'));
    
  const { addToast } = useToast();
  const pollingIntervalRef = useRef<any>(null);
  const batchPollingIntervalRef = useRef<any>(null);

  // Function definitions and rest of component code here...
  // This is just a stub file for syntax fixing
  
  // The key part that needs to be fixed:
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-8">
            {/* Content rendering */}
            {batchJobs.length > 0 && (
              <div className="panel bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="panel-header">
                  <h2 className="panel-title flex items-center space-x-2 mb-0">
                    <FiClock className="text-primary-500 dark:text-primary-400" />
                    <span>Batch Processing History</span>
                  </h2>
                </div>
                
                <div className="mt-4">
                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Progress</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {batchJobs.map((job, index) => (
                          <tr 
                            key={index}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50
                              ${job.status === 'running' ? 'bg-primary-50 dark:bg-primary-900/20' : 
                                job.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20' : 
                                job.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' : ''
                              }
                            `}
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{job.timestamp}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${job.status === 'running' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400' :
                                  job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  job.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }
                              `}>
                                {job.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mr-2 max-w-[100px]">
                                  <div 
                                    className={`h-2.5 rounded-full ${
                                      job.status === 'completed' ? 'bg-green-500' :
                                      job.status === 'running' ? 'bg-primary-500' :
                                      job.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                                    } ${job.status === 'running' ? 'animate-pulse' : ''}`}
                                    style={{ width: `${job.completedVisits && job.totalVisits ? Math.round((job.completedVisits / job.totalVisits) * 100) : 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                  {job.completedVisits || 0}/{job.totalVisits || 0}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{job.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormPrep;
