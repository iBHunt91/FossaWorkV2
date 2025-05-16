import React, { useState, useEffect } from 'react';
import {
  FiPlay, FiX, FiCheckCircle, FiXCircle, FiLoader,
  FiInfo, FiAlertTriangle, FiList, FiPause, FiRefreshCw
} from 'react-icons/fi';
import { useToast } from '../hooks/useToast';
import {
  processBatchVisits,
  getUnifiedAutomationStatus,
  cancelFormAutomation,
  pauseFormAutomation,
  resumeFormAutomation,
  getActiveJobs,
  clearJobHistory
} from '../services/formService';
import { UnifiedAutomationStatus } from '../types/automationTypes';
import {
  addFormPrepLogDetailed
} from '../services/scrapeService';
import { getDispensersForWorkOrder } from '../services/dispenserService';
import DispenserProgressCard from './DispenserProgressCard';

// WorkOrder type definition
interface WorkOrder {
  id: string;
  customer: {
    name: string;
    storeNumber: string;
    address: {
      street: string;
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
    id: string;
    date: string;
    status: string;
    url?: string;
  }[];
  [key: string]: any;
}

interface BatchVisitAutomationProps {
  activeUserId: string;
  workOrders: WorkOrder[];
  addDebugLog: (type: string, message: string, data?: any) => void;
  onJobStatusChange?: (jobStatus: any) => void;
  onJobComplete?: () => void;
  onJobError?: (error: any) => void;
  preselectedVisits?: string[];
  onSelectionChange?: (selectedVisits: string[]) => void;
  selectionOnly?: boolean;
}

const BatchVisitAutomation: React.FC<BatchVisitAutomationProps> = ({
  activeUserId,
  workOrders,
  addDebugLog,
  onJobStatusChange,
  onJobComplete,
  onJobError,
  preselectedVisits,
  onSelectionChange,
  selectionOnly = false
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isHeadless, setIsHeadless] = useState<boolean>(true);
  const [selectedVisits, setSelectedVisits] = useState<string[]>(preselectedVisits || []);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [batchJobs, setBatchJobs] = useState<Array<any>>([]);
  const [visitGroups, setVisitGroups] = useState<any[]>([]);
  const [resumeBatch, setResumeBatch] = useState<boolean>(false);
  const [lastFailedBatch, setLastFailedBatch] = useState<any | null>(null);
  const [dispenserDetails, setDispenserDetails] = useState<Record<string, any>>({});
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({
    '-1': true, // Past Due (always expanded)
    '0': true,  // This Week (expanded by default)
    '1': true,  // Next Week (expanded by default)
    '2': false, // Week 3 (collapsed by default)
    '3': false, // Week 4 (collapsed by default)
    '4': false  // Future (collapsed by default)
  });
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<string>('');
  const { addToast } = useToast();

  // Storage keys for localStorage - make user-specific
  const userStorageKeys = {
    BATCH_JOBS: `form_prep_batch_jobs_${activeUserId}`,
    BATCH_JOB_ID: `form_prep_batch_job_id_${activeUserId}`,
    SELECTED_VISITS: `form_prep_selected_visits_${activeUserId}`,
    LAST_FAILED_BATCH: `form_prep_last_failed_batch_${activeUserId}`,
    IS_PAUSED: `form_prep_is_paused_${activeUserId}`,
    PAUSE_REASON: `form_prep_pause_reason_${activeUserId}`,
    JOB_PROGRESS: `form_prep_job_progress_${activeUserId}`
  };

  // Helper functions for localStorage
  const saveToStorage = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving to localStorage (${key}):`, error);
    }
  };

  const getFromStorage = (key: string, defaultValue: any = null) => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return defaultValue;
    }
  };

  // Extract dispensers count from work order
  const getDispenserCount = (workOrder: any): number => {
    if (!workOrder) return 0;
    
    // Check if we have dispenser details for this work order
    if (dispenserDetails[workOrder.id]?.dispensers?.length) {
      return dispenserDetails[workOrder.id].dispensers.length;
    }
    
    // Fallback to services if dispensers array is empty/missing
    if (workOrder?.services) {
      // Look for meter calibration services as fallback
      const meterCalibrationService = workOrder.services.find(
        (service: any) => 
        service.description?.toLowerCase().includes("dispenser") ||
        service.description?.toLowerCase().includes("meter")
      );
      
      if (meterCalibrationService?.quantity) {
        return meterCalibrationService.quantity;
      }
    }
    
    return 0;
  };

  // Determine CSS styles for a store
  const getStoreStyles = (storeName: string) => {
    if (!storeName) return {
      bg: 'bg-gray-100 dark:bg-gray-800/20',
      border: 'border-gray-400',
      icon: 'text-gray-500'
    };
    
    // Normalize store name to lowercase for comparison
    const normalizedName = storeName.toLowerCase();
    
    // Define style mappings for different store names
    const storeStyleMap: Record<string, {bg: string, border: string, icon: string}> = {
      // Gas stations
      'shell': {
        bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        border: 'border-yellow-500',
        icon: 'text-yellow-600 dark:text-yellow-400'
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
      'chevron': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'bp': {
        bg: 'bg-green-100 dark:bg-green-900/20',
        border: 'border-green-500', 
        icon: 'text-green-600 dark:text-green-400'
      },
      'citgo': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'marathon': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'sunoco': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'valero': {
        bg: 'bg-green-100 dark:bg-green-900/20',
        border: 'border-green-500',
        icon: 'text-green-600 dark:text-green-400'
      },
      '7-eleven': {
        bg: 'bg-green-100 dark:bg-green-900/20',
        border: 'border-green-500',
        icon: 'text-green-600 dark:text-green-400'
      },
      'circle k': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'speedway': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'wawa': {
        bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        border: 'border-yellow-500',
        icon: 'text-yellow-600 dark:text-yellow-400'
      },
      'quiktrip': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'racetrac': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'costco': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'sams club': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      'loves': {
        bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        border: 'border-yellow-500',
        icon: 'text-yellow-600 dark:text-yellow-400'
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
      },
      'murphy': {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: 'text-blue-600 dark:text-blue-400'
      }
    };
    
    // Check for matches in the store name
    for (const [key, styles] of Object.entries(storeStyleMap)) {
      if (normalizedName.includes(key)) {
        return styles;
      }
    }
    
    // Default style if no match
    return {
      bg: 'bg-gray-100 dark:bg-gray-800/20',
      border: 'border-gray-400',
      icon: 'text-gray-500'
    };
  };

  // Polling manager for batch visit automation
  const pollingManager = React.useRef({
    activePolls: {} as Record<string, any>,
    
    // Start polling for a specific job ID
    startPolling: function(
      jobId: string,
      onUpdate: (status: any) => void,
      onComplete: () => void,
      onError: (error: any) => void,
      url: string = ''
    ) {
      // Add job existence check
      if (!this.checkIfJobExistsInState(jobId)) {
        console.log(`[DEBUG BATCH] Job ID ${jobId} not found in local state, skipping polling`);
        return; // Don't start polling for jobs not in state
      }
      
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
      
      // Set up a timeout to check for activity after 30 seconds
      const firstTimeout = setTimeout(() => {
        console.log('🔍 30-second check for activity');
        
        if (!this.activePolls[jobId]) return;
        
        const poll = this.activePolls[jobId];
        const lastMessage = poll.lastMessage || '';
        const timeSinceLastChange = Date.now() - poll.lastStatusTime;
        
        console.log(`🔍 Time since last activity: ${Math.round(timeSinceLastChange/1000)}s`);
        
        // Check for signs of active automation
        const isClosingBrowser = lastMessage.includes('Closing browser');
        const isFillingForms = lastMessage.includes('filling') || lastMessage.includes('entering');
        const isProcessingFuel = lastMessage.includes('processing fuel') || lastMessage.includes('fuel grade');
        const isNavigating = lastMessage.includes('navigating') || lastMessage.includes('next form');
        const isActive = isClosingBrowser || isFillingForms || isProcessingFuel || isNavigating;
        
        // Is the message updating frequently?
        const messageIsRecent = timeSinceLastChange < 45000; // 45 seconds
        
        if (messageIsRecent || isActive) {
          console.log('🔍 Active processing detected, continuing');
          return; // Continue polling normally
        }
        
        // After this point = limited activity. Set up an interval to keep checking
        const activityInterval = setInterval(() => {
          if (!this.activePolls[jobId]) {
            clearInterval(activityInterval);
            return;
          }
          
          const poll = this.activePolls[jobId];
          const timeSinceLastChange = Date.now() - poll.lastStatusTime;
          
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
      
      // Store all the timers and state
      this.activePolls[jobId] = {
        interval: null, // We'll set this after creating the poll object
        firstTimeout,
        startTime,
        lastStatusTime: Date.now(),
        lastMessage: '',
        lastStatus: '',
        forceComplete: false,
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
          // API call to check status - using only the jobId parameter
          const status = await getUnifiedAutomationStatus(jobId);
          const now = Date.now();
          
          // Make sure the poll still exists before updating
          if (!this.activePolls[jobId]) {
            return;
          }
          
          const poll = this.activePolls[jobId];
          
          // Only update last status time if the message actually changed
          if (status.message !== poll.lastMessage) {
            poll.lastMessage = status.message || '';
            poll.lastStatusTime = now;
          }
          
          // If status changed, always update time
          if (status.status !== poll.lastStatus) {
            poll.lastStatus = status.status;
            poll.lastStatusTime = now;
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
    
    // Check if a job exists in the state to avoid "not found in local state" errors
    checkIfJobExistsInState: function(jobId: string) {
      if (!jobId) return false;
      
      try {
        // Check batch jobs array
        const batchJob = batchJobs.find(job => job.jobId === jobId);
        
        if (!batchJob) {
          console.log(`[DEBUG BATCH] Job ID ${jobId} not found in local state, skipping polling`);
          return false;
        }
        
        // Check if the job belongs to the active user
        if (batchJob._userId && batchJob._userId !== activeUserId) {
          console.log(`[DEBUG BATCH] Job ID ${jobId} belongs to user ${batchJob._userId}, not active user ${activeUserId}, skipping polling`);
          return false;
        }
        
        return true;
      } catch (e) {
        console.error('Error checking if job exists in state:', e);
        return false;
      }
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
      
      // Clean up all timers and intervals
      try {
        const poll = this.activePolls[jobId];
        
        // Clear the main polling interval
        if (poll.interval) {
          clearInterval(poll.interval);
          poll.interval = null;
        }
        
        // Clear the activity check interval
        if (poll.activityInterval) {
          clearInterval(poll.activityInterval);
          poll.activityInterval = null;
        }
        
        // Clear all timeouts
        if (poll.firstTimeout) {
          clearTimeout(poll.firstTimeout);
          poll.firstTimeout = null;
        }
        
        // Extra safety: Clear any other potential intervals or timeouts
        // that might be stored in the poll object
        Object.keys(poll).forEach(key => {
          const value = poll[key];
          if (typeof value === 'number' && !isNaN(value)) {
            clearTimeout(value);
            clearInterval(value);
          }
        });
        
        // Delete the poll entry to prevent memory leaks
        delete this.activePolls[jobId];
        
        // Log cleanup completion
        console.log(`🔍 Successfully cleaned up all resources for job ID: ${jobId}`);
      } catch (e) {
        console.error('Error clearing timeouts and intervals:', e);
      }
    },
    
    // Stop all active polls
    stopAll: function() {
      console.log('🔍 Stopping all active polls');
      
      // Clean up each poll
      Object.keys(this.activePolls).forEach(jobId => {
        this.stopPolling(jobId);
      });
    }
  });

  // Extract fuel progress information from message
  const extractFuelProgressLocal = (message: string) => {
    const defaultResult = { current: 0, total: 0 };
    
    try {
      // First look for specific fuel grade mentions
      const specificFuelPattern = /fuel\s+grade:\s+([a-z\-\s]+)\s*\((\d+)\/(\d+)\)/i;
      const specificMatch = message.match(specificFuelPattern);
      if (specificMatch && specificMatch[1] && specificMatch[2] && specificMatch[3]) {
        const fuelType = specificMatch[1].trim();
        const current = parseInt(specificMatch[2]);
        const total = parseInt(specificMatch[3]);
        
        return {
          current,
          total,
          fuelType
        };
      }
      
      // Check for fuel grade patterns like "Processing Premium (3/3)" or "Fuel Grade: Regular (2/4)"
      const fuelRegex = /(regular|premium|unleaded|mid-?grade|diesel|e-?85|kerosene|racing|aviation)\s*\((\d+)\/(\d+)\)/i;
      const fuelMatch = message.match(fuelRegex);
      
      if (fuelMatch && fuelMatch[1] && fuelMatch[2] && fuelMatch[3]) {
        const fuelType = fuelMatch[1].trim();
        const current = parseInt(fuelMatch[2]);
        const total = parseInt(fuelMatch[3]);
        
        return {
          current,
          total,
          fuelType
        };
      }
      
      // Try the general pattern "Fuel (1/3)" or "Fuel Grades (2/4)"
      const generalFuelPattern = /fuel\s+(?:grades?)?.*?\((\d+)\/(\d+)\)/i;
      const generalMatch = message.match(generalFuelPattern);
      if (generalMatch && generalMatch[1] && generalMatch[2]) {
        return {
          current: parseInt(generalMatch[1]),
          total: parseInt(generalMatch[2]),
          fuelType: 'unknown'
        };
      }
      
      // Try to match just the numbers pattern (x/y) only as last resort
      const simpleMatch = message.match(/\b(\d+)\s*\/\s*(\d+)\b/);
      if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
        // Only use this if there's any mention of "fuel" in the message
        if (message.toLowerCase().includes('fuel')) {
          return {
            current: parseInt(simpleMatch[1]),
            total: parseInt(simpleMatch[2]),
            fuelType: 'unknown'
          };
        }
      }
    } catch (error) {
      console.error('Error extracting fuel progress:', error);
    }
    
    return defaultResult;
  };

  // Extract dispenser progress information from message and total count
  const extractDispenserProgressLocal = (message: string, totalDispensers?: number) => {
    const defaultResult = { current: 0, total: totalDispensers || 0 };
    
    try {
      // Check if there's dispenser info
      const dispenserRegex = /dispenser(?:[\s#]+)(\d+)(?:[^\d]+(\d+)|)/i;
      const dispenserMatch = message.match(dispenserRegex);
      
      if (dispenserMatch && dispenserMatch[1]) {
        const dispenserNum = parseInt(dispenserMatch[1]);
        // If there's a second capture group, use it, otherwise use the provided total
        const dispenserTotal = dispenserMatch[2] ? parseInt(dispenserMatch[2]) : (totalDispensers || 0);
        
        return { current: dispenserNum, total: dispenserTotal };
      } else {
        return defaultResult;
      }
    } catch (error) {
      console.error('Error extracting dispenser progress:', error);
      return defaultResult;
    }
  };

  // Format display message for better UI presentation
  const formatDisplayMessage = (message: string | undefined): string => {
    if (!message) return '';
    
    const lowerMessage = message.toLowerCase();
    
    // Most specific processing messages with X/Y pattern should be
    // left alone as they're already user-friendly
    const hasProgressPattern = /\b\d+\s*\/\s*\d+\b/.test(message);
    
    // More specific processing messages that don't fit the X/Y pattern
    if (lowerMessage.includes('filling form for dispenser')) return 'Filling dispenser form...';
    if (lowerMessage.includes('filling form')) return 'Filling forms...';
    if (lowerMessage.includes('working on dispenser')) return 'Working on dispensers...';
    if (lowerMessage.includes('processing fuel') || lowerMessage.includes('fuel grade')) return 'Processing fuel...';
    
    // General "processing" or "working on" if not caught by specifics and doesn't have X/Y
    if (!hasProgressPattern && (lowerMessage.includes('processing') || lowerMessage.includes('working on'))) {
      return 'Processing...';
    }
    
    return message;
  };

  // Load initial state from storage and apply cleanup for stale jobs
  useEffect(() => {
    // Load data from localStorage
    const storedBatchJobs = getFromStorage(userStorageKeys.BATCH_JOBS, []);
    const storedBatchJobId = getFromStorage(userStorageKeys.BATCH_JOB_ID);
    const storedSelectedVisits = getFromStorage(userStorageKeys.SELECTED_VISITS, []);
    const storedLastFailedBatch = getFromStorage(userStorageKeys.LAST_FAILED_BATCH);
    const storedIsPaused = getFromStorage(userStorageKeys.IS_PAUSED, false);
    const storedPauseReason = getFromStorage(userStorageKeys.PAUSE_REASON, '');
    
    // Clean up stale jobs (older than 24 hours)
    const cleanedJobs = storedBatchJobs.filter(job => {
      const jobTimestamp = new Date(job.timestamp).getTime();
      const now = Date.now();
      const ageInHours = (now - jobTimestamp) / (1000 * 60 * 60);
      
      // Keep jobs less than 24 hours old or with 'running' status or paused jobs
      return ageInHours < 24 || job.status === 'running' || job.paused;
    });
    
    // Set state from cleaned data
    setBatchJobs(cleanedJobs);
    
    // Only set batch job ID if it exists in the cleaned jobs
    if (storedBatchJobId && cleanedJobs.some(job => job.jobId === storedBatchJobId)) {
      setBatchJobId(storedBatchJobId);
      
      // Set pause state if the job is paused
      const pausedJob = cleanedJobs.find(job => job.jobId === storedBatchJobId && job.paused);
      if (pausedJob) {
        setIsPaused(true);
        setPauseReason(pausedJob.pauseReason || storedPauseReason || 'Paused');
      } else {
        setIsPaused(storedIsPaused);
        setPauseReason(storedPauseReason);
      }
    } else {
      // If the stored batch job ID doesn't exist in cleaned jobs, reset it
      setBatchJobId(null);
      saveToStorage(userStorageKeys.BATCH_JOB_ID, null);
      
      // Also reset pause state
      setIsPaused(false);
      setPauseReason('');
      saveToStorage(userStorageKeys.IS_PAUSED, false);
      saveToStorage(userStorageKeys.PAUSE_REASON, '');
    }
    
    setSelectedVisits(storedSelectedVisits);
    setLastFailedBatch(storedLastFailedBatch);
    
    // If batch jobs were cleaned up, save the cleaned list
    if (cleanedJobs.length !== storedBatchJobs.length) {
      saveToStorage(userStorageKeys.BATCH_JOBS, cleanedJobs);
      console.log(`Cleaned up ${storedBatchJobs.length - cleanedJobs.length} stale batch jobs`);
    }
    
    // Check for active jobs from the API (to sync with server state)
    const checkActiveJobs = async () => {
      try {
        const activeJobs = await getActiveJobs();
        console.log('Active jobs from server:', activeJobs);
        
        // Filter jobs to only include those for the active user
        const userJobs = activeJobs.filter(job => 
          !job.userId || job.userId === activeUserId
        );
        
        console.log(`Filtered to ${userJobs.length} jobs for user ${activeUserId}`);
        
        // If we have an active job ID but it's not in the active jobs list, reset it
        if (storedBatchJobId && !userJobs.some(job => job.jobId === storedBatchJobId)) {
          console.log(`Job ${storedBatchJobId} not found in active jobs, may have completed/failed on server`);
          
          // Only reset if it's not a paused job (paused jobs may not be in active list)
          if (!storedIsPaused) {
            setBatchJobId(null);
            saveToStorage(userStorageKeys.BATCH_JOB_ID, null);
          }
        }
        
        // Update pause state based on server status
        if (storedBatchJobId) {
          const serverJob = userJobs.find(job => job.jobId === storedBatchJobId);
          if (serverJob) {
            const serverIsPaused = serverJob.paused || false;
            if (serverIsPaused !== storedIsPaused) {
              setIsPaused(serverIsPaused);
              saveToStorage(userStorageKeys.IS_PAUSED, serverIsPaused);
            }
          }
        }
      } catch (error) {
        console.error('Error checking active jobs:', error);
      }
    };
    
    checkActiveJobs();
  }, []);

  // Process work orders into groups - useMemo outside useEffect
  const groupedWorkOrders = React.useMemo(() => {
    if (!workOrders.length) return [];
    
    // First, verify all work orders belong to the active user
    const validWorkOrders = workOrders.filter(order => {
      // Skip any work orders that don't belong to the active user
      if (order._userId && order._userId !== activeUserId) {
        console.warn(`Skipping work order ${order.id} - belongs to user ${order._userId}, not active user ${activeUserId}`);
        return false;
      }
      return true;
    });
    
    // Debug code
    console.log('Work orders raw data:', workOrders);
    console.log('Filtered work orders:', validWorkOrders);
    console.log('User ID check results:', workOrders.map(o => ({
      id: o.id,
      match: o._userId === activeUserId,
      userId: o._userId,
      activeId: activeUserId
    })));
    
    const groups: { week: string; orders: WorkOrder[] }[] = [];
    const ordersByWeek = new Map<string, WorkOrder[]>();
    
    // Function to determine week for a work order (Monday-Sunday based)
    const getWeekKey = (order: WorkOrder): string => {
      // If order has visits with dates
      if (order.visits && order.visits.length > 0) {
        for (const visit of order.visits) {
          if (visit.date) {
            const visitDate = new Date(visit.date);
            // Check if date is valid
            if (!isNaN(visitDate.getTime())) {
              const now = new Date();
              
              // Get start of current week (Monday)
              const currentWeekStart = new Date(now);
              currentWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
              currentWeekStart.setHours(0, 0, 0, 0);
              
              // Get end of current week (Sunday)
              const currentWeekEnd = new Date(currentWeekStart);
              currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
              currentWeekEnd.setHours(23, 59, 59, 999);
              
              // If visit is before this week
              if (visitDate < currentWeekStart) return '-1'; // Past due
              
              // If visit is in current week
              if (visitDate >= currentWeekStart && visitDate <= currentWeekEnd) return '0';
              
              // Calculate which future week the visit falls into
              const weekStart = new Date(currentWeekStart);
              for (let weekNum = 1; weekNum <= 4; weekNum++) {
                weekStart.setDate(weekStart.getDate() + 7);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                
                if (visitDate >= weekStart && visitDate <= weekEnd) {
                  return weekNum.toString();
                }
              }
              
              // If more than 4 weeks out
              return '4'; // Future
            }
          }
        }
      }
      
      // Default to "This Week" if no valid date is found
      return '0';
    };
    
    // Initialize week containers
    ordersByWeek.set('-1', []); // Past Due
    ordersByWeek.set('0', []);  // This Week
    ordersByWeek.set('1', []);  // Next Week
    ordersByWeek.set('2', []);  // Week 3
    ordersByWeek.set('3', []);  // Week 4
    ordersByWeek.set('4', []);  // Future
    
    // Add all work orders to the appropriate week based on visit dates
    validWorkOrders.forEach(order => {
      const weekKey = getWeekKey(order);
      ordersByWeek.get(weekKey)?.push(order);
    });
    
    // Convert Map to array
    ordersByWeek.forEach((orders, week) => {
      // Only add groups that have orders
      if (orders.length > 0) {
        groups.push({
          week,
          orders
        });
      }
    });
    
    // Sort groups by week number (past due first, then this week, next week, etc.)
    groups.sort((a, b) => parseInt(a.week) - parseInt(b.week));
    
    // Debug log
    console.log('Grouped work orders ready:', groups.length, 'groups');
    groups.forEach((group, i) => {
      console.log(`Week ${group.week} with ${group.orders.length} orders`);
    });
    
    return groups;
  }, [workOrders, activeUserId]);
  
  // Effect to update state based on the grouped orders and load dispenser details
  useEffect(() => {
    // Debug - log the work order groups before setting state
    console.log('[BATCH DEBUG] Setting visit groups with work orders:', groupedWorkOrders);
    
    setVisitGroups(groupedWorkOrders);
    
    // Load dispenser details for all work orders
    console.log('[BATCH DEBUG] Starting to load dispenser details for work orders');
    
    workOrders.forEach(workOrder => {
      // Skip if this work order doesn't belong to the active user
      if (workOrder._userId && workOrder._userId !== activeUserId) {
        console.warn(`Not loading dispensers for work order ${workOrder.id} - belongs to user ${workOrder._userId}, not active user ${activeUserId}`);
        return;
      }
      
      console.log(`[BATCH DEBUG] Loading dispensers for work order: ${workOrder.id}`);
      
      if (workOrder?.id) {
        getDispensersForWorkOrder(workOrder.id)
        .then((data: any) => {
          // Verify dispensers belong to the active user
          if (data._userId && data._userId !== activeUserId) {
            console.warn(`Skipping dispensers for work order ${workOrder.id} - belongs to user ${data._userId}, not active user ${activeUserId}`);
            return;
          }
          
          console.log(`[BATCH DEBUG] Got dispenser data for work order ${workOrder.id}:`, data);
          
          if (data && data.dispensers) {
            console.log(`[BATCH DEBUG] Setting dispensers for work order ${workOrder.id}, count: ${data.dispensers.length}`);
            setDispenserDetails(prev => ({
              ...prev,
              [workOrder.id]: data
            }));
          }
        })
        .catch(error => {
          console.error(`Error loading dispenser details for work order ${workOrder.id}:`, error);
        });
      }
    });
  }, [workOrders, groupedWorkOrders, activeUserId]);

  // Unified job resumption and polling system
  useEffect(() => {
    // Check for active jobs and resume polling if needed
    const resumeActiveJobs = async () => {
      try {
        // Check for batch jobs
        if (batchJobId) {
          addDebugLog('BATCH', `Resuming polling for batch job ${batchJobId}`);
          startPolling(batchJobId, true);
        }
      } catch (error) {
        console.error('Error resuming active jobs:', error);
        addDebugLog('ERROR', 'Failed to resume active jobs', error);
      }
    };
    
    // Run the resume function
    resumeActiveJobs();
    
    // Clean up function
    return () => {
      // COMPLETELY STOP all polling when component unmounts
      addDebugLog('BATCH', 'BatchVisitAutomation component unmounting - stopping all polls');
      
      if (pollingManager.current) {
        pollingManager.current.stopAll();
      }
    };
  }, [batchJobId]);

  // Component initialization/unmounting
  useEffect(() => {
    addDebugLog('SYSTEM', 'BatchVisitAutomation component initialized', {
      workOrders: workOrders.length,
      batchJobs: batchJobs.length,
      activeUserId
    });
    
    return () => {
      addDebugLog('SYSTEM', 'BatchVisitAutomation component unmounting - stopping all polls');
      
      // ALWAYS COMPLETELY STOP (not pause) all polling when component unmounts
      if (pollingManager.current) {
        pollingManager.current.stopAll();
      }
      
      // Extra safety check to clear any dangling intervals or timeouts
      const poll = pollingManager.current.activePolls[batchJobId || ''];
      if (poll) {
        if (poll.interval) clearInterval(poll.interval);
        if (poll.activityInterval) clearInterval(poll.activityInterval);
        if (poll.firstTimeout) clearTimeout(poll.firstTimeout);
      }
    };
  }, []);

  // Register a beforeunload handler to ensure localStorage is updated when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Make sure the most current state is saved to localStorage before unloading
      saveToStorage(userStorageKeys.BATCH_JOBS, batchJobs);
      saveToStorage(userStorageKeys.BATCH_JOB_ID, batchJobId);
      saveToStorage(userStorageKeys.SELECTED_VISITS, selectedVisits);
      saveToStorage(userStorageKeys.LAST_FAILED_BATCH, lastFailedBatch);
      saveToStorage(userStorageKeys.IS_PAUSED, isPaused);
      saveToStorage(userStorageKeys.PAUSE_REASON, pauseReason);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [batchJobs, batchJobId, selectedVisits, lastFailedBatch, isPaused, pauseReason]);

  // Sync selectedVisits with preselectedVisits prop
  useEffect(() => {
    if (preselectedVisits !== undefined) {
      setSelectedVisits(preselectedVisits);
    }
  }, [preselectedVisits]);

  // Function to update job status across localStorage and state
  const updateBatchStatus = (status: any) => {
    addDebugLog('BATCH', 'Updating batch status', status);
    
    // Skip updates for jobs that don't belong to the active user
    if (status.userId && status.userId !== activeUserId) {
      console.warn(`Skipping status update for job - userId ${status.userId} doesn't match active user ${activeUserId}`);
      return;
    }
    
    if (onJobStatusChange) {
      onJobStatusChange(status);
    }
    
    // Don't update anything in the UI if we've already unmounted
    if (!batchJobId) return;
    
    setBatchJobs(prev => {
      const updatedJobs = [...prev];
      const jobIndex = updatedJobs.findIndex(job => job.jobId === batchJobId);
      
      if (jobIndex !== -1) {
        updatedJobs[jobIndex] = {
          ...updatedJobs[jobIndex],
          status: status.status,
          message: status.message,
          currentVisit: status.currentVisit,
          currentVisitName: status.currentVisitName,
          currentVisitStatus: status.currentVisitStatus,
          completedVisits: status.completedVisits,
          totalVisits: status.totalVisits,
          // Additional tracking for dispensers and fuel
          formsTotal: status.dispenserCount,
          formsCurrent: status.dispenserCurrent,
          currentVisitFuelType: status.fuelType,
          currentVisitFuelCurrent: status.fuelCurrent,
          currentVisitFuelTotal: status.fuelTotal,
          dispenserProgress: status.dispenserProgress, // Add dispenser progress
          // Add a timestamp to the update
          timestamp: new Date().toISOString()
        };
        
        // Save to localStorage
        saveToStorage(userStorageKeys.BATCH_JOBS, updatedJobs);
      }
      
      return updatedJobs;
    });
  };

  // Handle job completion
  const handleBatchComplete = () => {
    addDebugLog('BATCH', 'Batch job completed');
    
    if (onJobComplete) {
      onJobComplete();
    }
    
    setBatchJobId(null);
    saveToStorage(userStorageKeys.BATCH_JOB_ID, null);
    setLastFailedBatch(null);
    saveToStorage(userStorageKeys.LAST_FAILED_BATCH, null);
  };

  // Handle job error
  const handleBatchError = (error: any) => {
    addDebugLog('ERROR', 'Batch job error', error);
    
    if (onJobError) {
      onJobError(error);
    }
    
    // Store the last failed batch for potential resumption
    if (batchJobId) {
      const failedBatch = batchJobs.find(job => job.jobId === batchJobId);
      if (failedBatch) {
        setLastFailedBatch(failedBatch);
        saveToStorage(userStorageKeys.LAST_FAILED_BATCH, failedBatch);
      }
    }
    
    setBatchJobId(null);
    saveToStorage(userStorageKeys.BATCH_JOB_ID, null);
    
    addToast('error', error instanceof Error ? error.message : 'An unknown error occurred');
  };

  // Unified polling function for batch jobs
  const startPolling = (jobId: string, isBatch: boolean) => {
    addDebugLog('BATCH', `Starting unified polling for batch job ${jobId} for user ${activeUserId}`);
    
    // Verify this job belongs to the current user
    const job = batchJobs.find(j => j.jobId === jobId);
    if (job && job._userId && job._userId !== activeUserId) {
      console.warn(`Job ${jobId} belongs to user ${job._userId}, not active user ${activeUserId}. Skipping polling.`);
      return;
    }
    
    pollingManager.current.startPolling(
      jobId,
      updateBatchStatus,
      handleBatchComplete,
      handleBatchError,
      ''
    );
  };

  // Toggle a visit selection
  const handleToggleVisit = (visitId: string) => {
    const newSelection = selectedVisits.includes(visitId)
      ? selectedVisits.filter(id => id !== visitId)
      : [...selectedVisits, visitId];
    
    setSelectedVisits(newSelection);
    
    // Notify parent component of selection change
    if (onSelectionChange) {
      onSelectionChange(newSelection);
    }
  };

  // Toggle all visits in a group
  const handleToggleGroup = (groupVisitIds: string[]) => {
    // Check if all visits in the group are already selected
    const allSelected = groupVisitIds.every(id => selectedVisits.includes(id));
    
    let newSelection: string[];
    
    if (allSelected) {
      // Deselect all visits in the group
      newSelection = selectedVisits.filter(id => !groupVisitIds.includes(id));
    } else {
      // Select all visits in the group
      const toAdd = groupVisitIds.filter(id => !selectedVisits.includes(id));
      newSelection = [...selectedVisits, ...toAdd];
    }
    
    setSelectedVisits(newSelection);
    
    // Notify parent component of selection change
    if (onSelectionChange) {
      onSelectionChange(newSelection);
    }
  };

  // Function to start batch processing with confirmation
  const handleBatchProcess = async () => {
    if (selectedVisits.length === 0) {
      addToast('warning', 'Please select at least one visit to process');
      return;
    }
    
    // Show confirmation dialog for important actions
    if (!window.confirm(`Are you sure you want to process ${selectedVisits.length} visit${selectedVisits.length !== 1 ? 's' : ''}?${resumeBatch && lastFailedBatch ? ' This will resume from the last failed job.' : ''}`)) {
      return;
    }
    
    setIsProcessing(true);
    
    try {
      addDebugLog('BATCH', 'Starting batch processing', {
        selectedVisits: selectedVisits.length,
        isHeadless: isHeadless,
        resumeBatch: resumeBatch,
        lastFailedBatch: lastFailedBatch
      });
      
      // Prepare the request data - Try both file paths
      const userSpecificPath = `/data/users/${activeUserId}/scraped_content.json`; 
      const defaultPath = '/data/scraped_content.json';
      
      // Will first attempt user-specific path, then fall back to default
      console.log(`Using path ${userSpecificPath} for batch processing with fallback to ${defaultPath}`);
      
      // Call the API to process the batch
      const response = await processBatchVisits(
        userSpecificPath,
        isHeadless,
        selectedVisits,
        resumeBatch && lastFailedBatch ? lastFailedBatch.jobId : undefined
      );
      
      if (response.success) {
        addDebugLog('BATCH', 'Batch automation job created', {
          jobId: response.jobId,
          message: response.message,
          totalVisits: response.totalVisits
        });
        
        // Add a new job to the batchJobs state
        setBatchJobs(prevJobs => {
          // Create a new job with a timestamp and status
          const newJob = {
            jobId: response.jobId,
            status: 'running',
            message: 'Starting batch process...',
            timestamp: new Date().toISOString(),
            headless: isHeadless,
            totalVisits: response.totalVisits || selectedVisits.length,
            completedVisits: resumeBatch && lastFailedBatch ? lastFailedBatch.completedVisits : 0,
            currentVisit: null,
            currentVisitName: null,
            currentVisitStatus: null,
            _userId: activeUserId // Mark job as belonging to this user
          };
          
          const updatedJobs = [newJob, ...prevJobs];
          
          // Set the new batch job ID
          setBatchJobId(response.jobId);
          
          // Update localStorage
          saveToStorage(userStorageKeys.BATCH_JOBS, updatedJobs);
          saveToStorage(userStorageKeys.BATCH_JOB_ID, response.jobId);
          
          return updatedJobs;
        });
        
        // Start polling for status updates
        startPolling(response.jobId, true);
        
        // Show success toast
        if (resumeBatch && lastFailedBatch) {
          addToast('success', `Resuming batch processing from visit ${lastFailedBatch.completedVisits + 1}/${lastFailedBatch.totalVisits}`);
        } else {
          addToast('success', `Batch processing started with ${selectedVisits.length} visits`);
        }
      } else {
        addDebugLog('ERROR', 'Error starting batch process', response);
        addToast('error', response.message || 'Failed to start batch processing');
      }
      
      // Reset resume flag after starting
      if (resumeBatch) {
        setResumeBatch(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unknown error occurred while starting batch processing';
      
      addDebugLog('BATCH', 'Error starting batch process', error);
      console.error('Error starting batch process:', error);
      
      // Enhanced error message with more details
      addToast('error', `${errorMessage}. Please try again or contact support if the issue persists.`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to handle pausing a batch job
  const handlePauseBatch = async (jobIdToPause: string) => {
    if (!jobIdToPause) return;
    
    setIsProcessing(true);
    
    try {
      // Call the API to pause the job
      const reason = 'Manually paused by user';
      const response = await pauseFormAutomation(jobIdToPause, reason);
      addDebugLog('BATCH', `Paused batch job ${jobIdToPause}`, response);
      
      if (response.success) {
        // Update the job status in state
        setBatchJobs(prevJobs => {
          const updatedJobs = [...prevJobs];
          const jobIndex = updatedJobs.findIndex(job => job.jobId === jobIdToPause);
          
          if (jobIndex !== -1) {
            updatedJobs[jobIndex] = {
              ...updatedJobs[jobIndex],
              paused: true,
              pauseReason: reason,
              pauseTime: Date.now()
            };
          }
          
          // Update localStorage
          saveToStorage(userStorageKeys.BATCH_JOBS, updatedJobs);
          
          return updatedJobs;
        });
        
        // Update pause state
        setIsPaused(true);
        setPauseReason(reason);
        
        // Store in localStorage
        saveToStorage(userStorageKeys.IS_PAUSED, true);
        saveToStorage(userStorageKeys.PAUSE_REASON, reason);
        
        // Pause polling
        const poll = pollingManager.current.activePolls[jobIdToPause];
        if (poll) {
          poll.isPaused = true;
        }
        
        // Show success toast
        addToast('success', 'Batch processing paused. You can resume it later.');
      } else {
        addToast('error', response.message || 'Failed to pause batch processing');
      }
    } catch (error) {
      console.error('Error pausing batch job:', error);
      addDebugLog('ERROR', 'Error pausing batch job', error);
      addToast('error', 'Failed to pause batch processing');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Function to handle resuming a paused batch job
  const handleResumeBatch = async (jobIdToResume: string) => {
    if (!jobIdToResume) return;
    
    setIsProcessing(true);
    
    try {
      // Call the API to resume the job
      const response = await resumeFormAutomation(jobIdToResume);
      addDebugLog('BATCH', `Resumed batch job ${jobIdToResume}`, response);
      
      if (response.success) {
        // Update the job status in state
        setBatchJobs(prevJobs => {
          const updatedJobs = [...prevJobs];
          const jobIndex = updatedJobs.findIndex(job => job.jobId === jobIdToResume);
          
          if (jobIndex !== -1) {
            updatedJobs[jobIndex] = {
              ...updatedJobs[jobIndex],
              paused: false,
              pauseReason: undefined,
              resumeTime: Date.now()
            };
          }
          
          // Update localStorage
          saveToStorage(userStorageKeys.BATCH_JOBS, updatedJobs);
          
          return updatedJobs;
        });
        
        // Update pause state
        setIsPaused(false);
        setPauseReason('');
        
        // Store in localStorage
        saveToStorage(userStorageKeys.IS_PAUSED, false);
        saveToStorage(userStorageKeys.PAUSE_REASON, '');
        
        // Resume polling
        startPolling(jobIdToResume, true);
        
        // Show success toast
        addToast('success', 'Batch processing resumed');
      } else {
        addToast('error', response.message || 'Failed to resume batch processing');
      }
    } catch (error) {
      console.error('Error resuming batch job:', error);
      addDebugLog('ERROR', 'Error resuming batch job', error);
      addToast('error', 'Failed to resume batch processing');
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to cancel a running batch job
  const handleCancelBatch = (jobIdToCancel: string) => {
    if (!jobIdToCancel) return;
    
    setIsProcessing(true);
    
    try {
      // Call the API to cancel the job
      cancelFormAutomation(jobIdToCancel);
      addDebugLog('BATCH', `Cancelled batch job ${jobIdToCancel}`);
      
      // Update the job status in state
      setBatchJobs(prevJobs => {
        const updatedJobs = [...prevJobs];
        const jobIndex = updatedJobs.findIndex(job => job.jobId === jobIdToCancel);
        
        if (jobIndex !== -1) {
          updatedJobs[jobIndex] = {
            ...updatedJobs[jobIndex],
            status: 'cancelled',
            message: 'Batch processing stopped by user',
            endTime: Date.now()
          };
        }
        
        return updatedJobs;
      });
      
      // Stop polling using our unified approach
      if (jobIdToCancel) {
        pollingManager.current.stopPolling(jobIdToCancel);
      } else {
        // Fallback to the old way
        setBatchJobId(null);
        saveToStorage(userStorageKeys.BATCH_JOB_ID, null);
      }
      
      setIsProcessing(false);
      
      // Show success toast
      addToast('success', 'Batch processing stopped');
    } catch (error) {
      console.error('Error cancelling batch job:', error);
      addDebugLog('ERROR', 'Error cancelling batch job', error);
      addToast('error', 'Failed to stop batch processing');
      setIsProcessing(false);
    }
  };

  // Function to clear batch job history
  const handleClearBatchHistory = async () => {
    if (!window.confirm('Are you sure you want to clear the batch job history? This action cannot be undone.')) {
      return;
    }
    
    try {
      await clearJobHistory(activeUserId, 'batch');
      
      // Clear from state
      setBatchJobs([]);
      setLastFailedBatch(null);
      
      // Clear from localStorage
      saveToStorage(userStorageKeys.BATCH_JOBS, []);
      saveToStorage(userStorageKeys.BATCH_JOB_ID, null);
      saveToStorage(userStorageKeys.LAST_FAILED_BATCH, null);
      
      // Reset related state
      setBatchJobId(null);
      setResumeBatch(false);
      
      addToast('success', 'Batch job history cleared');
      addDebugLog('BATCH', 'Cleared batch job history');
    } catch (error) {
      console.error('Error clearing batch job history:', error);
      addDebugLog('ERROR', 'Error clearing batch job history', error);
      addToast('error', 'Failed to clear batch job history');
    }
  };

  // Function to render the batch job progress
  const renderBatchJobProgress = () => {
    if (!batchJobId) return null;
    
    // Get the current batch job
    const job = batchJobs.find(job => job.jobId === batchJobId);
    if (!job) return null;
    
    // Different UI states based on job status
    return (
      <div className="mt-5 bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 overflow-hidden">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex justify-between items-center">
          <span>Batch Job Progress</span>
          {job.status === 'running' && !isPaused && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              <div className="animate-pulse mr-1.5 h-2 w-2 bg-blue-500 rounded-full"></div>
              Active
            </span>
          )}
          {job.status === 'running' && isPaused && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
              <FiPause className="mr-1.5 h-3 w-3" />
              Paused
            </span>
          )}
          {job.status === 'completed' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
              <FiCheckCircle className="mr-1.5 h-3 w-3" />
              Completed
            </span>
          )}
          {job.status === 'error' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
              <FiXCircle className="mr-1.5 h-3 w-3" />
              Error
            </span>
          )}
        </h3>
        
        {/* Job Metadata - Time and Duration */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Started: {new Date(job.timestamp).toLocaleString()}
          {job.status !== 'running' && job.endTime && (
            <span className="ml-3">
              Duration: {Math.round((job.endTime - new Date(job.timestamp).getTime()) / 1000 / 60)} minutes
            </span>
          )}
        </div>
        
        {/* Progress Header */}
        <div className="flex flex-wrap items-center justify-between mb-3 gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status: 
              <span className={`ml-2 ${
                job.status === 'running' && !isPaused ? 'text-blue-500' :
                job.status === 'running' && isPaused ? 'text-amber-500' :
                job.status === 'completed' ? 'text-green-500' :
                job.status === 'error' ? 'text-red-500' :
                'text-gray-500'
              }`}>
                {isPaused 
                  ? 'Paused' 
                  : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </span>
            </span>
            
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {isPaused 
                ? pauseReason || 'Job is currently paused. Resume to continue processing.'
                : formatDisplayMessage(job.message)}
            </span>
            
            {/* Display pause duration if paused */}
            {isPaused && job.pauseTime && (
              <span className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                Paused for {Math.round((Date.now() - job.pauseTime) / 60000)} minutes
              </span>
            )}
          </div>
          
          {/* Action buttons based on status */}
          <div>
            {job.status === 'running' && !isPaused && (
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePauseBatch(job.jobId)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                  title="Pause this job - you can resume it later"
                >
                  <FiPause className="mr-1.5 h-4 w-4" />
                  Pause
                </button>
                
                <button
                  onClick={() => handleCancelBatch(job.jobId)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  title="Stop this job - cannot be resumed"
                >
                  <FiX className="mr-1.5 h-4 w-4" />
                  Cancel
                </button>
              </div>
            )}
            
            {job.status === 'running' && isPaused && (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleResumeBatch(job.jobId)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  title="Resume this paused job"
                >
                  <FiPlay className="mr-1.5 h-4 w-4" />
                  Resume
                </button>
                
                <button
                  onClick={() => handleCancelBatch(job.jobId)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  title="Stop this job - cannot be resumed"
                >
                  <FiX className="mr-1.5 h-4 w-4" />
                  Cancel
                </button>
              </div>
            )}
            
            {job.status === 'error' && (
              <button
                onClick={() => {
                  setResumeBatch(true);
                  setLastFailedBatch(job);
                  saveToStorage(userStorageKeys.LAST_FAILED_BATCH, job);
                  // Scroll to top of page to make the resume option visible
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FiRefreshCw className="mr-1.5 h-4 w-4" />
                Retry
              </button>
            )}
          </div>
        </div>
        
        {/* Visit Progress Indicator */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-xs mb-1">
            <div className="font-medium text-gray-700 dark:text-gray-300">Visits Processed</div>
            <span className="font-mono bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded">
              {job.completedVisits}/{job.totalVisits}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-2.5 rounded-full transition-all duration-500 ${
                job.status === 'error' ? 'bg-red-500' :
                job.status === 'running' && isPaused ? 'bg-amber-500' :
                job.status === 'running' ? 'bg-blue-500' :
                job.status === 'completed' ? 'bg-green-500' : 'bg-gray-400'
              }`}
              style={{ 
                width: `${Math.min(Math.round((job.completedVisits / Math.max(job.totalVisits, 1)) * 100), 100)}%`
              }}
            ></div>
          </div>
        </div>
        
        {/* Current Visit Details - Only show when running */}
        {job.status === 'running' && !isPaused && job.currentVisitName && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-400">
                Currently Processing: 
                <span className="ml-1 font-normal">
                  {job.currentVisitName || `Visit #${job.currentVisit}`}
                </span>
              </span>
            </div>
            
            {/* Dispenser Progress */}
            {job.formsTotal > 0 && (
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <div className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Dispensers
                  </div>
                  <span className="font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">
                    {job.formsCurrent}/{job.formsTotal}
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800/30 rounded-full h-1.5 mb-3 overflow-hidden">
                  <div 
                    className="h-1.5 rounded-full transition-all duration-500 bg-blue-500"
                    style={{ 
                      width: `${Math.min(Math.round((job.formsCurrent / Math.max(job.formsTotal, 1)) * 100), 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Fuel Progress */}
            {job.currentVisitFuelTotal > 0 && (
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <div className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Fuel {job.currentVisitFuelType ? `(${job.currentVisitFuelType})` : ''}
                  </div>
                  <span className="font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">
                    {job.currentVisitFuelCurrent}/{job.currentVisitFuelTotal}
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800/30 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="h-1.5 rounded-full transition-all duration-500 bg-blue-500"
                    style={{ 
                      width: `${Math.min(Math.round((job.currentVisitFuelCurrent / Math.max(job.currentVisitFuelTotal, 1)) * 100), 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paused Job Details */}
        {job.status === 'running' && isPaused && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-100 dark:border-amber-800 mb-4">
            <div className="flex items-start">
              <FiPause className="mr-2 h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-amber-700 dark:text-amber-300 text-sm font-medium">
                  Job Paused
                </span>
                <span className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                  {pauseReason || 'Processing has been paused and can be resumed at any time.'}
                </span>
                
                {/* Show paused job info */}
                {job.currentVisitName && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    <div>Last active: {job.currentVisitName}</div>
                    <div className="mt-1">Progress: {job.completedVisits} of {job.totalVisits} visits completed</div>
                    {job.pauseTime && (
                      <div className="mt-1">Paused for: {Math.round((Date.now() - job.pauseTime) / 60000)} minutes</div>
                    )}
                  </div>
                )}
                
                <div className="mt-2">
                  <button
                    onClick={() => handleResumeBatch(job.jobId)}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700"
                  >
                    <FiPlay className="mr-1 h-3 w-3" />
                    Resume Processing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Status Message */}
        {job.status === 'error' && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-md">
            <div className="flex items-start">
              <FiAlertTriangle className="mr-2 h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-red-700 dark:text-red-300 text-sm font-medium">
                  Error Occurred
                </span>
                <span className="text-red-700 dark:text-red-300 text-sm mt-1">
                  {job.message || 'An error occurred during batch processing. Please try again or resume from where it failed.'}
                </span>
                <div className="mt-2">
                  <button
                    onClick={() => {
                      setResumeBatch(true);
                      setLastFailedBatch(job);
                      saveToStorage(userStorageKeys.LAST_FAILED_BATCH, job);
                      // Scroll to top of page to make the resume option visible
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                  >
                    <FiPlay className="mr-1 h-3 w-3" />
                    Resume Processing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {job.status === 'completed' && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-md">
            <div className="flex items-start">
              <FiCheckCircle className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-green-700 dark:text-green-300 text-sm font-medium">
                  Batch Processing Completed
                </span>
                <span className="text-green-700 dark:text-green-300 text-sm mt-1">
                  {job.message || `Successfully processed ${job.completedVisits} visits.`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        {selectionOnly ? 'Work Orders' : 'Batch Visit Automation'}
      </h2>
      
      <div className="space-y-6">
        {/* Processing Options - only show if not in selection-only mode */}
        {!selectionOnly && (
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
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
                {lastFailedBatch && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({lastFailedBatch.completedVisits}/{lastFailedBatch.totalVisits} completed)
                  </span>
                )}
              </span>
            </label>
          </div>
          
          <div className="mt-4 flex space-x-2">
            <button
              onClick={handleBatchProcess}
              disabled={isProcessing || selectedVisits.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <FiLoader className="animate-spin mr-2 h-4 w-4" />
                  Processing...
                </>
              ) : (
                <>
                  <FiPlay className="mr-2 h-4 w-4" />
                  Process {selectedVisits.length} Visit{selectedVisits.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
            
            {batchJobId && (
              <button
                onClick={() => handleCancelBatch(batchJobId)}
                disabled={isProcessing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiX className="mr-2 h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
        )}
        
        {/* Batch Job Progress - only show if not in selection-only mode */}
        {!selectionOnly && renderBatchJobProgress()}
        
        {/* Batch Job History - only show if not in selection-only mode and has past jobs */}
        {!selectionOnly && batchJobs.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 flex justify-between items-center">
              <span>Recent Batch Jobs</span>
              <div className="flex items-center gap-2">
                {batchJobs.some(job => job.status === 'running') && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    <div className="animate-pulse mr-1.5 h-2 w-2 bg-blue-500 rounded-full"></div>
                    Active Job
                  </span>
                )}
                {batchJobs.length > 0 && !batchJobs.some(job => job.status === 'running') && (
                  <button
                    onClick={handleClearBatchHistory}
                    className="inline-flex items-center px-2 py-1 text-xs rounded-md text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                    title="Clear history"
                  >
                    <FiX className="mr-1 h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
            </h3>
            <div className="space-y-3">
              {batchJobs.slice(0, 5).map((job, index) => (
                <div key={job.jobId || index} className={`bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md ${
                  job.status === 'running' ? 'border-l-4 border-blue-500' :
                  job.status === 'completed' ? 'border-l-4 border-green-500' :
                  job.status === 'error' ? 'border-l-4 border-red-500' :
                  job.status === 'cancelled' ? 'border-l-4 border-amber-500' : ''
                }`}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center">
                      {job.status === 'running' && (
                        <div className="animate-pulse mr-2 h-2 w-2 bg-blue-500 rounded-full"></div>
                      )}
                      {job.status === 'completed' && (
                        <FiCheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      )}
                      {job.status === 'error' && (
                        <FiXCircle className="mr-2 h-4 w-4 text-red-500" />
                      )}
                      {job.status === 'cancelled' && (
                        <FiX className="mr-2 h-4 w-4 text-amber-500" />
                      )}
                      
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        Batch Job
                      </span>
                      
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(job.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      {job.status === 'running' && !isPaused && (
                        <button
                          onClick={() => handlePauseBatch(job.jobId)}
                          className="inline-flex items-center px-2 py-1 text-xs rounded-md text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800/30"
                        >
                          <FiPause className="mr-1 h-3 w-3" />
                          Pause
                        </button>
                      )}
                      
                      {job.status === 'running' && (
                        <button
                          onClick={() => handleCancelBatch(job.jobId)}
                          className="inline-flex items-center px-2 py-1 text-xs rounded-md text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/30"
                        >
                          <FiX className="mr-1 h-3 w-3" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {job.message || `Status: ${job.status}`}
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Progress: {job.completedVisits}/{job.totalVisits} visits completed
                  </div>
                  
                  {job.status === 'running' && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${(job.completedVisits / Math.max(job.totalVisits, 1)) * 100}%` }}
                      ></div>
                    </div>
                  )}
                  
                  {/* Show detailed dispenser progress for running jobs */}
                  {job.status === 'running' && job.dispenserProgress && (
                    <div className="mt-3">
                      {job.dispenserProgress.dispensers.map((dispenser, idx) => (
                        <DispenserProgressCard key={idx} progress={dispenser} />
                      ))}
                    </div>
                  )}
                  
                  {/* Debug info */}
                  {job.status === 'running' && !job.dispenserProgress && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      No dispenser progress data available
                    </div>
                  )}
                  
                  {job.status === 'error' && (
                    <div className="mt-2 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-1.5 rounded">
                      {job.message || 'An error occurred during processing'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Work Order Selection */}
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center justify-between">
            <span>
              Select Visits to Process
              <span className="ml-2 text-xs text-primary-600 dark:text-primary-400">
                {selectedVisits.length} selected
              </span>
            </span>
            <div className="flex space-x-2">
              <button 
                onClick={() => setExpandedWeeks({
                  '-1': true,
                  '0': true,
                  '1': true,
                  '2': true,
                  '3': true,
                  '4': true
                })}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Show All
              </button>
              <span className="text-xs text-gray-500">|</span>
              <button 
                onClick={() => setExpandedWeeks({
                  '-1': true, // Keep past due visible
                  '0': true,  // Keep this week visible
                  '1': false,
                  '2': false,
                  '3': false,
                  '4': false
                })}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Collapse All
              </button>
            </div>
          </h3>
          
          {/* Work Order Groups */}
          <div className="space-y-3">
            {visitGroups.map((group, groupIndex) => (
              <div key={`week-${group.week}`} className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden mb-4">
                <div 
                  className={`px-4 py-2 flex justify-between items-center cursor-pointer ${
                    group.week === '-1' ? 'bg-red-50 dark:bg-red-900/20' :
                    group.week === '0' ? 'bg-blue-50 dark:bg-blue-900/20' :
                    group.week === '1' ? 'bg-green-50 dark:bg-green-900/20' :
                    group.week === '2' ? 'bg-purple-50 dark:bg-purple-900/20' :
                    group.week === '3' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                    group.week === '4' ? 'bg-gray-50 dark:bg-gray-900/20' :
                    'bg-gray-50 dark:bg-gray-700'
                  }`}
                  onClick={() => setExpandedWeeks(prev => ({
                    ...prev,
                    [group.week]: !prev[group.week]
                  }))}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 mr-3"
                      checked={group.orders.every(order => 
                        order.visits?.some(visit => selectedVisits.includes(visit.id))
                      )}
                      onChange={() => {
                        // Toggle all visits in this group
                        const allVisitIds = group.orders.flatMap(order => 
                          order.visits?.map(visit => visit.id) || []
                        );
                        handleToggleGroup(allVisitIds);
                      }}
                      onClick={(e) => e.stopPropagation()} // Prevent group toggle
                    />
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {(() => {
                        const now = new Date();
                        const currentWeekStart = new Date(now);
                        currentWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
                        currentWeekStart.setHours(0, 0, 0, 0);
                        
                        if (group.week === '-1') return 'Past Due';
                        if (group.week === '4') return 'Future (5+ weeks)';
                        
                        const weekNum = parseInt(group.week);
                        const weekStart = new Date(currentWeekStart);
                        weekStart.setDate(weekStart.getDate() + (weekNum * 7));
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekStart.getDate() + 6);
                        
                        const formatDate = (date: Date) => {
                          const month = (date.getMonth() + 1).toString().padStart(2, '0');
                          const day = date.getDate().toString().padStart(2, '0');
                          return `${month}/${day}`;
                        };
                        
                        const label = group.week === '0' ? 'This Week' :
                                     group.week === '1' ? 'Next Week' :
                                     `Week ${parseInt(group.week) + 1}`;
                        
                        return `${label} (${formatDate(weekStart)} - ${formatDate(weekEnd)})`;
                      })()}
                    </span>
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      {group.orders.length} work order{group.orders.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center">
                    {/* Expand/collapse indicator */}
                    <span className="text-gray-500 dark:text-gray-400">
                      {expandedWeeks[group.week] ? '▼' : '►'}
                    </span>
                  </div>
                </div>
                
                {expandedWeeks[group.week] && (
                  <div className={`overflow-y-auto`}>
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Store
                          </span>
                        </th>
                        <th scope="col" className="px-4 py-2 text-left">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Visit #
                          </span>
                        </th>
                        <th scope="col" className="px-4 py-2 text-left">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Location
                          </span>
                        </th>
                        <th scope="col" className="px-4 py-2 text-left">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Dispensers
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {group.orders.map((order: WorkOrder) => {
                          // Get styles for this store
                          const storeStyles = getStoreStyles(order.customer?.name || '');
                          
                          // Get dispenser count
                          const dispenserCount = getDispenserCount(order);
                          
                          return (order.visits || []).map((visit, visitIndex) => (
                            <tr 
                              key={visit.id} 
                              className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                                selectedVisits.includes(visit.id) ? `${storeStyles.bg} border-l-4 ${storeStyles.border}` : ''
                              }`}
                              onClick={(e) => {
                                // Prevent toggle if clicking on the checkbox itself (to avoid double-toggle)
                                if ((e.target as HTMLElement).tagName !== 'INPUT') {
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
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      {order.customer?.name || 'Unknown Store'}
                                    </div>
                                    {order.customer?.storeNumber && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {order.customer.storeNumber}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {visit.visitNumber || visit.id}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  {order.customer?.address?.cityState || 'Unknown Location'}
                                </div>
                                {order.customer?.address?.county && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {order.customer.address.county}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  dispenserCount > 0 
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' 
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400'
                                }`}>
                                  <FiList className="mr-1 h-3 w-3" />
                                  {dispenserCount > 0 ? dispenserCount : 'N/A'}
                                </span>
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchVisitAutomation;
