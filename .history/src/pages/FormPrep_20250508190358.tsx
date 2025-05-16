import React, { useState, useEffect } from 'react';
import { 
  FiPlay, FiCheck, FiX, FiUpload, FiInfo, 
  FiExternalLink, FiFileText, FiClipboard, FiSearch, 
  FiChevronDown, FiEye, FiRefreshCw, FiFilter,
  FiClock, FiMapPin, FiCheckCircle, FiXCircle
} from 'react-icons/fi';
// Import work order data from the local data file
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

// Storage keys for localStorage - make user-specific
const getUserStorageKeys = (userId: string = 'default') => ({
  FORM_JOBS: `form_prep_jobs_${userId}`,
  SINGLE_JOB_ID: `form_prep_single_job_id_${userId}`,
  BATCH_JOB_ID: `form_prep_batch_job_id_${userId}`,
  IS_POLLING_SINGLE: `form_prep_is_polling_single_${userId}`,
  LAST_STATUS_UPDATE: `form_prep_last_status_update_${userId}`,
  VISIT_URL: `form_prep_visit_url_${userId}`
});

// Default storage keys when no user is selected
const STORAGE_KEYS = getUserStorageKeys();

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
  jobId?: string; 
  // Fields for detailed progress tracking
  currentVisitId?: string;
  currentVisitName?: string;
  currentVisitStatus?: string;
  currentVisitPhase?: 'setup' | 'forms' | 'filling' | 'saving';
  formsTotal?: number;
  formsCurrent?: number;
  startTime?: number;
  endTime?: number;
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

// Add the enhanced BatchAutomationStatus interface before the BatchJob interface
interface BatchAutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
  completedVisits?: number;
  totalVisits?: number;
  currentVisit?: string;
  currentVisitStatus?: string;
  timestamp?: string;
}

const FormPrep: React.FC<{}> = () => {
  const { isDarkMode } = useTheme();
  // Initialize empty work orders array, it will be populated via API
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [visitUrl, setVisitUrl] = useState<string>('');
  const [batchFilePath, setBatchFilePath] = useState<string>('data/scraped_content.json');
  // Get active user ID for user-specific storage
  const [activeUserId, setActiveUserId] = useState<string>(() => 
    localStorage.getItem('activeUserId') || 'default');
  // Create user-specific storage keys
  const [userStorageKeys, setUserStorageKeys] = useState(() => 
    getUserStorageKeys(activeUserId));
  // Use localStorage for persistent state between navigations with user-specific keys
  const [formJobs, setFormJobs] = useState<FormJob[]>(() => 
    getFromStorage(userStorageKeys.FORM_JOBS, []));
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isHeadless, setIsHeadless] = useState<boolean>(true);
  const [batchJobId, setBatchJobId] = useState<string | null>(() => 
    getFromStorage(userStorageKeys.BATCH_JOB_ID, null));
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null);
  const [singleJobId, setSingleJobId] = useState<string | null>(() => 
    getFromStorage(userStorageKeys.SINGLE_JOB_ID, null));
  const [pollingSingle, setPollingSingle] = useState<boolean>(() => 
    getFromStorage(userStorageKeys.IS_POLLING_SINGLE, false));
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
  
  // Persist state to localStorage when it changes
  useEffect(() => {
    saveToStorage(userStorageKeys.FORM_JOBS, formJobs);
  }, [formJobs, userStorageKeys]);
  
  useEffect(() => {
    saveToStorage(userStorageKeys.SINGLE_JOB_ID, singleJobId);
  }, [singleJobId, userStorageKeys]);
  
  useEffect(() => {
    saveToStorage(userStorageKeys.BATCH_JOB_ID, batchJobId);
  }, [batchJobId, userStorageKeys]);
  
  useEffect(() => {
    saveToStorage(userStorageKeys.IS_POLLING_SINGLE, pollingSingle);
  }, [pollingSingle, userStorageKeys]);
  
  useEffect(() => {
    saveToStorage(userStorageKeys.VISIT_URL, visitUrl);
  }, [visitUrl, userStorageKeys]);
  
  // Persistent background polling system using intervals
  useEffect(() => {
    // Only set up continuous polling if we have an active job ID
    if (singleJobId && pollingSingle) {
      console.log('Starting continuous background polling:', singleJobId);
      
      // Check status immediately on mount
      getFormAutomationStatus().then(status => {
        if (status) {
          updateJobStatus(status);
        }
      }).catch(error => {
        console.error('Error getting initial status:', error);
      });
      
      // Set up polling interval that persists across navigations
      const intervalId = setInterval(async () => {
        try {
          // Check if we need to continue polling
          const currentJobId = getFromStorage(userStorageKeys.SINGLE_JOB_ID, null);
          const isCurrentlyPolling = getFromStorage(userStorageKeys.IS_POLLING_SINGLE, false);
          
          if (!currentJobId || !isCurrentlyPolling) {
            console.log('Stopping polling interval as job is no longer active');
            clearInterval(intervalId);
            return;
          }
          
          // Save timestamp of polling attempt
          saveToStorage(userStorageKeys.LAST_STATUS_UPDATE, new Date().toISOString());
          
          // Get current status from server
          const status = await getFormAutomationStatus();
          
          // Only process if we still have an active polling state
          if (status) {
            // Store the latest status in storage for persistence
            updateJobStatus(status);
            
            // If job is completed or errored, stop polling
            if (status.status === 'completed' || status.status === 'error') {
              saveToStorage(userStorageKeys.IS_POLLING_SINGLE, false);
              saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error('Error in background polling:', error);
          // Don't stop polling on network errors
        }
      }, 2000); // Poll every 2 seconds
      
      // Clean up
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [singleJobId, pollingSingle, userStorageKeys]);
  
  // Function to update job status across localStorage and state
  const updateJobStatus = (status: any) => {
    if (!status) return;
    
    // Get the stored jobs and update the relevant one
    const storedJobs = getFromStorage(userStorageKeys.FORM_JOBS, []);
    const activeJobIndex = storedJobs.findIndex((job: FormJob) => job.status === 'running');
    
    if (activeJobIndex !== -1) {
      const updatedJobs = [...storedJobs];
      const jobToUpdate = updatedJobs[activeJobIndex];
      
      // Ensure we have a proper dispenser count if missing
      let dispenserCount = jobToUpdate.dispenserCount || 0;
      if (!dispenserCount) {
        // Try to extract the work order ID from the URL
        const url = jobToUpdate.url;
        const urlParts = url.split('/');
        const workUrlIndex = urlParts.findIndex((part: string) => part === 'work');
        const workOrderId = workUrlIndex >= 0 && workUrlIndex + 1 < urlParts.length 
          ? `W-${urlParts[workUrlIndex + 1]}` 
          : null;
        
        if (workOrderId) {
          dispenserCount = getDispenserCountDirect(workOrderId);
          console.log(`Updated missing dispenser count for job: ${dispenserCount}`);
        }
      }
      
      // Format message for display (reuse existing message formatting logic)
      let formattedMessage = status.message || '';
      
      if (status.status === 'running') {
        // Default message if none provided
        if (!formattedMessage || formattedMessage.trim() === '') {
          formattedMessage = 'Processing form...';
        }
        
        // Apply fuel type formatting if applicable
        const fuelTypeRegex = /processing fuel type:\s*([a-zA-Z0-9\s-]+)\s*\((\d+)\/(\d+)\)/i;
        const fuelTypeMatch = formattedMessage.match(fuelTypeRegex);
        
        if (fuelTypeMatch && fuelTypeMatch[1] && fuelTypeMatch[2] && fuelTypeMatch[3]) {
          const fuelType = fuelTypeMatch[1].trim();
          const current = fuelTypeMatch[2];
          const total = fuelTypeMatch[3];
          
          // Check if there's dispenser info
          const dispenserRegex = /dispenser(?:[\s#]+)(\d+)(?:[^\d]+(\d+)|)/i;
          const dispenserMatch = formattedMessage.match(dispenserRegex);
          
          if (dispenserMatch && dispenserMatch[1]) {
            const dispenserNum = dispenserMatch[1];
            // If there's a second capture group, use it, otherwise use the job's dispenser count
            // This ensures we always have the most accurate total dispenser count
            const dispenserTotal = dispenserMatch[2] || jobToUpdate.dispenserCount || '?';
            formattedMessage = `Processing ${fuelType} (${current}/${total}) - Dispenser #${dispenserNum}/${dispenserTotal}`;
          } else {
            formattedMessage = `Processing ${fuelType} (${current}/${total})`;
          }
        }
      }
      
      // Simplify completion messages
      if (status.status === 'completed') {
        if (formattedMessage.includes(jobToUpdate.url)) {
          formattedMessage = `Form completed successfully`;
        } else if (formattedMessage.includes('Successfully')) {
          formattedMessage = `Form completed successfully`;
        }
      }
      
      // Update the job
      const endTime = (status.status === 'completed' || status.status === 'error') ? Date.now() : undefined;
      
      updatedJobs[activeJobIndex] = {
        ...jobToUpdate,
        status: status.status,
        message: formattedMessage,
        endTime: endTime || jobToUpdate.endTime,
        _statusChanged: jobToUpdate.status !== status.status,
        _completed: status.status === 'completed' && jobToUpdate.status !== 'completed',
        _error: status.status === 'error' && jobToUpdate.status !== 'error',
        // Preserve dispenser count in the job object
        dispenserCount: dispenserCount > 0 ? dispenserCount : jobToUpdate.dispenserCount || 0
      };
      
      // Save to localStorage
      saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
      
      // Update state if component is mounted
      setFormJobs(updatedJobs);
      
      // Show completion/error toast if status just changed
      if (status.status === 'completed' && jobToUpdate.status !== 'completed') {
        addToast('success', 'Form processing completed successfully');
        
        // Clear job state on completion
        setPollingSingle(false);
        setSingleJobId(null);
        setIsProcessing(false);
      } else if (status.status === 'error' && jobToUpdate.status !== 'error') {
        addToast('error', status.message || 'An error occurred during form processing');
        
        // Clear job state on error
        setPollingSingle(false);
        setSingleJobId(null);
        setIsProcessing(false);
      }
    }
  };
  
  // Sync component state with localStorage on mount
  useEffect(() => {
    // When component mounts, check for existing jobs and status in localStorage
    const storedJobs = getFromStorage(userStorageKeys.FORM_JOBS, []);
    const storedSingleJobId = getFromStorage(userStorageKeys.SINGLE_JOB_ID, null);
    const storedIsPolling = getFromStorage(userStorageKeys.IS_POLLING_SINGLE, false);
    
    // Update component state with stored values
    setFormJobs(storedJobs);
    setSingleJobId(storedSingleJobId);
    setPollingSingle(storedIsPolling);
    
    // Set processing flag if we have an active job
    if (storedSingleJobId && storedIsPolling) {
      setIsProcessing(true);
      
      // Get current status
      getFormAutomationStatus()
        .then(status => {
          if (status) {
            updateJobStatus(status);
            
            // If job completed while away, update state
            if (status.status === 'completed' || status.status === 'error') {
              setPollingSingle(false);
              setSingleJobId(null);
              setIsProcessing(false);
            }
          }
        })
        .catch(error => {
          console.error('Error getting status on mount:', error);
        });
    }
    
    // Load work orders from API
    let isMounted = true;
    
    const fetchWorkOrders = async () => {
      setIsLoading(true);
      
      try {
        // First try to load data from the API
        const response = await fetch('/api/workorders');
        
        if (!response.ok) {
          throw new Error(`Failed to load work orders: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.workOrders && Array.isArray(data.workOrders)) {
          if (isMounted) {
            console.log('Successfully loaded', data.workOrders.length, 'work orders from API');
            setWorkOrders(data.workOrders);
          }
        } else {
          throw new Error('Invalid API data format');
        }
      } catch (error) {
        console.error('Error loading work order data:', error);
        
        try {
          // Fall back to local JSON file
          console.log('Trying to load local JSON file as fallback');
          const fileResponse = await fetch('/src/data/scraped_content.json');
          
          if (!fileResponse.ok) {
            throw new Error(`Failed to load local data: ${fileResponse.status}`);
          }
          
          const fileData = await fileResponse.json();
          
          if (isMounted && fileData.workOrders) {
            console.log('Successfully loaded', fileData.workOrders.length, 'work orders from local file');
            setWorkOrders(fileData.workOrders);
          }
        } catch (localError) {
          console.error('Error loading local work order data:', localError);
          
          // Fall back to imported data
          if (isMounted) {
            console.warn('Using static imported data as final fallback');
            setWorkOrders(workOrderData.workOrders);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchWorkOrders();
    
    return () => {
      isMounted = false;
    };
  }, [userStorageKeys]);
  
  // Effect to resume polling for active jobs when component remounts
  useEffect(() => {
    // Log existing state on mount to help debug
    console.log('FormPrep mounted with state:', {
      formJobs: formJobs.length,
      batchJobs: batchJobs.length,
      singleJobId,
      pollingSingle,
      activeJobs: formJobs.filter(job => job.status === 'running').length
    });
    
    // Check if we have active single job
    if (singleJobId && !pollingSingle) {
      console.log('Resuming polling for previous active single job:', singleJobId);
      
      // Find the job URL from formJobs
      const activeJob = formJobs.find(job => job.status === 'running');
      const activeJobUrl = activeJob?.url || '';
      
      if (!activeJobUrl) {
        console.warn('Unable to find active job URL for resuming polling');
        return;
      }
      
      // First, get the current status immediately to catch up on any missed updates
      getFormAutomationStatus()
        .then(currentStatus => {
          console.log('Current automation status on resume:', currentStatus);
          
          // Update form job with current status immediately
          if (currentStatus) {
            setFormJobs(prev => {
              const updatedJobs = [...prev];
              const jobIndex = updatedJobs.findIndex(job => 
                job.url === activeJobUrl && job.status === 'running');
              
              if (jobIndex !== -1) {
                const jobToUpdate = updatedJobs[jobIndex];
                const updatedJob = {
                  ...jobToUpdate,
                  status: currentStatus.status,
                  message: currentStatus.message || jobToUpdate.message,
                  _statusChanged: jobToUpdate.status !== currentStatus.status,
                  _completed: currentStatus.status === 'completed' && jobToUpdate.status !== 'completed',
                  _error: currentStatus.status === 'error' && jobToUpdate.status !== 'error'
                };
                
                // Set end time if job has completed or errored
                if ((currentStatus.status === 'completed' || currentStatus.status === 'error') && !jobToUpdate.endTime) {
                  updatedJob.endTime = Date.now();
                }
                
                updatedJobs[jobIndex] = updatedJob;
              }
              
              return updatedJobs;
            });
            
            // If the job is already completed/error, don't start polling
            if (currentStatus.status === 'completed' || currentStatus.status === 'error') {
              console.log('Job already completed, not starting polling');
              setSingleJobId(null); // Clear the job ID
              setPollingSingle(false);
              return;
            }
          }
          
          // Set polling flag to true to avoid duplicate polling
          setPollingSingle(true);
          
          // Then resume polling for this job
          pollingManager.current.startPolling(
            singleJobId,
            (status) => {
              // Update status handler (same as in handleSingleVisit)
              if (status) {
                setFormJobs(prev => {
                  const updatedJobs = [...prev];
                  const jobIndex = updatedJobs.findIndex(job => 
                    job.url === activeJobUrl && job.status === 'running');
                  
                  if (jobIndex !== -1) {
                    const jobToUpdate = updatedJobs[jobIndex];
                    const updatedJob = {
                      ...jobToUpdate,
                      status: status.status,
                      message: status.message || jobToUpdate.message,
                      _statusChanged: jobToUpdate.status !== status.status,
                      _completed: status.status === 'completed' && jobToUpdate.status !== 'completed',
                      _error: status.status === 'error' && jobToUpdate.status !== 'error'
                    };
                    
                    // Set end time if job has completed or errored
                    if ((status.status === 'completed' || status.status === 'error') && !jobToUpdate.endTime) {
                      updatedJob.endTime = Date.now();
                    }
                    
                    updatedJobs[jobIndex] = updatedJob;
                  }
                  
                  return updatedJobs;
                });
              }
            },
            () => {
              // Complete handler
              setPollingSingle(false);
              setSingleJobId(null);
            },
            (error) => {
              // Error handler
              console.error('Error resuming form automation:', error);
              setPollingSingle(false);
              setSingleJobId(null);
              addToast(
                'error',
                error instanceof Error ? error.message : 'An unknown error occurred'
              );
            },
            activeJobUrl // Pass the URL for context
          );
        })
        .catch(error => {
          console.error('Error getting current automation status:', error);
        });
    }
    
    // Check for active batch jobs
    if (batchJobId) {
      // Similar implementation for batch jobs if needed
      getBatchAutomationStatus()
        .then(currentStatus => {
          // Update based on current status
          // Then resume polling for batch jobs
        })
        .catch(error => {
          console.error('Error getting current batch status:', error);
        });
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Effect to update visit URL when a work order is selected
  useEffect(() => {
    if (selectedWorkOrder && selectedWorkOrder.visits?.nextVisit?.url) {
      // Construct the full URL if it's relative
      const url = selectedWorkOrder.visits.nextVisit.url;
      const fullUrl = url.startsWith('http') ? url : `https://app.workfossa.com${url}`;
      setVisitUrl(fullUrl);
    } else if (!selectedWorkOrder) {
      // Optionally clear the URL if no work order is selected
      // setVisitUrl(''); 
    }
  }, [selectedWorkOrder]);
  
  // Polling manager that persists between renders and handles all polling logic
  const pollingManager = React.useRef({
    activePolls: {} as Record<string, {
      interval: NodeJS.Timeout | null,
      firstTimeout: NodeJS.Timeout | null,
      secondTimeout: NodeJS.Timeout | null,
      finalTimeout: NodeJS.Timeout | null,
      startTime: number,
      lastStatusUpdate: number,
      forceComplete: boolean,
      lastMessage: string,
      messageUpdateTime: number,
      // Add these properties to track the context
      url: string,
      onUpdate: (status: any) => void,
      onComplete: () => void,
      onError: (error: any) => void,
      isPaused: boolean,
      resumeTime: number | null
    }>,
    
    // Start polling for a specific job ID
    startPolling: function(
      jobId: string, 
      onUpdate: (status: any) => void, 
      onComplete: () => void,
      onError: (error: any) => void,
      url: string = ''
    ) {
      // Don't start polling if it's already active
      if (this.activePolls[jobId]) {
        console.log(`🔍 Already polling for job ID: ${jobId}, ignoring duplicate start request`);
        
        // If it was paused, resume it
        if (this.activePolls[jobId].isPaused) {
          console.log(`🔍 Resuming previously paused poll for job ID: ${jobId}`);
          this.activePolls[jobId].isPaused = false;
          this.activePolls[jobId].resumeTime = Date.now();
          this.activePolls[jobId].onUpdate = onUpdate;
          this.activePolls[jobId].onComplete = onComplete;
          this.activePolls[jobId].onError = onError;
          
          // Start a new interval for polling since the old one was cleared
          this._startPollingInterval(jobId);
        }
        
        return;
      }
      
      console.log('🔍 Starting status polling for job ID:', jobId, 'at', new Date().toISOString());
      
      const startTime = Date.now();
      const lastStatusUpdate = Date.now();
      
      // First activity check after 15 seconds
      const firstTimeout = setTimeout(() => {
        console.log('🔍 15-second check - monitoring job progress');
        
        if (!this.activePolls[jobId]) return;
        
        // Only log progress, never force completion on first check
        const poll = this.activePolls[jobId];
        console.log('🔍 Job progress at 15 seconds:', poll.lastMessage);
      }, 15000);
      
      // Activity monitoring every 30 seconds
      const secondTimeout = setTimeout(() => {
        // This starts the activity monitoring system
        console.log('🔍 Starting activity monitoring for job');
        
        // Create a recurring check that runs every 30 seconds
        const activityInterval = setInterval(() => {
          if (!this.activePolls[jobId]) {
            clearInterval(activityInterval);
            return;
          }
          
          const poll = this.activePolls[jobId];
          const lastMessage = poll.lastMessage || '';
          const now = Date.now();
          const timeSinceLastChange = now - poll.messageUpdateTime;
          
          // Log current activity for debugging
          console.log(`🔍 Activity check: ${lastMessage}`);
          console.log(`🔍 Time since last activity: ${Math.round(timeSinceLastChange/1000)}s`);
          
          // Check for signs of active automation
          const isClosingBrowser = lastMessage.includes('Closing browser');
          const isFillingForms = lastMessage.includes('filling') || lastMessage.includes('entering');
          const isProcessingFuel = lastMessage.includes('Processing fuel type');
          const isNavigating = lastMessage.includes('navigating') || lastMessage.includes('next form');
          const isActive = isClosingBrowser || isFillingForms || isProcessingFuel || isNavigating;
          
          // Is the message updating frequently?
          const messageIsRecent = timeSinceLastChange < 45000; // 45 seconds
          
          if (isActive || messageIsRecent) {
            // Automation is still active, don't force completion
            console.log('🔍 Automation is still active, continuing');
            return;
          }
          
          // Check for a long inactive period (2+ minutes with no change)
          if (timeSinceLastChange > 120000) {
            console.log('🔍 No activity for 2 minutes, assuming completion');
            this.activePolls[jobId].forceComplete = true;
            onUpdate({
              status: 'completed',
              message: lastMessage || 'Processing completed'
            });
            
            // Clean up polling
            this.stopPolling(jobId);
            onComplete();
            return;
          }
          
          // Between 45s and 120s without change, just wait and check next time
          console.log('🔍 Limited activity detected, but not forcing completion yet');
          
        }, 30000); // Check every 30 seconds
        
        // Store this interval for cleanup
        // @ts-ignore
        this.activePolls[jobId].activityInterval = activityInterval;
        
      }, 30000);
      
      // Final backup (only used if the browser truly hangs)
      const finalTimeout = setTimeout(() => {
        console.log('🔍 5-minute maximum check');
        
        if (!this.activePolls[jobId]) return;
        
        // Check if browser is still active
        const poll = this.activePolls[jobId];
        const lastMessage = poll.lastMessage || '';
        const timeSinceLastMessageChange = Date.now() - poll.messageUpdateTime;
        
        const isClosingBrowser = lastMessage.includes('Closing browser');
        const messageRecentlyChanged = timeSinceLastMessageChange < 60000; // Last minute
        
        // If still actively closing or changed in the last minute, give more time
        if (isClosingBrowser || messageRecentlyChanged) {
          console.log('🔍 Still active at 5 minutes, giving a bit more time');
          return;
        }
        
        console.log('🔍 Reached 5-minute maximum, forcing completion');
        this.activePolls[jobId].forceComplete = true;
        onUpdate({
          status: 'completed',
          message: lastMessage || 'Processing completed (maximum duration reached)'
        });
        
        // Clean up polling
        this.stopPolling(jobId);
        onComplete();
      }, 300000); // 5 minutes max
      
      // Store all the timers and state
      this.activePolls[jobId] = {
        interval: null, // We'll set this after creating the poll object
        firstTimeout,
        secondTimeout,
        finalTimeout,
        startTime,
        lastStatusUpdate,
        forceComplete: false,
        lastMessage: '',
        messageUpdateTime: Date.now(),
        // Store context for resuming
        url,
        onUpdate,
        onComplete,
        onError,
        isPaused: false,
        resumeTime: null
      };
      
      // Start the interval for polling
      this._startPollingInterval(jobId);
    },
    
    // Private method to start/restart the polling interval
    _startPollingInterval: function(jobId: string) {
      if (!this.activePolls[jobId]) return;
      
      // Set up the regular polling interval
      const interval = setInterval(async () => {
        // Skip if polling has been stopped or paused
        if (!this.activePolls[jobId] || this.activePolls[jobId].isPaused) {
          clearInterval(interval);
          return;
        }
        
        // Skip if we've already forced completion
        if (this.activePolls[jobId]?.forceComplete) {
          this.stopPolling(jobId);
          return;
        }
        
        try {
          // API call to check status
          const status = await getFormAutomationStatus();
          const now = Date.now();
          
          // Make sure the poll still exists before updating
          if (!this.activePolls[jobId]) {
            clearInterval(interval);
            return;
          }
          
          const poll = this.activePolls[jobId];
          
          // Update message timestamp if the message changed
          if (status.message !== poll.lastMessage) {
            // Update the polling state
            poll.messageUpdateTime = now;
            poll.lastMessage = status.message;
            poll.lastStatusUpdate = now;
          } else {
            // Just update the lastStatusUpdate
            poll.lastStatusUpdate = now;
          }
          
          // Update status in the UI via callback
          poll.onUpdate(status);
          
          // Check if we're done or errored
          if (status.status === 'completed' || status.status === 'error') {
            // Make sure we still have a reference before stopping
            if (this.activePolls[jobId]) {
              this.stopPolling(jobId);
              
              if (status.status === 'error') {
                poll.onError(new Error(status.message || 'Unknown error'));
              } else {
                poll.onComplete();
              }
            }
          }
        } catch (error) {
          console.error('Error polling for status:', error);
          // Don't stop polling on network errors, let the timeouts handle it
        }
      }, 1000); // Poll every second
      
      // Store the interval for cleanup
      if (this.activePolls[jobId]) {
        this.activePolls[jobId].interval = interval;
      }
    },
    
    // Pause polling but keep the job information (used when component unmounts)
    pausePolling: function(jobId: string) {
      console.log('🔍 Pausing polling for job ID:', jobId);
      
      if (!this.activePolls[jobId]) {
        console.log(`🔍 No active polling found for job ID: ${jobId}`);
        return;
      }
      
      const poll = this.activePolls[jobId];
      
      // Clear the interval but keep the poll data
      if (poll.interval) {
        clearInterval(poll.interval);
        poll.interval = null;
      }
      
      // Mark as paused
      poll.isPaused = true;
    },
    
    // Stop polling for a specific job ID
    stopPolling: function(jobId: string) {
      console.log('🔍 Stopping polling for job ID:', jobId);
      
      if (!this.activePolls[jobId]) {
        console.log(`🔍 No active polling found for job ID: ${jobId}`);
        return;
      }
      
      // Make a copy of the poll data before we delete it
      const pollData = { ...this.activePolls[jobId] };
      
      // Remove from active polls first to prevent race conditions
      delete this.activePolls[jobId];
      
      // Then clean up all timers
      try {
        // Clear main interval
        if (pollData.interval) {
          clearInterval(pollData.interval);
        }
        
        // Clear all timeouts
        if (pollData.firstTimeout) {
          clearTimeout(pollData.firstTimeout);
        }
        
        if (pollData.secondTimeout) {
          clearTimeout(pollData.secondTimeout);
        }
        
        if (pollData.finalTimeout) {
          clearTimeout(pollData.finalTimeout);
        }
        
        // Clear any additional intervals
        // @ts-ignore
        if (pollData.activityInterval) {
          // @ts-ignore
          clearInterval(pollData.activityInterval);
        }
        
        // @ts-ignore
        if (pollData.finalExtendedTimeout) {
          // @ts-ignore
          clearTimeout(pollData.finalExtendedTimeout);
        }
      } catch (e) {
        console.error('Error clearing timeouts:', e);
      }
    },
    
    // Stop all active polls
    stopAll: function() {
      console.log('🔍 Stopping all active polls');
      
      // Clean up each poll
      Object.keys(this.activePolls).forEach(jobId => {
        this.stopPolling(jobId);
      });
    },
    
    // Pause all active polls without removing them
    pauseAll: function() {
      console.log('🔍 Pausing all active polls');
      
      Object.keys(this.activePolls).forEach(jobId => {
        this.pausePolling(jobId);
      });
    }
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Instead of stopping all polls, pause them so they can be resumed
      pollingManager.current.pauseAll();
    };
  }, []);
  
  // Group work orders by week
  const groupedWorkOrders = React.useMemo(() => {
    if (!workOrders.length) return [];
    
    const groups: { week: string; orders: WorkOrder[] }[] = [];
    const ordersByWeek = new Map<string, WorkOrder[]>();
    
    // Sort orders by date first
    const sortedOrders = [...workOrders].sort((a, b) => {
      const dateA = a.visits.nextVisit.date ? new Date(a.visits.nextVisit.date) : new Date();
      const dateB = b.visits.nextVisit.date ? new Date(b.visits.nextVisit.date) : new Date();
      return dateA.getTime() - dateB.getTime();
    });
    
    // Group by week
    sortedOrders.forEach(order => {
      let weekLabel = 'No Date';
      
      if (order.visits.nextVisit.date) {
        const date = new Date(order.visits.nextVisit.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        // Format date range for the week
        const firstDayOfWeek = new Date(date);
        firstDayOfWeek.setDate(date.getDate() - date.getDay()); // Start with Sunday
        
        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6); // End with Saturday
        
        // Format as Month/Day - Month/Day without year
        const firstMonth = firstDayOfWeek.getMonth() + 1;
        const lastMonth = lastDayOfWeek.getMonth() + 1;
        const firstDay = firstDayOfWeek.getDate();
        const lastDay = lastDayOfWeek.getDate();
        
        if (firstMonth === lastMonth) {
          // Same month - always show month in both dates
          weekLabel = `${firstMonth}/${firstDay} - ${firstMonth}/${lastDay}`;
        } else {
          // Different months
          weekLabel = `${firstMonth}/${firstDay} - ${lastMonth}/${lastDay}`;
        }
      }
      
      if (!ordersByWeek.has(weekLabel)) {
        ordersByWeek.set(weekLabel, []);
      }
      
      ordersByWeek.get(weekLabel)?.push(order);
    });
    
    // Convert map to array
    ordersByWeek.forEach((orders, week) => {
      groups.push({ week, orders });
    });
    
    return groups;
  }, [workOrders]);
  
  // Filter work orders based on search term
  const filteredWorkOrders = React.useMemo(() => {
    if (!searchTerm) {
      return groupedWorkOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length
        ? groupedWorkOrders[currentWeekIndex].orders
        : [];
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    
    return groupedWorkOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length
      ? groupedWorkOrders[currentWeekIndex].orders.filter(order => 
          order.customer.name.toLowerCase().includes(searchTermLower) ||
          order.customer.storeNumber.toLowerCase().includes(searchTermLower) ||
          (order.id && order.id.toLowerCase().includes(searchTermLower))
        )
      : [];
  }, [groupedWorkOrders, currentWeekIndex, searchTerm]);
  
  // Navigation functions
  const goToPreviousWeek = () => {
    if (currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1);
    }
  };
  
  const goToNextWeek = () => {
    if (currentWeekIndex < groupedWorkOrders.length - 1) {
      setCurrentWeekIndex(currentWeekIndex + 1);
    }
  };
  
  const goToCurrentWeek = () => {
    // Find the current week or the next upcoming week
    const today = new Date();
    
    // Get the current week's Sunday-Saturday range
    const currentSunday = new Date(today);
    currentSunday.setDate(today.getDate() - today.getDay()); // Move to Sunday
    
    const currentSaturday = new Date(currentSunday);
    currentSaturday.setDate(currentSunday.getDate() + 6); // Move to Saturday
    
    // Format the same way we do in our grouping function
    const firstMonth = currentSunday.getMonth() + 1;
    const firstDay = currentSunday.getDate();
    const lastMonth = currentSaturday.getMonth() + 1;
    const lastDay = currentSaturday.getDate();
    
    let currentWeekLabel;
    if (firstMonth === lastMonth) {
      // Same month - always show month in both dates
      currentWeekLabel = `${firstMonth}/${firstDay} - ${firstMonth}/${lastDay}`;
    } else {
      currentWeekLabel = `${firstMonth}/${firstDay} - ${lastMonth}/${lastDay}`;
    }
    
    const weekIndex = groupedWorkOrders.findIndex(group => group.week === currentWeekLabel);
    
    if (weekIndex !== -1) {
      setCurrentWeekIndex(weekIndex);
    } else {
      // If current week not found, find the next upcoming week
      const today = new Date();
      const todayTimestamp = today.getTime();
      
      // Sort weeks by start date
      const futureWeeks = groupedWorkOrders
        .map((group, index) => {
          if (group.week === 'No Date') return { index, timestamp: Infinity };
          
          // Parse the week string to get the first date
          const [startPart] = group.week.split(' - ');
          const [month, day] = startPart.split('/').map(Number);
          
          // Create date object (use current year)
          const date = new Date();
          date.setMonth(month - 1);
          date.setDate(day);
          
          return { index, timestamp: date.getTime() };
        })
        .filter(week => week.timestamp >= todayTimestamp)
        .sort((a, b) => a.timestamp - b.timestamp);
      
      if (futureWeeks.length > 0) {
        setCurrentWeekIndex(futureWeeks[0].index);
      } else {
        // If no future weeks, go to the last week
        setCurrentWeekIndex(groupedWorkOrders.length - 1);
      }
    }
  };
  
  // Extract visit number from URL
  const extractVisitNumber = (url: string): string => {
    const match = url.match(/visits\/(\d+)/);
    return match ? match[1] : '';
  };
  
  // Extract store name and other info from a visit URL for display
  const extractVisitInfo = (url: string): { storeName: string; visitNumber: string; dispenserCount: number } => {
    // Default values
    const defaultInfo = { 
      storeName: "Unknown Store", 
      visitNumber: extractVisitNumber(url) || "Unknown", 
      dispenserCount: 0 
    };
    
    if (!url) return defaultInfo;
    
    try {
      // Extract visit ID from URL
      const visitNumber = extractVisitNumber(url);
      
      if (!visitNumber) return defaultInfo;
      
      // Extract work order ID from URL if available
      const urlParts = url.split('/');
      const workUrlIndex = urlParts.findIndex(part => part === 'work');
      const workOrderId = workUrlIndex >= 0 && workUrlIndex + 1 < urlParts.length 
        ? `W-${urlParts[workUrlIndex + 1]}` 
        : null;
      
      // First try with the work order ID extracted from URL
      if (workOrderId) {
        const dispenserCount = getDispenserCountDirect(workOrderId);
        // If we found a direct work order ID and it has dispensers, use it
        if (dispenserCount > 0) {
          // Attempt to find the matching work order to get the store name
          const matchingOrder = workOrders.find(order => order.id === workOrderId);
          return {
            storeName: matchingOrder?.customer?.name || "Unknown Store",
            visitNumber,
            dispenserCount
          };
        }
      }
      
      // Fallback: try to find matching work order by visit number
      for (const order of workOrders) {
        const orderVisitNumber = extractVisitNumber(order.visits.nextVisit.url);
        
        if (orderVisitNumber === visitNumber) {
          // Get accurate dispenser count using the better method
          const dispenserCount = getDispenserCountDirect(order.id);
          
          return {
            storeName: order.customer.name,
            visitNumber,
            dispenserCount
          };
        }
      }
      
      return { 
        ...defaultInfo,
        visitNumber
      };
    } catch (error) {
      console.error('Error extracting visit info:', error);
      return defaultInfo;
    }
  };
  
  // Update getDispenserCountDirect to retrieve from dispenserDetails if available
  const getDispenserCountDirect = (workOrderId: string): number => {
    // First check if we already have the dispenser details loaded
    if (dispenserDetails && dispenserDetails[workOrderId] && dispenserDetails[workOrderId].dispensers) {
      return dispenserDetails[workOrderId].dispensers.length;
    }
    
    // Then check if dispensers array is available in the work order
    const workOrder = workOrders.find(order => order.id === workOrderId);
    
    // First check if dispensers array is available and has content
    if (workOrder?.dispensers && workOrder.dispensers.length > 0) {
      // Filter out any incomplete/invalid dispensers that might inflate the count
      const validDispensers = workOrder.dispensers.filter(
        dispenser => dispenser.serial || dispenser.make || dispenser.model
      );
      return validDispensers.length > 0 ? validDispensers.length : workOrder.dispensers.length;
    }
    
    // Fallback to services if dispensers array is empty/missing
    if (workOrder?.services) {
      // Look for meter calibration services as fallback
      const meterCalibrationService = workOrder.services.find(
        service => service.type === "Meter Calibration" || 
                   service.description?.toLowerCase().includes("dispenser") ||
                   service.description?.toLowerCase().includes("meter")
      );
      
      if (meterCalibrationService?.quantity) {
        return meterCalibrationService.quantity;
      }
    }
    
    // No dispenser info available
    return 0;
  };
  
  const getStoreStyles = (storeName: string) => {
    // Default styles
    const defaultStyles = {
      bg: 'bg-gray-100 dark:bg-gray-700/50',
      border: 'border-gray-500',
      icon: 'text-gray-600 dark:text-gray-400'
    };
    
    // Normalize store name to lowercase for comparison
    const normalizedName = storeName.toLowerCase();
    
    // Define style mappings for different store names
    const styleMap: Record<string, typeof defaultStyles> = {
      // Gas stations
      'shell': {
        bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        border: 'border-yellow-500',
        icon: 'text-yellow-600 dark:text-yellow-400'
      },
      'chevron': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'exxon': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'mobil': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'bp': {
        bg: 'bg-green-100 dark:bg-green-900/20',
        border: 'border-green-500',
        icon: 'text-green-600 dark:text-green-400'
      },
      'texaco': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'arco': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'valero': {
        bg: 'bg-green-100 dark:bg-green-900/20',
        border: 'border-green-500',
        icon: 'text-green-600 dark:text-green-400'
      },
      'marathon': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'circle k': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      '7-eleven': {
        bg: 'bg-green-100 dark:bg-green-900/20',
        border: 'border-green-500',
        icon: 'text-green-600 dark:text-green-400'
      },
      'sunoco': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'costco': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'sams': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'sam': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'speedway': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'caseys': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'wawa': {
        bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        border: 'border-yellow-500',
        icon: 'text-yellow-600 dark:text-yellow-400'
      },
      'sheetz': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'maverik': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'kwik': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'quick': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'love': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'pilot': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'flying j': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'ta': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      }
    };
    
    // Find a matching style
    for (const [key, styles] of Object.entries(styleMap)) {
      if (normalizedName.includes(key)) {
        return styles;
      }
    }
    
    // Return default styles if no match
    return defaultStyles;
  };
  
  // Logic to handle single visit processing
  const handleSingleVisit = async () => {
    try {
      setIsProcessing(true);
      
      // Create a timestamp
      const timestamp = new Date().toLocaleTimeString();
      const startTime = Date.now();
      
      // Extract the work order ID from the URL if possible
      const urlParts = visitUrl.split('/');
      const workUrlIndex = urlParts.findIndex(part => part === 'work');
      const workOrderId = workUrlIndex >= 0 && workUrlIndex + 1 < urlParts.length 
        ? `W-${urlParts[workUrlIndex + 1]}` 
        : selectedWorkOrder?.id;
      
      // Get the store name and visit number from the URL
      const { storeName, visitNumber, dispenserCount: visitDispenserCount } = extractVisitInfo(visitUrl);
      
      // Get the dispenser count from the store data using the correct work order ID
      let dispenserCount = 0;
      if (workOrderId) {
        dispenserCount = getDispenserCountDirect(workOrderId);
        console.log('🔍 Work order ID for dispenser count:', workOrderId);
      } else if (selectedWorkOrder) {
        dispenserCount = getDispenserCountDirect(selectedWorkOrder.id);
      }
      
      // If still no dispenser count, use the one from visit info as fallback
      if (!dispenserCount && visitDispenserCount) {
        dispenserCount = visitDispenserCount;
      }
      
      console.log('🔍 Final dispenser count:', dispenserCount);
      
      // Add a new job to the list with the dispenser count
      const newJob: FormJob = {
        url: visitUrl,
        status: 'running',
        message: 'Initializing automation...',
        timestamp,
        headless: isHeadless,
        startTime,
        dispenserCount  // Store dispenser count in the job
      };
      
      // Add the job to state (at the beginning of the array)
      const updatedJobs = [newJob, ...formJobs];
      setFormJobs(updatedJobs);
      saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
      
      // Call API to process the visit
      const result = await processSingleVisit(visitUrl, isHeadless, visitNumber);
      
      console.log('Process visit API response:', result);
      
      // Save the job ID from the response
      if (result.jobId) {
        console.log(`Received job ID from server: ${result.jobId}`);
        setSingleJobId(result.jobId);
        saveToStorage(userStorageKeys.SINGLE_JOB_ID, result.jobId);
        
        // Also update the job in the jobs list with the ID
        const jobsWithId = [...updatedJobs];
        if (jobsWithId.length > 0) {
          jobsWithId[0] = {
            ...jobsWithId[0],
            jobId: result.jobId,
            status: 'running',
            message: 'Processing started...',
            storeName,
            visitNumber,
            dispenserCount
          };
          
          setFormJobs(jobsWithId);
          saveToStorage(userStorageKeys.FORM_JOBS, jobsWithId);
        }
                    } else {
        console.warn('No job ID received from server');
      }
      
      // Start polling for status updates
      startPolling();
            
            // Show success toast
            addToast(
              'success',
        `Processing started for ${storeName || 'visit'}`
            );
    } catch (error) {
      console.error('Error processing visit:', error);
      
        // Update the job status to error
      const errorJobs = [...formJobs];
      if (errorJobs.length > 0) {
        errorJobs[0] = {
          ...errorJobs[0],
              status: 'error',
          message: error instanceof Error ? error.message : 'An unknown error occurred',
              endTime: Date.now()
            };
        
        setFormJobs(errorJobs);
        saveToStorage(userStorageKeys.FORM_JOBS, errorJobs);
      }
      
      // Show error toast
      addToast(
        'error',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Logic to cancel form automation
  const handleStopProcessing = async () => {
    try {
      setIsProcessing(true); // Show processing state during cancellation
        
      // Get the running job to ensure we have the correct job ID
      const runningJob = formJobs.find(job => job.status === 'running');
          
      if (!runningJob && !singleJobId) {
        throw new Error('No running job found to cancel');
      }
      
      // Debug info for job ID tracking
      console.log('Cancellation request details:', {
        singleJobId,
        runningJobDetails: runningJob ? {
          url: runningJob.url,
          status: runningJob.status,
          jobId: runningJob.jobId || 'No Job ID'
        } : 'No running job in formJobs'
      });
      
      // Use the jobId from the running job record if available, otherwise fall back to singleJobId
      const jobIdToCancel = runningJob?.jobId || singleJobId;
      
      if (!jobIdToCancel) {
        throw new Error('No job ID available for cancellation');
      }
      
      // Call API to cancel the automation with the job ID
      console.log(`Using job ID for cancellation: ${jobIdToCancel}`);
      const result = await cancelFormAutomation(jobIdToCancel);
      
      // Validate cancellation was successful
      if (!result || !result.success) {
        throw new Error(result?.message || 'Failed to cancel automation process');
      }
      
      console.log('Cancellation API reported success');
      
      // Update the job status in localStorage and state
      const updatedJobs = [...formJobs];
      const jobIndex = updatedJobs.findIndex(job => job.status === 'running');
              
              if (jobIndex !== -1) {
                updatedJobs[jobIndex] = {
                  ...updatedJobs[jobIndex],
          status: 'error',
          message: 'Processing stopped by user',
          endTime: Date.now()
                };
                
        // Update both state and localStorage
        setFormJobs(updatedJobs);
        saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
      }
      
      // Clear all active intervals
      if (polling) {
        clearInterval(polling);
        setPolling(null);
      }
      
      // Reset state
      setSingleJobId(null);
      setPollingSingle(false);
            setIsProcessing(false);
      
      // Update localStorage to reflect stopped state
      saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
            
            // Show success toast
            addToast(
              'success',
        result.message || 'Processing stopped successfully'
      );
    } catch (error) {
      console.error('Error stopping automation:', error);
      setIsProcessing(false);
      
      // Show error toast
      addToast(
        'error',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    }
  };
  
  // New function to handle stopping batch process
  const handleStopBatchProcessing = async () => {
    try {
      setIsProcessing(true); // Show processing state during cancellation
      
      // Get the running batch job
      const runningBatchJob = batchJobs.find(job => job.status === 'running');
      
      if (!runningBatchJob && !batchJobId) {
        throw new Error('No running batch job found to cancel');
      }
      
      // Debug info for batch job ID tracking
      console.log('Batch cancellation request details:', {
        batchJobId,
        runningBatchJobDetails: runningBatchJob ? {
          filePath: runningBatchJob.filePath,
          status: runningBatchJob.status,
          jobId: runningBatchJob.jobId || 'No Job ID'
        } : 'No running job in batchJobs'
      });
      
      // Use the jobId from the running batch job record if available, otherwise fall back to batchJobId
      const jobIdToCancel = runningBatchJob?.jobId || batchJobId;
      
      if (!jobIdToCancel) {
        throw new Error('No batch job ID available for cancellation');
      }
      
      // Call API to cancel the batch automation with the job ID
      console.log(`Using batch job ID for cancellation: ${jobIdToCancel}`);
      const result = await cancelFormAutomation(jobIdToCancel);
      
      // Validate cancellation was successful
      if (!result || !result.success) {
        throw new Error(result?.message || 'Failed to cancel batch automation process');
      }
      
      console.log('Batch cancellation API reported success');
      
      // Update the batch job status
      setBatchJobs(prev => {
        const updatedJobs = [...prev];
        const jobIndex = updatedJobs.findIndex(job => job.status === 'running');
        
        if (jobIndex !== -1) {
          updatedJobs[jobIndex] = {
            ...updatedJobs[jobIndex],
            status: 'error',
            message: 'Batch processing stopped by user',
            endTime: Date.now()
          };
        }
        
        return updatedJobs;
      });
      
      // Reset state
      setBatchJobId(null);
      setIsProcessing(false);
      
      // Update localStorage
      saveToStorage(userStorageKeys.BATCH_JOB_ID, null);
      
      // Show success toast
      addToast(
        'success',
        result.message || 'Batch processing stopped successfully'
      );
    } catch (error) {
      console.error('Error stopping batch automation:', error);
      setIsProcessing(false);
      
      // Show error toast
      addToast(
        'error',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    }
  };
  
  // Preview batch file contents
  const handlePreviewBatch = async () => {
    try {
      setIsProcessing(true);
      
      // First check if the preview endpoint exists to avoid 404 errors
      try {
        // Call API to preview the batch file
        const url = await ENDPOINTS.FORM_AUTOMATION_PREVIEW_BATCH();
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filePath: batchFilePath
          }),
        });
        
        if (!response.ok) {
          throw new Error('Resource not found');
        }
        
        const data = await response.json();
        
        if (data && Array.isArray(data.visits)) {
          setPreviewData(data.visits);
          // Select all visits by default
          setSelectedVisits(data.visits.map((visit: any) => visit.id));
        } else {
          throw new Error('Invalid response format from preview API');
        }
      } catch (error) {
        console.warn('API endpoint unavailable, using work orders as fallback:', error);
        
        // Fallback: Use the existing work orders as our data source
        const fallbackVisits = workOrders.map((order) => ({
          id: order.id,
          visitId: extractVisitNumber(order.visits.nextVisit.url),
          visitUrl: order.visits.nextVisit.url,
          storeName: order.customer.name,
          storeId: order.customer.storeNumber,
          date: order.visits.nextVisit.date,
          dispenserCount: getDispenserCountDirect(order.id)
        }));
        
        setPreviewData(fallbackVisits);
        // Select all visits by default
        setSelectedVisits(fallbackVisits.map(visit => visit.id));
        
        // Show info toast
        addToast(
          'info',
          'Using existing work orders as preview data (preview API unavailable)'
        );
      }
    } catch (error) {
      console.error('Error previewing batch file:', error);
      
      // Show error toast
      addToast(
        'error',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Select all visits
  const handleSelectAll = () => {
    setSelectedVisits(previewData.map(visit => visit.id));
  };
  
  // Deselect all visits
  const handleDeselectAll = () => {
    setSelectedVisits([]);
  };
  
  // Toggle a visit selection
  const handleToggleVisit = (visitId: string) => {
    setSelectedVisits(prev => {
      if (prev.includes(visitId)) {
        return prev.filter(id => id !== visitId);
      } else {
        return [...prev, visitId];
      }
    });
  };
  
  // Add useEffect to automatically preview when batchFilePath changes
  useEffect(() => {
    // Only trigger preview after initial data load to avoid errors
    if (activeTab === 'batch' && batchFilePath && !isLoading && workOrders.length > 0) {
      handlePreviewBatch();
    }
  }, [batchFilePath, activeTab, workOrders.length, isLoading]);
  
  // Get week label from date
  const getWeekLabel = (dateStr: string): string => {
    if (!dateStr) return 'No Date';
    
    const date = new Date(dateStr);
    
    // Format date range for the week
    const firstDayOfWeek = new Date(date);
    firstDayOfWeek.setDate(date.getDate() - date.getDay()); // Start with Sunday
    
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6); // End with Saturday
    
    // Format as Month/Day - Month/Day without year
    const firstMonth = firstDayOfWeek.getMonth() + 1;
    const lastMonth = lastDayOfWeek.getMonth() + 1;
    const firstDay = firstDayOfWeek.getDate();
    const lastDay = lastDayOfWeek.getDate();
    
    if (firstMonth === lastMonth) {
      // Same month - always show month in both dates
      return `${firstMonth}/${firstDay} - ${firstMonth}/${lastDay}`;
    } else {
      // Different months
      return `${firstMonth}/${firstDay} - ${lastMonth}/${lastDay}`;
    }
  };
  
  // Render visits grouped by selected criteria
  const renderGroupedVisits = () => {
    if (previewData.length === 0) {
      return (
        <div className="p-6 flex flex-col items-center justify-center text-center">
          <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-gray-500 dark:text-gray-400">No visit data available</div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Please wait while we load the visit information</p>
        </div>
      );
    }
    
    // Table format for all visits regardless of grouping
    const renderVisitTable = (visits: any[]) => {
      return (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-4 py-2 text-left">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 mr-2"
                    checked={visits.every((v: any) => selectedVisits.includes(v.id))}
                    onChange={() => {
                      const visitIds = visits.map((v: any) => v.id);
                      const allSelected = visitIds.every((id: string) => selectedVisits.includes(id));
                      
                      if (allSelected) {
                        // Deselect all
                        setSelectedVisits(prev => prev.filter((id: string) => !visitIds.includes(id)));
                      } else {
                        // Select all
                        setSelectedVisits(prev => {
                          const newSelected = [...prev];
                          visitIds.forEach((id: string) => {
                            if (!newSelected.includes(id)) {
                              newSelected.push(id);
                            }
                          });
                          return newSelected;
                        });
                      }
                    }}
                  />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Store</span>
                </div>
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Visit #
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Dispensers
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {visits.map(visit => {
              const storeStyles = getStoreStyles(visit.storeName || '');
              return (
                <tr 
                  key={visit.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                    selectedVisits.includes(visit.id) ? `${storeStyles.bg} border-l-4 ${storeStyles.border}` : ''
                  }`}
                  onClick={(e) => {
                    // Prevent toggle if clicking on the checkbox itself (to avoid double-toggle)
                    if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      handleToggleVisit(visit.id);
                    }
                  }}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 mr-3"
                        checked={selectedVisits.includes(visit.id)}
                        onChange={() => handleToggleVisit(visit.id)}
                        id={`visit-${visit.id}`}
                      />
                      <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${storeStyles.bg} mr-3`}>
                        <FiMapPin className={`${storeStyles.icon}`} />
                      </div>
                      <div>
                        <div className="font-medium">{visit.storeName || 'Unknown Store'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {visit.storeId ? `ID: ${visit.storeId}` : 'No ID'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">
                    {visit.visitId || extractVisitNumber(visit.visitUrl) || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(visit.date)}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                      {visit.dispenserCount || '0'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    };

    // No grouping, render all visits in table format
    if (groupBy === 'none') {
      return (
        <div className="overflow-hidden">
          {renderVisitTable(previewData)}
        </div>
      );
    }
    
    // For other groupings, build the groups but still use table format for each group
    const groupedVisits: Record<string, any[]> = {};
    
    previewData.forEach(visit => {
      let groupKey = 'Unknown';
      
      if (groupBy === 'date') {
        groupKey = formatDate(visit.date) || 'Unknown Date';
      } else if (groupBy === 'week') {
        groupKey = getWeekLabel(visit.date) || 'Unknown Week';
      }
      
      if (!groupedVisits[groupKey]) {
        groupedVisits[groupKey] = [];
      }
      
      groupedVisits[groupKey].push(visit);
    });
    
    // Sort group keys
    const sortedGroups = Object.keys(groupedVisits).sort((a, b) => {
      // For dates, sort chronologically
      if (groupBy === 'date' || groupBy === 'week') {
        const dateA = new Date(groupedVisits[a][0].date);
        const dateB = new Date(groupedVisits[b][0].date);
        return dateA.getTime() - dateB.getTime();
      }
      // For other groups, sort alphabetically
      return a.localeCompare(b);
    });
    
    // Render the groups with tables
    return (
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sortedGroups.map(groupName => {
          const visits = groupedVisits[groupName];
          return (
            <div key={groupName} className="group">
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-100 flex items-center">
                  {(groupBy === 'date' || groupBy === 'week') && <FiClock className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" />}
                  {groupName}
                  <span className="ml-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded-full px-2 py-0.5">
                    {visits.length}
                  </span>
                </h4>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const groupVisitIds = visits.map(v => v.id);
                      const allSelected = groupVisitIds.every(id => selectedVisits.includes(id));
                      
                      if (allSelected) {
                        // Deselect all in this group
                        setSelectedVisits(prev => prev.filter(id => !groupVisitIds.includes(id)));
                      } else {
                        // Select all in this group
                        setSelectedVisits(prev => {
                          const newSelected = [...prev];
                          groupVisitIds.forEach(id => {
                            if (!newSelected.includes(id)) {
                              newSelected.push(id);
                            }
                          });
                          return newSelected;
                        });
                      }
                    }}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                  >
                    {visits.every(v => selectedVisits.includes(v.id)) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>
              <div>
                {renderVisitTable(visits)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // Helper function to get status icon
  const getStatusIcon = (status: 'idle' | 'running' | 'completed' | 'error') => {
    switch (status) {
      case 'running': return <FiRefreshCw className="h-4 w-4 text-primary-500 animate-spin" />;
      case 'completed': return <FiCheck className="h-4 w-4 text-green-500" />;
      case 'error': return <FiX className="h-4 w-4 text-red-500" />;
      default: return <FiClock className="h-4 w-4 text-gray-400" />;
    }
  };
  
  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  // Format automation duration in a readable format
  const formatDuration = (startTime?: number, endTime?: number): string => {
    if (!startTime) return "N/A";
    
    const end = endTime || Date.now();
    const durationMs = end - startTime;
    
    // If less than a minute, show seconds
    if (durationMs < 60000) {
      return `${Math.round(durationMs / 1000)}s`;
    }
    
    // If less than an hour, show minutes and seconds
    if (durationMs < 3600000) {
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.round((durationMs % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
    
    // Show hours, minutes, and seconds
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const seconds = Math.round((durationMs % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };
  
  // Open URL with auto-login
  const openUrlWithLogin = async (url: string) => {
    try {
      // Get active user ID
      const activeUserId = localStorage.getItem('activeUserId');
      
      if (!activeUserId) {
        throw new Error('No active user found. Please select a user first.');
      }
      
      // Fetch active user's credentials using the correct endpoint
      const response = await fetch(`/api/users/${activeUserId}/credentials`);
      
      if (!response.ok) {
        throw new Error('Failed to get active user credentials');
      }
      
      const credentials = await response.json();
      
      if (!credentials.email || !credentials.password) {
        throw new Error('Active user has incomplete credentials');
      }
      
      // Check if we have access to the Electron API
      if (window.electron && typeof window.electron.openUrlWithActiveUser === 'function') {
        // Use the electron API to open the URL with the active user's credentials
        const result = await window.electron.openUrlWithActiveUser({
          url: url,
          email: credentials.email,
          password: credentials.password
        });
        
        if (!result.success) {
          throw new Error(result.message || 'Failed to open URL with auto-login');
        }
        
        // Show success toast
        addToast(
          'info',
          'Opening URL with active user credentials'
        );
      } else {
        // Fallback for non-Electron environments (should rarely happen)
        window.open(url, '_blank');
        addToast(
          'warning',
          'Opening URL without auto-login (Electron API not available)'
        );
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      
      // Show error toast
      addToast(
        'error',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
      
      // As a last resort, try regular window.open
      try {
        window.open(url, '_blank');
        addToast(
          'warning',
          'Opened URL without auto-login due to an error'
        );
      } catch (fallbackError) {
        console.error('Failed to open URL even with fallback:', fallbackError);
      }
    }
  };
  
  // Establish a global interval to keep localStorage and state in sync
  useEffect(() => {
    // Set up an interval that runs periodically regardless of component focus
    const syncInterval = setInterval(() => {
      // Get latest stored state
      const storedJobId = getFromStorage(userStorageKeys.SINGLE_JOB_ID, null);
      const storedIsPolling = getFromStorage(userStorageKeys.IS_POLLING_SINGLE, false);
      
      // Only proceed if we have an active job
      if (storedJobId && storedIsPolling) {
        console.log('Background sync checking status...');
        
        // Fetch current status from server
        getFormAutomationStatus()
          .then(status => {
            if (!status) return;
            
            // Update status in localStorage directly
            const storedJobs = getFromStorage(userStorageKeys.FORM_JOBS, []);
            const activeJobIndex = storedJobs.findIndex((job: FormJob) => job.status === 'running');
            
            if (activeJobIndex !== -1) {
              // Update the job in storage
              updateJobStatus(status);
            }
          })
          .catch(error => {
            console.error('Error in background sync:', error);
          });
      }
    }, 5000); // Check every 5 seconds, separate from the main polling interval
    
    // Clean up
    return () => {
      clearInterval(syncInterval);
    };
  }, [userStorageKeys]);
  
  // Register a beforeunload handler to ensure localStorage is updated when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Make sure the most current state is saved to localStorage before unloading
      saveToStorage(userStorageKeys.FORM_JOBS, formJobs);
      saveToStorage(userStorageKeys.SINGLE_JOB_ID, singleJobId);
      saveToStorage(userStorageKeys.IS_POLLING_SINGLE, pollingSingle);
      saveToStorage(userStorageKeys.BATCH_JOB_ID, batchJobId);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [formJobs, singleJobId, pollingSingle, batchJobId, userStorageKeys]);

  // Start polling for status updates
  const startPolling = () => {
    // Set the polling flag
    setPollingSingle(true);
    
    // Create a polling interval if one doesn't exist
    if (!polling) {
      const newInterval = setInterval(async () => {
        try {
          const status = await getFormAutomationStatus();
          console.log('Polling: Form automation status:', status);
          
          // Update all jobs with status changes
          setFormJobs(prev => {
            const updatedJobs = [...prev];
            // Find the job that's currently running
            const jobIndex = updatedJobs.findIndex(job => job.status === 'running' && job.jobId === singleJobId);
            
            if (jobIndex !== -1) {
              const prevStatus = updatedJobs[jobIndex].status;
              const endTime = (status.status === 'completed' || status.status === 'error') 
                ? Date.now() 
                : undefined;
              
              // Update the job with the new status
              updatedJobs[jobIndex] = {
                ...updatedJobs[jobIndex],
                status: status.status,
                message: status.message || updatedJobs[jobIndex].message,
                endTime: endTime || updatedJobs[jobIndex].endTime,
                // Set flags for status changes (for toast notifications)
                _statusChanged: prevStatus !== status.status,
                _completed: status.status === 'completed' && prevStatus !== 'completed',
                _error: status.status === 'error' && prevStatus !== 'error'
              };
              
              // Also save to localStorage to persist across page navigations
              saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
              
              // If the job completed or errored, stop polling
              if (status.status === 'completed' || status.status === 'error') {
                console.log('Job completed or errored, stopping polling');
                clearInterval(newInterval);
                setPolling(null);
                setPollingSingle(false);
                setSingleJobId(null);
                saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
              }
            }
            
            return updatedJobs;
          });
        } catch (error) {
          console.error('Error polling for status:', error);
        }
      }, 2000); // Poll every 2 seconds
      
      // Save the interval ID so we can clear it later
      setPolling(newInterval);
    }
  };

  // Function to handle batch processing
  const handleBatchProcess = async () => {
    if (selectedVisits.length === 0) {
      addToast('warning', 'Please select at least one visit to process');
      return;
    }

    try {
      setIsProcessing(true);
      
      try {
        // Prepare the batch processing request with the correct parameters
        const result = await processBatchVisits(
          batchFilePath, 
          isHeadless,
          { 
            selectedVisits: selectedVisits,
            resumeFromBatchId: resumeBatch && lastFailedBatch ? lastFailedBatch.jobId : undefined 
          }
        );
        
        // Add success property to match BatchProcessResult interface
        const batchResult: BatchProcessResult = { ...result, success: true };
        
        setBatchJobId(batchResult.jobId);
        saveToStorage(userStorageKeys.BATCH_JOB_ID, batchResult.jobId);
        
        // Add a new batch job to the history
        const newBatchJob: BatchJob = {
          filePath: 'Selected visits',
          timestamp: new Date().toLocaleString(),
          status: 'running',
          message: batchResult.message || 'Processing batch visits...',
          totalVisits: batchResult.totalVisits || selectedVisits.length,
          completedVisits: 0,
          headless: isHeadless,
          jobId: batchResult.jobId,
          startTime: Date.now() // Set the start time
        };
        
        setBatchJobs(prev => [newBatchJob, ...prev]);
        addToast('success', `Batch processing started with ${selectedVisits.length} visits`);
        
        // Start polling for batch status
        startBatchPolling();
      } catch (error: any) {
        console.error('API error during batch process:', error);
        
        // For development/testing purposes, create a mock batch job when API is unavailable
        if (error.message && error.message.includes('404')) {
          // Create a fake batch job ID
          const mockJobId = `mock-batch-${Date.now()}`;
          setBatchJobId(mockJobId);
          saveToStorage(userStorageKeys.BATCH_JOB_ID, mockJobId);
          
          // Create a mock batch job for testing UI
          const mockBatchJob: BatchJob = {
            filePath: 'Selected visits (DEMO)',
            timestamp: new Date().toLocaleString(),
            status: 'running',
            message: 'Processing batch visits (DEMO MODE)...',
            totalVisits: selectedVisits.length,
            completedVisits: 0,
            headless: isHeadless,
            jobId: mockJobId,
            startTime: Date.now(),
            // Add some initial values to demo the UI
            currentVisitId: selectedVisits[0],
            currentVisitName: 'Demo Store',
            currentVisitStatus: 'Preparing forms for processing...',
            currentVisitPhase: 'setup'
          };
          
          setBatchJobs(prev => [mockBatchJob, ...prev]);
          addToast('info', 'Batch processing API endpoint not available. Running in DEMO mode.');
          
          // Start a demo polling simulation
          startDemoPolling(mockJobId, selectedVisits.length);
        } else {
          // Re-throw for the outer catch
          throw error;
        }
      }
    } catch (error) {
      console.error('Error starting batch process:', error);
      addToast('error', error instanceof Error ? error.message : 'Failed to start batch processing');
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to start polling for batch status
  const startBatchPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        let status: BatchAutomationStatus;
        try {
          status = await getBatchAutomationStatus();
        } catch (apiError: any) {
          console.error('Error getting batch status:', apiError);
          
          // If the endpoint doesn't exist (404), create a fake status for development
          if (apiError.message && apiError.message.includes('404')) {
            console.log('Batch status endpoint not available, creating simulated status');
            
            // Get the current batch job to use its data
            const currentBatch = batchJobs.find(job => job.jobId === batchJobId); // Use batchJobId here
            if (!currentBatch) {
              console.warn('No running batch job found to simulate status for (jobId:', batchJobId, ')');
              clearInterval(pollInterval); // Stop polling if the job is gone
              return;
            }
            
            // Create a fake status based on the current job
            status = {
              status: 'running', // Keep it running for simulation
              message: currentBatch.message || 'Processing batch (simulated)...',
              completedVisits: currentBatch.completedVisits || 0,
              totalVisits: currentBatch.totalVisits || 0,
              currentVisit: currentBatch.currentVisitName || 'Simulated Store',
              currentVisitStatus: currentBatch.currentVisitStatus || 'Simulating progress...',
              timestamp: new Date().toISOString()
            };
          } else {
            // For non-404 errors, just log and continue polling, but don't stop it
            console.error('API error during batch status poll (non-404):', apiError.message);
            return; // Skip update for this cycle if API error occurs
          }
        }
        
        if (status) {
          setBatchJobs(prev => {
            const updatedJobs = [...prev];
            // Use batchJobId from component state to find the job
            const jobIndex = updatedJobs.findIndex(job => job.jobId === batchJobId);
            
            if (jobIndex !== -1) {
              const jobToUpdate = updatedJobs[jobIndex];
              const currentTime = Date.now();
              
              // Determine if the job is truly finished based on server status
              const isJobFinishedByServer = status.status === 'completed' || status.status === 'error';
              
              // Preserve start time if not already set
              const startTime = jobToUpdate.startTime || currentTime;
              const endTime = isJobFinishedByServer ? currentTime : undefined;
              
              let newStatus = status.status;
              // If the server says idle, but we have an active batchJobId and polling, 
              // and it's not yet marked as completed/error by the server, keep it running visually.
              if (status.status === 'idle' && batchJobId && !isJobFinishedByServer) {
                newStatus = 'running'; 
              }

              // Extract detailed progress information from status message
              let currentVisitId = jobToUpdate.currentVisitId || '';
              let currentVisitName = jobToUpdate.currentVisitName || '';
              let formsTotal = jobToUpdate.formsTotal || 0;
              let formsCurrent = jobToUpdate.formsCurrent || 0;
              let currentVisitPhase = jobToUpdate.currentVisitPhase;

              if (status.currentVisit) {
                const visitMatch = status.currentVisit.match(/W-(\d+)/);
                if (visitMatch) currentVisitId = visitMatch[0];
                const storeMatch = status.message?.match(/Processing visit for (.+?)(?:$|\s-\s)/);
                if (storeMatch) currentVisitName = storeMatch[1];
              }

              if (status.message) {
                if (status.message.includes('Preparing') || status.message.includes('forms')) currentVisitPhase = 'forms';
                else if (status.message.includes('Filling')) currentVisitPhase = 'filling';
                else if (status.message.includes('Saving')) currentVisitPhase = 'saving';
                else if (newStatus === 'running') currentVisitPhase = 'setup'; // Default to setup if running and no other phase detected

                const formCountMatch = status.message.match(/(\d+)\s*of\s*(\d+)\s*forms/i);
                if (formCountMatch) {
                  formsCurrent = parseInt(formCountMatch[1]);
                  formsTotal = parseInt(formCountMatch[2]);
                }
                const dispenserProgress = extractDispenserProgress(status.message);
                if (dispenserProgress.total > 0) {
                  formsCurrent = dispenserProgress.current;
                  formsTotal = dispenserProgress.total;
                }
                const fuelProgress = extractFuelProgress(status.message);
                if (fuelProgress.total > 0) {
                  formsCurrent = fuelProgress.current;
                  formsTotal = fuelProgress.total;
                }
              }
              
              updatedJobs[jobIndex] = {
                ...jobToUpdate,
                status: newStatus, // Use the potentially overridden status
                message: status.message || jobToUpdate.message,
                completedVisits: status.completedVisits !== undefined ? status.completedVisits : jobToUpdate.completedVisits,
                totalVisits: status.totalVisits !== undefined ? status.totalVisits : jobToUpdate.totalVisits,
                currentVisitId,
                currentVisitName,
                currentVisitStatus: status.currentVisitStatus || status.message || jobToUpdate.currentVisitStatus,
                currentVisitPhase,
                formsTotal,
                formsCurrent,
                startTime,
                endTime
              };
              
              // If batch truly completed or errored according to server, stop polling
              if (isJobFinishedByServer) {
                if (status.status === 'error') {
                  setLastFailedBatch(updatedJobs[jobIndex]);
                }
                clearInterval(pollInterval);
                setIsProcessing(false);
                setBatchJobId(null); // Clear the active batch job ID
                saveToStorage(userStorageKeys.BATCH_JOB_ID, null);
              }
            } else {
              // If the jobIndex is not found, but we still have an active batchJobId, 
              // it might mean the batchJobs array was cleared or modified unexpectedly.
              // Stop polling to prevent errors.
              if (batchJobId) {
                console.warn(`Batch job with ID ${batchJobId} not found in state during polling. Stopping poll.`);
                clearInterval(pollInterval);
                setBatchJobId(null);
                saveToStorage(userStorageKeys.BATCH_JOB_ID, null);
                setIsProcessing(false);
              }
            }
            return updatedJobs;
          });
        }
      } catch (error) {
        console.error('Error handling batch status update:', error);
        // Potentially stop polling on certain types of critical errors after some retries
      }
    }, 2000); // Poll every 2 seconds
  };

  // Add a useEffect to load dispenser details when a work order is selected
  useEffect(() => {
    if (selectedWorkOrder?.id) {
      // Try to load dispenser details for the selected work order
      getDispensersForWorkOrder(selectedWorkOrder.id)
        .then((data: any) => {
          if (data && data.dispensers) {
            setDispenserDetails(prev => ({
              ...prev,
              [selectedWorkOrder.id]: data
            }));
            console.log(`Loaded ${data.dispensers.length} dispensers for ${selectedWorkOrder.id}`);
          }
        })
        .catch((error: Error) => {
          console.error('Error loading dispenser details:', error);
        });
    }
  }, [selectedWorkOrder]);

  // Use debugging to verify data is actually being loaded:
  // Add another console log when groupedWorkOrders change
  useEffect(() => {
    if (groupedWorkOrders.length > 0) {
      console.log('Grouped work orders ready:', groupedWorkOrders.length, 'groups');
      console.log('Current week:', currentWeekIndex, 'with', 
        groupedWorkOrders[currentWeekIndex]?.orders?.length || 0, 'orders');
    }
  }, [groupedWorkOrders, currentWeekIndex]);

  // Monitor for changes in active user ID
  useEffect(() => {
    // Set up event listener for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'activeUserId') {
        const newUserId = e.newValue || 'default';
        
        // Update our local state
        setActiveUserId(newUserId);
        setUserStorageKeys(getUserStorageKeys(newUserId));
        
        // Load the user-specific data
        const userKeys = getUserStorageKeys(newUserId);
        setFormJobs(getFromStorage(userKeys.FORM_JOBS, []));
        setBatchJobId(getFromStorage(userKeys.BATCH_JOB_ID, null));
        setSingleJobId(getFromStorage(userKeys.SINGLE_JOB_ID, null));
        setPollingSingle(getFromStorage(userKeys.IS_POLLING_SINGLE, false));
        setVisitUrl(getFromStorage(userKeys.VISIT_URL, ''));
        
        console.log(`Switched to user ID: ${newUserId}, loading user-specific data`);
      }
    };

    // Also check for local changes to activeUserId
    const checkActiveUserId = () => {
      const currentActiveUserId = localStorage.getItem('activeUserId') || 'default';
      if (currentActiveUserId !== activeUserId) {
        setActiveUserId(currentActiveUserId);
        const userKeys = getUserStorageKeys(currentActiveUserId);
        setUserStorageKeys(userKeys);
        
        // Load the user-specific data
        setFormJobs(getFromStorage(userKeys.FORM_JOBS, []));
        setBatchJobId(getFromStorage(userKeys.BATCH_JOB_ID, null));
        setSingleJobId(getFromStorage(userKeys.SINGLE_JOB_ID, null));
        setPollingSingle(getFromStorage(userKeys.IS_POLLING_SINGLE, false));
        setVisitUrl(getFromStorage(userKeys.VISIT_URL, ''));
      }
    };
    
    // Check user ID on initial load
    checkActiveUserId();
    
    // Set up interval to periodically check for user changes (polling approach)
    const interval = setInterval(checkActiveUserId, 5000);
    
    // Add event listener for changes in other tabs/windows
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [activeUserId]);
  
  // Reset visitUrl to stored value when activeUserId changes
  useEffect(() => {
    setVisitUrl(getFromStorage(userStorageKeys.VISIT_URL, ''));
  }, [userStorageKeys]);

  // Function to start a demo polling simulation for batch jobs
  const startDemoPolling = (jobId: string, totalVisits: number) => {
    console.log('Starting demo polling simulation for batch job:', jobId);
    let visitCounter = 0;
    let formCounter = 0;
    const maxForms = 5; // Simulate 5 forms per visit
    const phases: Array<'setup' | 'forms' | 'filling' | 'saving'> = ['setup', 'forms', 'filling', 'saving'];
    let phaseIndex = 0;
    
    // Mock store names for demo
    const demoStoreNames = [
      'Circle K #12345', 
      'Shell Gas Station', 
      '7-Eleven Store', 
      'BP Station', 
      'Chevron', 
      'Exxon', 
      'Mobil', 
      'Valero',
      'Sunoco',
      'QuikTrip'
    ];
    
    // Create a polling interval
    const demoInterval = setInterval(() => {
      setBatchJobs(prev => {
        const updatedJobs = [...prev];
        const jobIndex = updatedJobs.findIndex(job => job.jobId === jobId);
        
        if (jobIndex === -1) {
          clearInterval(demoInterval);
          return updatedJobs;
        }
        
        // Update the job with simulated progress
        const currentJob = updatedJobs[jobIndex];
        
        // Handle form progress within a visit
        formCounter++;
        if (formCounter > maxForms) {
          formCounter = 1;
          phaseIndex = (phaseIndex + 1) % phases.length;
          
          // If we've gone through all phases, move to next visit
          if (phaseIndex === 0) {
            visitCounter++;
            
            // If we've completed all visits, mark job as completed
            if (visitCounter >= totalVisits) {
              clearInterval(demoInterval);
              
              const completedJobs = [...updatedJobs];
              const completedJobIndex = completedJobs.findIndex(job => job.jobId === jobId);
              
              if (completedJobIndex !== -1) {
                completedJobs[completedJobIndex] = {
                  ...completedJobs[completedJobIndex],
                  status: 'completed',
                  message: 'Batch processing completed successfully',
                  completedVisits: totalVisits,
                  endTime: Date.now()
                };
              }
              
              return completedJobs;
            }
          }
        }
        
        // Generate a message based on current state
        let statusMessage = '';
        const currentStore = demoStoreNames[visitCounter % demoStoreNames.length];
        const currentPhase = phases[phaseIndex];
        
        switch (currentPhase) {
          case 'setup':
            statusMessage = `Setting up for ${currentStore} - Preparing forms`;
            break;
          case 'forms':
            statusMessage = `Working on ${currentStore} - Loading form ${formCounter} of ${maxForms}`;
            break;
          case 'filling':
            statusMessage = `Working on ${currentStore} - Filling form fields for fuel (${formCounter}/${maxForms})`;
            break;
          case 'saving':
            statusMessage = `Working on ${currentStore} - Saving completed form ${formCounter}/${maxForms}`;
            break;
        }
        
        updatedJobs[jobIndex] = {
          ...currentJob,
          completedVisits: visitCounter,
          currentVisitId: `visit-${visitCounter + 1}`,
          currentVisitName: currentStore,
          currentVisitStatus: statusMessage,
          currentVisitPhase: currentPhase,
          formsCurrent: formCounter,
          formsTotal: maxForms,
          message: `Processing visit ${visitCounter + 1} of ${totalVisits}: ${currentStore}`
        };
        
        return updatedJobs;
      });
    }, 2000); // Update every 2 seconds
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="space-y-6 animate-fadeIn">
          {/* Page header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 text-white rounded-xl shadow-lg overflow-hidden border border-gray-700 dark:border-gray-800">
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FiFileText className="h-6 w-6 text-primary-400" />
                <div>
                  <h1 className="text-xl font-semibold text-white">Form Prep</h1>
                  <p className="text-sm text-gray-300">Automate form preparation for work orders</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium bg-gray-700 dark:bg-gray-800/80 text-gray-300 py-1 px-2 rounded">
                  {statusMessage}
                </span>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {/* Mode switch buttons */}
            <div className="mb-6 flex justify-center">
              <div className="inline-flex rounded-md shadow-sm overflow-hidden">
                <button
                  onClick={() => setActiveTab('single')}
                  className={`px-6 py-2.5 text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'single'
                      ? 'bg-primary-500 hover:bg-primary-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <FiFileText className="h-4 w-4" />
                  Single Visit
                </button>
                <button
                  onClick={() => setActiveTab('batch')}
                  className={`px-6 py-2.5 text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'batch'
                      ? 'bg-primary-500 hover:bg-primary-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <FiUpload className="h-4 w-4" />
                  Batch Mode
                </button>
              </div>
            </div>

            {activeTab === 'single' && (
              <div className="space-y-6">
                {/* Work Order Selection Panel */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <FiClipboard className="text-primary-500" />
                        Select Work Order
                    </h2>
                      {selectedWorkOrder && (
                        <div className="bg-primary-100 dark:bg-primary-900/30 px-2.5 py-1 rounded-md">
                          <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                            {selectedWorkOrder.customer.name}
                            <span className="font-mono text-xs ml-1">({extractVisitNumber(selectedWorkOrder.visits.nextVisit.url)})</span>
                          </span>
                        </div>
                      )}
                    </div>
                    </div>
                    
                  <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700 m-4">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                        <button 
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          onClick={goToPreviousWeek}
                          disabled={currentWeekIndex <= 0}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        <div className="flex items-center">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {groupedWorkOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length ? 
                              `Week of ${groupedWorkOrders[currentWeekIndex].week}` : 'No work orders'}
                          </h3>
                        <span className="ml-2 bg-primary-100 dark:bg-primary-900/30 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300 rounded-md">
                            {groupedWorkOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length ? 
                              groupedWorkOrders[currentWeekIndex].orders.length : 0} orders
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button 
                          className="text-xs font-medium px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-md"
                            onClick={goToCurrentWeek}
                          >
                            Today
                          </button>
                          <button 
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            onClick={goToNextWeek}
                            disabled={currentWeekIndex >= groupedWorkOrders.length - 1}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    
                    <div className="overflow-x-auto bg-white dark:bg-gray-800">
                        {filteredWorkOrders.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <FiClipboard className="h-10 w-10 mx-auto mb-2 opacity-40" />
                            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-1">No work orders found</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">There are no work orders available for this period.</p>
                          </div>
                      ) : (
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900/30">
                            <tr>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dispensers</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                  </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {/* Keep your existing work order rows implementation */}
                            {/* ... existing workorder rows ... */}
                            {currentWeekIndex < groupedWorkOrders.length && filteredWorkOrders.map((order) => {
                                      const storeStyles = getStoreStyles(order.customer.name);
                                      const dispenserCount = getDispenserCountDirect(order.id);
                                      return (
                                        <tr
                                          key={order.id}
                                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                                            selectedWorkOrder?.id === order.id ? 
                                            `${storeStyles.bg} border-l-4 ${storeStyles.border}` : 
                                            ''
                                          }`}
                                          onClick={() => {
                                            setSelectedWorkOrder(order);
                                          }}
                                        >
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                              <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${storeStyles.bg} mr-3`}>
                                                <FiMapPin className={`${storeStyles.icon}`} />
                                              </div>
                                              <div>
                                                <div className="font-medium">{order.customer.name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                  Visit #: {extractVisitNumber(order.visits.nextVisit.url)}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-sm">{order.customer.address.cityState}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{order.customer.storeNumber}</div>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            {order.visits.nextVisit.date || 'Not scheduled'}
                                          </td>
                                          <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                                              {dispenserCount || '-'}
                                            </span>
                                          </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (order.visits.nextVisit.url) {
                                          const url = order.visits.nextVisit.url.startsWith('http') 
                                            ? order.visits.nextVisit.url 
                                            : `https://app.workfossa.com${order.visits.nextVisit.url}`;
                                          openUrlWithLogin(url);
                                        }
                                      }}
                                      className="text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                                      title="Open visit in browser"
                                    >
                                      <FiEye className="w-5 h-5" />
                                    </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                            )}
                    </div>
                  </div>
                </div>
                
                {/* Form Setup Panel */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                    <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <FiPlay className="text-accent-green-500" />
                      Process Form
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiExternalLink className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="Enter visit URL or select from above"
                          value={visitUrl}
                          onChange={(e) => setVisitUrl(e.target.value)}
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 pl-10 py-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                            id="isHeadless"
                            checked={isHeadless}
                            onChange={(e) => setIsHeadless(e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500 h-4 w-4"
                          />
                          <label 
                            htmlFor="isHeadless" 
                            className="text-sm font-medium text-gray-700 dark:text-gray-300"
                            title="Run in background without showing browser window"
                          >
                            Headless
                      </label>
                    </div>
                        <button
                          onClick={handleSingleVisit}
                          disabled={isProcessing || !visitUrl}
                          className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
                            isProcessing || !visitUrl
                              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                              : 'bg-primary-500 hover:bg-primary-600 text-white hover:shadow-md transition-all duration-200'
                          }`}
                        >
                          {isProcessing ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing
                            </>
                          ) : (
                            <>
                              <FiPlay className="mr-1.5 h-4 w-4" />
                              Process
                            </>
                          )}
                        </button>
                        {isProcessing && (
                        <button
                            onClick={handleStopProcessing}
                            className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white hover:shadow-md transition-all duration-200"
                        >
                            <FiX className="mr-1 h-4 w-4" />
                            Stop
                        </button>
                      )}
                    </div>
                    </div>
                    
                    {/* Validation message */}
                    {visitUrl && !visitUrl.includes('workfossa.com') && !visitUrl.match(/\/visits?\/\d+/) && (
                      <div className="mt-2 text-amber-700 dark:text-amber-400 text-xs flex items-center">
                        <FiInfo className="mr-1" />
                        URL doesn't appear to be a valid work order visit URL
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Results Panel */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <FiCheck className="text-accent-green-500" />
                        Form Processing Results
                      </h2>
                {formJobs.length > 0 && (
                        <div className="bg-accent-green-100 dark:bg-accent-green-900/30 px-2.5 py-1 rounded-md">
                          <span className="text-xs font-medium text-accent-green-700 dark:text-accent-green-300">
                            {formJobs.length} Total Jobs
                            </span>
                        </div>
                      )}
                      </div>
                    </div>
                    
                  <div className="overflow-x-auto">
                    {formJobs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <FiCheck className="h-10 w-10 mx-auto mb-2 opacity-40" />
                        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-1">No form jobs yet</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Process a form above to see results here</p>
                      </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/30">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Store</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visit</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Progress</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {/* Keep your existing form job rows implementation */}
                            {formJobs.map((job, index) => {
                              // Extract visit info if not already stored in the job
                              const visitInfo = job.storeName && job.visitNumber ? 
                                  { storeName: job.storeName, visitNumber: job.visitNumber, dispenserCount: job.dispenserCount || 0 } : 
                                  extractVisitInfo(job.url);
                              
                              // Remove the ⚡ symbol from the store name if it exists
                              const cleanStoreName = visitInfo.storeName.replace(/⚡/g, '').trim();
                              
                              // Extract dispenser and fuel info for progress bars
                              const dispenserInfo = extractDispenserProgress(job.message || '', job.dispenserCount);
                              const fuelInfo = extractFuelProgress(job.message || '');
                              
                              return (
                                <tr 
                                  key={index}
                                  className={`
                                  hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150
                                    ${job.status === 'running' 
                                    ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500' 
                                      : job.status === 'completed' 
                                      ? 'bg-accent-green-50 dark:bg-accent-green-900/20 border-l-4 border-green-500' 
                                        : job.status === 'error' 
                                        ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                                        : ''
                                  }
                                `}
                                >
                                <td className="px-4 py-3">
                                  <div className="flex items-center">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full 
                                      ${job.status === 'running' ? 'bg-primary-100 dark:bg-primary-800/50 text-primary-600 dark:text-primary-400 animate-pulse' :
                                        job.status === 'completed' ? 'bg-green-100 dark:bg-green-800/50 text-green-600 dark:text-green-400' :
                                        job.status === 'error' ? 'bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-400' :
                                        'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                      } mr-2`}>
                                      {getStatusIcon(job.status)}
                                    </div>
                                    <span className={`font-medium text-sm capitalize
                                      ${job.status === 'running' ? 'text-primary-700 dark:text-primary-400' :
                                        job.status === 'completed' ? 'text-green-700 dark:text-green-400' :
                                        job.status === 'error' ? 'text-red-700 dark:text-red-400' :
                                        'text-gray-700 dark:text-gray-300'
                                      }`}>
                                      {job.status}
                                    </span>
                                  </div>
                                  
                                  {/* Status message for completed/error states */}
                                  {job.status === 'completed' && (
                                    <div className="flex items-center text-xs text-green-600 dark:text-green-500 mt-2">
                                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span>
                                        Completed in {formatDuration(job.startTime, job.endTime)}
                                      </span>
                                    </div>
                                  )}
                                
                                  {job.status === 'error' && (
                                    <div className="flex items-center text-xs text-red-600 dark:text-red-500 mt-2">
                                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                      <span>{job.message}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="font-medium text-gray-700 dark:text-gray-300">
                                      {cleanStoreName}
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm">
                                    #{visitInfo.visitNumber}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {job.status === 'running' && (
                                    <div className="space-y-3 min-w-56">
                                      {/* Dispenser progress */}
                                      {dispenserInfo.total > 0 && (
                                        <div>
                                          <div className="flex justify-between items-center text-xs mb-1">
                                            <div className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                              </svg>
                                              Dispensers
                                            </div>
                                            <span className="font-mono bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                              {dispenserInfo.current}/{dispenserInfo.total}
                                            </span>
                                          </div>
                                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                                dispenserInfo.current / dispenserInfo.total < 0.3 ? 'bg-amber-400' :
                                                dispenserInfo.current / dispenserInfo.total < 0.7 ? 'bg-amber-500' :
                                                'bg-amber-600'
                                              }`}
                                              style={{ width: `${Math.min(Math.round((dispenserInfo.current / Math.max(dispenserInfo.total, 1)) * 100), 100)}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Fuel type progress */}
                                      {fuelInfo.type && fuelInfo.total > 0 && (
                                        <div>
                                          <div className="flex justify-between items-center text-xs mb-1">
                                            <div className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                              {fuelInfo.type}
                                            </div>
                                            <span className="font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                              {fuelInfo.current}/{fuelInfo.total}
                                            </span>
                                          </div>
                                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                                fuelInfo.current / fuelInfo.total < 0.3 ? 'bg-blue-400' :
                                                fuelInfo.current / fuelInfo.total < 0.7 ? 'bg-blue-500' :
                                                'bg-blue-600'
                                              }`}
                                              style={{ width: `${Math.min(Math.round((fuelInfo.current / Math.max(fuelInfo.total, 1)) * 100), 100)}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* General progress message when no specific progress data */}
                                      {!dispenserInfo.total && !fuelInfo.total && job.message && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400 py-1 italic">
                                          {job.message}
                                        </div>
                                      )}
                                      
                                      {/* Indeterminate progress when no specific data available */}
                                      {(!dispenserInfo.total && !fuelInfo.total) && (
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                          <div className="h-1.5 bg-primary-500 rounded-full animate-pulse-progress" style={{ width: '40%' }}></div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex space-x-2">
                        <button
                                      onClick={() => {
                                        if (job.url) {
                                          openUrlWithLogin(job.url);
                                        }
                                      }}
                                      className="text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                                      title="Open visit in browser"
                                    >
                                      <FiEye className="w-5 h-5" />
                        </button>
                                    {job.status === 'running' && (
                        <button
                                        onClick={handleStopProcessing}
                                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                        title="Stop processing"
                        >
                                        <FiX className="w-5 h-5" />
                        </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          </tbody>
                        </table>
                    )}
                      </div>
                    </div>
              </div>
            )}

            {activeTab === 'batch' && (
              <div className="space-y-6">
                {/* Development notice banner */}
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start">
                  <div className="flex-shrink-0 text-amber-500 dark:text-amber-400 mr-3 mt-0.5">
                    <FiInfo className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Batch Processing Under Development
                    </h3>
                    <div className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                      <p>The batch processing API endpoints are still under development. The UI is fully functional and displaying work order data from the system. API calls will be properly connected when the endpoints are available.</p>
                    </div>
                  </div>
                </div>
                
                {/* Visit Selection Panel - Styled like the Work Order Selection Panel */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                    <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <FiClipboard className="text-primary-500 dark:text-primary-400" />
                      <span>Select Work Order Visits</span>
                    </h2>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
                      <div className="flex flex-wrap items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Group By:</span>
                          <select
                            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-1.5 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value)}
                          >
                            <option value="none">No Grouping</option>
                            <option value="date">Visit Date</option>
                            <option value="week">Week</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          className="bg-primary-50 hover:bg-primary-100 text-primary-600 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 dark:text-primary-400 rounded-md px-3 py-1.5 text-sm font-medium flex items-center space-x-1 border border-primary-200 dark:border-primary-800 transition-colors"
                          onClick={handleSelectAll}
                        >
                          <FiCheck className="h-3.5 w-3.5" />
                          <span>Select All</span>
                        </button>
                        <button
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 rounded-md px-3 py-1.5 text-sm font-medium flex items-center space-x-1 border border-gray-200 dark:border-gray-600 transition-colors"
                          onClick={handleDeselectAll}
                        >
                          <FiX className="h-3.5 w-3.5" />
                          <span>Deselect All</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center">
                          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">
                            Available Visits
                          </h3>
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                            {previewData.length} visits
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                          <span className="bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400 text-xs rounded-full px-2 py-0.5">
                            {selectedVisits.length} selected
                          </span>
                        </div>
                      </div>
                      
                      {/* Visit List - Increased max-height to show more rows */}
                      <div className="max-h-[400px] overflow-y-auto bg-white dark:bg-gray-800">
                        {isLoading || previewData.length === 0 ? (
                          <div className="p-8 flex flex-col items-center justify-center text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                            <div className="text-gray-500 dark:text-gray-400">Loading visit data...</div>
                          </div>
                        ) : (
                          renderGroupedVisits()
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Batch Processing Panel */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <FiUpload className="text-primary-500 dark:text-primary-400" />
                        <span>Batch Processing</span>
                      </h2>
                      
                      {batchJobId && (
                        <div className="bg-primary-100 dark:bg-primary-900/30 px-2 py-0.5 rounded text-xs font-medium text-primary-700 dark:text-primary-300 flex items-center">
                          <FiInfo className="mr-1 h-3.5 w-3.5" />
                          <span>Job ID: {batchJobId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-800/80 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Processing Options</h3>
                      
                      <div className="flex items-center mb-3">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500"
                            checked={!isHeadless}
                            onChange={() => setIsHeadless(!isHeadless)}
                          />
                          <span className="ml-2 text-gray-700 dark:text-gray-300">Show browser during automation (debug mode)</span>
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500"
                            checked={resumeBatch}
                            onChange={() => setResumeBatch(!resumeBatch)}
                            disabled={!lastFailedBatch}
                          />
                          <span className="ml-2 text-gray-700 dark:text-gray-300">
                            Resume from last failed batch
                            {!lastFailedBatch && (
                              <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">(No failed batches found)</span>
                            )}
                          </span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        {selectedVisits.length > 0 && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">{selectedVisits.length}</span> visits selected for processing
                          </div>
                        )}
                      </div>
                      
                      <div className="flex space-x-3">
                        <button
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors"
                          onClick={handlePreviewBatch}
                        >
                          <FiRefreshCw className="h-4 w-4" />
                          <span>Refresh Data</span>
                        </button>
                        
                        {isProcessing && batchJobId ? (
                          <button
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium flex items-center space-x-2 transition-colors"
                            onClick={handleStopBatchProcessing}
                          >
                            <FiX className="h-4 w-4" />
                            <span>Stop Processing</span>
                          </button>
                        ) : (
                          <button
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium flex items-center space-x-2 transition-colors"
                            onClick={handleBatchProcess}
                            disabled={isProcessing || selectedVisits.length === 0}
                          >
                            <FiPlay className="h-4 w-4" />
                            <span>Process {selectedVisits.length} Visit{selectedVisits.length !== 1 ? 's' : ''}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Batch History Panel */}
                {batchJobs.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <FiClock className="text-primary-500 dark:text-primary-400" />
                        <span>Batch Processing History</span>
                      </h2>
                    </div>
                    
                    <div className="p-4">
                      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Progress</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {batchJobs.map((job, index) => (
                              <tr
                                key={index}
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50
                                  ${job.status === 'running' ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500' : 
                                    job.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500' : 
                                    job.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500' : ''
                                  }
                                `}
                              >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full 
                                      ${job.status === 'running' ? 'bg-primary-100 dark:bg-primary-800/50 text-primary-600 dark:text-primary-400 animate-pulse' :
                                        job.status === 'completed' ? 'bg-green-100 dark:bg-green-800/50 text-green-600 dark:text-green-400' :
                                        job.status === 'error' ? 'bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-400' :
                                        'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                      } mr-2`}>
                                      {getStatusIcon(job.status)}
                                    </div>
                                    <span className={`font-medium text-sm capitalize
                                      ${job.status === 'running' ? 'text-primary-700 dark:text-primary-400' :
                                        job.status === 'completed' ? 'text-green-700 dark:text-green-400' :
                                        job.status === 'error' ? 'text-red-700 dark:text-red-400' :
                                        'text-gray-700 dark:text-gray-300'
                                      }`}>
                                      {job.status}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="space-y-2">
                                    {/* Overall Batch Progress */}
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-gray-500 dark:text-gray-400">
                                        {job.completedVisits} of {job.totalVisits} visits
                                      </span>
                                      <span className={`font-mono ${
                                        job.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 
                                        job.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 
                                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                      } px-1.5 py-0.5 rounded`}>
                                        {Math.round((job.completedVisits / Math.max(1, job.totalVisits)) * 100)}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          job.status === 'completed' ? 'bg-green-500 dark:bg-green-400' : 
                                          job.status === 'running' ? 'bg-blue-500 dark:bg-blue-400' : 
                                          job.status === 'error' ? 'bg-red-500 dark:bg-red-400' : 
                                          'bg-gray-500 dark:bg-gray-400'
                                        }`}
                                        style={{ width: `${job.status === 'completed' ? 100 : (job.completedVisits / Math.max(1, job.totalVisits) * 100)}%` }}
                                      />
                                    </div>
                                    
                                    {/* Detailed Progress for Current Visit (if running) */}
                                    {job.status === 'running' && job.currentVisitId && job.formsTotal !== undefined && job.formsTotal > 0 && (
                                      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex justify-between items-center text-xs mb-1">
                                          <div className="font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"></path></svg>
                                            {job.currentVisitName || `Visit ${job.completedVisits + 1}`}
                                          </div>
                                          <span className="font-mono bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                                            {job.formsCurrent || 0}/{job.formsTotal}
                                          </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                          <div 
                                            className={`h-1.5 rounded-full transition-all duration-500 ${
                                              (job.formsCurrent || 0) / job.formsTotal < 0.3 ? 'bg-indigo-400' :
                                              (job.formsCurrent || 0) / job.formsTotal < 0.7 ? 'bg-indigo-500' :
                                              'bg-indigo-600'
                                            }`}
                                            style={{ width: `${((job.formsCurrent || 0) / Math.max(1, job.formsTotal)) * 100}%` }}
                                          ></div>
                                        </div>
                                        
                                        {/* Dispenser Progress Visualization */}
                                        {job.currentVisitStatus && (
                                          <div className="mt-3 space-y-2">
                                            {/* Dispensers Progress */}
                                            {(() => {
                                              const dispenserInfo = extractDispenserProgress(job.currentVisitStatus, job.formsTotal);
                                              if (dispenserInfo.total > 0) {
                                                return (
                                                  <div>
                                                    <div className="flex justify-between items-center text-xs mb-1">
                                                      <div className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                                        </svg>
                                                        Dispensers
                                                      </div>
                                                      <span className="font-mono bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                                        {dispenserInfo.current}/{dispenserInfo.total}
                                                      </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                      <div 
                                                        className="h-full rounded-full transition-all duration-500 bg-amber-500"
                                                        style={{ width: `${Math.min(Math.round((dispenserInfo.current / Math.max(dispenserInfo.total, 1)) * 100), 100)}%` }}
                                                      ></div>
                                                    </div>
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}
                                            
                                            {/* Fuel Type Progress */}
                                            {(() => {
                                              const fuelInfo = extractFuelProgress(job.currentVisitStatus);
                                              if (fuelInfo.type && fuelInfo.total > 0) {
                                                return (
                                                  <div>
                                                    <div className="flex justify-between items-center text-xs mb-1">
                                                      <div className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                        </svg>
                                                        {fuelInfo.type}
                                                      </div>
                                                      <span className="font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                                        {fuelInfo.current}/{fuelInfo.total}
                                                      </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                      <div 
                                                        className="h-full rounded-full transition-all duration-500 bg-blue-500"
                                                        style={{ width: `${Math.min(Math.round((fuelInfo.current / Math.max(fuelInfo.total, 1)) * 100), 100)}%` }}
                                                      ></div>
                                                    </div>
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}
                                          </div>
                                        )}
                                        
                                        {job.currentVisitPhase && (
                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                                            Phase: {job.currentVisitPhase}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {(job.status === 'completed' || job.status === 'error' || (job.status === 'running' && job.startTime)) && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Duration: {formatDuration(job.startTime, job.endTime || Date.now())}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add utility functions for progress extraction below the FormPrep component but before the export statement

/**
 * Extracts dispenser progress information from status messages
 */
const extractDispenserProgress = (message: string, totalDispensers?: number): { current: number; total: number } => {
  const defaultResult = { current: 0, total: totalDispensers || 0 };
  
  try {
    // Check for dispenser patterns like "Dispenser #1/2" or "Processing dispenser 3 of 5"
    const dispenserRegex = /(?:dispenser|pump|meter)(?:[\s#:]+)(\d+)(?:[^\d]+(\d+)|)/i;
    const dispenserMatch = message.match(dispenserRegex);
    
    if (dispenserMatch && dispenserMatch[1]) {
      const current = parseInt(dispenserMatch[1]);
      let total = totalDispensers || 0;
      
      // If we extracted a total from the message, use that
      if (dispenserMatch[2]) {
        total = parseInt(dispenserMatch[2]);
      }
      
      return { current, total: Math.max(total, 1) };
    }
    
    return defaultResult;
  } catch (error) {
    console.error('Error extracting dispenser progress:', error);
    return defaultResult;
  }
};

/**
 * Extracts fuel grade progress information from status messages
 */
const extractFuelProgress = (message: string): { current: number; total: number; type?: string } => {
  const defaultResult = { current: 0, total: 0 };
  
  try {
    // Check for fuel grade patterns like "Processing Premium (3/3)" or "Fuel Grade: Regular (2/4)"
    const fuelTypes = ['premium', 'regular', 'plus', 'diesel', 'supreme', 'unleaded', 'mid-grade', 'midgrade', 'super', 'ethanol-free', 'ethanol free', 'fuel type', 'fuel grade'];
    const fuelTypePattern = fuelTypes.join('|');
    const fuelRegex = new RegExp(`(?:processing\\s+)?(${fuelTypePattern})(?:[^\\(]*)?\\s*\\(?([0-9]+)\\/([0-9]+)\\)?`, 'i');
    const fuelMatch = message.match(fuelRegex);
    
    if (fuelMatch && fuelMatch[1] && fuelMatch[2] && fuelMatch[3]) {
      const type = fuelMatch[1].trim();
      const current = parseInt(fuelMatch[2]);
      const total = parseInt(fuelMatch[3]);
      
      return { 
        current, 
        total, 
        type: type.charAt(0).toUpperCase() + type.slice(1) // Capitalize first letter
      };
    }
    
    // Try to match just the numbers pattern (x/y)
    const simpleMatch = message.match(/\b(\d+)\s*\/\s*(\d+)\b/);
    if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
      return {
        current: parseInt(simpleMatch[1]),
        total: parseInt(simpleMatch[2])
      };
    }
    
    return defaultResult;
  } catch (error) {
    console.error('Error extracting fuel progress:', error);
    return defaultResult;
  }
};

export default FormPrep; 
