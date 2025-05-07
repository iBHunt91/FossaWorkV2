import React, { useState, useEffect } from 'react';
import { 
  FiPlay, FiCheck, FiX, FiUpload, FiInfo, 
  FiExternalLink, FiFileText, FiClipboard, FiSearch, 
  FiChevronDown, FiEye, FiRefreshCw, FiFilter,
  FiClock, FiMapPin
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

const FormPrep: React.FC<{}> = () => {
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
  
  // Persist state to localStorage when it changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.FORM_JOBS, formJobs);
  }, [formJobs]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SINGLE_JOB_ID, singleJobId);
  }, [singleJobId]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.BATCH_JOB_ID, batchJobId);
  }, [batchJobId]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.IS_POLLING_SINGLE, pollingSingle);
  }, [pollingSingle]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.VISIT_URL, visitUrl);
  }, [visitUrl]);
  
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
          const currentJobId = getFromStorage(STORAGE_KEYS.SINGLE_JOB_ID, null);
          const isCurrentlyPolling = getFromStorage(STORAGE_KEYS.IS_POLLING_SINGLE, false);
          
          if (!currentJobId || !isCurrentlyPolling) {
            console.log('Stopping polling interval as job is no longer active');
            clearInterval(intervalId);
            return;
          }
          
          // Save timestamp of polling attempt
          saveToStorage(STORAGE_KEYS.LAST_STATUS_UPDATE, new Date().toISOString());
          
          // Get current status from server
          const status = await getFormAutomationStatus();
          
          // Only process if we still have an active polling state
          if (status) {
            // Store the latest status in storage for persistence
            updateJobStatus(status);
            
            // If job is completed or errored, stop polling
            if (status.status === 'completed' || status.status === 'error') {
              saveToStorage(STORAGE_KEYS.IS_POLLING_SINGLE, false);
              saveToStorage(STORAGE_KEYS.SINGLE_JOB_ID, null);
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
  }, [singleJobId, pollingSingle]);
  
  // Function to update job status across localStorage and state
  const updateJobStatus = (status: any) => {
    if (!status) return;
    
    // Get the stored jobs and update the relevant one
    const storedJobs = getFromStorage(STORAGE_KEYS.FORM_JOBS, []);
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
      saveToStorage(STORAGE_KEYS.FORM_JOBS, updatedJobs);
      
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
    const storedJobs = getFromStorage(STORAGE_KEYS.FORM_JOBS, []);
    const storedSingleJobId = getFromStorage(STORAGE_KEYS.SINGLE_JOB_ID, null);
    const storedIsPolling = getFromStorage(STORAGE_KEYS.IS_POLLING_SINGLE, false);
    
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
  }, []);
  
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
      saveToStorage(STORAGE_KEYS.FORM_JOBS, updatedJobs);
      
      // Call API to process the visit
      const result = await processSingleVisit(visitUrl, isHeadless, visitNumber);
      
      console.log('Process visit API response:', result);
      
      // Save the job ID from the response
      if (result.jobId) {
        console.log(`Received job ID from server: ${result.jobId}`);
        setSingleJobId(result.jobId);
        saveToStorage(STORAGE_KEYS.SINGLE_JOB_ID, result.jobId);
        
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
          saveToStorage(STORAGE_KEYS.FORM_JOBS, jobsWithId);
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
        saveToStorage(STORAGE_KEYS.FORM_JOBS, errorJobs);
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
        saveToStorage(STORAGE_KEYS.FORM_JOBS, updatedJobs);
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
      saveToStorage(STORAGE_KEYS.SINGLE_JOB_ID, null);
            
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
  
  // Preview batch file contents
  const handlePreviewBatch = async () => {
    try {
      setIsProcessing(true);
      
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to preview batch file');
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
    if (activeTab === 'batch' && batchFilePath) {
      handlePreviewBatch();
    }
  }, [batchFilePath, activeTab]);
  
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
      // Call the API to open the URL with login
      const response = await fetch('/api/open-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to open URL: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to open URL');
      }
      
      // Show success toast
      addToast(
        'info',
        'The URL has been opened in a new window'
      );
    } catch (error) {
      console.error('Error opening URL:', error);
      
      // Show error toast
      addToast(
        'error',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    }
  };
  
  // Establish a global interval to keep localStorage and state in sync
  useEffect(() => {
    // Set up an interval that runs periodically regardless of component focus
    const syncInterval = setInterval(() => {
      // Get latest stored state
      const storedJobId = getFromStorage(STORAGE_KEYS.SINGLE_JOB_ID, null);
      const storedIsPolling = getFromStorage(STORAGE_KEYS.IS_POLLING_SINGLE, false);
      
      // Only proceed if we have an active job
      if (storedJobId && storedIsPolling) {
        console.log('Background sync checking status...');
        
        // Fetch current status from server
        getFormAutomationStatus()
          .then(status => {
            if (!status) return;
            
            // Update status in localStorage directly
            const storedJobs = getFromStorage(STORAGE_KEYS.FORM_JOBS, []);
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
  }, []);
  
  // Register a beforeunload handler to ensure localStorage is updated when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Make sure the most current state is saved to localStorage before unloading
      saveToStorage(STORAGE_KEYS.FORM_JOBS, formJobs);
      saveToStorage(STORAGE_KEYS.SINGLE_JOB_ID, singleJobId);
      saveToStorage(STORAGE_KEYS.IS_POLLING_SINGLE, pollingSingle);
      saveToStorage(STORAGE_KEYS.BATCH_JOB_ID, batchJobId);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [formJobs, singleJobId, pollingSingle, batchJobId]);

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
              saveToStorage(STORAGE_KEYS.FORM_JOBS, updatedJobs);
              
              // If the job completed or errored, stop polling
              if (status.status === 'completed' || status.status === 'error') {
                console.log('Job completed or errored, stopping polling');
                clearInterval(newInterval);
                setPolling(null);
                setPollingSingle(false);
                setSingleJobId(null);
                saveToStorage(STORAGE_KEYS.SINGLE_JOB_ID, null);
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

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900`}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          {/* Page header */}
          <div className="panel-header px-6 py-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-3">
                <FiFileText className="h-6 w-6 text-blue-500" />
                Form Prep
              </h1>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
            {/* Mode switch buttons */}
            <div className="mb-8 flex justify-center">
              <div className="inline-flex rounded-md shadow-sm overflow-hidden">
                <button
                  onClick={() => setActiveTab('single')}
                  className={`px-6 py-2.5 text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'single'
                      ? 'bg-primary-600 text-white'
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
                      ? 'bg-primary-600 text-white'
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
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title flex items-center space-x-2 mb-0">
                      <FiClipboard />
                      <span>Select Work Order</span>
                    </h2>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-4">
                      {selectedWorkOrder && (
                        <div className="flex items-center">
                          <div className="badge badge-primary flex items-center space-x-1 py-1 px-3">
                            <span>{selectedWorkOrder.customer.name}</span>
                            <span className="font-mono text-xs ml-1">({extractVisitNumber(selectedWorkOrder.visits.nextVisit.url)})</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <button 
                          className="btn btn-sm btn-icon text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          onClick={goToPreviousWeek}
                          disabled={currentWeekIndex <= 0}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        <div className="flex items-center">
                          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">
                            {groupedWorkOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length ? 
                              `Week of ${groupedWorkOrders[currentWeekIndex].week}` : 'No work orders'}
                          </h3>
                          <span className="ml-2 badge badge-secondary py-1 px-2 text-xs">
                            {groupedWorkOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length ? 
                              groupedWorkOrders[currentWeekIndex].orders.length : 0} orders
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button 
                            className="btn btn-sm bg-primary-50 hover:bg-primary-100 text-primary-600 border border-primary-200 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 dark:text-primary-400 dark:border-primary-800"
                            onClick={goToCurrentWeek}
                          >
                            Today
                          </button>
                          <button 
                            className="btn btn-sm btn-icon text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            onClick={goToNextWeek}
                            disabled={currentWeekIndex >= groupedWorkOrders.length - 1}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    
                      <div className="overflow-x-auto">
                        {filteredWorkOrders.length === 0 ? (
                          <div className="p-6 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                              <FiClipboard className="h-6 w-6 text-gray-400" />
                            </div>
                            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-1">No work orders found</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">There are no work orders available for this period.</p>
                          </div>
                        ) : groupedWorkOrders.length === 0 ? (
                          <div className="p-6 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                              <FiClipboard className="h-6 w-6 text-gray-400" />
                            </div>
                            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-1">No work orders found</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">There are no work orders available for any week.</p>
                          </div>
                        ) : (
                          <div>
                            {currentWeekIndex < groupedWorkOrders.length && (
                              <div className="bg-white dark:bg-gray-800">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                  <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Store</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visit #</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dispensers</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {groupedWorkOrders[currentWeekIndex].orders.map((order) => {
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
                                                  ID: {order.id}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 font-mono whitespace-nowrap">
                                            {extractVisitNumber(order.visits.nextVisit.url)}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            {order.visits.nextVisit.date || 'Not scheduled'}
                                          </td>
                                          <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                                              {dispenserCount || '-'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Visit URL & Process Form Panel */}
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title flex items-center space-x-2 mb-0">
                      <FiExternalLink />
                      <span>Process Work Order Visit</span>
                    </h2>
                  </div>
                  
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Visit URL
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          className="input flex-1"
                          placeholder="https://app.workfossa.com/visit/..."
                          value={visitUrl}
                          onChange={(e) => setVisitUrl(e.target.value)}
                        />
                        <button 
                          className="btn btn-secondary flex items-center"
                          onClick={() => {
                            if (visitUrl) {
                              openUrlWithLogin(visitUrl);
                            }
                          }}
                          disabled={!visitUrl}
                        >
                          <FiEye className="mr-1" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500"
                          checked={!isHeadless}
                          onChange={() => setIsHeadless(!isHeadless)}
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Show browser during automation (debug mode)</span>
                      </label>
                    </div>
                    
                    <div className="flex justify-end mt-4">
                      {pollingSingle ? (
                        <button
                          className="btn btn-danger flex items-center space-x-2"
                          onClick={handleStopProcessing}
                        >
                          <FiX className="h-4 w-4" />
                          <span>Stop Processing</span>
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary flex items-center space-x-2"
                          onClick={handleSingleVisit}
                          disabled={isProcessing || !visitUrl}
                        >
                          <FiPlay className="h-4 w-4" />
                          <span>Process Visit Form</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Recent Jobs Panel */}
                {formJobs.length > 0 && (
                  <div className="panel">
                    <div className="panel-header">
                      <h2 className="panel-title flex items-center space-x-2 mb-0">
                        <FiClipboard />
                        <span>Recent Form Jobs</span>
                        {/* Add job status counter badges */}
                        <div className="flex items-center space-x-1 ml-2">
                          {formJobs.filter(job => job.status === 'running').length > 0 && (
                            <span className="bg-primary-100 text-primary-700 dark:bg-primary-800/50 dark:text-primary-400 text-xs rounded-full px-2 py-0.5 flex items-center">
                              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse mr-1"></span>
                              {formJobs.filter(job => job.status === 'running').length} Running
                            </span>
                          )}
                          {formJobs.filter(job => job.status === 'completed').length > 0 && (
                            <span className="bg-green-100 text-green-700 dark:bg-green-800/50 dark:text-green-400 text-xs rounded-full px-2 py-0.5 flex items-center">
                              <FiCheck className="w-3 h-3 mr-1" />
                              {formJobs.filter(job => job.status === 'completed').length} Completed
                            </span>
                          )}
                          {formJobs.filter(job => job.status === 'error').length > 0 && (
                            <span className="bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-400 text-xs rounded-full px-2 py-0.5 flex items-center">
                              <FiX className="w-3 h-3 mr-1" />
                              {formJobs.filter(job => job.status === 'error').length} Failed
                            </span>
                          )}
                        </div>
                      </h2>
                      <div className="flex items-center space-x-2">
                        {/* Filter options */}
                        <div className="mr-2">
                          <select
                            className="form-select rounded-md border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs px-2 py-1 bg-white dark:bg-gray-800 focus:ring-primary-500 focus:border-primary-500"
                            onChange={(e) => {
                              // Here we would implement filtering logic
                              // For now just show a toast indicating the filter was applied
                              if (e.target.value !== 'all') {
                                addToast('info', `Filtered to show ${e.target.value} jobs`);
                              }
                            }}
                            defaultValue="all"
                          >
                            <option value="all">All Jobs</option>
                            <option value="running">Running</option>
                            <option value="completed">Completed</option>
                            <option value="error">Failed</option>
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            // Clear all form jobs and update storage
                            setFormJobs([]);
                            saveToStorage(STORAGE_KEYS.FORM_JOBS, []);
                            addToast('info', 'Recent form jobs cleared');
                          }}
                          className="btn btn-sm btn-outline-danger flex items-center space-x-1 px-3 py-1 text-xs"
                          title="Clear all job history"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Clear All</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-[50%]">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-[20%]">
                                Store & Visit
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-[15%]">
                                Timestamp
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-[15%]">
                                Mode
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {formJobs.map((job, index) => {
                              // Extract visit info if not already stored in the job
                              const visitInfo = job.storeName && job.visitNumber ? 
                                  { storeName: job.storeName, visitNumber: job.visitNumber, dispenserCount: job.dispenserCount || 0 } : 
                                  extractVisitInfo(job.url);
                              
                              // Remove the ⚡ symbol from the store name if it exists
                              const cleanStoreName = visitInfo.storeName.replace(/⚡/g, '').trim();
                              
                              return (
                                <tr 
                                  key={index}
                                  className={`
                                    ${job.status === 'running' 
                                      ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-500 shadow-sm' 
                                      : job.status === 'completed' 
                                        ? 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500' 
                                        : job.status === 'error' 
                                          ? 'bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500'
                                          : index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                                    }
                                    hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-150
                                    cursor-pointer group relative
                                  `}
                                  onClick={() => {
                                    // No action needed - details removed as requested
                                    // if (job.url) {
                                    //   addToast('info', `Viewing details for ${visitInfo.storeName} (${job.status})`);
                                    // }
                                  }}
                                >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full 
                                      ${job.status === 'running' ? 'bg-primary-100 dark:bg-primary-800/60 text-primary-600 dark:text-primary-400 animate-pulse' :
                                        job.status === 'completed' ? 'bg-green-100 dark:bg-green-800/60 text-green-600 dark:text-green-400' :
                                        job.status === 'error' ? 'bg-red-100 dark:bg-red-800/60 text-red-600 dark:text-red-400' :
                                        'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                      } mr-2 shadow-sm`}>
                                      {job.status === 'running' && (
                                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      )}
                                      {job.status === 'completed' && (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                      {job.status === 'error' && (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                      {job.status === 'idle' && (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      )}
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
                                  
                                  {/* Job progress timeline estimate (only for running jobs) */}
                                  {job.status === 'running' && job.startTime && (
                                    <div className="mt-1.5 ml-10 flex items-center text-xs text-gray-500 dark:text-gray-400">
                                      <svg className="w-3.5 h-3.5 mr-1 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {(() => {
                                        // Show elapsed time instead of trying to estimate remaining time
                                        const elapsedMs = Date.now() - job.startTime;
                                        const elapsedMinutes = Math.floor(elapsedMs / 60000);
                                        const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
                                        
                                        return `Running for ${elapsedMinutes > 0 ? `${elapsedMinutes}m ` : ''}${elapsedSeconds}s`;
                                      })()}
                                    </div>
                                  )}
                                  
                                  {job.message && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 min-h-[3.75rem]">
                                      {/* Format messages by type */}
                                      {job.status === 'completed' 
                                        ? <span className="font-medium text-green-600 dark:text-green-400">Form completed successfully</span>
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
                                              // Example: "Processing Premium (3/3) - Dispenser #1/2"
                                              // Or: "Premium: 3/3, Dispenser: #7/8"
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
                                                  } else {
                                                    // Reset to defaults when no specific grade is being processed
                                                    premiumCurrent = 0;
                                                    premiumTotal = 0;
                                                  }
                                                  
                                                  // Log for debugging
                                                  // console.log(`Detected fuel grade: "${premium}" from "${premiumMatch[1]}" (${premiumCurrent}/${premiumTotal})`);
                                                } 
                                                // Fallback to a simpler regex if the complex one fails
                                                else if (job.message.match(/\b\d+\s*\/\s*\d+\b/)) {
                                                  const simpleMatch = job.message.match(/\b(\d+)\s*\/\s*(\d+)\b/);
                                                  if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
                                                    // Look for fuel type words near the numbers
                                                    const nearbyText = job.message.substring(
                                                      Math.max(0, job.message.indexOf(simpleMatch[0]) - 20),
                                                      Math.min(job.message.length, job.message.indexOf(simpleMatch[0]) + simpleMatch[0].length + 20)
                                                    );
                                                    
                                                    // Check if any fuel type is mentioned nearby
                                                    let detectedType = null;
                                                    for (const type of fuelTypes) {
                                                      if (type !== 'fuel type' && type !== 'fuel grade' && nearbyText.toLowerCase().includes(type)) {
                                                        detectedType = type;
                                                        break;
                                                      }
                                                    }
                                                    
                                                    if (detectedType) {
                                                      premium = detectedType.charAt(0).toUpperCase() + detectedType.slice(1);
                                                    } else {
                                                      premium = "Fuel Grade"; // Default name if type can't be detected
                                                    }
                                                    
                                                    premiumCurrent = parseInt(simpleMatch[1]);
                                                    premiumTotal = parseInt(simpleMatch[2]);
                                                  }
                                                }
                                                
                                                // Check for dispenser (improved regex)
                                                const dispenserRegex = /(?:dispenser|pump|meter)(?:[\s#:]+)(\d+)(?:[^\d]+(\d+)|)/i;
                                                const dispenserMatch = job.message.match(dispenserRegex);
                                                
                                                if (dispenserMatch && dispenserMatch[1]) {
                                                  dispenser = "Dispenser";
                                                  dispenserCurrent = parseInt(dispenserMatch[1]);
                                                  
                                                  // Always prioritize the job's dispenserCount when calculating percentage
                                                  // This ensures consistent progress indication throughout the process
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
                                                  
                                                  // Extract work order ID if available to get actual dispenser labels
                                                  const workOrderId = job.url?.match(/\/work\/(\w+)/)?.[1];
                                                  if (workOrderId && dispenserDetails[`W-${workOrderId}`]) {
                                                    const dispensersData = dispenserDetails[`W-${workOrderId}`].dispensers;
                                                    
                                                    // More robust dispenser index calculation
                                                    if (dispensersData && dispensersData.length > 0) {
                                                      // Try to find the closest matching dispenser by number
                                                      let dispenserIndex = dispenserCurrent - 1; // Default 0-indexed position
                                                      
                                                      // Safety check to prevent array out of bounds
                                                      if (dispenserIndex >= dispensersData.length) {
                                                        // If the current dispenser number is too high, use the last dispenser
                                                        dispenserIndex = dispensersData.length - 1;
                                                      } else if (dispenserIndex < 0) {
                                                        // If somehow negative, use the first dispenser
                                                        dispenserIndex = 0;
                                                      }
                                                      
                                                      const dispenserData = dispensersData[dispenserIndex];
                                                      if (dispenserData?.title) {
                                                        // Extract the dispenser number from the title (e.g., "1/2" from "1/2 - Regular...")
                                                        const dispenserNumber = dispenserData.title.split(' - ')[0];
                                                        dispenser = `Dispenser ${dispenserNumber}`;
                                                        
                                                        // Keep a consistent count of total dispensers
                                                        dispenserTotal = dispensersData.length;
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                              // Always show dispenser block if current dispenser is detected
                                              // This ensures consistent UI even if we don't have all dispenser information yet
                                              if (dispenserCurrent > 0 && !dispenser) {
                                                dispenser = "Dispenser";
                                                dispenserTotal = job.dispenserCount || 1;
                                              }
                                              
                                              // Calculate percentages for progress bars
                                              const premiumPercent = premiumTotal > 0 ? Math.round((premiumCurrent / premiumTotal) * 100) : 0;
                                              
                                              // For dispensers, prioritize using the job's known dispenser count for more accuracy
                                              const authoritativeTotalForPercent = job.dispenserCount || dispenserTotal || 1;
                                              
                                              // Fix the percentage calculation to ensure it reaches 100% at the last dispenser
                                              // Instead of 0% for first dispenser, calculate based on progress through the dispensers
                                              let dispenserPercent = 0;
                                              if (dispenserCurrent && authoritativeTotalForPercent) {
                                                // Start at a base percentage (not 0%) for the first dispenser
                                                // This indicates we're working on this first dispenser
                                                if (authoritativeTotalForPercent === 1) {
                                                  // If there's only one dispenser, use percentage based on whether it's started (50%) or not
                                                  dispenserPercent = job.status === 'running' ? 50 : 0;
                                                } else {
                                                  // For multiple dispensers:
                                                  // - First dispenser starts at a base percentage (not 0%)
                                                  // - Last dispenser = 100% when complete
                                                  
                                                  // Calculate as: (current-1 + progressOnCurrent) / total * 100
                                                  // Where progressOnCurrent is 0.5 (halfway) by default, but can be refined later
                                                  // This gives an even distribution across all dispensers
                                                  
                                                  // Each dispenser gets an equal portion of the 100%
                                                  const percentPerDispenser = 100 / authoritativeTotalForPercent;
                                                  
                                                  // Calculate completed dispensers (current-1)
                                                  const completedProgress = (dispenserCurrent - 1) * percentPerDispenser;
                                                  
                                                  // Add half of the current dispenser's percentage (assuming work is ~halfway through)
                                                  const currentDispenserProgress = percentPerDispenser * 0.5;
                                                  
                                                  // Total progress is the sum of the two
                                                  dispenserPercent = Math.round(completedProgress + currentDispenserProgress);
                                                  
                                                  // Cap at 100% to prevent overflow
                                                  dispenserPercent = Math.min(dispenserPercent, 100);
                                                }
                                              }
                                              
                                              // The old calculation was:
                                              // const dispenserPercent = Math.round((dispenserCurrent / authoritativeTotalForPercent) * 100);
                                              
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
                                              
                                              // Fixed height container for progress bars
                                              return (
                                                <div className="flex flex-col h-24 justify-center">
                                                  {/* Always render the dispenser block - with placeholder when no data yet */}
                                                  <div className="relative h-8 mb-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                      <span className="flex items-center font-medium text-amber-600 dark:text-amber-400 text-xs">
                                                        <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                          <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 100 2h.01a1 1 0 100-2H7zm2 1a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm4-4a1 1 0 100 2h.01a1 1 0 100-2H13zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zM7 8a1 1 0 000 2h.01a1 1 0 000-2H7z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="font-semibold">{dispenser || "Dispenser"}</span>
                                                      </span>
                                                      <div className="flex items-center space-x-2">
                                                        {dispenserCurrent > 0 ? (
                                                          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                                                            {(dispenser && dispenser !== "Dispenser") ? 
                                                              dispenser.replace("Dispenser ", "") : `#${dispenserCurrent}`}
                                                          </span>
                                                        ) : (
                                                          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-500">
                                                            Loading...
                                                          </span>
                                                        )}
                                                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full 
                                                          ${dispenserCurrent > 0 ? 
                                                            (dispenserPercent >= 75 ? 'bg-green-100 text-green-700 dark:bg-green-800/40 dark:text-green-400' : 
                                                            dispenserPercent >= 25 ? 'bg-amber-100 text-amber-700 dark:bg-amber-800/40 dark:text-amber-400' : 
                                                            'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400') :
                                                            'bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-500'}`}>
                                                          {dispenserCurrent > 0 ? `${dispenserPercent}%` : 'Waiting...'}
                                                        </span>
                                                      </div>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                      {dispenserCurrent > 0 ? (
                                                        <div 
                                                          className={`${getDispenserColor()} h-2 rounded-full transition-all duration-500 ease-in-out ${pulseAnimation}`}
                                                          style={{ width: `${dispenserPercent}%` }}
                                                        ></div>
                                                      ) : (
                                                        <div className="flex w-full h-2 animate-pulse">
                                                          <div className="w-1/5 h-2 bg-amber-300 dark:bg-amber-700/50 rounded-l-full"></div>
                                                          <div className="w-4/5 h-2 bg-gray-300 dark:bg-gray-600/50 rounded-r-full"></div>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Always render the premium block with conditional visibility */}
                                                  <div className={`relative ${premium ? 'opacity-100' : 'opacity-0'} h-8`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                      <span className="flex items-center font-medium text-blue-600 dark:text-blue-400 text-xs">
                                                        <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                          <path fillRule="evenodd" d="M5 17a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5zm12-10a1 1 0 00-1-1h-3a1 1 0 00-1 1v6a1 1 0 001 1h3a1 1 0 001-1V7z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="font-semibold">{premium}</span>
                                                      </span>
                                                      <div className="flex items-center space-x-2">
                                                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                                                          {/* Only show numbers if we have a specific grade, otherwise show a placeholder */}
                                                          {premium && premium !== "Fuel Grade" ? 
                                                            `${premiumCurrent}/${premiumTotal}` : 
                                                            "Ready"
                                                          }
                                                        </span>
                                                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full 
                                                          ${premiumPercent >= 75 ? 'bg-green-100 text-green-700 dark:bg-green-800/40 dark:text-green-400' : 
                                                            premiumPercent >= 25 ? 'bg-blue-100 text-blue-700 dark:bg-blue-800/40 dark:text-blue-400' : 
                                                            'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400'}`}>
                                                          {/* Only show percentage if we have a specific grade */}
                                                          {premium && premium !== "Fuel Grade" ? 
                                                            `${premiumPercent}%` : 
                                                            "Waiting..."
                                                          }
                                                        </span>
                                                      </div>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                      <div 
                                                        className={`${getPremiumColor()} h-2 rounded-full transition-all duration-500 ease-in-out ${pulseAnimation}`}
                                                        style={{ width: `${premiumPercent}%` }}
                                                      ></div>
                                                    </div>
                                                  </div>
                                                  
                                                  {!premium && !dispenser && (
                                                    <div className="flex h-full items-center">
                                                      <span>{job.message}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })()
                                          : job.status === 'error'
                                            ? <span className="text-red-500 dark:text-red-400">{job.message}</span>
                                            : <span>{job.message}</span>
                                      }
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {/* Store & Visit information - now on separate lines with better styling */}
                                  <div className="font-medium text-gray-700 dark:text-gray-300">
                                    <div className={`inline-block w-2 h-2 rounded-full ${
                                      job.status === 'running' ? 'bg-primary-500 animate-pulse' :
                                      job.status === 'completed' ? 'bg-green-500' :
                                      job.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                                    } mr-2`}></div>
                                    {cleanStoreName}
                                  </div>
                                  <div className="text-xs mt-1.5 flex items-center">
                                    <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md text-gray-700 dark:text-gray-300 font-medium">
                                      #{visitInfo.visitNumber}
                                    </span>
                                  </div>
                                  {visitInfo.dispenserCount > 0 && (
                                    <div className="text-xs mt-1.5 flex">
                                      <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md px-2 py-0.5 flex items-center shadow-sm">
                                        <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                        </svg>
                                        <span className="font-medium">Dispensers:</span>
                                        <span className="ml-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-300 rounded px-1.5 font-semibold">{visitInfo.dispenserCount}</span>
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  <div className="flex flex-col"> {/* Main container for vertical alignment */}
                                    <div className="flex items-center space-x-2">
                                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400 shadow-sm">
                                        <FiClock className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-700 dark:text-gray-300">
                                          {job.timestamp}
                                        </div>
                                        {job.startTime && (
                                          <div className="flex items-center text-xs mt-1">
                                            <span className="inline-flex items-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md">
                                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              {formatDuration(job.startTime, job.endTime)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {job.status === 'completed' && job.startTime && job.endTime && (
                                      <div className="mt-1.5 flex items-center text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2.5 py-1 rounded-md shadow-sm">
                                        <svg className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="font-semibold whitespace-nowrap">
                                          Completed
                                        </span>
                                        <span className="ml-1.5"> {/* Increased spacing for better readability */}
                                          {new Date(job.endTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {job.status === 'error' && job.startTime && job.endTime && (
                                      <div className="mt-1.5 flex items-center text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2.5 py-1 rounded-md shadow-sm">
                                        <svg className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="font-semibold whitespace-nowrap">
                                          Failed
                                        </span>
                                        <span className="ml-1.5"> {/* Increased spacing for better readability */}
                                          {new Date(job.endTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  <div className="flex items-center">
                                    {job.headless ? (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-sm">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        Headless
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 shadow-sm">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        Visible
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'batch' && (
              <div className="space-y-6">
                {/* Visit Selection Panel - Styled like the Work Order Selection Panel */}
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title flex items-center space-x-2 mb-0">
                      <FiClipboard />
                      <span>Select Work Order Visits</span>
                    </h2>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Group By:</span>
                          <select
                            className="select text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-1.5 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
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
                          className="btn btn-sm btn-secondary flex items-center space-x-1"
                          onClick={handleSelectAll}
                        >
                          <FiCheck className="h-3.5 w-3.5" />
                          <span>Select All</span>
                        </button>
                        <button
                          className="btn btn-sm btn-secondary flex items-center space-x-1"
                          onClick={handleDeselectAll}
                        >
                          <FiX className="h-3.5 w-3.5" />
                          <span>Deselect All</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center">
                          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">
                            Available Visits
                          </h3>
                          <span className="ml-2 badge badge-secondary py-1 px-2 text-xs">
                            {previewData.length} visits
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedVisits.length} selected
                        </div>
                      </div>
                      
                      {/* Visit List - Increased max-height to show more rows */}
                      <div className="max-h-[400px] overflow-y-auto bg-white dark:bg-gray-800">
                        {isLoading || previewData.length === 0 ? (
                          <div className="p-8 flex flex-col items-center justify-center text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                            <div className="text-gray-500 dark:text-gray-400">Loading visit data...</div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Please wait while we fetch the visit information</p>
                          </div>
                        ) : (
                          renderGroupedVisits()
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Process Batch Panel - Similar to Process Form Panel in single visit */}
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title flex items-center space-x-2 mb-0">
                      <FiExternalLink />
                      <span>Process Batch Visits</span>
                    </h2>
                  </div>
                  
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Debug Options
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500"
                            checked={!isHeadless}
                            onChange={() => setIsHeadless(!isHeadless)}
                          />
                          <span className="ml-2 text-gray-700 dark:text-gray-300">Show browser during automation (debug mode)</span>
                        </label>
                        
                        {/* Resume Batch Option */}
                        {lastFailedBatch && (
                          <label className="flex items-center cursor-pointer text-yellow-600 dark:text-yellow-500">
                            <input
                              type="checkbox"
                              className="form-checkbox h-5 w-5 text-yellow-600 rounded border-yellow-400 dark:border-yellow-600 focus:ring-yellow-500"
                              checked={resumeBatch}
                              onChange={() => setResumeBatch(!resumeBatch)}
                            />
                            <span className="ml-2">
                              Resume from last failed batch ({lastFailedBatch.completedVisits}/{lastFailedBatch.totalVisits})
                            </span>
                          </label>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-4">
                      <button
                        className="btn btn-primary flex items-center space-x-2"
                        onClick={() => {
                          addToast('info', 'Batch processing not implemented in this version');
                        }}
                        disabled={isProcessing || (previewData.length > 0 && selectedVisits.length === 0)}
                      >
                        <FiPlay className="h-4 w-4" />
                        <span>Process Batch</span>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Batch Jobs Panel - Styled like the Recent Jobs Panel */}
                {batchJobs.length > 0 && (
                  <div className="panel">
                    <div className="panel-header">
                      <h2 className="panel-title flex items-center space-x-2 mb-0">
                        <FiClipboard />
                        <span>Batch Job History</span>
                      </h2>
                    </div>
                    
                    <div className="mt-4">
                      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Store
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Visit #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Dispensers
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {batchJobs.map((job, index) => {
                              // Extract file name for display
                              const fileName = job.filePath.split('/').pop() || job.filePath;
                              // Create job ID for display (can be customized)
                              const jobId = `B-${String(index + 1).padStart(5, '0')}`;
                              // Format date nicely (MM/DD/YYYY)
                              const jobDate = job.timestamp ? new Date(job.timestamp).toLocaleDateString('en-US', {
                                month: '2-digit',
                                day: '2-digit',
                                year: 'numeric'
                              }) : 'N/A';
                              
                              // Determine which icon color to use based on status
                              const storeStyles = job.status === 'completed' 
                                ? { bg: 'bg-green-100 dark:bg-green-900/20', border: 'border-green-500', icon: 'text-green-600 dark:text-green-400' }
                                : job.status === 'error'
                                  ? { bg: 'bg-red-100 dark:bg-red-900/20', border: 'border-red-500', icon: 'text-red-600 dark:text-red-400' }
                                  : { bg: 'bg-blue-100 dark:bg-blue-900/20', border: 'border-blue-500', icon: 'text-blue-600 dark:text-blue-400' };
                              
                              return (
                                <tr
                                  key={index}
                                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                                    job.status === 'running' ? `${storeStyles.bg} border-l-4 ${storeStyles.border}` : ''
                                  }`}
                                >
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${storeStyles.bg} mr-3`}>
                                        <FiFileText className={`${storeStyles.icon}`} />
                                      </div>
                                      <div>
                                        <div className="font-medium">{fileName}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          ID: {jobId}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-mono whitespace-nowrap">
                                    {job.completedVisits}/{job.totalVisits}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {jobDate}
                                  </td>
                                  <td className="px-4 py-3 text-center whitespace-nowrap">
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                                      {job.totalVisits > 0 ? Math.round((job.completedVisits / job.totalVisits) * 100) : 0}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
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

export default FormPrep; 
