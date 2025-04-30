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
  totalVisits: number;
  completedVisits: number;
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
  headless: boolean
): Promise<{ message: string, jobId: string }> => {
  const url = await ENDPOINTS.FORM_AUTOMATION_BATCH();
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filePath,
      headless
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
export const getBatchAutomationStatus = async (): Promise<BatchAutomationStatus> => {
  const url = await ENDPOINTS.FORM_AUTOMATION_BATCH_STATUS();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to get batch automation status');
  }

  return response.json();
};

/**
 * Cancel an ongoing form automation job
 */
export const cancelFormAutomation = async (jobId: string): Promise<{ success: boolean, message: string }> => {
  const url = await ENDPOINTS.FORM_AUTOMATION_CANCEL();
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jobId
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to cancel form automation');
  }

  return response.json();
}; 