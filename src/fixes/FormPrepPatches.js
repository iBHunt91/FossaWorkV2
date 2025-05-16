/**
 * COMPREHENSIVE FIXES FOR FORMPREP.TSX
 * ===================================
 * This file contains all the fixes needed for your FormPrep.tsx TypeScript errors
 * and batch job functionality issues.
 */

/**
 * FIX 1: FUNCTION CALL ARGUMENTS
 * ------------------------------
 * Location: Around line 298
 * Error: Expected 0 arguments, but got 2
 * 
 * Find:
 * const status = await getUnifiedAutomationStatus(jobId, isBatch);
 * 
 * Replace with:
 * const status = await getUnifiedAutomationStatus(jobId);
 */

/**
 * FIX 2: LINE 323-332 PROPERTY ACCESS
 * ----------------------------------
 * These errors are all related to accessing properties that don't exist on UnifiedAutomationStatus
 * 
 * Find (around line 323-332):
 * jobToUpdate.currentVisit = status.currentVisit || jobToUpdate.currentVisit;
 * jobToUpdate.currentVisitName = status.visitName || jobToUpdate.currentVisitName;
 * jobToUpdate.currentVisitStatus = status.currentVisitStatus || jobToUpdate.currentVisitStatus;
 * jobToUpdate.formsTotal = status.dispenserCount || jobToUpdate.formsTotal;
 * jobToUpdate.formsCurrent = status.dispenserCurrent || jobToUpdate.formsCurrent;
 * jobToUpdate.currentVisitFuelType = status.fuelType || jobToUpdate.currentVisitFuelType;
 * jobToUpdate.currentVisitFuelCurrent = status.fuelCurrent || jobToUpdate.currentVisitFuelCurrent;
 * jobToUpdate.currentVisitFuelTotal = status.fuelTotal || jobToUpdate.currentVisitFuelTotal;
 * 
 * The properties are actually correct, but the UnifiedAutomationStatus interface needs to be updated.
 * You've already added the missing properties to the automationTypes.ts file. Ensure that file is
 * imported in FormPrep.tsx or wherever UnifiedAutomationStatus is being used.
 */

/**
 * FIX 3: ELECTRON API METHODS
 * ---------------------------
 * Location: Line 556-558, 2710-2712
 * Error: Property 'saveFile'/'openUrlWithActiveUser' does not exist on type 'ElectronAPI'
 * 
 * The type definitions have been added to src/types/electron.d.ts. Make sure this file
 * is properly included in your TypeScript compilation.
 */

/**
 * FIX 4: LINE 1168 FUNCTION CALL
 * ------------------------------
 * Location: Line 1168
 * Error: Expected 0 arguments, but got 1
 * 
 * Find a function call at line 1168 that's passing an argument when it shouldn't.
 * Remove the argument from the function call.
 */

/**
 * FIX 5: POLLING MANAGEMENT
 * ------------------------
 * Replace the existing pollingManager implementation with this improved version
 * that properly cleans up resources and prevents polling anomalies.
 */

// Replace your current pollingManager implementation with this one:
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
        // API call to check status - FIXED: removed the isBatch parameter
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
      const formJobExists = formJobs.some(job => job.jobId === jobId);
      
      // Check batch jobs array
      const batchJobExists = batchJobs.some(job => job.jobId === jobId);
      
      return formJobExists || batchJobExists;
    } catch (e) {
      console.error('Error checking if job exists in state:', e);
      return false;
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
  }
});

/**
 * FIX 6: COMPONENT UNMOUNTING
 * --------------------------
 * Find the useEffect for component unmounting and replace it with this one:
 */

// Find the useEffect that has this cleanup function (likely containing "pauseAll")
useEffect(() => {
  // Your existing component initialization code here
  
  return () => {
    addDebugLog('SYSTEM', 'FormPrep component unmounting - stopping all polls');
    
    // COMPLETELY STOP all polling when unmounting - don't just pause it
    if (pollingManager.current) {
      pollingManager.current.stopAll(); // Changed from pauseAll to stopAll
    }
    
    // Clear any other intervals
    if (pollingConfig.interval) {
      clearInterval(pollingConfig.interval);
    }
  };
}, []);

/**
 * APPLICATION INSTRUCTIONS
 * -----------------------
 * 1. Ensure you've added the UnifiedAutomationStatus interface to src/types/automationTypes.ts
 * 2. Ensure you've added the ElectronAPI type definitions to src/types/electron.d.ts
 * 3. Update any function calls with incorrect arguments
 * 4. Replace your pollingManager implementation with the improved version
 * 5. Replace your component unmounting useEffect with the improved version that stops all polls
 */
