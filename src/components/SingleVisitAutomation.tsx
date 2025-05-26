import React, { useState, useEffect, useCallback } from 'react';
import {
  FiPlay, FiX, FiExternalLink, FiCheckCircle, FiXCircle, FiAlertTriangle, FiTool, FiList, FiPause, FiSkipForward
} from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { useToast } from '../hooks/useToast';
import {
  processSingleVisit,
  getUnifiedAutomationStatus,
  cancelFormAutomation,
  openUrlWithDebugMode,
  clearJobHistory
} from '../services/formService';
import { UnifiedAutomationStatus } from '../types/automationTypes';
import {
  addFormPrepLogDetailed
} from '../services/scrapeService';
import DispenserProgressCard from './DispenserProgressCard';
import { automationSocket, ProgressUpdate, JobStatus } from '../services/automationSocketService';

interface SingleVisitAutomationProps {
  activeUserId: string;
  workOrders?: any[];
  addDebugLog: (type: string, message: string, data?: any) => void;
  onJobStatusChange?: (jobStatus: any) => void;
  onJobComplete?: () => void;
  onJobError?: (error: any) => void;
  prefilledUrl?: string;
}

const SingleVisitAutomation: React.FC<SingleVisitAutomationProps> = ({
  activeUserId,
  workOrders = [],
  addDebugLog,
  onJobStatusChange,
  onJobComplete,
  onJobError,
  prefilledUrl
}) => {
  const [visitUrl, setVisitUrl] = useState<string>(prefilledUrl || '');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isHeadless, setIsHeadless] = useState<boolean>(true);
  const [singleJobId, setSingleJobId] = useState<string | null>(null);
  const [pollingSingle, setPollingSingle] = useState<boolean>(false);
  const [formJobs, setFormJobs] = useState<Array<any>>([]);
  const [, forceUpdate] = useState<{}>({});
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string>('');
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({
    '-1': true, // Past Due (always expanded)
    '0': true,  // This Week (expanded by default)
    '1': true,  // Next Week (expanded by default)
    '2': false, // Week 3 (collapsed by default)
    '3': false, // Week 4 (collapsed by default)
    '4': false  // Future (collapsed by default)
  });
  const [selectedWorkOrderData, setSelectedWorkOrderData] = useState<any>(null);
  const [jobTypeInfo, setJobTypeInfo] = useState<{serviceCode: string | null, isSpecificDispensers: boolean, formType: string} | null>(null);
  
  // New job state management state
  const [currentJobStatus, setCurrentJobStatus] = useState<JobStatus | null>(null);
  const [jobProgress, setJobProgress] = useState<ProgressUpdate | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [canPause, setCanPause] = useState<boolean>(false);
  const [canResume, setCanResume] = useState<boolean>(false);
  const [canCancel, setCanCancel] = useState<boolean>(false);
  
  // Force render state for React re-renders
  const [forceRenderCount, setForceRenderCount] = useState(0);
  const forceRender = () => setForceRenderCount(prev => prev + 1);
  
  const { addToast } = useToast();

  // Get store-specific styling (same as BatchVisitAutomation)
  const getStoreStyles = (storeName: string) => {
    const normalizedName = storeName.toLowerCase();
    
    const storeStyleMap: Record<string, { bg: string; border: string; icon: string }> = {
      'circle': {
        bg: 'bg-green-100 dark:bg-green-900/20',
        border: 'border-green-500',
        icon: 'text-green-600 dark:text-green-400'
      },
      'wawa': {
        bg: 'bg-red-100 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: 'text-red-600 dark:text-red-400'
      },
      'sheetz': {
        bg: 'bg-purple-100 dark:bg-purple-900/20',
        border: 'border-purple-500',
        icon: 'text-purple-600 dark:text-purple-400'
      },
      'royal': {
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

  // Get dispenser count (same as BatchVisitAutomation)
  const getDispenserCount = (workOrder: any): number => {
    if (!workOrder) return 0;
    
    // Fallback to services
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

  // Helper function to format duration - only update if job is still running
  const formatDuration = (startTime: number, endTime: number | null, isCompleted: boolean = false): string => {
    // If job is completed, use the actual end time, otherwise use current time
    const effectiveEndTime = isCompleted ? (endTime || startTime) : (endTime || Date.now());
    const duration = effectiveEndTime - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Helper function to extract store name from work order data
  const extractStoreInfo = (url: string): { storeName: string; visitNumber: string } => {
    try {
      // Extract work order ID and visit ID from URL like /work/126723/visits/128712/
      const workOrderMatch = url.match(/\/work\/(\d+)/);
      const visitMatch = url.match(/\/visits\/(\d+)/);
      
      const workOrderId = workOrderMatch?.[1];
      const visitId = visitMatch?.[1];
      
      // Look for work order data to get actual store name
      if (workOrderId && workOrders?.length > 0) {
        const workOrder = workOrders.find(wo => 
          wo.id === workOrderId || 
          wo.id === `W-${workOrderId}` ||
          wo.id === parseInt(workOrderId)
        );
        
        if (workOrder) {
          // Extract store name safely handling different data types
          let storeName = `Store ${workOrderId}`;
          
          if (workOrder.customer?.name) {
            if (typeof workOrder.customer.name === 'string') {
              storeName = workOrder.customer.name;
            } else if (typeof workOrder.customer.name === 'object' && workOrder.customer.name.name) {
              storeName = workOrder.customer.name.name;
            }
          } else if (workOrder.customerName && typeof workOrder.customerName === 'string') {
            storeName = workOrder.customerName;
          } else if (workOrder.location?.name && typeof workOrder.location.name === 'string') {
            storeName = workOrder.location.name;
          } else if (workOrder.locationName && typeof workOrder.locationName === 'string') {
            storeName = workOrder.locationName;
          }
          
          const visitNumber = visitId ? `#${visitId}` : `W-${workOrderId}`;
          
          return { 
            storeName: storeName,
            visitNumber: visitNumber
          };
        }
      }
      
      // Fallback if no work order data found
      const visitNumber = visitId ? `#${visitId}` : (workOrderId ? `W-${workOrderId}` : 'Unknown');
      const storeName = workOrderId ? `Store ${workOrderId}` : 'Unknown Store';
      
      return { storeName, visitNumber };
    } catch (e) {
      return { storeName: 'Unknown Store', visitNumber: 'Unknown' };
    }
  };

  // Helper function for backward compatibility
  const extractStoreName = (url: string): string => {
    const { storeName } = extractStoreInfo(url);
    return storeName;
  };

  // Process work orders into groups - similar to BatchVisitAutomation
  const groupedWorkOrders = React.useMemo(() => {
    if (!workOrders.length) return [];
    
    // Filter work orders for the active user
    const validWorkOrders = workOrders.filter(order => {
      if (order._userId && order._userId !== activeUserId) {
        return false;
      }
      return true;
    });
    
    const groups: { week: string; orders: any[] }[] = [];
    const ordersByWeek = new Map<string, any[]>();
    
    // Function to determine week for a work order
    const getWeekKey = (order: any): string => {
      let visitDate: Date | null = null;
      
      if (order.visits && typeof order.visits === 'object' && 'nextVisit' in order.visits) {
        const nextVisit = (order.visits as any).nextVisit;
        if (nextVisit?.date) {
          visitDate = new Date(nextVisit.date);
        }
      } else if (order.visits && Array.isArray(order.visits) && order.visits.length > 0) {
        for (const visit of order.visits) {
          if (visit.date) {
            visitDate = new Date(visit.date);
            break;
          }
        }
      }
      
      if (visitDate && !isNaN(visitDate.getTime())) {
        const now = new Date();
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
        currentWeekStart.setHours(0, 0, 0, 0);
        
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
        currentWeekEnd.setHours(23, 59, 59, 999);
        
        if (visitDate < currentWeekStart) return '-1'; // Past due
        if (visitDate >= currentWeekStart && visitDate <= currentWeekEnd) return '0';
        
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
        
        return '4'; // Future
      }
      
      return '0'; // Default to "This Week"
    };
    
    // Initialize week containers
    ordersByWeek.set('-1', []); // Past Due
    ordersByWeek.set('0', []);  // This Week
    ordersByWeek.set('1', []);  // Next Week
    ordersByWeek.set('2', []);  // Week 3
    ordersByWeek.set('3', []);  // Week 4
    ordersByWeek.set('4', []);  // Future
    
    // Add work orders to appropriate weeks
    validWorkOrders.forEach(order => {
      const weekKey = getWeekKey(order);
      ordersByWeek.get(weekKey)?.push(order);
    });
    
    // Convert to array and sort
    ordersByWeek.forEach((orders, week) => {
      if (orders.length > 0) {
        groups.push({ week, orders });
      }
    });
    
    groups.sort((a, b) => parseInt(a.week) - parseInt(b.week));
    
    return groups;
  }, [workOrders, activeUserId]);

  // Handle visit selection (single selection only)
  const handleVisitSelect = async (visitId: string, workOrder: any) => {
    // For single visit, we only allow one selection at a time
    setSelectedWorkOrder(visitId === selectedWorkOrder ? '' : visitId);
    
    if (visitId !== selectedWorkOrder) {
      // Store the work order data
      // Find the selected visit data within the work order
      const visitsArray = workOrder.visits && typeof workOrder.visits === "object" && "nextVisit" in workOrder.visits
        ? [{ ...workOrder.visits.nextVisit, id: workOrder.id }]
        : Array.isArray(workOrder.visits) 
          ? workOrder.visits 
          : [];
          
      const selectedVisit = visitsArray.find((visit) => visit.id === visitId);
      
      // Store the combined work order + visit data
      setSelectedWorkOrderData({
        ...workOrder,
        // Add visit-specific data
        visitNumber: selectedVisit?.visitNumber || selectedVisit?.visitId || selectedVisit?.id,
        visitId: selectedVisit?.id,
        selectedVisit: selectedVisit
      });
      
      // Auto-populate URL from work order
      if (workOrder.visits && typeof workOrder.visits === 'object' && 'nextVisit' in workOrder.visits) {
        const nextVisit = (workOrder.visits as any).nextVisit;
        if (nextVisit?.url) {
          const fullUrl = nextVisit.url.startsWith('http') ? 
            nextVisit.url : 
            `https://app.workfossa.com${nextVisit.url}`;
          setVisitUrl(fullUrl);
          const displayVisitId = nextVisit.visitId || visitId;
          addDebugLog('Visit', `Auto-populated URL from visit #${displayVisitId}`, { url: fullUrl, visitId: displayVisitId });
        }
      } else if (workOrder.visits && Array.isArray(workOrder.visits) && workOrder.visits.length > 0) {
        const visit = workOrder.visits[0];
        if (visit.url) {
          const fullUrl = visit.url.startsWith('http') ? 
            visit.url : 
            `https://app.workfossa.com${visit.url}`;
          setVisitUrl(fullUrl);
          const displayVisitId = visit.visitId || visit.id || visitId;
          addDebugLog('Visit', `Auto-populated URL from visit #${displayVisitId}`, { url: fullUrl, visitId: displayVisitId });
        }
      }
      
      // Analyze job type from services
      analyzeJobType(workOrder);
    } else {
      // If deselecting, clear the URL and job type info
      setVisitUrl('');
      setSelectedWorkOrderData(null);
      setJobTypeInfo(null);
    }
  };

  // Storage keys for localStorage - make user-specific
  const userStorageKeys = {
    FORM_JOBS: `form_prep_jobs_${activeUserId}`,
    SINGLE_JOB_ID: `form_prep_single_job_id_${activeUserId}`,
    IS_POLLING_SINGLE: `form_prep_is_polling_single_${activeUserId}`,
    VISIT_URL: `form_prep_visit_url_${activeUserId}`,
    CURRENT_JOB_STATUS: `form_prep_current_job_status_${activeUserId}`,
    JOB_PROGRESS: `form_prep_job_progress_${activeUserId}`,
    IS_PROCESSING: `form_prep_is_processing_${activeUserId}`
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

  // Polling manager for single visit automation
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
      // Skip the job existence check for now - we know we just created it
      console.log(`🔍 Starting polling for job ID: ${jobId} (skipping state check)`);
      
      // Add a small delay to ensure state is settled
      setTimeout(() => {
        // Now check if job exists after delay
        if (!this.checkIfJobExistsInState(jobId)) {
          console.warn(`[DEBUG SINGLE] Job ID ${jobId} not found after delay, but continuing anyway`);
        }
      }, 500);
      
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
          
          // Check for dispenser status changes to force UI update
          if (status.dispenserProgress) {
            const currentActiveDispenser = status.dispenserProgress.dispensers.find(d => d.status === 'processing');
            if (currentActiveDispenser && poll.lastActiveFormNumber !== currentActiveDispenser.formNumber) {
              console.log(`[DEBUG] Form progression detected: ${poll.lastActiveFormNumber} -> ${currentActiveDispenser.formNumber}`);
              poll.lastActiveFormNumber = currentActiveDispenser.formNumber;
              poll.lastStatusTime = now; // Force update
            }
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
        // Check localStorage directly for the most current state
        const storedJobs = getFromStorage(userStorageKeys.FORM_JOBS, []);
        const formJob = storedJobs.find((job: any) => job.jobId === jobId);
        
        if (!formJob) {
          console.log(`[DEBUG SINGLE] Job ID ${jobId} not found in local state, checking if it's the current job: ${singleJobId}`);
          // Also check if it's the current job ID
          return jobId === singleJobId;
        }
        
        // Check if the job belongs to the active user
        if (formJob._userId && formJob._userId !== activeUserId) {
          console.log(`[DEBUG SINGLE] Job ID ${jobId} belongs to user ${formJob._userId}, not active user ${activeUserId}, skipping polling`);
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

  // Load initial state from storage and apply cleanup for stale jobs
  useEffect(() => {
    // Load data from localStorage
    const storedFormJobs = getFromStorage(userStorageKeys.FORM_JOBS, []);
    const storedSingleJobId = getFromStorage(userStorageKeys.SINGLE_JOB_ID);
    const storedPollingSingle = getFromStorage(userStorageKeys.IS_POLLING_SINGLE, false);
    const storedVisitUrl = getFromStorage(userStorageKeys.VISIT_URL, '');
    const storedCurrentJobStatus = getFromStorage(userStorageKeys.CURRENT_JOB_STATUS, null);
    const storedJobProgress = getFromStorage(userStorageKeys.JOB_PROGRESS, null);
    const storedIsProcessing = getFromStorage(userStorageKeys.IS_PROCESSING, false);
    
    // Clean up stale jobs (older than 24 hours) and filter for current user
    const cleanedJobs = storedFormJobs.filter((job: any) => {
      // Skip jobs that don't belong to the active user
      if (job._userId && job._userId !== activeUserId) {
        console.log(`Skipping job ${job.jobId} - belongs to user ${job._userId}, not active user ${activeUserId}`);
        return false;
      }
      
      const jobTimestamp = new Date(job.timestamp).getTime();
      const now = Date.now();
      const ageInHours = (now - jobTimestamp) / (1000 * 60 * 60);
      
      // Keep jobs less than 24 hours old or with 'running' status
      return ageInHours < 24 || job.status === 'running';
    });
    
    // Set state from cleaned data
    setFormJobs(cleanedJobs);
    
    // Only set single job ID if it exists in the cleaned jobs
    if (storedSingleJobId && cleanedJobs.some((job: any) => job.jobId === storedSingleJobId)) {
      setSingleJobId(storedSingleJobId);
      setPollingSingle(storedPollingSingle);
      
      // Restore job progress state if there's an active job
      if (storedCurrentJobStatus && storedCurrentJobStatus.status === 'running') {
        setCurrentJobStatus(storedCurrentJobStatus);
        setJobProgress(storedJobProgress);
        setIsProcessing(storedIsProcessing);
        console.log('🔄 [PERSISTENCE] Restored active job progress:', {
          jobId: storedSingleJobId,
          status: storedCurrentJobStatus.status,
          hasProgress: !!storedJobProgress
        });
      }
    } else {
      // If the stored single job ID doesn't exist in cleaned jobs, reset it
      setSingleJobId(null);
      setPollingSingle(false);
      setCurrentJobStatus(null);
      setJobProgress(null);
      setIsProcessing(false);
      saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
      saveToStorage(userStorageKeys.IS_POLLING_SINGLE, false);
      saveToStorage(userStorageKeys.CURRENT_JOB_STATUS, null);
      saveToStorage(userStorageKeys.JOB_PROGRESS, null);
      saveToStorage(userStorageKeys.IS_PROCESSING, false);
    }
    
    setVisitUrl(storedVisitUrl);
    
    // If form jobs were cleaned up, save the cleaned list
    if (cleanedJobs.length !== storedFormJobs.length) {
      saveToStorage(userStorageKeys.FORM_JOBS, cleanedJobs);
      console.log(`Cleaned up ${storedFormJobs.length - cleanedJobs.length} stale form jobs`);
    }
    
    // Log final state for debugging
    console.log('📂 [PERSISTENCE] Component mounted/user changed - final state:', {
      userId: activeUserId,
      jobsLoaded: cleanedJobs.length,
      completedJobs: cleanedJobs.filter(job => job.status === 'completed').length,
      runningJobs: cleanedJobs.filter(job => job.status === 'running').length
    });
  }, [activeUserId]);

  // Periodic persistence check (every 5 seconds) to ensure data isn't lost
  useEffect(() => {
    const persistenceInterval = setInterval(() => {
      // Only save if there are jobs or active progress
      if (formJobs.length > 0 || currentJobStatus || jobProgress) {
        const currentStored = getFromStorage(userStorageKeys.FORM_JOBS, []);
        const currentStatusStored = getFromStorage(userStorageKeys.CURRENT_JOB_STATUS, null);
        const currentProgressStored = getFromStorage(userStorageKeys.JOB_PROGRESS, null);
        
        // Check if any state has changed
        const jobsChanged = JSON.stringify(currentStored) !== JSON.stringify(formJobs);
        const statusChanged = JSON.stringify(currentStatusStored) !== JSON.stringify(currentJobStatus);
        const progressChanged = JSON.stringify(currentProgressStored) !== JSON.stringify(jobProgress);
        
        if (jobsChanged || statusChanged || progressChanged) {
          saveToStorage(userStorageKeys.FORM_JOBS, formJobs);
          saveToStorage(userStorageKeys.CURRENT_JOB_STATUS, currentJobStatus);
          saveToStorage(userStorageKeys.JOB_PROGRESS, jobProgress);
          saveToStorage(userStorageKeys.IS_PROCESSING, isProcessing);
          console.log('🔄 [PERSISTENCE] Periodic save - state diverged:', {
            jobsChanged,
            statusChanged,
            progressChanged,
            hasActiveJob: !!currentJobStatus
          });
        }
      }
    }, 5000);

    return () => clearInterval(persistenceInterval);
  }, [formJobs, currentJobStatus, jobProgress, isProcessing, userStorageKeys]);

  // Unified job resumption and polling system
  useEffect(() => {
    // Check for active jobs and resume polling if needed
    const resumeActiveJobs = async () => {
      try {
        // Check for single visit jobs
        if (singleJobId && pollingSingle) {
          addDebugLog('SINGLE', `Resuming polling for single job ${singleJobId}`);
          startPolling(singleJobId, false);
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
      addDebugLog('SINGLE', 'SingleVisitAutomation component unmounting - stopping all polls');
      
      if (pollingManager.current) {
        pollingManager.current.stopAll();
      }
    };
  }, [singleJobId, pollingSingle]);

  // Component initialization/unmounting
  useEffect(() => {
    addDebugLog('SYSTEM', 'SingleVisitAutomation component initialized', {
      formJobs: formJobs.length,
      activeUserId
    });
    
    return () => {
      addDebugLog('SYSTEM', 'SingleVisitAutomation component unmounting - stopping all polls');
      
      // ALWAYS COMPLETELY STOP (not pause) all polling when component unmounts
      if (pollingManager.current) {
        pollingManager.current.stopAll();
      }
      
      // Extra safety check to clear any dangling intervals or timeouts
      const poll = pollingManager.current.activePolls[singleJobId || ''];
      if (poll) {
        if (poll.interval) clearInterval(poll.interval);
        if (poll.activityInterval) clearInterval(poll.activityInterval);
        if (poll.firstTimeout) clearTimeout(poll.firstTimeout);
      }
    };
  }, []);

  // Analyze job type from work order services
  const analyzeJobType = async (workOrder: any) => {
    try {
      // Check if we have services in the work order
      if (workOrder.services && workOrder.services.length > 0) {
        let serviceCode = null;
        let isSpecificDispensers = false;
        let formType = 'AccuMeasure'; // Default
        
        // Log all services for debugging
        workOrder.services.forEach((service: any, index: number) => {
          addDebugLog('Service', `Service ${index + 1}: Code=${service.code}, Description=${service.description}`);
          
          // Remember service code
          if (service.code) {
            serviceCode = service.code;
          }
        });
        
        // Check for specific dispensers (code 2862)
        isSpecificDispensers = workOrder.services.some((service: any) => 
          (service.code === "2862") || 
          (service.description && service.description.includes('Specific Dispenser(s)'))
        );
        
        // Check for open neck prover (code 3146)
        const isOpenNeckProver = workOrder.services.some((service: any) => 
          (service.code === "3146")
        );
        
        if (isOpenNeckProver) {
          formType = 'Open Neck Prover';
          serviceCode = '3146';
        }
        
        const jobInfo = {
          serviceCode,
          isSpecificDispensers,
          formType
        };
        
        setJobTypeInfo(jobInfo);
        
        // Log job type detection
        if (isOpenNeckProver) {
          addDebugLog('Job Type', `Open Neck Prover detected (Code 3146)`);
        } else if (isSpecificDispensers) {
          addDebugLog('Job Type', `Specific Dispensers job detected (Code 2862)`);
        } else if (serviceCode === '2861' || serviceCode === '3002') {
          addDebugLog('Job Type', `All Dispensers job detected (Code ${serviceCode})`);
        } else {
          addDebugLog('Job Type', `Standard job (Code ${serviceCode || 'unknown'})`);
        }
      } else {
        // Try to fetch scraped content to get more details
        try {
          // Note: getScrapedContent function needs to be imported or implemented
          // Commenting out until function is available
          /*
          const scrapedData = await getScrapedContent(activeUserId);
          if (scrapedData && scrapedData.workOrders) {
            const foundWorkOrder = scrapedData.workOrders.find((wo: any) => 
              wo.id === workOrder.id || wo.orderNumber === workOrder.orderNumber
            );
            if (foundWorkOrder && foundWorkOrder.services) {
              // Recursively call with the enriched work order
              analyzeJobType(foundWorkOrder);
              return;
            }
          }
          */
        } catch (error) {
          addDebugLog('WARNING', 'Could not fetch scraped content for job type detection', error);
        }
        
        addDebugLog('Job Type', 'No services found - cannot determine job type');
      }
    } catch (error) {
      addDebugLog('ERROR', 'Error analyzing job type', error);
    }
  };
  
  // Update visitUrl when prefilledUrl changes
  useEffect(() => {
    if (prefilledUrl) {
      setVisitUrl(prefilledUrl);
    }
  }, [prefilledUrl]);

  // Register a beforeunload handler to ensure localStorage is updated when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Make sure the most current state is saved to localStorage before unloading
      saveToStorage(userStorageKeys.FORM_JOBS, formJobs);
      console.log('📤 [PERSISTENCE] Page unload - saving current state:', {
        jobsCount: formJobs.length,
        completedCount: formJobs.filter(job => job.status === 'completed').length
      });
      saveToStorage(userStorageKeys.SINGLE_JOB_ID, singleJobId);
      saveToStorage(userStorageKeys.IS_POLLING_SINGLE, pollingSingle);
      saveToStorage(userStorageKeys.VISIT_URL, visitUrl);
      saveToStorage(userStorageKeys.CURRENT_JOB_STATUS, currentJobStatus);
      saveToStorage(userStorageKeys.JOB_PROGRESS, jobProgress);
      saveToStorage(userStorageKeys.IS_PROCESSING, isProcessing);
      
      // Log that we're saving data for this specific user
      console.log(`Saving single visit automation state for user ${activeUserId}`, {
        hasActiveJob: !!currentJobStatus,
        hasProgress: !!jobProgress,
        isProcessing
      });
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Page is being hidden (tab switch, minimize, etc.) - save state
        saveToStorage(userStorageKeys.FORM_JOBS, formJobs);
        saveToStorage(userStorageKeys.CURRENT_JOB_STATUS, currentJobStatus);
        saveToStorage(userStorageKeys.JOB_PROGRESS, jobProgress);
        saveToStorage(userStorageKeys.IS_PROCESSING, isProcessing);
        console.log('👁️ [PERSISTENCE] Page hidden - saving state:', {
          jobs: formJobs.length,
          hasActiveJob: !!currentJobStatus,
          hasProgress: !!jobProgress
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [formJobs, singleJobId, pollingSingle, visitUrl, currentJobStatus, jobProgress, isProcessing, activeUserId]);
  
  // Timer effect to update elapsed time for running jobs
  useEffect(() => {
    // Only set up the timer if there are running jobs
    if (formJobs.some(job => job.status === 'running')) {
      const timer = setInterval(() => {
        forceUpdate({});  // Force a re-render to update timers
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [formJobs]);

  // WebSocket connection management
  useEffect(() => {
    let unsubscribeFunctions: (() => void)[] = [];

    if (activeUserId) {
      console.log('🔌 Attempting WebSocket connection for user:', activeUserId);
      
      // Connect to WebSocket
      automationSocket.connect(activeUserId)
        .then(() => {
          console.log('✅ Connected to automation WebSocket');
          setIsSocketConnected(true);
          
          // Test connection health
          automationSocket.ping();
          console.log('📡 WebSocket ping sent');
          
          // Subscribe to progress updates
          const unsubscribeProgress = automationSocket.onProgress((update: ProgressUpdate) => {
            console.log('🎯 [FRONTEND DEBUG] RAW Progress update received:', JSON.stringify(update, null, 2));
            console.log('🎯 [FRONTEND DEBUG] Update type:', update.type);
            console.log('🎯 [FRONTEND DEBUG] Fuel type:', update.fuelType);
            
            // Always update jobProgress for real-time display
            setJobProgress(update);
            
            // STRICT completion detection - only trigger on explicit automation completion
            // This matches the backend logic to prevent premature completion on phase updates
            const isCompletionEvent = update.type === 'automation_complete' || 
                                    update.phase === 'completed';
            
            // Handle completion events immediately - improved detection
            if (isCompletionEvent) {
              console.log('🎉 [COMPLETION] Received automation complete event');
              console.log('🎉 [COMPLETION] Update data:', update);
              
              // Clear any active polling and timeout
              if (completionPollInterval) {
                clearInterval(completionPollInterval);
                completionPollInterval = null;
                console.log('🎉 [COMPLETION] Stopped polling - received completion event');
              }
              if (completionTimeoutId) {
                clearTimeout(completionTimeoutId);
                completionTimeoutId = null;
                console.log('🎉 [COMPLETION] Cleared timeout - received completion event');
              }
              
              setCurrentJobStatus(prevStatus => ({
                ...prevStatus!,
                status: 'completed',
                completedAt: new Date().toISOString(), // Add completion timestamp
                result: { success: true, message: update.message || 'Automation completed' },
                progress: {
                  ...prevStatus!.progress,
                  phase: 'completed',
                  percentage: 100,
                  currentFuel: undefined,
                }
              }));
              setJobProgress(null); // Clear ongoing progress
              setIsProcessing(false);
              updateJobControlButtons('completed');
              
              // Call completion callback
              if (onJobComplete) {
                console.log('🎉 [COMPLETION] Calling onJobComplete callback');
                onJobComplete();
              }
              
              // Force render to update UI
              forceRender();
              
              console.log('🎉 [COMPLETION] ✅ Job completion handled successfully');
              return; // Exit early for completion
            }
            
            // Update job state for matching job ID
            if (update.jobId === singleJobId) {
              console.log('🔥 [JOB UPDATE] Processing update for job:', singleJobId);
              
              setCurrentJobStatus(prevStatus => {
                if (!prevStatus) {
                  return {
                    id: update.jobId,
                    status: 'running',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    progress: {
                      current: update.current || 0,
                      total: update.total || 0,
                      percentage: update.percentage || 0,
                      phase: update.phase || 'starting',
                      currentFuel: update.fuelType,
                      completedFuels: [],
                      completedFuelsByDispenser: {}, // Initialize per-dispenser tracking
                      currentDispenser: update.dispenser || null,
                      dispenserProgress: null
                    }
                  };
                }
                
                // Handle fuel completion with per-dispenser tracking
                const existingCompletedFuels = prevStatus?.progress?.completedFuels || [];
                const existingCompletedByDispenser = prevStatus?.progress?.completedFuelsByDispenser || {};
                let newCompletedFuels = [...existingCompletedFuels];
                let newCompletedByDispenser = { ...existingCompletedByDispenser };
                
                // Get current dispenser ID for per-dispenser tracking
                const currentDispenserId = update.dispenser?.id || prevStatus?.progress?.currentDispenser?.id || 'default';
                
                if ((update.type === 'fuel_grade_completed' || update.type === 'fuel_completed') && 
                    update.fuelType) {
                  
                  // Update legacy global tracking (for backward compatibility)
                  if (!newCompletedFuels.includes(update.fuelType)) {
                    newCompletedFuels = [...newCompletedFuels, update.fuelType];
                  }
                  
                  // Update per-dispenser tracking
                  if (!newCompletedByDispenser[currentDispenserId]) {
                    newCompletedByDispenser[currentDispenserId] = [];
                  }
                  
                  if (!newCompletedByDispenser[currentDispenserId].includes(update.fuelType)) {
                    newCompletedByDispenser[currentDispenserId] = [
                      ...newCompletedByDispenser[currentDispenserId], 
                      update.fuelType
                    ];
                    console.log('🎯 [FUEL SUCCESS] Added completed fuel for dispenser', currentDispenserId, ':', update.fuelType);
                    console.log('🎯 [FUEL SUCCESS] Dispenser completed fuels:', newCompletedByDispenser[currentDispenserId]);
                    
                    // Force re-render
                    setTimeout(() => forceUpdate({}), 0);
                  }
                }
                
                // Handle dispenser change - reset current dispenser's tracking if new dispenser
                if (update.type === 'dispenser_started' && update.dispenser?.id && 
                    update.dispenser.id !== prevStatus?.progress?.currentDispenser?.id) {
                  console.log('🔄 [DISPENSER CHANGE] New dispenser detected:', update.dispenser.id);
                  console.log('🔄 [DISPENSER CHANGE] Previous dispenser:', prevStatus?.progress?.currentDispenser?.id);
                  // New dispenser detected - we'll track separately but don't clear existing data
                }

                // Create new status object with forced timestamp
                return {
                  ...prevStatus,
                  updatedAt: Date.now().toString(), // Force React change detection
                  progress: {
                    current: update.current || prevStatus.progress.current,
                    total: update.total || prevStatus.progress.total,
                    percentage: update.percentage || prevStatus.progress.percentage,
                    phase: update.phase || prevStatus.progress.phase,
                    currentFuel: update.fuelType || prevStatus.progress.currentFuel,
                    completedFuels: newCompletedFuels, // Legacy - kept for backward compatibility
                    completedFuelsByDispenser: newCompletedByDispenser, // New per-dispenser tracking
                    currentDispenser: update.dispenser || prevStatus.progress.currentDispenser,
                    dispenserProgress: (update.type === 'dispenser_started' || update.type === 'dispenser_completed') ? {
                      current: update.current,
                      total: update.total,
                      percentage: update.percentage,
                      dispenser: update.dispenser
                    } : prevStatus.progress.dispenserProgress
                  }
                };
              });
            }
          });
          
          // Subscribe to completion events with enhanced job ID matching
          const unsubscribeComplete = automationSocket.onComplete((result: any) => {
            console.log('✅ [WEBSOCKET] Automation completed via WebSocket:', result);
            console.log('🔍 [COMPLETION DEBUG] Full result object:', JSON.stringify(result, null, 2));
            console.log('🔍 [COMPLETION DEBUG] result.jobId:', result.jobId, 'type:', typeof result.jobId);
            console.log('🔍 [COMPLETION DEBUG] current singleJobId:', singleJobId, 'type:', typeof singleJobId);
            
            // Enhanced job ID matching - handle various formats and types
            const resultJobId = String(result.jobId || result.id || '').trim();
            const currentJobId = String(singleJobId || '').trim();
            const jobIdMatches = resultJobId === currentJobId || 
                                 (!resultJobId && !currentJobId) ||
                                 (resultJobId && currentJobId && resultJobId.includes(currentJobId)) ||
                                 (resultJobId && currentJobId && currentJobId.includes(resultJobId));
            
            console.log('🔍 [COMPLETION DEBUG] jobId match result:', jobIdMatches);
            console.log('🔍 [COMPLETION DEBUG] normalized result ID:', resultJobId);
            console.log('🔍 [COMPLETION DEBUG] normalized current ID:', currentJobId);
            
            if (jobIdMatches) {
              console.log('🎉 [COMPLETION] ✅ JOB ID MATCH - Processing completion for job:', singleJobId);
              
              // Use proper state setter callback to access previous status
              setCurrentJobStatus(prevStatus => {
                const completedStatus = {
                  ...prevStatus!,
                  status: 'completed' as const,
                  result,
                  completedAt: new Date().toISOString(),
                  progress: {
                    ...prevStatus!.progress,
                    phase: 'completed',
                    percentage: 100,
                    currentFuel: undefined,
                  }
                };
                
                console.log('🎉 [COMPLETION] ✅ Job status updated to completed');
                console.log('🎉 [COMPLETION] ✅ Final status:', completedStatus);
                
                return completedStatus;
              });
              
              setIsProcessing(false);
              updateJobControlButtons('completed');
              setJobProgress(null); // Clear real-time progress
              
              // Force re-render to ensure UI updates immediately
              forceRender();
              
              // Callback to parent component
              if (onJobComplete) {
                console.log('🎉 [COMPLETION] ✅ Calling onJobComplete callback');
                onJobComplete();
              }
            } else {
              console.log('⚠️ [COMPLETION] ❌ Job ID mismatch - ignoring completion event');
              console.log('⚠️ [COMPLETION] Expected:', currentJobId, 'Got:', resultJobId);
            }
          });
          
          // Subscribe to error events
          const unsubscribeError = automationSocket.onError((error: any) => {
            console.error('❌ Automation error:', error);
            if (error.jobId === singleJobId) {
              setCurrentJobStatus(prevStatus => ({
                ...prevStatus!,
                status: 'failed',
                error: {
                  type: error.type || 'unknown',
                  severity: error.severity || 'medium',
                  userMessage: error.message || 'An error occurred during automation',
                  suggestedActions: error.suggestedActions || ['Review the error and try again'],
                  recoverable: error.recoverable !== false
                }
              }));
              setIsProcessing(false);
              updateJobControlButtons('failed');
            }
          });
          
          // Subscribe to cancellation events  
          const unsubscribeCancelled = automationSocket.onCancelled((data: any) => {
            console.log('⏹️ Automation cancelled:', data);
            if (data.jobId === singleJobId) {
              setCurrentJobStatus(prevStatus => ({
                ...prevStatus!,
                status: 'cancelled'
              }));
              setIsProcessing(false);
              updateJobControlButtons('cancelled');
            }
          });
          
          unsubscribeFunctions = [unsubscribeProgress, unsubscribeComplete, unsubscribeError, unsubscribeCancelled];
          
          // **FALLBACK COMPLETION DETECTION** - Poll job state as backup
          let completionPollInterval: NodeJS.Timeout | null = null;
          let completionTimeoutId: NodeJS.Timeout | null = null;
          let maxPollAttempts = 60; // 5 minutes of polling (every 5 seconds)
          let pollAttempts = 0;
          
          // **ULTIMATE FALLBACK** - Force completion after delay if all signals show done
          const setupCompletionTimeout = () => {
            completionTimeoutId = setTimeout(() => {
              console.log('⏰ [ULTIMATE FALLBACK] Checking if job should be force-completed...');
              
              if (jobProgress?.percentage === 100 && 
                  (jobProgress?.phase === 'all_forms_complete' || jobProgress?.phase === 'completed') &&
                  currentJobStatus?.status === 'running') {
                console.log('⏰ [ULTIMATE FALLBACK] ✅ Force completing job - all signals show completion');
                
                // Clear any active polling
                if (completionPollInterval) {
                  clearInterval(completionPollInterval);
                  completionPollInterval = null;
                }
                
                setCurrentJobStatus(prevStatus => ({
                  ...prevStatus!,
                  status: 'completed',
                  result: { success: true, message: 'Completed via timeout (all signals indicated completion)' },
                  progress: {
                    ...prevStatus!.progress,
                    phase: 'completed',
                    percentage: 100,
                    currentFuel: undefined,
                  }
                }));
                
                setIsProcessing(false);
                updateJobControlButtons('completed');
                setJobProgress(null);
                forceRender();
                
                if (onJobComplete) {
                  onJobComplete();
                }
                
                console.log('⏰ [ULTIMATE FALLBACK] ✅ Force completion executed');
              } else {
                console.log('⏰ [ULTIMATE FALLBACK] Conditions not met for force completion', {
                  progressPercentage: jobProgress?.percentage,
                  progressPhase: jobProgress?.phase,
                  currentStatus: currentJobStatus?.status
                });
              }
            }, 30000); // 30 second ultimate fallback
            console.log('⏰ [ULTIMATE FALLBACK] Timeout set for 30 seconds');
          };
          
          const startCompletionPolling = () => {
            console.log('🔄 [FALLBACK] Starting completion polling as backup mechanism');
            setupCompletionTimeout(); // Start ultimate fallback timer
            
            completionPollInterval = setInterval(async () => {
              pollAttempts++;
              console.log(`🔄 [FALLBACK] Polling attempt ${pollAttempts}/${maxPollAttempts} for job completion`);
              console.log(`🔄 [FALLBACK] Current singleJobId:`, singleJobId);
              
              // Skip polling if no job ID available
              if (!singleJobId || singleJobId === 'null' || singleJobId === null) {
                console.log('⚠️ [FALLBACK] Skipping poll - no valid job ID available');
                return;
              }
              
              try {
                // Check job state via API
                const { buildUrl } = await import('../config/api');
                const url = await buildUrl(`/api/job-state/${singleJobId}`);
                console.log(`🔄 [FALLBACK] Polling URL:`, url);
                const response = await fetch(url);
                
                if (response.ok) {
                  const jobState = await response.json();
                  console.log('🔄 [FALLBACK] Job state from API:', jobState);
                  
                  // Check if job is completed
                  if (jobState.status === 'completed') {
                    console.log('🎉 [FALLBACK] ✅ JOB COMPLETED detected via polling!');
                    
                    // Clear polling
                    if (completionPollInterval) {
                      clearInterval(completionPollInterval);
                      completionPollInterval = null;
                    }
                    
                    // Update status via fallback completion
                    setCurrentJobStatus(prevStatus => ({
                      ...prevStatus!,
                      status: 'completed',
                      result: jobState.result || { success: true, message: 'Completed via fallback detection' },
                      progress: {
                        ...prevStatus!.progress,
                        phase: 'completed',
                        percentage: 100,
                        currentFuel: undefined,
                      }
                    }));
                    
                    setIsProcessing(false);
                    updateJobControlButtons('completed');
                    setJobProgress(null);
                    forceRender();
                    
                    console.log('🎉 [FALLBACK] ✅ Job completion handled via polling fallback');
                    
                    if (onJobComplete) {
                      onJobComplete();
                    }
                    
                    return;
                  }
                  
                  // Check if job failed or was cancelled
                  if (jobState.status === 'failed' || jobState.status === 'cancelled' || jobState.status === 'error') {
                    console.log('⚠️ [FALLBACK] Job ended with status:', jobState.status);
                    
                    // Clear polling
                    if (completionPollInterval) {
                      clearInterval(completionPollInterval);
                      completionPollInterval = null;
                    }
                    
                    setCurrentJobStatus(prevStatus => ({
                      ...prevStatus!,
                      status: jobState.status,
                      error: jobState.error
                    }));
                    
                    setIsProcessing(false);
                    updateJobControlButtons(jobState.status);
                    setJobProgress(null);
                    forceRender();
                    
                    return;
                  }
                } else if (response.status === 404) {
                  console.warn(`🔄 [FALLBACK] Job state API returned 404 for ${singleJobId} - job may not exist in jobStateManager`);
                  
                  // If we've been getting 404s for a while and current progress shows completion,
                  // treat it as completed via WebSocket
                  if (pollAttempts > 10 && jobProgress?.percentage === 100 && 
                      (jobProgress?.phase === 'all_forms_complete' || jobProgress?.phase === 'completed')) {
                    console.log('🎉 [FALLBACK] ✅ Treating as COMPLETED - 404 API but WebSocket shows 100% completion');
                    
                    // Clear polling
                    if (completionPollInterval) {
                      clearInterval(completionPollInterval);
                      completionPollInterval = null;
                    }
                    
                    // Update status as completed
                    setCurrentJobStatus(prevStatus => ({
                      ...prevStatus!,
                      status: 'completed',
                      result: { success: true, message: 'Completed via WebSocket (job state API unavailable)' },
                      progress: {
                        ...prevStatus!.progress,
                        phase: 'completed',
                        percentage: 100,
                        currentFuel: undefined,
                      }
                    }));
                    
                    setIsProcessing(false);
                    updateJobControlButtons('completed');
                    setJobProgress(null);
                    forceRender();
                    
                    if (onJobComplete) {
                      onJobComplete();
                    }
                    
                    return;
                  }
                } else {
                  console.warn(`🔄 [FALLBACK] Job state API returned ${response.status} for ${singleJobId}`);
                }
              } catch (pollError) {
                console.warn('🔄 [FALLBACK] Polling error:', pollError);
                
                // If we're getting errors but WebSocket shows completion, treat as completed
                if (pollAttempts > 10 && jobProgress?.percentage === 100 && 
                    (jobProgress?.phase === 'all_forms_complete' || jobProgress?.phase === 'completed')) {
                  console.log('🎉 [FALLBACK] ✅ Treating as COMPLETED - API errors but WebSocket shows 100% completion');
                  
                  // Clear polling
                  if (completionPollInterval) {
                    clearInterval(completionPollInterval);
                    completionPollInterval = null;
                  }
                  
                  // Update status as completed
                  setCurrentJobStatus(prevStatus => ({
                    ...prevStatus!,
                    status: 'completed',
                    result: { success: true, message: 'Completed via WebSocket (job state API errors)' },
                    progress: {
                      ...prevStatus!.progress,
                      phase: 'completed',
                      percentage: 100,
                      currentFuel: undefined,
                    }
                  }));
                  
                  setIsProcessing(false);
                  updateJobControlButtons('completed');
                  setJobProgress(null);
                  forceRender();
                  
                  if (onJobComplete) {
                    onJobComplete();
                  }
                  
                  return;
                }
              }
              
              // Stop polling after max attempts
              if (pollAttempts >= maxPollAttempts) {
                console.log('⏰ [FALLBACK] Max polling attempts reached - stopping fallback polling');
                
                // If WebSocket shows completion but API failed, treat as completed
                if (jobProgress?.percentage === 100 && 
                    (jobProgress?.phase === 'all_forms_complete' || jobProgress?.phase === 'completed')) {
                  console.log('🎉 [FALLBACK] ✅ Final fallback: Treating as COMPLETED based on WebSocket data');
                  
                  setCurrentJobStatus(prevStatus => ({
                    ...prevStatus!,
                    status: 'completed',
                    result: { success: true, message: 'Completed via WebSocket (API polling failed)' },
                    progress: {
                      ...prevStatus!.progress,
                      phase: 'completed',
                      percentage: 100,
                      currentFuel: undefined,
                    }
                  }));
                  
                  setIsProcessing(false);
                  updateJobControlButtons('completed');
                  setJobProgress(null);
                  forceRender();
                  
                  if (onJobComplete) {
                    onJobComplete();
                  }
                }
                
                if (completionPollInterval) {
                  clearInterval(completionPollInterval);
                  completionPollInterval = null;
                }
              }
            }, 5000); // Poll every 5 seconds
          };
          
          // Start polling after a short delay to allow WebSocket events to work first
          setTimeout(startCompletionPolling, 10000); // Start polling after 10 seconds
          
          // Store cleanup function for polling and timeout
          unsubscribeFunctions.push(() => {
            if (completionPollInterval) {
              console.log('🔄 [FALLBACK] Cleaning up completion polling');
              clearInterval(completionPollInterval);
              completionPollInterval = null;
            }
            if (completionTimeoutId) {
              console.log('⏰ [ULTIMATE FALLBACK] Cleaning up completion timeout');
              clearTimeout(completionTimeoutId);
              completionTimeoutId = null;
            }
          });
        })
        .catch(error => {
          console.error('❌ Failed to connect to WebSocket:', error);
          setIsSocketConnected(false);
        });
    }

    return () => {
      // Clean up subscriptions
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      setIsSocketConnected(false);
    };
  }, [activeUserId, singleJobId]);

  // *** CRITICAL MISSING PIECE *** - Sync currentJobStatus changes to formJobs array
  useEffect(() => {
    if (currentJobStatus && singleJobId) {
      console.log('🔄 [STATUS SYNC] currentJobStatus changed, updating formJobs array:', currentJobStatus);
      updateJobStatus(currentJobStatus);
    }
  }, [currentJobStatus, singleJobId]);

  // *** CRITICAL ADDITION *** - Handle automation_complete status transition
  useEffect(() => {
    if (currentJobStatus?.status === 'automation_complete' || 
        currentJobStatus?.status === 'completed') {
      
      const jobId = currentJobStatus.jobId || singleJobId;
      if (jobId) {
        console.log('🎉 [COMPLETION SYNC] Finalizing job completion in formJobs:', jobId);
        
        // Update formJobs with final completion status
        setFormJobs(prev => prev.map(job => 
          job.jobId === jobId || (job.url === visitUrl && job.status === 'running')
            ? { 
                ...job, 
                status: 'completed', 
                endTime: Date.now(),
                message: 'Automation completed successfully',
                timestamp: new Date().toISOString(),
                // Preserve any additional data from currentJobStatus
                ...(currentJobStatus.processedForms && { processedForms: currentJobStatus.processedForms }),
                ...(currentJobStatus.createdForms && { createdForms: currentJobStatus.createdForms }),
                ...(currentJobStatus.serviceCode && { serviceCode: currentJobStatus.serviceCode }),
                ...(currentJobStatus.dispenserCount && { dispenserCount: currentJobStatus.dispenserCount }),
                ...(currentJobStatus.visitNumber && { visitNumber: currentJobStatus.visitNumber })
              }
            : job
        ));
        
        // Force immediate persistence to localStorage
        setTimeout(() => {
          const currentJobs = getFromStorage(userStorageKeys.FORM_JOBS, []);
          const updatedJobs = currentJobs.map((job: any) => 
            (job.jobId === jobId || (job.url === visitUrl && job.status === 'running'))
              ? { 
                  ...job, 
                  status: 'completed', 
                  endTime: Date.now(),
                  message: 'Automation completed successfully',
                  timestamp: new Date().toISOString()
                }
              : job
          );
          
          // Force save the updated jobs
          saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
          
          console.log('✅ [COMPLETION SYNC] Force-saved completion status:', {
            jobId,
            totalJobs: updatedJobs.length,
            completedJobs: updatedJobs.filter(j => j.status === 'completed').length
          });
        }, 100);
      }
      
      // Reset automation state
      setCurrentJobStatus(null);
      setIsProcessing(false);
      setSingleJobId(null);
      setPollingSingle(false);
      
      // Clean up storage
      saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
      saveToStorage(userStorageKeys.IS_POLLING_SINGLE, false);
    }
  }, [currentJobStatus?.status, currentJobStatus?.jobId, singleJobId, visitUrl]);

  // Helper function to update job control button states
  const updateJobControlButtons = useCallback((status: string) => {
    const isRunning = status === 'running';
    const isPaused = status === 'paused';
    const isCompleted = ['completed', 'failed', 'cancelled'].includes(status);
    
    setCanPause(isRunning);
    setCanResume(isPaused);
    setCanCancel(isRunning || isPaused);
  }, []);

  // Function to update job status across localStorage and state
  const updateJobStatus = (status: any) => {
    // Log the full status object to see if dispenserProgress is included
    console.log('[DEBUG] Full status update:', JSON.stringify(status, null, 2));
    addDebugLog('SINGLE', 'Updating job status', {
      ...status,
      hasDispenserProgress: !!status.dispenserProgress,
      dispenserCount: status.dispenserProgress?.dispensers?.length || 0
    });
    
    // Extra debug logging for dispenser progress
    if (status.dispenserProgress) {
      console.log('[DEBUG] Dispenser progress found:', JSON.stringify(status.dispenserProgress, null, 2));
    } else {
      console.log('[DEBUG] No dispenser progress in status update');
    }
    
    // Skip updates for jobs that don't belong to the active user
    if (status.userId && status.userId !== activeUserId) {
      console.warn(`Skipping status update for job - userId ${status.userId} doesn't match active user ${activeUserId}`);
      return;
    }
    
    if (onJobStatusChange) {
      onJobStatusChange(status);
    }
    
    // Don't update anything in the UI if we've already unmounted
    if (!singleJobId) return;
    
    setFormJobs(prev => {
      const updatedJobs = [...prev];
      
      // Find the right job to update (look for running, processing, or unknown status)
      const activeJobUrl = getFromStorage(userStorageKeys.VISIT_URL);
      const jobIndex = updatedJobs.findIndex(job => 
        job.url === activeJobUrl && (job.status === 'running' || job.status === 'processing' || job.status === 'unknown'));
      
      if (jobIndex !== -1) {
        // Handle various backend status values
        let finalStatus = status.status;
        if (status.status === 'automation_complete') {
          finalStatus = 'completed';
        } else if (status.status === 'processing') {
          finalStatus = 'running';
        }
        
        // Update the job's status
        updatedJobs[jobIndex] = {
          ...updatedJobs[jobIndex],
          status: finalStatus,
          message: status.message || (finalStatus === 'completed' ? 'Automation completed successfully' : status.message),
          dispenserProgress: status.dispenserProgress, // Add dispenser progress
          // Add a timestamp to the update
          timestamp: new Date().toISOString(),
          // Add endTime if job is completed or errored
          ...(finalStatus === 'completed' || finalStatus === 'error' || finalStatus === 'cancelled' ? { endTime: Date.now() } : {}),
          // Preserve additional completion data
          ...(status.processedForms && { processedForms: status.processedForms }),
          ...(status.createdForms && { createdForms: status.createdForms }),
          ...(status.serviceCode && { serviceCode: status.serviceCode }),
          ...(status.dispenserCount && { dispenserCount: status.dispenserCount }),
          ...(status.visitNumber && { visitNumber: status.visitNumber })
        };
        
        // Log form progression if detected
        if (status.dispenserProgress) {
          const activeForm = status.dispenserProgress.dispensers.find(d => d.status === 'processing');
          if (activeForm) {
            console.log(`[DEBUG] Currently processing form ${activeForm.formNumber}/${activeForm.totalForms}`);
          }
        }
        
        // Save to localStorage with enhanced logging
        saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
        console.log('💾 [PERSISTENCE] Job status saved to localStorage:', {
          jobId: status.jobId || 'unknown',
          status: finalStatus,
          jobsCount: updatedJobs.length,
          completedCount: updatedJobs.filter(j => j.status === 'completed').length
        });
      }
      
      return updatedJobs;
    });
  };

  // Handle job completion
  const handleJobComplete = () => {
    addDebugLog('SINGLE', 'Job completed');
    
    if (onJobComplete) {
      onJobComplete();
    }
    
    setSingleJobId(null);
    setPollingSingle(false);
    saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
    saveToStorage(userStorageKeys.IS_POLLING_SINGLE, false);
  };

  // Handle job error
  const handleJobError = (error: any) => {
    addDebugLog('ERROR', 'Job error', error);
    
    if (onJobError) {
      onJobError(error);
    }
    
    setSingleJobId(null);
    setPollingSingle(false);
    saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
    saveToStorage(userStorageKeys.IS_POLLING_SINGLE, false);
    
    addToast('error', error instanceof Error ? error.message : 'An unknown error occurred');
  };

  // Unified polling function that works for single visits
  const startPolling = (jobId: string, isSingle: boolean) => {
    addDebugLog('SINGLE', `Starting unified polling for single visit job ${jobId} for user ${activeUserId}`);
    
    // Verify this job belongs to the current user
    const job = formJobs.find(j => j.jobId === jobId);
    if (job && job._userId && job._userId !== activeUserId) {
      console.warn(`Job ${jobId} belongs to user ${job._userId}, not active user ${activeUserId}. Skipping polling.`);
      return;
    }
    
    pollingManager.current.startPolling(
      jobId,
      updateJobStatus,
      handleJobComplete,
      handleJobError,
      visitUrl
    );
  };

  // New job state management functions
  const pauseJob = async () => {
    if (!singleJobId) return;
    
    try {
      const { buildUrl } = await import('../config/api');
      const url = await buildUrl('/api/job-state/pause');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: singleJobId, reason: 'user_requested' })
      });
      
      if (response.ok) {
        addToast('info', 'Job paused successfully');
        setCurrentJobStatus(prev => prev ? { ...prev, status: 'paused' } : null);
        updateJobControlButtons('paused');
      } else {
        throw new Error('Failed to pause job');
      }
    } catch (error) {
      console.error('Error pausing job:', error);
      addToast('error', 'Failed to pause job');
    }
  };

  const resumeJob = async () => {
    if (!singleJobId) return;
    
    try {
      const { buildUrl } = await import('../config/api');
      const url = await buildUrl('/api/job-state/resume');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: singleJobId })
      });
      
      if (response.ok) {
        addToast('info', 'Job resumed successfully');
        setCurrentJobStatus(prev => prev ? { ...prev, status: 'running' } : null);
        updateJobControlButtons('running');
      } else {
        throw new Error('Failed to resume job');
      }
    } catch (error) {
      console.error('Error resuming job:', error);
      addToast('error', 'Failed to resume job');
    }
  };

  const cancelJob = async () => {
    if (!singleJobId) return;
    
    try {
      const { buildUrl } = await import('../config/api');
      const url = await buildUrl('/api/job-state/cancel');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: singleJobId, reason: 'user_requested' })
      });
      
      if (response.ok) {
        addToast('info', 'Job cancelled successfully');
        setCurrentJobStatus(prev => prev ? { ...prev, status: 'cancelled' } : null);
        setIsProcessing(false);
        updateJobControlButtons('cancelled');
      } else {
        throw new Error('Failed to cancel job');
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      addToast('error', 'Failed to cancel job');
    }
  };

  // Function to handle single visit processing with confirmation
  const handleSingleVisit = async () => {
    if (!visitUrl) {
      addToast('warning', 'Please enter a valid visit URL');
      return;
    }
    
    // Validate URL format
    if (!visitUrl.startsWith('http')) {
      addToast('warning', 'URL must start with http:// or https://');
      return;
    }
    
    // Process directly without confirmation
    
    // Set the URL in storage for resuming
    saveToStorage(userStorageKeys.VISIT_URL, visitUrl);
    
    setIsProcessing(true);
    
    try {
      addDebugLog('SINGLE', 'Processing single visit', { 
        url: visitUrl, 
        headless: isHeadless,
        userId: activeUserId // Log the user ID to track whose job this is
      });
      
      // Extract work order ID from URL for better tracking
      const workOrderMatch = visitUrl.match(/\/work\/(\d+)/);
      const workOrderId = workOrderMatch ? workOrderMatch[1] : undefined;
      
      // Make sure we're passing isHeadless as a boolean value
      const headlessOption = isHeadless === true;
      console.log(`Processing with headless=${headlessOption}`);
      
      // Prepare job code parameters if available
      const serviceCode = jobTypeInfo?.serviceCode || undefined;
      const isSpecificDispensers = jobTypeInfo?.isSpecificDispensers || false;
      const instructions = selectedWorkOrderData?.instructions || '';
      
      // ===== ENHANCED DEBUGGING FOR SPECIFIC DISPENSER ISSUE =====
      console.log('🔍 [FRONTEND DEBUG] About to call processSingleVisit with:');
      console.log('🔍 [FRONTEND DEBUG] - visitUrl:', visitUrl);
      console.log('🔍 [FRONTEND DEBUG] - headlessOption:', headlessOption);
      console.log('🔍 [FRONTEND DEBUG] - workOrderId:', workOrderId);
      console.log('🔍 [FRONTEND DEBUG] - serviceCode:', serviceCode);
      console.log('🔍 [FRONTEND DEBUG] - isSpecificDispensers:', isSpecificDispensers, '(type:', typeof isSpecificDispensers, ')');
      console.log('🔍 [FRONTEND DEBUG] - instructions:', JSON.stringify(instructions));
      console.log('🔍 [FRONTEND DEBUG] - jobTypeInfo:', jobTypeInfo);
      console.log('🔍 [FRONTEND DEBUG] - selectedWorkOrderData?.instructions:', selectedWorkOrderData?.instructions);
      console.log('🔍 [FRONTEND DEBUG] =========================================');
      
      if (serviceCode) {
        addDebugLog('SINGLE', `Processing with job code: ${serviceCode}, specificDispensers: ${isSpecificDispensers}`);
      }
      
      // Call the API to process the visit with explicit boolean and job code info
      const response = await processSingleVisit(
        visitUrl, 
        headlessOption, 
        workOrderId,
        serviceCode,
        isSpecificDispensers,
        instructions
      );
      
      if (response.jobId) {
        addDebugLog('SINGLE', 'Visit processing started', { jobId: response.jobId });
        
        // Set up job state management
        setSingleJobId(response.jobId);
        setCurrentJobStatus({
          id: response.jobId,
          status: 'running',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          progress: {
            current: 0,
            total: 0,
            percentage: 0,
            phase: 'starting',
            completedFuels: []
          }
        });
        updateJobControlButtons('running');
        
        // Subscribe to job updates if WebSocket is connected
        if (isSocketConnected) {
          console.log('🔗 Subscribing to job updates:', response.jobId);
          automationSocket.subscribeToJob(response.jobId);
        } else {
          console.warn('⚠️ WebSocket not connected, cannot subscribe to job updates');
        }
        
        // Extract additional job information
        const storeInfo = extractStoreInfo(visitUrl);
        const workOrderData = selectedWorkOrderData;
        const dispenserCount = workOrderData ? getDispenserCount(workOrderData) : 0;
        
        // Add a new job to the formJobs state with enhanced metadata
        const newJob = {
          url: visitUrl,
          jobId: response.jobId,
          status: 'running',
          message: 'Starting process...',
          timestamp: new Date().toISOString(),
          startTime: Date.now(), // Add start time for duration tracking
          endTime: null, // Will be set when job completes
          headless: isHeadless,
          storeName: storeInfo.storeName, // Better store name extraction
          visitNumber: storeInfo.visitNumber, // Extract visit number
          dispenserCount: dispenserCount, // Add dispenser count
          serviceCode: serviceCode, // Add service code
          isSpecificDispensers: isSpecificDispensers, // Add dispenser type info
          dispenserProgress: null, // Initialize dispenserProgress
          _userId: activeUserId // Mark job as belonging to this user
        };
        
        setFormJobs(prevJobs => {
          const updatedJobs = [newJob, ...prevJobs].filter(job => 
            // Remove any older jobs with the same URL that are running or idle
            !(job.url === visitUrl && job.jobId !== response.jobId && 
              (job.status === 'running' || job.status === 'idle'))
          );
          
          // Update localStorage
          saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
          
          return updatedJobs;
        });
        
        // Set the new single job ID
        setSingleJobId(response.jobId);
        setPollingSingle(true);
        
        // Update localStorage
        saveToStorage(userStorageKeys.SINGLE_JOB_ID, response.jobId);
        saveToStorage(userStorageKeys.IS_POLLING_SINGLE, true);
        
        // Small delay to ensure state is updated before polling starts
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Start polling for status updates
        startPolling(response.jobId, true);
        
        // Show success toast
        addToast('success', 'Processing started');
      } else {
        addDebugLog('ERROR', 'Error starting visit processing', response);
        addToast('error', response.message || 'Failed to start processing');
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unknown error occurred while processing the visit';
      
      addDebugLog('SINGLE', 'Error processing visit', error);
      console.error('Error processing visit:', error);
      
      // Enhanced error message with more details
      addToast('error', `${errorMessage}. Please check the URL and try again or contact support if the issue persists.`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to cancel a running job
  const handleCancelJob = (jobIdToCancel: string) => {
    if (!jobIdToCancel) return;
    
    setIsProcessing(true);
    
    try {
      // Call the API to cancel the job
      cancelFormAutomation(jobIdToCancel);
      addDebugLog('SINGLE', `Cancelled job ${jobIdToCancel}`);
      
      // Update the job status in state
      setFormJobs(prevJobs => {
        const updatedJobs = [...prevJobs];
        const jobIndex = updatedJobs.findIndex(job => job.jobId === jobIdToCancel);
        
        if (jobIndex !== -1) {
          updatedJobs[jobIndex] = {
            ...updatedJobs[jobIndex],
            status: 'cancelled',
            message: 'Processing stopped by user',
            endTime: Date.now() // Set end time when cancelling
          };
        }
        
        // Update both state and localStorage
        saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
        return updatedJobs;
      });
      
      // Stop polling
      const jobIdToStop = jobIdToCancel;
      if (jobIdToStop) {
        pollingManager.current.stopPolling(jobIdToStop);
      }
      
      setSingleJobId(null);
      setPollingSingle(false);
      saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
      saveToStorage(userStorageKeys.IS_POLLING_SINGLE, false);
      
      setIsProcessing(false);
      
      // Show success toast
      addToast('success', 'Processing stopped');
    } catch (error) {
      console.error('Error cancelling job:', error);
      addDebugLog('ERROR', 'Error cancelling job', error);
      addToast('error', 'Failed to stop processing');
      setIsProcessing(false);
    }
  };

  // Function to open a URL with debug mode
  const handleOpenUrlWithDebugMode = async () => {
    if (!visitUrl) {
      addToast('warning', 'Please enter a valid visit URL');
      return;
    }
    
    try {
      addDebugLog('SINGLE', 'Opening URL with debug mode', { url: visitUrl, isHeadless });
      
      // Call the API to open the URL with debug mode
      // Pass false for headless to ensure the browser is visible
      await openUrlWithDebugMode(visitUrl, false);
      
      addToast('success', 'Opened in debug mode');
    } catch (error) {
      console.error('Error opening URL with debug mode:', error);
      addDebugLog('ERROR', 'Error opening URL with debug mode', error);
      addToast('error', 'Failed to open in debug mode');
    }
  };

  // Function to clear job history
  const handleClearHistory = async () => {
    // Clear directly without confirmation
    
    try {
      await clearJobHistory(activeUserId, 'single');
      
      // Clear from state
      setFormJobs([]);
      
      // Clear from localStorage  
      saveToStorage(userStorageKeys.FORM_JOBS, []);
      saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
      saveToStorage(userStorageKeys.IS_POLLING_SINGLE, false);
      
      // Reset related state
      setSingleJobId(null);
      setPollingSingle(false);
      
      addToast('success', 'Job history cleared');
      addDebugLog('SINGLE', 'Cleared job history for single visits');
    } catch (error) {
      console.error('Error clearing job history:', error);
      addDebugLog('ERROR', 'Error clearing job history', error);
      addToast('error', 'Failed to clear job history');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 leading-tight">Single Visit Automation</h2>
      
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiExternalLink className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Enter visit URL"
              value={visitUrl}
              onChange={(e) => setVisitUrl(e.target.value)}
              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white pl-10 py-2.5 focus:ring-primary-500 focus:border-primary-500 text-base"
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
              <label htmlFor="isHeadless" className="text-gray-700 dark:text-gray-300 text-sm">Run Headless</label>
            </div>
            
            <button
              onClick={handleSingleVisit}
              disabled={isProcessing || !visitUrl}
              className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPlay className="mr-1.5 h-4 w-4" />
              Process
            </button>

            {/* Job Control Buttons */}
            {canPause && (
              <button
                onClick={pauseJob}
                className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <FiPause className="mr-1.5 h-4 w-4" />
                Pause
              </button>
            )}

            {canResume && (
              <button
                onClick={resumeJob}
                className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <FiSkipForward className="mr-1.5 h-4 w-4" />
                Resume
              </button>
            )}

            {canCancel && (
              <button
                onClick={cancelJob}
                className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <FiX className="mr-1.5 h-4 w-4" />
                Cancel
              </button>
            )}
            
            <button
              onClick={handleOpenUrlWithDebugMode}
              disabled={!visitUrl}
              className="inline-flex items-center px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiExternalLink className="mr-1.5 h-4 w-4" />
              Debug
            </button>
          </div>
        </div>
        
        {/* Job Type Information */}
        {jobTypeInfo && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiTool className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Job Type: {jobTypeInfo.formType}
                </span>
                {jobTypeInfo.serviceCode && (
                  <span className="ml-2 text-xs text-blue-700 dark:text-blue-300">
                    (Code: {jobTypeInfo.serviceCode})
                  </span>
                )}
              </div>
              {jobTypeInfo.isSpecificDispensers && (
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full">
                  Specific Dispensers
                </span>
              )}
            </div>
            {selectedWorkOrderData?.instructions && (
              <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                <span className="font-medium">Instructions:</span> {selectedWorkOrderData.instructions}
              </div>
            )}
          </div>
        )}

        {/* Real-time Job Progress Display */}
        {currentJobStatus && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Job Progress</h3>
            
            {/* Connection Status */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {isSocketConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Job ID: {currentJobStatus.id}
              </span>
            </div>

            {/* Job Status */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Status: <span className={`font-medium ${
                    currentJobStatus.status === 'running' ? 'text-blue-600' :
                    currentJobStatus.status === 'paused' ? 'text-yellow-600' :
                    currentJobStatus.status === 'completed' ? 'text-green-600' :
                    currentJobStatus.status === 'failed' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {currentJobStatus.status.charAt(0).toUpperCase() + currentJobStatus.status.slice(1)}
                  </span>
                </span>
                {currentJobStatus.progress.percentage > 0 && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {currentJobStatus.progress.percentage.toFixed(1)}%
                  </span>
                )}
              </div>
              
              {/* Progress Bar */}
              {currentJobStatus.progress.total > 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${currentJobStatus.progress.percentage}%` }}
                  ></div>
                </div>
              )}
              
              {/* Current Phase */}
              {currentJobStatus.progress.phase && (
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div>
                    Phase: {currentJobStatus.progress.phase}
                    {currentJobStatus.progress.currentFuel && (
                      <span className="ml-2">| Fuel: {currentJobStatus.progress.currentFuel}</span>
                    )}
                  </div>
                  
                  {/* Enhanced Dispenser Progress Display - Hide when completed */}
                  {(() => {
                    console.log('🎯 [UI DEBUG] Checking enhanced dispenser display conditions:');
                    console.log('🎯 [UI DEBUG] jobProgress exists:', !!jobProgress);
                    console.log('🎯 [UI DEBUG] jobProgress.dispenser exists:', !!jobProgress?.dispenser);
                    console.log('🎯 [UI DEBUG] jobProgress full object:', jobProgress);
                    return null;
                  })()}
                  {jobProgress && jobProgress.dispenser && currentJobStatus.status !== 'completed' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-3 mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                          <span className="font-medium text-blue-900 dark:text-blue-100">
                            {jobProgress.dispenser.title || `Dispenser ${jobProgress.dispenser.id}`}
                          </span>
                        </div>
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                          {jobProgress.type === 'dispenser_started' ? 'Starting...' :
                           jobProgress.type === 'dispenser_completed' ? 'Completed' :
                           jobProgress.type === 'fuel_grade_completed' ? 'Processing Grades' :
                           'Processing'}
                        </div>
                      </div>
                      
                      {/* Fuel Grades Progress */}
                      {jobProgress.dispenser.fuelGrades && jobProgress.dispenser.fuelGrades.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Fuel Grades Progress:</div>
                          <div className="grid grid-cols-2 gap-1">
                            {jobProgress.dispenser.fuelGrades.map((grade, index) => {
                              const isCurrentFuel = jobProgress.fuelType === grade;
                              
                              // Use per-dispenser completion tracking
                              const currentDispenserId = jobProgress.dispenser?.id || 'default';
                              const completedForThisDispenser = currentJobStatus?.progress?.completedFuelsByDispenser?.[currentDispenserId] || [];
                              const isCompleted = completedForThisDispenser.includes(grade);
                              
                              // Debug logging for completion tracking
                              if (index === 0) { // Only log once per render to avoid spam
                                console.log('🎯 [UI RENDER] Dispenser ID:', currentDispenserId);
                                console.log('🎯 [UI RENDER] Completed for this dispenser:', completedForThisDispenser);
                                console.log('🎯 [UI RENDER] All completion data:', currentJobStatus?.progress?.completedFuelsByDispenser);
                              }
                              
                              return (
                                <div
                                  key={index}
                                  className={`flex items-center px-2 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
                                    isCompleted
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-300 dark:border-green-700'
                                      : isCurrentFuel
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                                  }`}
                                >
                                  {isCompleted && (
                                    <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  {isCurrentFuel && !isCompleted && (
                                    <svg className="animate-spin w-3 h-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  )}
                                  <span className="truncate">{grade}</span>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Progress Summary */}
                          <div className="flex items-center justify-between pt-2 border-t border-blue-200 dark:border-blue-700">
                            <span className="text-xs text-blue-700 dark:text-blue-300">
                              Current Grade: {jobProgress.fuelType || 'Starting...'}
                            </span>
                            {jobProgress.current && jobProgress.total && (
                              <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                                {jobProgress.current}/{jobProgress.total} dispensers
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Fallback Current Dispenser Info (for backward compatibility) - Hide when completed */}
                  {!jobProgress?.dispenser && currentJobStatus.progress.currentDispenser && currentJobStatus.status !== 'completed' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-blue-900 dark:text-blue-100">
                          {currentJobStatus.progress.currentDispenser.title || `Dispenser ${currentJobStatus.progress.currentDispenser.id}`}
                        </span>
                        {currentJobStatus.progress.currentDispenser.completedGrades !== undefined && 
                         currentJobStatus.progress.currentDispenser.totalGrades !== undefined && (
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {currentJobStatus.progress.currentDispenser.completedGrades}/{currentJobStatus.progress.currentDispenser.totalGrades} grades
                          </span>
                        )}
                      </div>
                      
                      {/* Fuel Grades Progress */}
                      {currentJobStatus.progress.currentDispenser.fuelGrades && 
                       currentJobStatus.progress.currentDispenser.fuelGrades.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">Fuel Grades:</div>
                          <div className="flex flex-wrap gap-1">
                            {currentJobStatus.progress.currentDispenser.fuelGrades.map((grade, index) => {
                              // Use per-dispenser completion tracking for fallback section too
                              const currentDispenserId = currentJobStatus.progress.currentDispenser?.id || 'default';
                              const completedForThisDispenser = currentJobStatus.progress.completedFuelsByDispenser?.[currentDispenserId] || [];
                              const isCompleted = completedForThisDispenser.includes(grade);
                              const isCurrent = currentJobStatus.progress.currentFuel === grade;
                              
                              return (
                                <span
                                  key={index}
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    isCompleted
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                      : isCurrent
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                  }`}
                                >
                                  {isCompleted && (
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  {isCurrent && (
                                    <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  )}
                                  {grade}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Dispenser Progress Summary */}
                  {currentJobStatus.progress.dispenserProgress && (
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300">Overall Progress:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {currentJobStatus.progress.dispenserProgress.current}/{currentJobStatus.progress.dispenserProgress.total} dispensers
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-1">
                        <div 
                          className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${currentJobStatus.progress.dispenserProgress.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Completion Message */}
            {currentJobStatus.status === 'completed' && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded p-4 mb-3">
                <div className="flex items-center mb-3">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                      Automation Completed Successfully
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                      All dispensers have been processed and forms submitted.
                    </div>
                  </div>
                </div>
                
                {/* Completion Summary - Show Store, Visit, and Duration Info */}
                <div className="space-y-3">
                  {(() => {
                    // Extract store name from URL or selected work order
                    let storeName = 'Unknown Store';
                    let visitNumber = 'N/A';
                    
                    if (selectedWorkOrderData) {
                      // Extract store name from work order data
                      storeName = selectedWorkOrderData.store || 
                                selectedWorkOrderData.storeName || 
                                (typeof selectedWorkOrderData.customer === 'string' ? selectedWorkOrderData.customer : selectedWorkOrderData.customer?.name || selectedWorkOrderData.customer?.customerName) ||
                                selectedWorkOrderData.location || 
                                'Unknown Store';
                      
                      // Get actual visit number from work order - prioritize visit-specific fields
                      visitNumber = selectedWorkOrderData.visitNumber || 
                                  selectedWorkOrderData.visit ||
                                  selectedWorkOrderData.visitId ||
                                  'N/A'; // Don't fall back to work order ID
                    } else if (visitUrl) {
                      // Try to extract store info from URL - multiple patterns
                      const urlPatterns = [
                        /\/([^/]+)\/visits\/(\d+)/, // /store/visits/123
                        /store=([^&]+).*visit.*?(\d+)/, // ?store=name&visit=123
                        /customer[=/]([^&/]+)/, // customer=name or customer/name
                        /location[=/]([^&/]+)/ // location=name or location/name
                      ];
                      
                      for (const pattern of urlPatterns) {
                        const match = visitUrl.match(pattern);
                        if (match) {
                          storeName = match[1] || storeName;
                          if (match[2]) visitNumber = match[2];
                          break;
                        }
                      }
                      
                      // Enhanced visit number extraction from URL if not found
                      if (visitNumber === 'N/A') {
                        const visitMatch = visitUrl.match(/visits\/(\d+)|visit[=/](\d+)|id[=/](\d+)|(?:^|[?&])v[=/](\d+)/);
                        if (visitMatch) {
                          visitNumber = visitMatch[1] || visitMatch[2] || visitMatch[3] || visitMatch[4];
                        }
                      }
                    }
                    
                    // Calculate duration - stop counting when completed
                    const startTime = currentJobStatus.createdAt ? new Date(currentJobStatus.createdAt).getTime() : Date.now();
                    const isCompleted = currentJobStatus.status === 'completed';
                    const endTime = isCompleted && currentJobStatus.completedAt 
                      ? new Date(currentJobStatus.completedAt).getTime() 
                      : isCompleted 
                        ? startTime // Fallback: don't count time if completed but no timestamp
                        : Date.now(); // Still running: use current time
                    const duration = Math.round((endTime - startTime) / 1000);
                    const minutes = Math.floor(duration / 60);
                    const seconds = duration % 60;
                    const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Store Information */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <div>
                              <div className="text-xs text-green-700 dark:text-green-300 font-medium">Store</div>
                              <div className="text-sm font-semibold text-green-900 dark:text-green-100">{storeName}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Visit Number */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                              <div className="text-xs text-green-700 dark:text-green-300 font-medium">Visit Number</div>
                              <div className="text-sm font-semibold text-green-900 dark:text-green-100">{visitNumber}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Duration */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <div className="text-xs text-green-700 dark:text-green-300 font-medium">Duration</div>
                              <div className="text-sm font-semibold text-green-900 dark:text-green-100">{durationText}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Summary Statistics */}
                  {currentJobStatus.progress.completedFuels.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <div>
                            <div className="text-xs text-green-700 dark:text-green-300 font-medium">Fuel Grades Processed</div>
                            <div className="text-sm font-semibold text-green-900 dark:text-green-100">
                              {currentJobStatus.progress.completedFuels.length} grades completed successfully
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-green-700 dark:text-green-300">Total Dispensers</div>
                          <div className="text-sm font-semibold text-green-900 dark:text-green-100">
                            {currentJobStatus.progress.dispenserProgress?.total || Object.keys(currentJobStatus.progress.completedFuelsByDispenser || {}).length}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DEBUG: All Progress Data */}
            {jobProgress && currentJobStatus.status !== 'completed' && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded text-xs mb-2">
                <div className="font-bold text-yellow-800 dark:text-yellow-200">🐛 DEBUG - All Progress Data:</div>
                <pre className="text-xs mt-1 text-yellow-700 dark:text-yellow-300 overflow-auto max-h-32">
                  {JSON.stringify(jobProgress, null, 2)}
                </pre>
              </div>
            )}

            {/* Latest Progress Message with Enhanced Context */}
            {jobProgress && currentJobStatus.status !== 'completed' && (
              <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 dark:text-gray-200 font-medium">{jobProgress.message}</span>
                  <span className="text-gray-500 dark:text-gray-500">
                    {new Date(jobProgress.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                {/* Additional Context */}
                {(jobProgress.fuelType || jobProgress.dispenser) && (
                  <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700">
                    {jobProgress.dispenser && (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                        {jobProgress.dispenser.title || jobProgress.dispenser.id}
                      </span>
                    )}
                    {jobProgress.fuelType && (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {jobProgress.fuelType}
                      </span>
                    )}
                    {jobProgress.percentage !== undefined && (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {jobProgress.percentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error Display */}
            {currentJobStatus.error && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center mb-2">
                  <FiAlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                  <span className="text-sm font-medium text-red-900 dark:text-red-100">
                    Error ({currentJobStatus.error.severity})
                  </span>
                </div>
                <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                  {currentJobStatus.error.userMessage}
                </p>
                {currentJobStatus.error.suggestedActions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-900 dark:text-red-100 mb-1">Suggested Actions:</p>
                    <ul className="text-xs text-red-800 dark:text-red-200 list-disc list-inside">
                      {currentJobStatus.error.suggestedActions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Work Order Selection Section - Table Layout (identical to batch) */}
        {groupedWorkOrders.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center justify-between">
              <span>
                Select Visit to Process
                {selectedWorkOrder && (
                  <span className="ml-2 text-xs text-primary-600 dark:text-primary-400">
                    1 selected
                  </span>
                )}
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
            
            {/* Work Order Groups with Table Layout */}
            <div className="space-y-3">
              {groupedWorkOrders.map((group, groupIndex) => (
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
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
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
                    <div className="overflow-y-auto">
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
                          {group.orders.map((order: any) => {
                            // Get styles for this store
                            const customerName = String((order.customer?.name && typeof order.customer.name === "string") ? order.customer.name : (order.customer?.name?.name) || order.customer?.customerName || "");
                            const storeStyles = getStoreStyles(customerName);
                            
                            // Get dispenser count
                            const dispenserCount = getDispenserCount(order);
                            
                            // Handle the case where visits is an object with nextVisit property (Fossa structure)
                            const visitsArray = order.visits && typeof order.visits === 'object' && 'nextVisit' in order.visits
                              ? [{ ...(order.visits as any).nextVisit, id: order.id }] // Use workOrder.id as the visit id
                              : Array.isArray(order.visits) 
                                ? order.visits 
                                : [];
                            
                            return visitsArray.map((visit: any, visitIndex: number) => (
                              <tr 
                                key={visit.id} 
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                                  selectedWorkOrder === visit.id ? `${storeStyles.bg} border-l-4 ${storeStyles.border}` : ''
                                }`}
                                onClick={(e) => {
                                  // Prevent toggle if clicking on the radio button itself (to avoid double-toggle)
                                  if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                    handleVisitSelect(visit.id, order);
                                  }
                                }}
                              >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <input
                                      type="radio"
                                      name="single-visit-selection"
                                      className="form-radio h-5 w-5 text-primary-600 border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 mr-3"
                                      checked={selectedWorkOrder === visit.id}
                                      onChange={() => handleVisitSelect(visit.id, order)}
                                      id={`visit-${visit.id}`}
                                    />
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-gray-100">
                                        {String((order.customer?.name && typeof order.customer.name === "string") ? order.customer.name : (order.customer?.name?.name) || order.customer?.customerName || "Unknown Store")}
                                      </div>
                                      {order.customer?.storeNumber && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {String(order.customer?.storeNumber || "")}
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
                                    {String(order.customer?.address?.cityState || (typeof order.customer?.address === 'string' ? order.customer?.address : '') || "Unknown Location")}
                                  </div>
                                  {order.customer?.address?.county && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {String(order.customer?.address?.county || "")}
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
        )}
        
        {/* Job Status Section */}
        {formJobs.length > 0 && (
          <div className="mt-4">
            {/* Quick Summary Stats */}
            {formJobs.length > 1 && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Recent Activity Summary
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    {(() => {
                      const completedJobs = formJobs.filter(job => job.status === 'completed');
                      const avgDuration = completedJobs.length > 0 ? 
                        completedJobs.reduce((sum, job) => {
                          if (job.startTime && job.endTime) {
                            return sum + (job.endTime - job.startTime);
                          }
                          return sum;
                        }, 0) / completedJobs.length : 0;
                      
                      return (
                        <>
                          <span className="text-gray-600 dark:text-gray-400">
                            Avg Duration: {avgDuration > 0 ? formatDuration(0, avgDuration, true) : 'N/A'}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            Success Rate: {formJobs.length > 0 ? Math.round((completedJobs.length / formJobs.length) * 100) : 0}%
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
            
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex justify-between items-center leading-tight">
              <span className="flex items-center gap-2">
                Recent Jobs 
                {formJobs.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    {formJobs.length} total
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {/* Enhanced Status Summary with Success Rate */}
                {formJobs.length > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    {formJobs.filter(job => job.status === 'completed').length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        <FiCheckCircle className="mr-1 h-3 w-3" />
                        {formJobs.filter(job => job.status === 'completed').length} completed
                      </span>
                    )}
                    {formJobs.filter(job => job.status === 'running').length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        <div className="animate-pulse mr-1 h-2 w-2 bg-blue-500 rounded-full"></div>
                        {formJobs.filter(job => job.status === 'running').length} active
                      </span>
                    )}
                    {formJobs.filter(job => job.status === 'error').length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                        <FiXCircle className="mr-1 h-3 w-3" />
                        {formJobs.filter(job => job.status === 'error').length} failed
                      </span>
                    )}
                    {formJobs.filter(job => job.status === 'cancelled').length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                        <FiX className="mr-1 h-3 w-3" />
                        {formJobs.filter(job => job.status === 'cancelled').length} cancelled
                      </span>
                    )}
                    {/* Success Rate Indicator */}
                    {formJobs.length > 1 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {(() => {
                          const total = formJobs.length;
                          const completed = formJobs.filter(job => job.status === 'completed').length;
                          const successRate = Math.round((completed / total) * 100);
                          return `${successRate}% success`;
                        })()}
                      </span>
                    )}
                  </div>
                )}
                {formJobs.length > 0 && !formJobs.some(job => job.status === 'running') && (
                  <button
                    onClick={handleClearHistory}
                    className="inline-flex items-center px-2 py-1 text-xs rounded-md text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    title="Clear completed and failed jobs"
                  >
                    <FiX className="mr-1 h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
            </h3>
            <div className="space-y-3">
              {formJobs.length === 0 ? (
                <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <FiList className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500 mb-3" />
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No Recent Jobs
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                    Start your first automation by entering a visit URL above. Your recent jobs will appear here with completion status and timing information.
                  </p>
                </div>
              ) : (
                formJobs.slice(0, 5).map((job, index) => (
                <div key={job.jobId || index} className={`bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md ${
                  job.status === 'running' ? 'border-l-4 border-blue-500' :
                  job.status === 'completed' ? 'border-l-4 border-green-500' :
                  job.status === 'error' ? 'border-l-4 border-red-500' :
                  job.status === 'cancelled' ? 'border-l-4 border-amber-500' : ''
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start flex-1">
                      <div className="flex items-center mr-3">
                        {job.status === 'running' && (
                          <div className="animate-pulse mr-2 h-3 w-3 bg-blue-500 rounded-full"></div>
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
                        
                        <div className="flex items-center justify-between">
                          {/* Single line with all information */}
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {job.storeName || (job.url ? new URL(job.url).pathname.split('/').pop() : 'Visit')}
                            </span>
                            
                            {/* Status badge */}
                            {job.status === 'error' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 font-medium">
                                Failed
                              </span>
                            )}
                            {job.status === 'cancelled' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium">
                                Cancelled
                              </span>
                            )}
                            {(job.status === 'running' || job.status === 'processing' || job.status === 'unknown') && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-medium">
                                Running
                              </span>
                            )}
                            
                            {/* Visit number with single # */}
                            {job.visitNumber && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium">
                                #{job.visitNumber}
                              </span>
                            )}
                            
                            {/* Dispenser count with gas pump icon */}
                            {job.dispenserCount && job.dispenserCount > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium">
                                <GiGasPump className="w-3 h-3 mr-1" />
                                {job.dispenserCount}
                              </span>
                            )}
                            
                            {/* Service code */}
                            {job.serviceCode && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-medium">
                                {job.serviceCode}
                              </span>
                            )}
                            
                            {/* Duration timer */}
                            {job.startTime && (
                              <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300 font-medium">
                                {(job.status === 'running' || job.status === 'processing' || job.status === 'unknown') ? (
                                  formatDuration(job.startTime, null, false)
                                ) : job.endTime ? (
                                  formatDuration(job.startTime, job.endTime, true)
                                ) : job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled' ? (
                                  formatDuration(job.startTime, Date.now(), true)
                                ) : (
                                  formatDuration(job.startTime, null, false)
                                )}
                              </span>
                            )}
                            
                            {/* Start time */}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {job.timestamp ? new Date(job.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Starting...'}
                              {job.status === 'completed' && job.timestamp && (
                                <span className="ml-1">
                                  ({(() => {
                                    const now = Date.now();
                                    const jobTime = new Date(job.timestamp).getTime();
                                    const diffMinutes = Math.floor((now - jobTime) / (1000 * 60));
                                    
                                    if (diffMinutes < 1) return 'now';
                                    if (diffMinutes < 60) return `${diffMinutes}m ago`;
                                    const diffHours = Math.floor(diffMinutes / 60);
                                    if (diffHours < 24) return `${diffHours}h ago`;
                                    const diffDays = Math.floor(diffHours / 24);
                                    return `${diffDays}d ago`;
                                  })()})
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        
                        {/* Second line for results/status when needed */}
                        {((job.status === 'completed' && (job.processedForms || job.createdForms)) || 
                          job.status === 'error' || 
                          (job.status === 'running' || job.status === 'processing' || job.status === 'unknown')) && (
                          <div className="flex items-center mt-1 text-xs">
                            {/* Completion results */}
                            {job.status === 'completed' && (job.processedForms || job.createdForms) && (
                              <div className="flex items-center gap-1">
                                {job.processedForms && (
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    {job.processedForms} processed
                                  </span>
                                )}
                                {job.createdForms && job.createdForms > 0 && (
                                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                                    {job.processedForms ? ', ' : ''}{job.createdForms} created
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Error message */}
                            {job.status === 'error' && (
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                {job.message || 'Processing failed'}
                              </span>
                            )}
                            
                            {/* Current action for running jobs */}
                            {(job.status === 'running' || job.status === 'processing' || job.status === 'unknown') && (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {job.message || job.currentStep || 'Processing...'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {/* Quick action to open URL */}
                      {job.url && (
                        <button
                          onClick={async () => {
                            try {
                              // Use our updated service to open the URL via Electron
                              const result = await openUrlWithDebugMode(job.url, false);
                              
                              if (result.success) {
                                addToast('success', 'Browser opened successfully');
                              } else {
                                addToast('error', result.error || 'Failed to open browser');
                              }
                            } catch (error) {
                              console.error('Error opening URL:', error);
                              addToast('error', error instanceof Error ? error.message : 'Failed to open browser');
                            }
                          }}
                          className="inline-flex items-center px-2 py-1 text-xs rounded-md text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                          title="Open Visit in Browser"
                        >
                          <FiExternalLink className="h-3 w-3" />
                        </button>
                      )}
                      
                      {/* Quick action to copy URL if present */}
                      {job.url && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(job.url);
                            addToast('success', 'URL copied to clipboard');
                          }}
                          className="inline-flex items-center px-2 py-1 text-xs rounded-md text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                          title="Copy URL"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Cancel button for running jobs */}
                      {(job.status === 'running' || job.status === 'processing' || job.status === 'unknown') && (
                        <button
                          onClick={() => handleCancelJob(job.jobId)}
                          className="inline-flex items-center px-2 py-1 text-xs rounded-md text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/30"
                        >
                          <FiX className="mr-1 h-3 w-3" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  
                </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SingleVisitAutomation;
