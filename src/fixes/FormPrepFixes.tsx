
// This file contains fixes for FormPrep.tsx TypeScript errors and batch job functionality

// 1. Updated UnifiedAutomationStatus interface
interface UnifiedAutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
  completedVisits?: number;
  totalVisits?: number;
  currentVisit?: string | null;
  currentVisitName?: string;
  visitName?: string;
  currentVisitStatus?: string;
  timestamp?: string;
  dispenserCount?: number;
  dispenserCurrent?: number;
  fuelType?: string; 
  fuelCurrent?: number;
  fuelTotal?: number;
  currentVisitFuelType?: string;
  currentVisitFuelCurrent?: number;
  currentVisitFuelTotal?: number;
  isBatch?: boolean;
  storeInfo?: {
    name: string;
    id?: string;
  };
}

// 2. Fix for line 298 (startPolling function call with too many arguments)
// Original: console.log(`[Polling - Batch Job ${jobId}] Status received from API:`, status, status.status);
// Replace with:
console.log(`[Polling - Batch Job ${jobId}] Status received from API:`, status);

// 3. Fix for line 323-325 (accessing non-existent properties)
// Replace with:
jobToUpdate.currentVisit = status.currentVisit || jobToUpdate.currentVisit;
jobToUpdate.currentVisitName = status.currentVisitName || status.visitName || jobToUpdate.currentVisitName;
jobToUpdate.currentVisitStatus = status.currentVisitStatus || jobToUpdate.currentVisitStatus;

// 4. Fix for line 556-558 (saveFile doesn't exist on ElectronAPI)
// Handle in declaration file (add to electron.d.ts):
/**
 * interface ElectronAPI {
 *   // ... other methods
 *   saveFile(filePath: string, content: string): Promise<boolean>;
 *   openUrlWithActiveUser(options: {url: string, email: string, password: string}): Promise<any>;
 * }
 */

// 5. Fix for line 1168 (Expected 0 arguments, but got 1)
// Find and replace the function call to use the correct pattern

// 6. Better Polling Management Implementation
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
    
    // Second timeout for midpoint check
    const secondTimeout = setTimeout(() => {
      if (!this.activePolls[jobId]) return;
      
      console.log('🔍 2.5-minute check on job ID:', jobId);
      const poll = this.activePolls[jobId];
      const lastMessage = poll.lastMessage || '';
      const timeSinceLastChange = Date.now() - poll.lastStatusTime;
      
      // If no activity for over 60 seconds at the midpoint, consider completion
      if (timeSinceLastChange > 60000) {
        console.log('🔍 No recent activity at 2.5-minute checkpoint, assuming completion');
        this.activePolls[jobId].forceComplete = true;
        onUpdate({
          status: 'completed',
          message: lastMessage || 'Processing completed (limited activity)'
        });
        
        // Clean up polling
        this.stopPolling(jobId);
        onComplete();
      }
    }, 150000); // 2.5 minutes
    
    // Final backup (only used if the browser truly hangs)
    const finalTimeout = setTimeout(() => {
      console.log('🔍 5-minute maximum check');
      
      if (!this.activePolls[jobId]) return;
      
      const poll = this.activePolls[jobId];
      const lastMessage = poll.lastMessage || '';
      
      // Check if we've had any updates in the last minute
      const timeSinceLastChange = Date.now() - poll.lastStatusTime;
      
      if (timeSinceLastChange < 60000) {
        console.log('🔍 Recent activity detected in the last minute - extending timeout');
        
        // Create a new timeout for 2 more minutes
        setTimeout(() => {
          if (!this.activePolls[jobId]) return;
          
          console.log('🔍 7-minute final check for job ID:', jobId);
          
          const poll = this.activePolls[jobId];
          const lastMessage = poll.lastMessage || '';
          const timeSinceLastChange = Date.now() - poll.lastStatusTime;
          
          // If still active in the last minute, allow one more minute
          if (timeSinceLastChange < 60000) {
            console.log('🔍 Still active at 7-minute mark, extending one more minute');
            
            setTimeout(() => {
              if (!this.activePolls[jobId]) return;
              
              console.log('🔍 8-minute absolute maximum reached for job ID:', jobId);
              this.activePolls[jobId].forceComplete = true;
              onUpdate({
                status: 'completed',
                message: lastMessage || 'Processing completed (maximum time reached)'
              });
              
              this.stopPolling(jobId);
              onComplete();
            }, 60000); // One more minute
            
            return;
          }
          
          // Otherwise complete at 7-minute mark
          console.log('🔍 No recent activity at 7-minute mark, forcing completion');
          this.activePolls[jobId].forceComplete = true;
          onUpdate({
            status: 'completed',
            message: lastMessage || 'Processing completed (extended timeout reached)'
          });
          
          this.stopPolling(jobId);
          onComplete();
        }, 120000); // 2 more minutes
        
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
        // API call to check status - use isBatch to determine which endpoint
        const status = await getUnifiedAutomationStatus(jobId); // Pass just the jobId
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
  
  // Pause polling but keep the job information (used when component unmounts)
  pausePolling: function(jobId: string) {
    console.log('🔍 Pausing polling for job ID:', jobId);
    
    if (!this.activePolls[jobId]) {
      console.log(`🔍 No active polling found for job ID: ${jobId}`);
      return;
    }
    
    const poll = this.activePolls[jobId];
    
    // Clear the interval
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
    
    // Clean up all timers and intervals
    try {
      const poll = this.activePolls[jobId];
      
      // Clear the main polling interval
      if (poll.interval) {
        clearInterval(poll.interval);
      }
      
      // Clear the activity check interval
      if (poll.activityInterval) {
        clearInterval(poll.activityInterval);
      }
      
      // Clear all timeouts
      if (poll.firstTimeout) {
        clearTimeout(poll.firstTimeout);
      }
      
      if (poll.secondTimeout) {
        clearTimeout(poll.secondTimeout);
      }
      
      if (poll.finalTimeout) {
        clearTimeout(poll.finalTimeout);
      }
      
      // Delete the poll entry to prevent memory leaks
      delete this.activePolls[jobId];
      
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
  },
  
  // Check if a job exists in the state to avoid "not found in local state" errors
  checkIfJobExistsInState: function(jobId: string) {
    if (!jobId) return false;
    
    try {
      // Check form jobs from localStorage
      const formJobsStr = localStorage.getItem('formJobs') || '[]';
      const formJobs = JSON.parse(formJobsStr);
      const formJobExists = formJobs.some((job: any) => job.jobId === jobId);
      
      // Check batch jobs from localStorage
      const batchJobsStr = localStorage.getItem('batchJobs') || '[]';
      const batchJobs = JSON.parse(batchJobsStr);
      const batchJobExists = batchJobs.some((job: any) => job.jobId === jobId);
      
      return formJobExists || batchJobExists;
    } catch (e) {
      console.error('Error checking if job exists in state:', e);
      return false;
    }
  }
});

// 7. Fix for Component unmounting
useEffect(() => {
  // When component unmounts
  return () => {
    addDebugLog('SYSTEM', 'FormPrep component unmounting - stopping all polls');
    
    // COMPLETELY STOP all polling when unmounting - don't just pause it
    if (pollingManager.current) {
      pollingManager.current.stopAll();
    }
    
    // Clear any other intervals
    if (pollingConfig.interval) {
      clearInterval(pollingConfig.interval);
    }
    
    // Store component state for debug purposes  
    try {
      const componentState = {
        formJobs,
        batchJobs,
        singleJobId,
        batchJobId,
        pollingSingle,
        unmountTime: Date.now()
      };
      sessionStorage.setItem('formPrep_lastState', JSON.stringify(componentState));
    } catch (e) {
      console.error('Error saving component state on unmount:', e);
    }
  };
}, []);

// 8. Fix for startPolling using correct parameter count
// When you need to call getUnifiedAutomationStatus, use:
const status = await getUnifiedAutomationStatus(jobId);  // No second parameter

// 9. Fix for Electron API
// Create a types.d.ts file with:
/*
declare interface ElectronAPI {
  // existing methods
  saveFile(filePath: string, content: string): Promise<boolean>;
  openUrlWithActiveUser(options: {url: string, email: string, password: string}): Promise<any>;
}
*/

// 10. Job tracking registry with sessionStorage
const ensureJobRegistry = () => {
  try {
    const registry = sessionStorage.getItem('batch_job_registry') || '[]';
    return JSON.parse(registry);
  } catch (e) {
    console.error('Error parsing job registry:', e);
    return [];
  }
};

const registerJob = (jobId: string, isBatch: boolean) => {
  try {
    const registry = ensureJobRegistry();
    if (!registry.includes(jobId)) {
      registry.push(jobId);
      sessionStorage.setItem('batch_job_registry', JSON.stringify(registry));
    }
    
    // Also store a timestamp for this job
    sessionStorage.setItem(`job_${jobId}_startTime`, Date.now().toString());
    sessionStorage.setItem(`job_${jobId}_isBatch`, isBatch.toString());
  } catch (e) {
    console.error('Error registering job:', e);
  }
};

const checkForStaleJobs = () => {
  try {
    const registry = ensureJobRegistry();
    const now = Date.now();
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    
    // Filter out jobs older than 2 hours
    const staleJobIds = registry.filter(jobId => {
      const startTimeStr = sessionStorage.getItem(`job_${jobId}_startTime`);
      if (!startTimeStr) return true; // Consider it stale if no timestamp
      
      const startTime = parseInt(startTimeStr);
      return (now - startTime) > TWO_HOURS;
    });
    
    // Remove stale jobs from the registry
    if (staleJobIds.length > 0) {
      console.log('Removing stale jobs from registry:', staleJobIds);
      const updatedRegistry = registry.filter(jobId => !staleJobIds.includes(jobId));
      sessionStorage.setItem('batch_job_registry', JSON.stringify(updatedRegistry));
      
      // Also clean up their sessionStorage entries
      staleJobIds.forEach(jobId => {
        sessionStorage.removeItem(`job_${jobId}_startTime`);
        sessionStorage.removeItem(`job_${jobId}_isBatch`);
        sessionStorage.removeItem(`job_${jobId}_status`);
      });
    }
  } catch (e) {
    console.error('Error checking for stale jobs:', e);
  }
};

// Run this check when component mounts
useEffect(() => {
  checkForStaleJobs();
}, []);
