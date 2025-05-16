/**
 * Service for interacting with the form automation API
 */
import { ENDPOINTS } from '../config/api';

/**
 * Interface for form automation status response
 */
export interface FormAutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
  jobId?: string;
  timestamp?: string;
  visitId?: string;
  visitName?: string;
  dispenserCount?: number;
  dispenserCurrent?: number;
  fuelType?: string;
  fuelCurrent?: number;
  fuelTotal?: number;
}

/**
 * Interface for batch automation status response
 */
export interface BatchAutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
  completedVisits?: number;
  totalVisits?: number;
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
  jobId?: string;
}

/**
 * A unified automation status interface that works for both single and batch jobs
 */
export interface UnifiedAutomationStatus {
  // Common fields
  jobId: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
  timestamp?: string;
  startTime?: string;
  endTime?: string;
  
  // Single visit-specific fields
  visitId?: string;
  visitName?: string;
  
  // Current element progress (applies to dispensers or visits)
  currentItem?: number;
  totalItems?: number;
  
  // Dispenser-specific progress
  dispenserCount?: number;
  dispenserCurrent?: number;
  
  // Fuel-specific progress
  fuelType?: string;
  fuelCurrent?: number;
  fuelTotal?: number;
  
  // Batch-specific fields
  completedVisits?: number;
  totalVisits?: number;
  currentVisit?: string;
  currentVisitStatus?: string;
  completedVisitIds?: string[];
  
  // For UI notifications
  _statusChanged?: boolean;
  _completed?: boolean;
  _error?: boolean;
}

/**
 * Process a single Fossa visit form
 */
export const processSingleVisit = async (
  visitUrl: string, 
  headless: boolean,
  workOrderId?: string
): Promise<{ success: boolean, message: string, jobId: string }> => {
  const url = await ENDPOINTS.FORM_AUTOMATION();
  
  // Log url for debugging
  console.log('Automating form for URL:', visitUrl);
  
  try {
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
      // Try to get error details from the response
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
      } catch (parseError) {
        // If we can't parse the response, throw a generic error
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error processing form:', error);
    throw error;
  }
};

/**
 * Get the current status of a form automation process
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
 * Get automation status for either single or batch jobs using a unified interface
 * @param {string} jobId - The job ID to check
 * @param {boolean} isBatch - Whether this is a batch job or single visit
 * @returns {Promise<UnifiedAutomationStatus>}
 */
export const getUnifiedAutomationStatus = async (jobId: string, isBatch: boolean): Promise<UnifiedAutomationStatus> => {
  try {
    // Call the appropriate API based on job type
    if (isBatch) {
      const batchStatus = await getBatchAutomationStatus(jobId);
      
      // Extract fuel type information from message if not directly available
      let enhancedFuelType = batchStatus.fuelType;
      let enhancedFuelCurrent = batchStatus.fuelCurrent;
      let enhancedFuelTotal = batchStatus.fuelTotal;
      
      if (batchStatus.currentVisitStatus && (!enhancedFuelType || !enhancedFuelTotal)) {
        const fuelRegex = /(?:fuel\s+(?:type|grade):\s+)([a-z\-\s]+)(?:[^(]*)\(?(\d+)\/(\d+)\)?/i;
        const fuelMatch = batchStatus.currentVisitStatus.match(fuelRegex);
        
        if (fuelMatch && fuelMatch[1] && fuelMatch[2] && fuelMatch[3]) {
          enhancedFuelType = fuelMatch[1].trim();
          enhancedFuelCurrent = parseInt(fuelMatch[2]);
          enhancedFuelTotal = parseInt(fuelMatch[3]);
        }
      }
      
      // Enhanced dispenser progress extraction
      let enhancedDispenserCount = batchStatus.dispenserCount;
      let enhancedDispenserCurrent = batchStatus.dispenserCurrent;
      
      if (batchStatus.currentVisitStatus && (!enhancedDispenserCount || !enhancedDispenserCurrent)) {
        // Try to extract from status message
        const dispenserRegex = /(?:dispenser|form)[:\s]+#?(\d+)(?:\s*(?:of|\/)\s*(\d+))?/i;
        const dispenserMatch = batchStatus.currentVisitStatus.match(dispenserRegex);
        
        if (dispenserMatch && dispenserMatch[1]) {
          enhancedDispenserCurrent = parseInt(dispenserMatch[1]);
          if (dispenserMatch[2]) {
            enhancedDispenserCount = parseInt(dispenserMatch[2]);
          }
        }
      }
      
      // Map batch status to unified format with enhanced values
      return {
        jobId: jobId,
        status: batchStatus.status,
        message: batchStatus.message || '',
        timestamp: batchStatus.timestamp,
        startTime: batchStatus.startTime,
        endTime: batchStatus.endTime,
        
        // Batch-specific fields
        completedVisits: batchStatus.completedVisits,
        totalVisits: batchStatus.totalVisits,
        currentVisit: batchStatus.currentVisit || undefined,
        currentVisitStatus: batchStatus.currentVisitStatus,
        completedVisitIds: batchStatus.completedVisitIds,
        
        // Progress tracking
        currentItem: batchStatus.completedVisits,
        totalItems: batchStatus.totalVisits,
        
        // Enhanced dispenser progress
        dispenserCount: enhancedDispenserCount,
        dispenserCurrent: enhancedDispenserCurrent,
        
        // Enhanced fuel progress
        fuelType: enhancedFuelType,
        fuelCurrent: enhancedFuelCurrent,
        fuelTotal: enhancedFuelTotal
      };
    } else {
      const singleStatus = await getFormAutomationStatus();
      
      // Map single visit status to unified format
      return {
        jobId: jobId, // Use the provided jobId since the API might not return it
        status: singleStatus.status,
        message: singleStatus.message,
        timestamp: singleStatus.timestamp,
        
        // Single visit-specific fields
        visitId: singleStatus.visitId,
        visitName: singleStatus.visitName,
        
        // Dispenser progress
        dispenserCount: singleStatus.dispenserCount,
        dispenserCurrent: singleStatus.dispenserCurrent,
        
        // Fuel progress
        fuelType: singleStatus.fuelType,
        fuelCurrent: singleStatus.fuelCurrent,
        fuelTotal: singleStatus.fuelTotal,
        
        // Map dispenser progress to generic progress fields
        currentItem: singleStatus.dispenserCurrent,
        totalItems: singleStatus.dispenserCount
      };
    }
  } catch (error) {
    console.error(`Error getting unified status for ${isBatch ? 'batch' : 'single'} job ${jobId}:`, error);
    // Return an error status
    return {
      jobId: jobId,
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get automation status'
    };
  }
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