/**
 * Service for interacting with the form automation API
 */
import { ENDPOINTS } from '../config/api';

// Types
export interface FormAutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
}

export interface BatchAutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
  completedVisits: number;
  totalVisits: number;
  currentVisit?: string | null;
  currentVisitStatus?: string;
  timestamp?: string;
  dispenserCount?: number;
  dispenserCurrent?: number;
  fuelType?: string;
  fuelCurrent?: number;
  fuelTotal?: number;
  storeInfo?: {
    name: string;
    id?: string;
  };
  // Additional properties needed for the polling logic
  lastUpdated?: string;
  lastStatusUpdate?: string;
  currentItem?: number;
  totalItems?: number;
  progress?: number;
  startTime?: string;
  endTime?: string;
  completedVisitIds?: string[];
}

/**
 * Process a single Fossa visit
 */
export const processSingleVisit = async (
  visitUrl: string, 
  headless: boolean,
  workOrderId?: string
): Promise<{ success: boolean, message: string, jobId: string }> => {
  const url = await ENDPOINTS.FORM_AUTOMATION();
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      visitUrl,
      headless,
      workOrderId
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to process visit');
  }

  const result = await response.json();
  
  // Ensure we always have a jobId, even if the server doesn't provide one
  if (!result.jobId) {
    console.warn('Server did not provide a jobId, generating a client-side fallback ID');
    result.jobId = `client-${Date.now()}`;
  }
  
  return { ...result, success: true };
};

/**
 * Get the current status of a form automation job
 */
export const getFormAutomationStatus = async (): Promise<FormAutomationStatus> => {
  const url = await ENDPOINTS.FORM_AUTOMATION_STATUS();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to get form automation status');
  }

  return response.json();
};

/**
 * Process a batch of Fossa visits
 */
export const processBatchVisits = async (
  filePath: string,
  headless: boolean,
  options?: { selectedVisits?: string[] | null; resumeFromBatchId?: string }
): Promise<{ message: string, jobId: string }> => {
  const url = await ENDPOINTS.FORM_AUTOMATION_BATCH();
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filePath,
      headless,
      selectedVisits: options?.selectedVisits,
      resumeFromBatchId: options?.resumeFromBatchId
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to process batch');
  }

  return response.json();
};

/**
 * Get the current status of a batch automation job
 */
export const getBatchAutomationStatus = async (jobId: string): Promise<BatchAutomationStatus> => {
  const url = await ENDPOINTS.FORM_AUTOMATION_BATCH_STATUS(jobId);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to get batch automation status');
  }

  return response.json();
};

/**
 * Cancel an active form automation process
 * @param {string} jobId - The job ID to cancel
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const cancelFormAutomation = async (jobId: string): Promise<{success: boolean, message: string}> => {
  try {
    console.log(`Requesting cancellation of job ID: ${jobId}`);
    const endpoint = await ENDPOINTS.FORM_AUTOMATION_CANCEL();
  
    // Log the job ID for debugging
    console.log(`Sending cancellation request to ${endpoint} for job ID: ${jobId}`);
    
    const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
      body: JSON.stringify({ jobId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
      console.error(`Server returned error on cancellation: ${errorData.error || response.statusText}`);
      return { 
        success: false, 
        message: errorData.error || `Server error: ${response.status} ${response.statusText}` 
      };
    }
    
    const data = await response.json();
    
    // If the server explicitly returns success: false, respect that
    if (data && data.success === false) {
      console.error(`Cancellation failed: ${data.message || 'Unknown error'}`);
      return { 
        success: false, 
        message: data.message || 'Failed to cancel automation' 
      };
  }

    // The server should have properly verified cancellation, so we can trust its response
    console.log(`Cancellation result: ${JSON.stringify(data)}`);
    return { 
      success: true, 
      message: data.message || 'Automation cancelled successfully' 
    };
  } catch (error) {
    console.error('Error cancelling form automation:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to cancel form automation' 
    };
  }
};

export const openUrlWithDebugMode = async (url: string) => {
  try {
    // Use the electron API to open the URL with login, explicitly setting debug mode
    // @ts-ignore (electron is defined in the preload script)
    const result = await window.electron.openUrlWithLogin(url, { isDebugMode: true });
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to open URL in debug mode');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error opening URL in debug mode:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}; 