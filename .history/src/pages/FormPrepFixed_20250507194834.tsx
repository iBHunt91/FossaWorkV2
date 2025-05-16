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
                            job.status === 'completed' 
                              ? React.createElement('span', { className: 'font-medium text-green-600 dark:text-green-400' }, 'Form completed successfully')
                              : job.status === 'idle' || job.status === 'running'
                                ? (() => {
                                    // Extract Premium and Dispenser info for better display
                                    let premium = "";
                                    let dispenser = "";
                                    let premiumCurrent = 0;
                                    let premiumTotal = 0;
                                    let dispenserCurrent = 0;
                                    let dispenserTotal = 0;
                                    
                                    // Try to extract values from different formats of messages
                                    if (job.message) {
                                      // Check for premium or other fuel types (improved regex)
                                      const fuelTypes = ['premium', 'regular', 'plus', 'diesel', 'supreme', 'unleaded', 'mid-grade', 'midgrade', 'super', 'ethanol-free', 'ethanol free', 'fuel type', 'fuel grade'];
                                      const fuelTypePattern = fuelTypes.join('|');
                                      const premiumRegex = new RegExp(`(?:processing\\s+)?(${fuelTypePattern})(?:[^\\(]*)?\\s*\\(?([0-9]+)\\/([0-9]+)\\)?`, 'i');
                                      const premiumMatch = job.message.match(premiumRegex);
                                      
                                      if (premiumMatch && premiumMatch[1] && premiumMatch[2] && premiumMatch[3]) {
                                        // Extract the properly capitalized fuel type name
                                        const matchedType = premiumMatch[1].trim().toLowerCase();
                                        
                                        // Always display "Fuel Grade" and append the specific grade if known
                                        let hasSpecificGrade = false;
                                        premium = "Fuel Grade";
                                        
                                        // Add the specific grade if it's not already "fuel grade" or "fuel type"
                                        if (matchedType !== 'fuel grade' && matchedType !== 'fuel type') {
                                          hasSpecificGrade = true;
                                          // Special handling for common fuel types
                                          let specificGrade = "";
                                          if (matchedType.includes('ethanol')) {
                                            specificGrade = 'Ethanol-Free';
                                          }
                                          else if (matchedType === 'midgrade' || matchedType === 'mid-grade') {
                                            specificGrade = 'Mid-Grade';
                                          }
                                          else {
                                            // Standard capitalization for other fuel types
                                            specificGrade = matchedType.charAt(0).toUpperCase() + matchedType.slice(1);
                                          }
                                          
                                          // Append the specific grade to "Fuel Grade"
                                          premium = `Fuel Grade: ${specificGrade}`;
                                        }
                                        
                                        // Only set the current/total numbers if we have a specific grade
                                        if (hasSpecificGrade) {
                                          premiumCurrent = parseInt(premiumMatch[2]);
                                          premiumTotal = parseInt(premiumMatch[3]);
                                        }
                                      }
                                      
                                      // Check for dispenser (improved regex)
                                      const dispenserRegex = /(?:dispenser|pump|meter)(?:[\s#:]+)(\d+)(?:[^\d]+(\d+)|)/i;
                                      const dispenserMatch = job.message.match(dispenserRegex);
                                      
                                      if (dispenserMatch && dispenserMatch[1]) {
                                        dispenser = "Dispenser";
                                        dispenserCurrent = parseInt(dispenserMatch[1]);
                                        
                                        // Always prioritize the job's dispenserCount when calculating percentage
                                        if (job.dispenserCount) {
                                          dispenserTotal = job.dispenserCount;
                                        } 
                                        // Fall back to parsed value if job.dispenserCount is not available
                                        else if (dispenserMatch[2]) {
                                          dispenserTotal = parseInt(dispenserMatch[2]);
                                        }
                                        // Provide a minimum fallback value to prevent divide-by-zero errors
                                        else {
                                          dispenserTotal = 1;
                                        }
                                      }
                                    }
                                    
                                    // Calculate percentages for progress bars
                                    const premiumPercent = premiumTotal > 0 ? Math.round((premiumCurrent / premiumTotal) * 100) : 0;
                                    
                                    // For dispensers, prioritize using the job's known dispenser count for more accuracy
                                    const authoritativeTotalForPercent = job.dispenserCount || dispenserTotal || 1;
                                    
                                    // Fix the percentage calculation to ensure it reaches 100% at the last dispenser
                                    let dispenserPercent = 0;
                                    if (dispenserCurrent && authoritativeTotalForPercent) {
                                      // Calculate progress
                                      if (authoritativeTotalForPercent === 1) {
                                        // If there's only one dispenser, use percentage based on whether it's started (50%) or not
                                        dispenserPercent = job.status === 'running' ? 50 : 0;
                                      } else {
                                        // For multiple dispensers, calculate based on completion of previous dispensers
                                        const percentPerDispenser = 100 / authoritativeTotalForPercent;
                                        const completedProgress = (dispenserCurrent - 1) * percentPerDispenser;
                                        const currentDispenserProgress = percentPerDispenser * 0.5;
                                        dispenserPercent = Math.round(completedProgress + currentDispenserProgress);
                                        dispenserPercent = Math.min(dispenserPercent, 100);
                                      }
                                    }
                                    
                                    // Determine color based on progress
                                    const getPremiumColor = () => {
                                      if (premiumPercent < 30) return 'bg-blue-400';
                                      if (premiumPercent < 70) return 'bg-blue-500';
                                      return 'bg-blue-600';
                                    };
                                    
                                    const getDispenserColor = () => {
                                      if (dispenserPercent < 30) return 'bg-amber-400';
                                      if (dispenserPercent < 70) return 'bg-amber-500';
                                      return 'bg-amber-600';
                                    };
                                    
                                    // Pulse animation class for running jobs
                                    const pulseAnimation = job.status === 'running' ? 'animate-pulse' : '';
                                    
                                    // Determine overall progress: if dispensers are being processed, use dispenser progress. Otherwise, use premium/fuel grade.
                                    const overallProgress = dispenserCurrent > 0 ? dispenserPercent : premiumPercent;
                                    const progressLabel = dispenserCurrent > 0 ? dispenser : premium;
                                    const currentProgressCount = dispenserCurrent > 0 ? dispenserCurrent : premiumCurrent;
                                    const totalProgressCount = dispenserCurrent > 0 ? authoritativeTotalForPercent : premiumTotal;
                                    
                                    // Progress visualization
                                    return React.createElement('div', { className: 'flex flex-col h-24 justify-center' }, 
                                      // Dispenser progress
                                      React.createElement('div', { className: 'relative h-8 mb-3' },
                                        React.createElement('div', { className: 'flex items-center justify-between mb-1' },
                                          React.createElement('span', { className: 'flex items-center font-medium text-amber-600 dark:text-amber-400 text-xs' },
                                            React.createElement('svg', { 
                                              className: 'w-3.5 h-3.5 mr-1', 
                                              fill: 'currentColor', 
                                              viewBox: '0 0 20 20'
                                            },
                                              React.createElement('path', {
                                                fillRule: 'evenodd',
                                                d: 'M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 000 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 000 2h.01a1 1 0 000-2H7zm2 1a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm4-4a1 1 0 100 2h.01a1 1 0 100-2H13zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zM7 8a1 1 0 000 2h.01a1 1 0 000-2H7z',
                                                clipRule: 'evenodd'
                                              })
                                            ),
                                            React.createElement('span', { className: 'font-semibold' }, dispenser || "Dispenser")
                                          ),
                                          React.createElement('div', { className: 'flex items-center space-x-2' },
                                            dispenserCurrent > 0 ?
                                              React.createElement('span', { className: 'text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300' },
                                                (dispenser && dispenser !== "Dispenser") ? 
                                                  dispenser.replace("Dispenser ", "") : `#${dispenserCurrent}`
                                              ) :
                                              React.createElement('span', { className: 'text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-500' },
                                                'Loading...'
                                              ),
                                            React.createElement('span', { 
                                              className: `text-xs font-mono px-1.5 py-0.5 rounded-full 
                                                ${dispenserCurrent > 0 ? 
                                                  (dispenserPercent >= 75 ? 'bg-green-100 text-green-700 dark:bg-green-800/40 dark:text-green-400' : 
                                                  dispenserPercent >= 25 ? 'bg-amber-100 text-amber-700 dark:bg-amber-800/40 dark:text-amber-400' : 
                                                  'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400') :
                                                  'bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-500'}`
                                            }, dispenserCurrent > 0 ? `${dispenserPercent}%` : 'Waiting...')
                                          )
                                        ),
                                        React.createElement('div', { className: 'w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden' },
                                          dispenserCurrent > 0 ?
                                            React.createElement('div', { 
                                              className: `${getDispenserColor()} h-2 rounded-full transition-all duration-500 ease-in-out ${pulseAnimation}`,
                                              style: { width: `${dispenserPercent}%` }
                                            }) :
                                            React.createElement('div', { className: 'flex w-full h-2 animate-pulse' },
                                              React.createElement('div', { className: 'w-1/5 h-2 bg-amber-300 dark:bg-amber-700/50 rounded-l-full' }),
                                              React.createElement('div', { className: 'w-4/5 h-2 bg-gray-300 dark:bg-gray-600/50 rounded-r-full' })
                                            )
                                        )
                                      ),
                                      
                                      // Fuel grade progress
                                      React.createElement('div', { className: `relative ${premium ? 'opacity-100' : 'opacity-0'} h-8` },
                                        React.createElement('div', { className: 'flex items-center justify-between mb-1' },
                                          React.createElement('span', { className: 'flex items-center font-medium text-blue-600 dark:text-blue-400 text-xs' },
                                            React.createElement('svg', { 
                                              className: 'w-3.5 h-3.5 mr-1', 
                                              fill: 'currentColor', 
                                              viewBox: '0 0 20 20'
                                            },
                                              React.createElement('path', {
                                                fillRule: 'evenodd',
                                                d: 'M5 17a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5zm12-10a1 1 0 00-1-1h-3a1 1 0 00-1 1v6a1 1 0 001 1h3a1 1 0 001-1V7z',
                                                clipRule: 'evenodd'
                                              })
                                            ),
                                            React.createElement('span', { className: 'font-semibold' }, premium)
                                          ),
                                          React.createElement('div', { className: 'flex items-center space-x-2' },
                                            React.createElement('span', { className: 'text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300' },
                                              premium && premium !== "Fuel Grade" ? 
                                                `${premiumCurrent}/${premiumTotal}` : 
                                                "Ready"
                                            ),
                                            React.createElement('span', { 
                                              className: `text-xs font-mono px-1.5 py-0.5 rounded-full 
                                                ${premiumPercent >= 75 ? 'bg-green-100 text-green-700 dark:bg-green-800/40 dark:text-green-400' : 
                                                  premiumPercent >= 25 ? 'bg-blue-100 text-blue-700 dark:bg-blue-800/40 dark:text-blue-400' : 
                                                  'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400'}`
                                            }, premium && premium !== "Fuel Grade" ? 
                                                `${premiumPercent}%` : 
                                                "Waiting..."
                                            )
                                          )
                                        ),
                                        React.createElement('div', { className: 'w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden' },
                                          React.createElement('div', { 
                                            className: `${getPremiumColor()} h-2 rounded-full transition-all duration-500 ease-in-out ${pulseAnimation}`,
                                            style: { width: `${premiumPercent}%` }
                                          })
                                        )
                                      ),
                                      
                                      // Show raw message if no progress indicators are available
                                      !premium && !dispenser && React.createElement('div', { className: 'flex h-full items-center' },
                                        React.createElement('span', null, job.message)
                                      )
                                    );
                                  })()
                                : job.status === 'error' 
                                  ? React.createElement('span', { className: 'text-red-500 dark:text-red-400' }, job.message) 
                                  : React.createElement('span', null, job.message)
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
          )
        )
    );
  };
  
  return renderContent();
};

export default FormPrepFixed;
