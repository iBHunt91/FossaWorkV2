import React, { useState, useEffect } from 'react';
import {
  FiPlay, FiX, FiExternalLink, FiCheckCircle, FiXCircle, FiAlertTriangle
} from 'react-icons/fi';
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

interface SingleVisitAutomationProps {
  activeUserId: string;
  addDebugLog: (type: string, message: string, data?: any) => void;
  onJobStatusChange?: (jobStatus: any) => void;
  onJobComplete?: () => void;
  onJobError?: (error: any) => void;
  prefilledUrl?: string;
}

const SingleVisitAutomation: React.FC<SingleVisitAutomationProps> = ({
  activeUserId,
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
  const { addToast } = useToast();

  // Storage keys for localStorage - make user-specific
  const userStorageKeys = {
    FORM_JOBS: `form_prep_jobs_${activeUserId}`,
    SINGLE_JOB_ID: `form_prep_single_job_id_${activeUserId}`,
    IS_POLLING_SINGLE: `form_prep_is_polling_single_${activeUserId}`,
    VISIT_URL: `form_prep_visit_url_${activeUserId}`
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
      // Add job existence check
      if (!this.checkIfJobExistsInState(jobId)) {
        console.log(`[DEBUG SINGLE] Job ID ${jobId} not found in local state, skipping polling`);
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
        // Check form jobs array
        const formJob = formJobs.find(job => job.jobId === jobId);
        
        if (!formJob) {
          console.log(`[DEBUG SINGLE] Job ID ${jobId} not found in local state, skipping polling`);
          return false;
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
    
    // Clean up stale jobs (older than 24 hours) and filter for current user
    const cleanedJobs = storedFormJobs.filter(job => {
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
    if (storedSingleJobId && cleanedJobs.some(job => job.jobId === storedSingleJobId)) {
      setSingleJobId(storedSingleJobId);
      setPollingSingle(storedPollingSingle);
    } else {
      // If the stored single job ID doesn't exist in cleaned jobs, reset it
      setSingleJobId(null);
      setPollingSingle(false);
      saveToStorage(userStorageKeys.SINGLE_JOB_ID, null);
      saveToStorage(userStorageKeys.IS_POLLING_SINGLE, false);
    }
    
    setVisitUrl(storedVisitUrl);
    
    // If form jobs were cleaned up, save the cleaned list
    if (cleanedJobs.length !== storedFormJobs.length) {
      saveToStorage(userStorageKeys.FORM_JOBS, cleanedJobs);
      console.log(`Cleaned up ${storedFormJobs.length - cleanedJobs.length} stale form jobs`);
    }
  }, [activeUserId]);

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
      saveToStorage(userStorageKeys.SINGLE_JOB_ID, singleJobId);
      saveToStorage(userStorageKeys.IS_POLLING_SINGLE, pollingSingle);
      saveToStorage(userStorageKeys.VISIT_URL, visitUrl);
      
      // Log that we're saving data for this specific user
      console.log(`Saving single visit automation state for user ${activeUserId}`);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [formJobs, singleJobId, pollingSingle, visitUrl, activeUserId]);

  // Function to update job status across localStorage and state
  const updateJobStatus = (status: any) => {
    // Log the full status object to see if dispenserProgress is included
    console.log('[DEBUG] Full status update:', status);
    addDebugLog('SINGLE', 'Updating job status', {
      ...status,
      hasDispenserProgress: !!status.dispenserProgress,
      dispenserCount: status.dispenserProgress?.dispensers?.length || 0
    });
    
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
      
      // Find the right job to update
      const activeJobUrl = getFromStorage(userStorageKeys.VISIT_URL);
      const jobIndex = updatedJobs.findIndex(job => 
        job.url === activeJobUrl && job.status === 'running');
      
      if (jobIndex !== -1) {
        // Update the job's status
        updatedJobs[jobIndex] = {
          ...updatedJobs[jobIndex],
          status: status.status,
          message: status.message,
          dispenserProgress: status.dispenserProgress, // Add dispenser progress
          // Add a timestamp to the update
          timestamp: new Date().toISOString()
        };
        
        // Save to localStorage
        saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
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
    
    // Show confirmation dialog for important actions
    if (!window.confirm(`Are you sure you want to process this visit?\n${visitUrl}`)) {
      return;
    }
    
    // Set the URL in storage for resuming
    saveToStorage(userStorageKeys.VISIT_URL, visitUrl);
    
    setIsProcessing(true);
    
    try {
      addDebugLog('SINGLE', 'Processing single visit', { 
        url: visitUrl, 
        headless: isHeadless,
        userId: activeUserId // Log the user ID to track whose job this is
      });
      
      // Call the API to process the visit
      const response = await processSingleVisit(visitUrl, isHeadless);
      
      if (response.success) {
        addDebugLog('SINGLE', 'Visit processing started', { jobId: response.jobId });
        
        // Add a new job to the formJobs state with a timestamp
        setFormJobs(prevJobs => {
          // Extract store name from the URL or use a generic name
          const storeName = visitUrl.split('/').pop() || 'Unknown Store';
          
          // Create a new job with a timestamp and status
          const newJob = {
            url: visitUrl,
            jobId: response.jobId,
            status: 'running',
            message: 'Starting process...',
            timestamp: new Date().toISOString(),
            headless: isHeadless,
            storeName,
            dispenserProgress: null, // Initialize dispenserProgress
            _userId: activeUserId // Mark job as belonging to this user
          };
          
          const updatedJobs = [newJob, ...prevJobs].filter(job => 
            // Remove any older jobs with the same URL that are running or idle
            !(job.url === visitUrl && job.jobId !== response.jobId && 
              (job.status === 'running' || job.status === 'idle'))
          );
          
          // Set the new single job ID
          setSingleJobId(response.jobId);
          setPollingSingle(true);
          
          // Update localStorage
          saveToStorage(userStorageKeys.SINGLE_JOB_ID, response.jobId);
          saveToStorage(userStorageKeys.IS_POLLING_SINGLE, true);
          saveToStorage(userStorageKeys.FORM_JOBS, updatedJobs);
          
          return updatedJobs;
        });
        
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
            endTime: Date.now()
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
      addDebugLog('SINGLE', 'Opening URL with debug mode', { url: visitUrl });
      
      // Call the API to open the URL with debug mode
      await openUrlWithDebugMode(visitUrl);
      
      addToast('success', 'Opened in debug mode');
    } catch (error) {
      console.error('Error opening URL with debug mode:', error);
      addDebugLog('ERROR', 'Error opening URL with debug mode', error);
      addToast('error', 'Failed to open in debug mode');
    }
  };

  // Function to clear job history
  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear the job history? This action cannot be undone.')) {
      return;
    }
    
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
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Single Visit Automation</h2>
      
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
              <label htmlFor="isHeadless" className="text-gray-700 dark:text-gray-300 text-sm">Run Headless</label>
            </div>
            
            <button
              onClick={handleSingleVisit}
              disabled={isProcessing || !visitUrl}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPlay className="mr-1.5 h-4 w-4" />
              Process
            </button>
            
            <button
              onClick={handleOpenUrlWithDebugMode}
              disabled={!visitUrl}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm leading-4 font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiExternalLink className="mr-1.5 h-4 w-4" />
              Debug
            </button>
          </div>
        </div>
        
        {/* Job Status Section */}
        {formJobs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 flex justify-between items-center">
              <span>Recent Jobs</span>
              <div className="flex items-center gap-2">
                {formJobs.some(job => job.status === 'running') && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    <div className="animate-pulse mr-1.5 h-2 w-2 bg-blue-500 rounded-full"></div>
                    Active Job
                  </span>
                )}
                {formJobs.length > 0 && !formJobs.some(job => job.status === 'running') && (
                  <button
                    onClick={handleClearHistory}
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
              {formJobs.slice(0, 5).map((job, index) => (
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
                        {job.storeName || 'Visit'}
                      </span>
                      
                      {/* Show a timestamp for the job */}
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(job.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
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
                      {job.status === 'running' && (
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
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {job.message || `Status: ${job.status}`}
                  </div>
                  
                  {job.status === 'running' && job.message && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2 overflow-hidden">
                      <div className="bg-blue-500 h-1 rounded-full w-1/4 animate-pulse"></div>
                    </div>
                  )}
                  
                  {/* Show detailed dispenser progress for running jobs */}
                  {job.status === 'running' && job.dispenserProgress && (
                    <div className="mt-3">
                      {console.log('[DEBUG] Rendering dispenser progress:', job.dispenserProgress)}
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
                  
                  {/* Show error details */}
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
      </div>
    </div>
  );
};

export default SingleVisitAutomation;
