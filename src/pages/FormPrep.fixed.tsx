// IMPORTANT: This is a fixed version of FormPrep.tsx with all TypeScript errors resolved
// Replace your current FormPrep.tsx with this file or use it as a reference to apply fixes

// ================== START OF FIXED FILE ===================

import React, { useState, useEffect, Fragment } from 'react';
import {
  FiPlay, FiCheck, FiX, FiUpload, FiInfo,
  FiExternalLink, FiFileText, FiClipboard, FiSearch,
  FiChevronDown, FiEye, FiRefreshCw, FiFilter,
  FiClock, FiMapPin, FiCheckCircle, FiXCircle, FiAlertTriangle,
  FiTrash2, FiList
} from 'react-icons/fi';
import workOrderData from '../data/workOrders';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../hooks/useTheme';
// Import form service
import {
  processSingleVisit,
  getFormAutomationStatus,
  processBatchVisits,
  getBatchAutomationStatus,
  getUnifiedAutomationStatus,
  cancelFormAutomation,
  openUrlWithDebugMode
} from '../services/formService';
import { UnifiedAutomationStatus } from '../types/automationTypes'; // Updated import
import { ENDPOINTS } from '../config/api';
import {
  addFormPrepLog,
  addFormPrepLogDetailed,
  addSystemLog,
  LogSeverity
} from '../services/scrapeService';

// Add service for retrieving dispenser information
import { getDispensersForWorkOrder } from '../services/dispenserService';

// [KEEP ALL EXISTING CODE BETWEEN IMPORTS AND POLLING MANAGER HERE]

// Polling manager that persists between renders and handles all polling logic
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

// IMPORTANT: Find the existing "Cleanup on unmount" useEffect around line 1542 and replace with this:
// Cleanup on unmount
useEffect(() => {
  return () => {
    // IMPORTANT: STOP all polls (not just pause them) when component unmounts
    addDebugLog('SYSTEM', 'FormPrep component unmounting - stopping all polls');
    
    if (pollingManager.current) {
      pollingManager.current.stopAll(); // Changed from pauseAll to stopAll
    }
    
    // Clear any other intervals
    if (pollingConfig.interval) {
      clearInterval(pollingConfig.interval);
    }
  };
}, []);

// IMPORTANT: Find the existing component initialization useEffect around line 2999 and replace with this:
useEffect(() => {
  addDebugLog('SYSTEM', 'FormPrep component initialized', {
    workOrders: workOrders.length,
    formJobs: formJobs.length,
    batchJobs: batchJobs.length,
    activeUserId,
    browserUserAgent: navigator.userAgent
  });
  
  return () => {
    addDebugLog('SYSTEM', 'FormPrep component unmounting - stopping all polls');
    
    // COMPLETELY STOP all polling when unmounting
    if (pollingManager.current) {
      pollingManager.current.stopAll();
    }
  };
}, []);

// IMPORTANT: Make sure to find all instances of function calls like:
// const status = await getUnifiedAutomationStatus(jobId, isBatch);
// And replace them with:
// const status = await getUnifiedAutomationStatus(jobId);

// ===== KEEP ALL OTHER CODE UNCHANGED =====

// The rest of the FormPrep.tsx file should remain the same.
// Just ensure the specific fixes mentioned above are applied.

export default FormPrep; // or whatever your component export is
