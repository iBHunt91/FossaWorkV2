// Add this to your component to fix polling issues

// Component unmounting fix - use in useEffect
useEffect(() => {
  // When component unmounts
  return () => {
    // IMPORTANT: Use stopAll() instead of pauseAll() to completely stop all polling
    addDebugLog('SYSTEM', 'FormPrep component unmounting - stopping all polls');
    
    if (pollingManager.current) {
      pollingManager.current.stopAll();
    }
    
    // Clear any other intervals
    if (pollingConfig.interval) {
      clearInterval(pollingConfig.interval);
    }
  };
}, []);

// Job existence check to prevent "polling anomaly" errors
const checkIfJobExistsInState = (jobId: string) => {
  if (!jobId) return false;
  
  try {
    // Check if job exists in formJobs
    const formJobExists = formJobs.some(job => job.jobId === jobId);
    
    // Check if job exists in batchJobs
    const batchJobExists = batchJobs.some(job => job.jobId === jobId);
    
    return formJobExists || batchJobExists;
  } catch (e) {
    console.error('Error checking if job exists in state:', e);
    return false;
  }
};

// Update your startPollingJob function to check if job exists
const startPollingJob = (jobId: string, isBatch: boolean) => {
  // Add this check at the beginning of the function
  if (!checkIfJobExistsInState(jobId)) {
    console.log(`[DEBUG ${isBatch ? 'BATCH' : 'SINGLE'}] Job ID ${jobId} not found in local state, skipping polling`);
    return; // Don't start polling for jobs not in state
  }
  
  // Rest of your existing startPollingJob function...
};
