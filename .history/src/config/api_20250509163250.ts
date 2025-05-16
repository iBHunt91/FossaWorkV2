/**
 * API Configuration
 */

// Import the ElectronAPI type
import { ElectronAPI } from '../types/electron';

// Declare the electron global for TypeScript
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

import { getServerPort } from '../services/ipcService';
import urlJoin from 'url-join';

const isDev = process.env.NODE_ENV === 'development';
const API_BASE = isDev ? 'http://localhost:3001' : '';

// Cache for the API port
let cachedPort: number | null = null;

/**
 * Invalidate the cached port when needed
 */
export const invalidatePortCache = (): void => {
  cachedPort = null;
  // Dispatch an event so components know to refresh their data
  window.dispatchEvent(new Event('api-port-changed'));
};

/**
 * Get the server port synchronously (uses default port if needed)
 * @returns The port number
 */
export const getPortSync = (): number => {
  // If we already have a cached port, return it
  if (cachedPort !== null) {
    return cachedPort;
  }

  // Since we can't call async functions synchronously,
  // we'll use a default port for sync calls
  console.warn('getPortSync called before port was cached, using default port');
  return 3001; // Default fallback port
};

/**
 * Get the server port asynchronously
 * @returns Promise that resolves to the port number
 */
export const getPort = async (): Promise<number> => {
  // If we already have a cached port, return it
  if (cachedPort !== null) {
    return Promise.resolve(cachedPort);
  }

  try {
    // Try to get port from ipcService - this is an async function
    const port = await getServerPort();
    cachedPort = port;
    return port;
  } catch (error) {
    console.error('Error getting port:', error);
    return 3001; // Default fallback port
  }
};

/**
 * Build the complete API URL for a given endpoint
 * @param endpoint The API endpoint path
 * @returns The complete URL
 */
export const buildUrl = async (endpoint: string): Promise<string> => {
  const port = await getPort();
  const baseUrl = isDev ? `http://localhost:${port}` : '';
  return urlJoin(baseUrl, endpoint);
};

/**
 * API endpoints
 */
export const ENDPOINTS = {
  LAST_SCRAPED: async () => buildUrl('/api/last-scraped'),
  NEXT_SCRAPE: async () => buildUrl('/api/next-scrape'),
  START_SCRAPE: async () => buildUrl('/api/scrape'),
  LOGS: async () => buildUrl('/api/logs'),
  DISPENSERS: async () => buildUrl('/api/dispensers'),
  DISPENSER: async (id: string) => buildUrl(`/api/dispensers/${id}`),
  SCRAPE: async () => buildUrl('/api/scrape'),
  SCRAPE_STATUS: async () => buildUrl('/api/status'),
  DISPENSER_SCRAPE: async () => buildUrl('/api/dispenser-scrape'),
  DISPENSER_STATUS: async () => buildUrl('/api/dispenser-status'),
  CLEAR_DISPENSER: async () => buildUrl('/api/clear-dispenser-data'),
  FORCE_RESCRAPE_DISPENSER: async () => buildUrl('/api/force-rescrape-dispenser'),
  SCRAPE_LOGS: async (type: string) => buildUrl(`/api/scrape-logs/${type}`),
  FOSSA_CREDENTIALS: async () => buildUrl('/api/settings/fossa-credentials'),
  HISTORY: async () => buildUrl('/api/history'),
  CHANGE_HISTORY: async () => buildUrl('/api/change-history'),
  ADD_HISTORY_ENTRY: async () => buildUrl('/api/change-history/entry'),
  SCHEDULE_ARCHIVES: async () => buildUrl('/api/schedule-archives'),
  SCHEDULE_ARCHIVE: async (id: string) => buildUrl(`/api/schedule-archives/${id}`),
  DELETE_ARCHIVE: async (id: string) => buildUrl(`/api/schedule-archives/${id}`),
  WORK_ORDERS: async () => buildUrl('/api/work-orders'),
  PROVER_PREFERENCES: async () => buildUrl('/api/prover-preferences'),
  // Form automation endpoints
  FORM_AUTOMATION: async () => buildUrl('/api/form-automation'),
  FORM_AUTOMATION_STATUS: async () => buildUrl('/api/form-automation/status'),
  FORM_AUTOMATION_BATCH: async () => buildUrl('/api/form-automation/batch'),
  FORM_AUTOMATION_BATCH_STATUS: async (jobId: string) => buildUrl(`/api/form-automation/batch/status/${jobId}`),
  FORM_AUTOMATION_CANCEL: async () => buildUrl('/api/form-automation/cancel'),
  FORM_AUTOMATION_PREVIEW_BATCH: async () => buildUrl('/api/form-automation/preview-batch'),
};

/**
 * Update Fossa credentials
 */
export const updateFossaCredentials = async (email: string, password: string): Promise<{ message: string }> => {
  try {
    const url = await ENDPOINTS.FOSSA_CREDENTIALS();
    console.log('Calling Fossa credentials API:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      console.error('Error response:', response.status, response.statusText);
      let errorMessage = `Server returned ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        // If we can't parse JSON, try to get text content
        try {
          const textContent = await response.text();
          console.error('Error response content:', textContent.substring(0, 200) + '...');
          errorMessage += ' (Response was not valid JSON)';
        } catch (textError) {
          console.error('Could not read response content');
        }
      }
      
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating Fossa credentials:', error);
    throw error;
  }
}; 