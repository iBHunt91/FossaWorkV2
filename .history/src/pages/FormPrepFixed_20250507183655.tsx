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
  startTime?: number; 
  endTime?: number;   
  _statusChanged?: boolean;
  _completed?: boolean;
  _error?: boolean;
  jobId?: string; 
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

/**
 * Form Prep component for automating form completion
 */
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

  // Update job status across localStorage and state
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

  // Effect to update visit URL when a work order is selected
  useEffect(() => {
    if (selectedWorkOrder && selectedWorkOrder.visits?.nextVisit?.url) {
      // Construct the full URL if it's relative
      const url = selectedWorkOrder.visits.nextVisit.url;
      const fullUrl = url.startsWith('http') ? url : `https://app.workfossa.com${url}`;
      setVisitUrl(fullUrl);
    }
  }, [selectedWorkOrder]);

  // Extract visit number from URL
  const extractVisitNumber = (url: string): string => {
    const match = url.match(/visits\/(\d+)/);
    return match ? match[1] : '';
  };

  // Get dispenser count
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-6 animate-fadeIn">
          {/* Page header - updated to match Dashboard Header style */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 text-white rounded-xl shadow-lg mb-6 flex flex-col overflow-hidden border border-gray-700 dark:border-gray-800">
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                  <FiFileText className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white mb-0">Form Prep</h1>
                  <p className="text-sm text-gray-300 mt-0.5">Automate form completion for service visits</p>
                </div>
              </div>
              
              <div className="relative z-10">
                {/* Decorative element */}
                <div className="absolute top-0 right-0 w-32 h-32 -mt-8 -mr-8 bg-gradient-to-br from-primary-400/20 to-primary-600/10 rounded-full blur-xl"></div>
                
                {/* Tab buttons - updated to match Dashboard Action Buttons */}
                <div className="flex items-center space-x-2 relative z-10">
                  <button
                    onClick={() => setActiveTab('single')}
                    className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                      activeTab === 'single'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'
                    }`}
                  >
                    <FiFileText className="h-4 w-4" />
                    Single Visit
                  </button>
                  <button
                    onClick={() => setActiveTab('batch')}
                    className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                      activeTab === 'batch'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'
                    }`}
                  >
                    <FiUpload className="h-4 w-4" />
                    Batch Mode
                  </button>
                </div>
              </div>
            </div>
          </div>

          {activeTab === 'single' && (
            <div className="space-y-6">
              {/* Work Order Selection Panel */}
              <div className="panel bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="panel-header">
                  <h2 className="panel-title text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-2 mb-4">
                    <FiClipboard className="text-primary-500 dark:text-primary-400" />
                    <span>Select Work Order</span>
                  </h2>
                </div>
                
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-4">
                    {selectedWorkOrder && (
                      <div className="flex items-center">
                        <div className="badge badge-primary bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 flex items-center space-x-1 py-1 px-3 rounded-full text-sm">
                          <span>{selectedWorkOrder.customer.name}</span>
                          <span className="font-mono text-xs ml-1">({extractVisitNumber(selectedWorkOrder.visits.nextVisit.url)})</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <button 
                        className="btn btn-sm btn-icon text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1 rounded"
                        onClick={() => {
                          if (currentWeekIndex > 0) {
                            setCurrentWeekIndex(currentWeekIndex - 1);
                          }
                        }}
                        disabled={currentWeekIndex <= 0}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      <div className="flex items-center">
                        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">
                          {workOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length ? 
                            `Week of ${groupedWorkOrders[currentWeekIndex]?.week}` : 'No work orders'}
                        </h3>
                        <span className="ml-2 badge badge-secondary bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 py-1 px-2 text-xs rounded">
                          {workOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length ? 
                            groupedWorkOrders[currentWeekIndex]?.orders?.length || 0 : 0} orders
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button 
                          className="btn btn-sm bg-primary-50 hover:bg-primary-100 text-primary-600 border border-primary-200 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 dark:text-primary-400 dark:border-primary-800 py-1 px-2 rounded text-sm"
                          onClick={() => {
                            // Find current week logic from the original component
                            const today = new Date();
                            const currentSunday = new Date(today);
                            currentSunday.setDate(today.getDate() - today.getDay());
                            
                            const currentSaturday = new Date(currentSunday);
                            currentSaturday.setDate(currentSunday.getDate() + 6);
                            
                            const firstMonth = currentSunday.getMonth() + 1;
                            const firstDay = currentSunday.getDate();
                            const lastMonth = currentSaturday.getMonth() + 1;
                            const lastDay = currentSaturday.getDate();
                            
                            let currentWeekLabel;
                            if (firstMonth === lastMonth) {
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
                          }}
                        >
                          Today
                        </button>
                        <button 
                          className="btn btn-sm btn-icon text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1 rounded"
                          onClick={() => {
                            if (currentWeekIndex < groupedWorkOrders.length - 1) {
                              setCurrentWeekIndex(currentWeekIndex + 1);
                            }
                          }}
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
                      ) : (
                        <div>
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
                              {filteredWorkOrders.map((order) => {
                                // Styling and display logic for each work order
                                return (
                                  <tr
                                    key={order.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                    onClick={() => {
                                      setSelectedWorkOrder(order);
                                    }}
                                  >
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mr-3">
                                          <FiMapPin className="text-blue-500 dark:text-blue-400" />
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
                                        {getDispenserCountDirect(order.id) || '-'}
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
                  </div>
                </div>
              </div>
              
              {/* Visit URL & Process Form Panel */}
              <div className="panel bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="panel-header">
                  <h2 className="panel-title text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-2 mb-4">
                    <FiExternalLink className="text-primary-500 dark:text-primary-400" />
                    <span>Process Work Order Visit</span>
                  </h2>
                </div>
                
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Visit URL
                    </label>
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiExternalLink className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        type="text"
                        className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 pl-10 py-2.5 focus:ring-primary-500 focus:border-primary-500 text-sm"
                        placeholder="https://app.workfossa.com/visit/..."
                        value={visitUrl}
                        onChange={(e) => setVisitUrl(e.target.value)}
                      />
                      <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
                        <button 
                          className="inline-flex items-center px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium"
                          onClick={() => {
                            if (visitUrl) {
                              addToast('info', 'Opening URL: ' + visitUrl);
                            }
                          }}
                          disabled={!visitUrl}
                        >
                          <FiEye className="mr-1.5 h-4 w-4" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Automation Options</h3>
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
                  </div>
                  
                  <div className="flex justify-end mt-6 space-x-3">
                    {pollingSingle ? (
                      <button
                        className="btn bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700 flex items-center space-x-2 px-4 py-2 rounded-md"
                        onClick={handleStopProcessing}
                      >
                        <FiX className="h-4 w-4" />
                        <span>Stop Processing</span>
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
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
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="space-y-6">
              <div className="panel bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="panel-header">
                  <h2 className="panel-title text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-2 mb-4">
                    <FiUpload className="text-primary-500 dark:text-primary-400" />
                    <span>Batch Processing</span>
                  </h2>
                </div>
                
                <div className="mt-4">
                  <div className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                      <FiClipboard className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Processing</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Process multiple visits in batch mode.</p>
                    <button 
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors"
                      onClick={() => addToast('info', 'Batch processing functionality is coming soon.')}
                    >
                      <span>Preview Batch Data</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormPrepFixed; 