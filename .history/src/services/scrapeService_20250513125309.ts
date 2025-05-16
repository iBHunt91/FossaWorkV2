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

// Define log types and severity for type safety
export type LogType = 'workOrder' | 'dispenser' | 'server' | 'formPrep';
export type LogSeverity = 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'SYSTEM' | 'NETWORK' | 'PROGRESS' | 'STATUS';

/**
 * General purpose logging function that can be used to add logs to any log type
 * @param type The log type (workOrder, dispenser, server, formPrep)
 * @param severity The severity level (INFO, ERROR, etc)
 * @param message The log message
 * @param data Optional data to include in the message
 */
export const addSystemLog = async (
  type: LogType,
  severity: LogSeverity,
  message: string,
  data?: any
): Promise<void> => {
  try {
    // Format the message with severity and data
    let formattedMessage = `[${severity}] ${message}`;
    
    // Add data information to the log if it exists
    if (data) {
      // If data is an object, format it nicely
      if (typeof data === 'object') {
        try {
          const dataKeys = Object.keys(data);
          // Only include most relevant properties to avoid clutter
          const relevantData = dataKeys.reduce((acc: any, key: string) => {
            // Skip functions and large arrays/objects for clarity
            if (typeof data[key] !== 'function' && 
                !(Array.isArray(data[key]) && data[key].length > 10) &&
                !(typeof data[key] === 'object' && data[key] !== null && Object.keys(data[key]).length > 10)) {
              acc[key] = data[key];
            }
            return acc;
          }, {});
          
          // Format as a string with important values
          if (Object.keys(relevantData).length > 0) {
            const dataString = Object.entries(relevantData)
              .map(([k, v]) => `${k}: ${v !== null && typeof v === 'object' ? '{...}' : v}`)
              .join(', ');
            formattedMessage += ` (${dataString})`;
          }
        } catch (err) {
          formattedMessage += ` (Error formatting data: ${err instanceof Error ? err.message : 'Unknown error'})`;
        }
      } else {
        // For primitive types, append directly
        formattedMessage += ` (${data})`;
      }
    }
    
    const url = await ENDPOINTS.SCRAPE_LOGS(type);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: formattedMessage }),
    });

    if (!response.ok) {
      console.error(`Failed to add ${type} log: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error adding ${type} log:`, error);
  }
};

/**
 * Add a log entry for work order operations
 */
export const addWorkOrderLog = async (
  severity: LogSeverity,
  message: string,
  data?: any
): Promise<void> => {
  return addSystemLog('workOrder', severity, message, data);
};

/**
 * Convenience functions for adding work order logs with specific severity levels
 */
export const workOrderLog = {
  debug: (message: string, data?: any) => addWorkOrderLog('DEBUG', message, data),
  info: (message: string, data?: any) => addWorkOrderLog('INFO', message, data),
  success: (message: string, data?: any) => addWorkOrderLog('SUCCESS', message, data),
  warn: (message: string, data?: any) => addWorkOrderLog('WARN', message, data),
  error: (message: string, data?: any) => addWorkOrderLog('ERROR', message, data),
  system: (message: string, data?: any) => addWorkOrderLog('SYSTEM', message, data),
  network: (message: string, data?: any) => addWorkOrderLog('NETWORK', message, data),
  progress: (message: string, data?: any) => addWorkOrderLog('PROGRESS', message, data),
  status: (message: string, data?: any) => addWorkOrderLog('STATUS', message, data),
};

/**
 * Add a log entry for dispenser operations
 */
export const addDispenserLog = async (
  severity: LogSeverity,
  message: string,
  data?: any
): Promise<void> => {
  return addSystemLog('dispenser', severity, message, data);
};

/**
 * Convenience functions for adding dispenser logs with specific severity levels
 */
export const dispenserLog = {
  debug: (message: string, data?: any) => addDispenserLog('DEBUG', message, data),
  info: (message: string, data?: any) => addDispenserLog('INFO', message, data),
  success: (message: string, data?: any) => addDispenserLog('SUCCESS', message, data),
  warn: (message: string, data?: any) => addDispenserLog('WARN', message, data),
  error: (message: string, data?: any) => addDispenserLog('ERROR', message, data),
  system: (message: string, data?: any) => addDispenserLog('SYSTEM', message, data),
  network: (message: string, data?: any) => addDispenserLog('NETWORK', message, data),
  progress: (message: string, data?: any) => addDispenserLog('PROGRESS', message, data),
  status: (message: string, data?: any) => addDispenserLog('STATUS', message, data),
};

/**
 * Add a log entry for server operations
 */
export const addServerLog = async (
  severity: LogSeverity,
  message: string,
  data?: any
): Promise<void> => {
  return addSystemLog('server', severity, message, data);
};

/**
 * Convenience functions for adding server logs with specific severity levels
 */
export const serverLog = {
  debug: (message: string, data?: any) => addServerLog('DEBUG', message, data),
  info: (message: string, data?: any) => addServerLog('INFO', message, data),
  success: (message: string, data?: any) => addServerLog('SUCCESS', message, data),
  warn: (message: string, data?: any) => addServerLog('WARN', message, data),
  error: (message: string, data?: any) => addServerLog('ERROR', message, data),
  system: (message: string, data?: any) => addServerLog('SYSTEM', message, data),
  network: (message: string, data?: any) => addServerLog('NETWORK', message, data),
  progress: (message: string, data?: any) => addServerLog('PROGRESS', message, data),
  status: (message: string, data?: any) => addServerLog('STATUS', message, data),
};

/**
 * Add a log entry for form prep automation
 */
export const addFormPrepLog = async (message: string): Promise<void> => {
  try {
    const url = await ENDPOINTS.SCRAPE_LOGS('formPrep');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      console.error(`Failed to add form prep log: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error adding form prep log:', error);
  }
};

// Enhanced version of addFormPrepLog with severity and data
export const addFormPrepLogDetailed = async (
  severity: LogSeverity,
  message: string, 
  data?: any
): Promise<void> => {
  return addSystemLog('formPrep', severity, message, data);
};

/**
 * Convenience functions for adding form prep logs with specific severity levels
 */
export const formPrepLog = {
  debug: (message: string, data?: any) => addFormPrepLogDetailed('DEBUG', message, data),
  info: (message: string, data?: any) => addFormPrepLogDetailed('INFO', message, data),
  success: (message: string, data?: any) => addFormPrepLogDetailed('SUCCESS', message, data),
  warn: (message: string, data?: any) => addFormPrepLogDetailed('WARN', message, data),
  error: (message: string, data?: any) => addFormPrepLogDetailed('ERROR', message, data),
  system: (message: string, data?: any) => addFormPrepLogDetailed('SYSTEM', message, data),
  network: (message: string, data?: any) => addFormPrepLogDetailed('NETWORK', message, data),
  progress: (message: string, data?: any) => addFormPrepLogDetailed('PROGRESS', message, data),
  status: (message: string, data?: any) => addFormPrepLogDetailed('STATUS', message, data),
};

/**
 * Unified logging interface for all log types
 */
export const systemLogs = {
  server: serverLog,
  workOrder: workOrderLog,
  dispenser: dispenserLog,
  formPrep: formPrepLog
};

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
export const getScrapeLogs = async (type: 'workOrder' | 'dispenser' | 'server' | 'formPrep'): Promise<LogEntry[]> => {
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