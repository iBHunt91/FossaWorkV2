// Form automation services for connecting to the backend

import { UnifiedAutomationStatus } from '../types/automationTypes';
import { buildUrl } from '../config/api';

// Helper function to make API calls
async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    const url = await buildUrl(endpoint);
    console.log(`Making API call to: ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API call error (${endpoint}):`, error);
    throw error;
  }
}

// Process a single visit
export const processSingleVisit = async (visitUrl: string, isHeadless: boolean = true, workOrderId?: string): Promise<any> => {
  console.log(`Processing single visit: ${visitUrl}, headless: ${isHeadless}, workOrderId: ${workOrderId}`);
  
  try {
    const response = await apiCall('/api/form-automation', {
      method: 'POST',
      body: JSON.stringify({
        visitUrl,
        headless: isHeadless,
        workOrderId
      }),
    });
    
    return response;
  } catch (error) {
    console.error('Error processing single visit:', error);
    throw error;
  }
};

// Process batch visits
export const processBatchVisits = async (
  filePath: string,
  isHeadless: boolean = true,
  selectedVisits: string[] = [],
  resumeFromBatchId?: string
): Promise<any> => {
  console.log(`Processing batch visits: ${filePath}, headless: ${isHeadless}, selected: ${selectedVisits.length}`);
  
  try {
    const response = await apiCall('/api/form-automation/batch', {
      method: 'POST',
      body: JSON.stringify({
        filePath,
        headless: isHeadless,
        selectedVisits,
        resumeFromBatchId
      }),
    });
    
    return response;
  } catch (error) {
    console.error('Error processing batch visits:', error);
    throw error;
  }
};

// Get status for a form automation job
export const getFormAutomationStatus = async (): Promise<any> => {
  try {
    const response = await apiCall('/api/form-automation/status');
    return response;
  } catch (error) {
    console.error('Error getting form automation status:', error);
    throw error;
  }
};

// Get batch automation status
export const getBatchAutomationStatus = async (jobId: string): Promise<any> => {
  try {
    const response = await apiCall(`/api/form-automation/batch/${jobId}/status`);
    return response;
  } catch (error) {
    console.error('Error getting batch automation status:', error);
    throw error;
  }
};

// Get unified automation status (works for both single and batch)
export const getUnifiedAutomationStatus = async (jobId: string): Promise<UnifiedAutomationStatus> => {
  try {
    const response = await apiCall(`/api/form-automation/unified-status?jobId=${jobId}`);
    console.log(`Unified status response for ${jobId}:`, response);
    
    // Debug logging for dispenserProgress
    console.log('[DEBUG] Unified status response details:', {
      jobId,
      status: response.status,
      message: response.message,
      hasDispenserProgress: !!response.dispenserProgress,
      dispenserProgressType: typeof response.dispenserProgress,
      dispenserCount: response.dispenserProgress?.dispensers?.length || 0
    });
    
    return response;
  } catch (error) {
    console.error('Error getting unified automation status:', error);
    // Return a default error status
    return {
      status: 'error',
      message: error.message || 'Failed to get status',
      completedVisits: 0,
      totalVisits: 0,
      currentVisit: '',
      currentVisitName: '',
      currentVisitStatus: '',
      dispenserCount: 0,
      dispenserCurrent: 0,
      isBatch: jobId.startsWith('batch_'),
      userId: localStorage.getItem('activeUserId') || undefined,
      dispenserProgress: null, // Include dispenserProgress to prevent undefined
    };
  }
};

// Pause a running job
export const pauseFormAutomation = async (jobId: string, reason: string = 'User requested'): Promise<any> => {
  console.log(`Pausing job: ${jobId}, reason: ${reason}`);
  
  try {
    const response = await apiCall(`/api/form-automation/pause/${jobId}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return response;
  } catch (error) {
    console.error('Error pausing form automation:', error);
    throw error;
  }
};

// Resume a paused job
export const resumeFormAutomation = async (jobId: string): Promise<any> => {
  console.log(`Resuming job: ${jobId}`);
  
  try {
    const response = await apiCall(`/api/form-automation/resume/${jobId}`, {
      method: 'POST',
    });
    return response;
  } catch (error) {
    console.error('Error resuming form automation:', error);
    throw error;
  }
};

// Cancel a form automation job
export const cancelFormAutomation = async (jobId: string): Promise<any> => {
  console.log(`Cancelling job: ${jobId}`);
  
  try {
    const response = await apiCall(`/api/form-automation/cancel/${jobId}`, {
      method: 'POST',
    });
    return response;
  } catch (error) {
    console.error('Error cancelling form automation:', error);
    throw error;
  }
};

// Open URL with debug mode
export const openUrlWithDebugMode = async (url: string): Promise<any> => {
  console.log(`Opening URL with debug mode: ${url}`);
  
  try {
    const response = await apiCall('/api/form-automation/open-debug', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    return response;
  } catch (error) {
    console.error('Error opening URL in debug mode:', error);
    throw error;
  }
};

// Get a list of all active jobs
export const getActiveJobs = async (): Promise<any[]> => {
  try {
    const response = await apiCall('/api/form-automation/active-jobs');
    return response;
  } catch (error) {
    console.error('Error getting active jobs:', error);
    return [];
  }
};

// Clear job history for a specific user
export const clearJobHistory = async (userId: string, jobType: 'single' | 'batch' | 'all'): Promise<any> => {
  console.log(`Clearing job history for user: ${userId}, type: ${jobType}`);
  
  try {
    const response = await apiCall('/api/form-automation/clear-history', {
      method: 'POST',
      body: JSON.stringify({ userId, jobType }),
    });
    return response;
  } catch (error) {
    console.error('Error clearing job history:', error);
    throw error;
  }
};