/**
 * Service for interacting with the job scraping API
 */
import { ENDPOINTS } from '../config/api';

// Types
export interface ScrapeStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  message: string;
  error: string | null;
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

export interface LogsResponse {
  logs: LogEntry[];
}

/**
 * Start a new scrape job
 */
export const startScrapeJob = async (): Promise<{ message: string }> => {
  // First check if a job is already running
  try {
    const status = await getScrapeStatus();
    if (status.status === 'running') {
      throw new Error('A scrape job is already running. Please wait for it to complete.');
    }
  } catch (error) {
    // If the error is due to not being able to get status, proceed with the start attempt
    if (!(error instanceof Error && error.message.includes('Failed to get scrape status'))) {
      throw error;
    }
  }

  const url = await ENDPOINTS.SCRAPE();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to start scrape job');
  }

  return response.json();
};

/**
 * Get the current status of the scrape job
 */
export const getScrapeStatus = async (): Promise<ScrapeStatus> => {
  const url = await ENDPOINTS.SCRAPE_STATUS();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to get scrape status');
  }

  return response.json();
};

/**
 * Start a new dispenser scrape job
 */
export const startDispenserScrapeJob = async (): Promise<{ message: string }> => {
  // First check if a job is already running
  try {
    const status = await getDispenserScrapeStatus();
    if (status.status === 'running') {
      throw new Error('A dispenser scrape job is already running. Please wait for it to complete.');
    }
  } catch (error) {
    // If the error is due to not being able to get status, proceed with the start attempt
    if (!(error instanceof Error && error.message.includes('Failed to get dispenser scrape status'))) {
      throw error;
    }
  }

  const url = await ENDPOINTS.DISPENSER_SCRAPE();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ skipExisting: true })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to start dispenser scrape job');
  }

  return response.json();
};

/**
 * Get the current status of the dispenser scrape job
 */
export const getDispenserScrapeStatus = async (): Promise<ScrapeStatus> => {
  const url = await ENDPOINTS.DISPENSER_STATUS();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to get dispenser scrape status');
  }

  return response.json();
};

/**
 * Clear dispenser data for a specific store
 */
export const clearDispenserData = async (storeId: string): Promise<{ message: string }> => {
  const url = await ENDPOINTS.CLEAR_DISPENSER();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ storeId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to clear dispenser data');
  }

  return response.json();
};

/**
 * Force rescrape of dispenser data for a specific store
 */
export const forceRescrapeDispenserData = async (storeId: string): Promise<{ message: string }> => {
  const url = await ENDPOINTS.FORCE_RESCRAPE_DISPENSER();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ storeId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to force rescrape dispenser data');
  }

  return response.json();
};

/**
 * Get the logs for a specific job type
 */
export const getScrapeLogs = async (type: 'workOrder' | 'dispenser'): Promise<LogEntry[]> => {
  const url = await ENDPOINTS.SCRAPE_LOGS(type);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to get logs for ${type}`);
  }

  const data: LogsResponse = await response.json();
  return data.logs;
};

/**
 * Check and update both work order and dispenser scrape statuses
 * @returns Object containing both status objects
 */
export const checkAllScrapeStatus = async (): Promise<{
  workOrder: ScrapeStatus;
  dispenser: ScrapeStatus;
}> => {
  const defaultStatus: ScrapeStatus = {
    status: 'idle',
    progress: 0,
    message: '',
    error: null
  };

  let workOrderStatus = { ...defaultStatus };
  let dispenserStatus = { ...defaultStatus };

  try {
    workOrderStatus = await getScrapeStatus();
  } catch (error) {
    console.warn('Failed to get work order scrape status');
  }

  try {
    dispenserStatus = await getDispenserScrapeStatus();
  } catch (error) {
    console.warn('Failed to get dispenser scrape status');
  }

  return {
    workOrder: workOrderStatus,
    dispenser: dispenserStatus
  };
};

/**
 * Alias for startScrapeJob to simplify integration with DataTools component
 */
export const scrapeAllData = startScrapeJob;

/**
 * Get work orders for the active user
 */
export const getWorkOrders = async () => {
  const url = await ENDPOINTS.WORK_ORDERS();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to get work orders');
  }

  return response.json();
};

/**
 * Get prover preferences for the active user
 */
export const getProverPreferences = async () => {
  const url = await ENDPOINTS.PROVER_PREFERENCES();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to get prover preferences');
  }

  return response.json();
};

/**
 * Save prover preferences for the active user
 */
export const saveProverPreferences = async (preferences: any) => {
  const url = await ENDPOINTS.PROVER_PREFERENCES();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(preferences)
  });

  if (!response.ok) {
    throw new Error('Failed to save prover preferences');
  }

  return response.json();
};

// We removed the getWorkOrdersWithDispensers function since we're loading files directly in the component 