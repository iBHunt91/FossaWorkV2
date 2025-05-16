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
  
  // Component will be built incrementally with proper structure to fix the issues
  
  // For now, create a minimal working version of the component
  const renderContent = () => {
    return React.createElement('div', { className: 'container mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg' },
      React.createElement('h1', { className: 'text-2xl font-bold mb-4 text-gray-800 dark:text-white' }, 'Form Prep Fixed'),
      
      // Tabs section
      React.createElement('div', { className: 'flex border-b border-gray-200 dark:border-gray-700 mb-4' },
        React.createElement('button', { 
          onClick: () => setActiveTab('single'),
          className: `px-4 py-2 font-medium ${activeTab === 'single' 
            ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
        }, 'Single Form'),
        
        React.createElement('button', { 
          onClick: () => setActiveTab('batch'),
          className: `px-4 py-2 font-medium ${activeTab === 'batch' 
            ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
        }, 'Batch Processing')
      ),
      
      // Display loading state or content based on active tab
      isLoading 
        ? React.createElement('div', { className: 'p-6 text-center' }, 'Loading...')
        : (activeTab === 'single'
          ? React.createElement('div', { className: 'space-y-6' }, 
              // Recent Jobs Panel
              formJobs.length > 0 && React.createElement('div', { className: 'panel bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6' },
                // Panel Header
                React.createElement('div', { className: 'panel-header mb-4' },
                  React.createElement('h2', { className: 'panel-title text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-2' },
                    React.createElement(FiClock, { className: 'text-primary-500 dark:text-primary-400' }),
                    React.createElement('span', null, 'Recent Jobs'),
                    // Job counts
                    React.createElement('div', { className: 'flex items-center space-x-1 ml-2' },
                      formJobs.filter(job => job.status === 'running').length > 0 && 
                      React.createElement('span', { className: 'px-1.5 py-0.5 rounded-full text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium' }, 
                        formJobs.filter(job => job.status === 'running').length, ' running'
                      ),
                      formJobs.filter(job => job.status === 'completed').length > 0 && 
                      React.createElement('span', { className: 'px-1.5 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium' }, 
                        formJobs.filter(job => job.status === 'completed').length, ' completed'
                      ),
                      formJobs.filter(job => job.status === 'error').length > 0 && 
                      React.createElement('span', { className: 'px-1.5 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium' }, 
                        formJobs.filter(job => job.status === 'error').length, ' failed'
                      )
                    )
                  )
                ),
                
                // Table container
                React.createElement('div', { className: 'overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700' },
                  React.createElement('table', { className: 'min-w-full divide-y divide-gray-200 dark:divide-gray-700' },
                    // Table header
                    React.createElement('thead', { className: 'bg-gray-50 dark:bg-gray-800' },
                      React.createElement('tr', null,
                        React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider' }, 'Status'),
                        React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider' }, 'Visit'),
                        React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider' }, 'Time'),
                        React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider' }, 'Mode')
                      )
                    ),
                    // Table body - should contain all the rows with job info
                    React.createElement('tbody', { className: 'bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700' },
                      formJobs.map((job, index) => {
                        // Extract visit information
                        const visitInfo = job.url ? extractVisitInfo(job.url) : { storeName: 'Unknown', visitNumber: 'N/A', dispenserCount: 0 };
                        const cleanStoreName = visitInfo.storeName.replace(/^Store\s*-\s*/i, '');
                        
                        return React.createElement('tr', { 
                          key: index,
                          className: `
                            ${job.status === 'running' 
                              ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-primary-500 shadow-sm' 
                              : job.status === 'completed' 
                                ? 'bg-accent-green-50 dark:bg-accent-green-900/20 border-l-2 border-green-500' 
                                : job.status === 'error' 
                                  ? 'bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500'
                                  : index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                            }
                            hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-150
                            cursor-pointer group relative
                          `
                        },
                        // Status cell
                        React.createElement('td', { className: 'px-4 py-3 whitespace-nowrap' },
                          React.createElement('div', { className: 'flex items-center' },
                            React.createElement('div', { className: `flex items-center justify-center w-8 h-8 rounded-full 
                              ${job.status === 'running' ? 'bg-primary-100 dark:bg-primary-800/50 text-primary-600 dark:text-primary-400 animate-pulse' :
                                job.status === 'completed' ? 'bg-green-100 dark:bg-green-800/50 text-green-600 dark:text-green-400' :
                                job.status === 'error' ? 'bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-400' :
                                'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                              } mr-2`
                            },
                            job.status === 'running' ? 
                              React.createElement('svg', { 
                                className: 'w-4 h-4 animate-spin', 
                                fill: 'none', 
                                stroke: 'currentColor', 
                                viewBox: '0 0 24 24' 
                              },
                                React.createElement('path', { 
                                  strokeLinecap: 'round', 
                                  strokeLinejoin: 'round', 
                                  strokeWidth: 2, 
                                  d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' 
                                })
                              ) :
                            job.status === 'completed' ?
                              React.createElement('svg', { 
                                className: 'w-4 h-4', 
                                fill: 'none', 
                                stroke: 'currentColor', 
                                viewBox: '0 0 24 24' 
                              },
                                React.createElement('path', { 
                                  strokeLinecap: 'round', 
                                  strokeLinejoin: 'round', 
                                  strokeWidth: 2, 
                                  d: 'M5 13l4 4L19 7' 
                                })
                              ) :
                            job.status === 'error' ?
                              React.createElement('svg', { 
                                className: 'w-4 h-4', 
                                fill: 'none', 
                                stroke: 'currentColor', 
                                viewBox: '0 0 24 24' 
                              },
                                React.createElement('path', { 
                                  strokeLinecap: 'round', 
                                  strokeLinejoin: 'round', 
                                  strokeWidth: 2, 
                                  d: 'M6 18L18 6M6 6l12 12' 
                                })
                              ) :
                              React.createElement('svg', { 
                                className: 'w-4 h-4', 
                                fill: 'none', 
                                stroke: 'currentColor', 
                                viewBox: '0 0 24 24' 
                              },
                                React.createElement('path', { 
                                  strokeLinecap: 'round', 
                                  strokeLinejoin: 'round', 
                                  strokeWidth: 2, 
                                  d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' 
                                })
                              )
                            ),
                            React.createElement('span', { 
                              className: `font-medium text-sm capitalize
                                ${job.status === 'running' ? 'text-primary-700 dark:text-primary-400' :
                                  job.status === 'completed' ? 'text-green-700 dark:text-green-400' :
                                  job.status === 'error' ? 'text-red-700 dark:text-red-400' :
                                  'text-gray-700 dark:text-gray-300'
                                }`
                            }, job.status)
                          ),
                          // Additional job progress details would go here
                          React.createElement('div', { className: "text-xs text-gray-500 dark:text-gray-400 mt-1 min-h-[3.75rem]" },
                            job.message
                          )
                        ),
                        
                        // Visit information cell
                        React.createElement('td', { className: 'px-4 py-3 text-sm' },
                          React.createElement('div', { className: 'flex flex-col' },
                            React.createElement('div', { className: 'font-medium text-gray-700 dark:text-gray-300 flex items-center mb-1' },
                              React.createElement('div', { 
                                className: `w-2 h-2 rounded-full ${
                                  job.status === 'running' ? 'bg-primary-500 animate-pulse' :
                                  job.status === 'completed' ? 'bg-green-500' :
                                  job.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                                } mr-2 flex-shrink-0`
                              }),
                              cleanStoreName
                            ),
                            React.createElement('div', { className: 'text-xs text-gray-500 dark:text-gray-400 flex items-center mb-1 ml-4' },
                              React.createElement('span', { className: 'font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded' }, `#${visitInfo.visitNumber}`)
                            ),
                            visitInfo.dispenserCount > 0 && React.createElement('div', { className: 'text-xs text-gray-500 dark:text-gray-400 flex items-center ml-4' },
                              React.createElement('span', { className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full px-2 py-0.5 text-xs flex items-center shadow-sm' },
                                React.createElement('svg', { 
                                  className: 'w-3 h-3 mr-0.5',
                                  fill: 'none',
                                  stroke: 'currentColor',
                                  viewBox: '0 0 24 24'
                                },
                                  React.createElement('path', {
                                    strokeLinecap: 'round',
                                    strokeLinejoin: 'round',
                                    strokeWidth: 2,
                                    d: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
                                  })
                                ),
                                React.createElement('span', { className: 'font-medium' }, 'Dispensers:'),
                                React.createElement('span', { className: 'ml-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-300 rounded px-1.5 font-semibold' }, visitInfo.dispenserCount)
                              )
                            )
                          )
                        ),
                        
                        // Time information cell
                        React.createElement('td', { className: 'px-4 py-3 text-sm text-gray-500 dark:text-gray-400' },
                          React.createElement('div', { className: 'flex flex-col space-y-1' },
                            React.createElement('div', { className: 'flex items-center space-x-2' },
                              React.createElement('div', { className: 'flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-800/30 text-indigo-600 dark:text-indigo-400' },
                                React.createElement(FiClock, { className: 'h-4 w-4' })
                              ),
                              React.createElement('div', null,
                                React.createElement('div', { className: 'font-medium text-gray-700 dark:text-gray-300' }, job.timestamp),
                                job.startTime && React.createElement('div', { className: 'flex items-center text-xs mt-0.5' },
                                  React.createElement('span', { className: 'inline-flex items-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md' },
                                    React.createElement('svg', {
                                      className: 'w-3 h-3 mr-1',
                                      fill: 'none',
                                      stroke: 'currentColor',
                                      viewBox: '0 0 24 24'
                                    },
                                      React.createElement('path', {
                                        strokeLinecap: 'round',
                                        strokeLinejoin: 'round',
                                        strokeWidth: 2,
                                        d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                                      })
                                    ),
                                    formatDuration(job.startTime, job.endTime)
                                  )
                                )
                              )
                            ),
                            job.status === 'completed' && job.startTime && job.endTime && React.createElement('div', {
                              className: 'flex items-center text-xs text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-md self-start'
                            },
                              React.createElement(FiCheckCircle, { className: 'w-4 h-4 mr-1.5 flex-shrink-0' }),
                              React.createElement('span', null, `Completed ${new Date(job.endTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`)
                            ),
                            job.status === 'error' && job.startTime && job.endTime && React.createElement('div', {
                              className: 'flex items-center text-xs text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-md self-start'
                            },
                              React.createElement(FiXCircle, { className: 'w-4 h-4 mr-1.5 flex-shrink-0' }),
                              React.createElement('span', null, `Failed ${new Date(job.endTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`)
                            )
                          )
                        ),
                        
                        // Mode information cell
                        React.createElement('td', { className: 'px-4 py-3 text-sm text-gray-500 dark:text-gray-400' },
                          React.createElement('div', { className: 'flex items-center' },
                            job.headless 
                              ? React.createElement('span', { className: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300' },
                                  React.createElement('svg', {
                                    className: 'w-3 h-3 mr-1',
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    viewBox: '0 0 24 24'
                                  },
                                    React.createElement('path', {
                                      strokeLinecap: 'round',
                                      strokeLinejoin: 'round',
                                      strokeWidth: 2,
                                      d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                                    }),
                                    React.createElement('path', {
                                      strokeLinecap: 'round',
                                      strokeLinejoin: 'round',
                                      strokeWidth: 2,
                                      d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                                    })
                                  ),
                                  'Headless'
                                )
                              : React.createElement('span', { className: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800/40 text-blue-800 dark:text-blue-300' },
                                  React.createElement('svg', {
                                    className: 'w-3 h-3 mr-1',
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    viewBox: '0 0 24 24'
                                  },
                                    React.createElement('path', {
                                      strokeLinecap: 'round',
                                      strokeLinejoin: 'round',
                                      strokeWidth: 2,
                                      d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                                    }),
                                    React.createElement('path', {
                                      strokeLinecap: 'round',
                                      strokeLinejoin: 'round',
                                      strokeWidth: 2,
                                      d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                                    })
                                  ),
                                  'Visible'
                                )
                          )
                        )
                      )})
                    )
                  )
                )
              )
            )
          : React.createElement('div', { className: 'p-4' }, 'Batch processing will be implemented here')
        )
    );
  };
  
  return renderContent();
};

export default FormPrepFixed;
