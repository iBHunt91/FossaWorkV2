// Implementation of scrapeService functions
import { initializeServerConnection } from '../utils/serverUtils';

export type LogSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG' | 'SUCCESS' | 'PROGRESS';

// ScrapeStatus type definition needed by ScrapeContext and App.tsx
export interface ScrapeStatus {
  status: string;
  progress: number;
  message: string;
  error: string | null;
}

// Store the API base URL once we find it
let apiBaseUrl = '';

// Initialize the API base URL
const initializeApiBaseUrl = async (): Promise<string> => {
  if (apiBaseUrl) return apiBaseUrl;
  
  apiBaseUrl = await initializeServerConnection();
  console.log(`API Base URL initialized: ${apiBaseUrl || '(empty)'}`);
  return apiBaseUrl;
};

// Get the API base URL with fallback to both standard ports
const getApiBaseUrl = (): string => {
  // If we've already found the base URL, use it
  if (apiBaseUrl) return apiBaseUrl;
  
  // Otherwise return empty string, and we'll initialize it on first use
  return '';
};

// Function to debug connection issues 
export const testServerConnection = async (): Promise<{
  success: boolean;
  message: string;
  ports: Array<{ port: number; status: string }>;
}> => {
  const ports = [3001, 3002, 3003, 3004, 3005]; // Common ports the server might use
  const results = [];
  
  // Try connecting to each possible port
  for (const port of ports) {
    try {
      // Set a shorter timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      const response = await fetch(`http://localhost:${port}/health`, {
        signal: controller.signal,
      }).catch(e => {
        if (e.name === 'AbortError') {
          return { ok: false, status: 'timeout' };
        }
        throw e;
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        results.push({ port, status: 'available' });
      } else {
        results.push({ port, status: `unavailable (${response.status})` });
      }
    } catch (error) {
      results.push({ port, status: 'connection failed' });
    }
  }
  
  // Check if we found any working ports
  const workingPorts = results.filter(r => r.status === 'available');
  
  // If we found working ports, update our apiBaseUrl
  if (workingPorts.length > 0) {
    const port = workingPorts[0].port;
    apiBaseUrl = `http://localhost:${port}`;
    console.log(`Found working server, setting API base URL to: ${apiBaseUrl}`);
  }
  
  return {
    success: workingPorts.length > 0,
    message: workingPorts.length > 0 
      ? `Found ${workingPorts.length} available server(s)` 
      : 'No available servers found - server might be down',
    ports: results
  };
};

// Add log entry (useful for debugging)
export const addLogEntry = async (type: string, message: string): Promise<boolean> => {
  try {
    // Initialize API URL if not already done
    const baseUrl = await initializeApiBaseUrl();
    if (!baseUrl) {
      console.error('Could not connect to server to add log entry');
      return false;
    }
    
    const response = await fetch(`${baseUrl}/api/scrape-logs/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message })
    });
    
    return response.ok;
  } catch (error) {
    console.error(`Error adding log entry: ${error}`);
    return false;
  }
};

// Mock implementations of scrape-related functions

// Start a scrape job for work orders
export const startScrapeJob = async (): Promise<any> => {
  console.log('Starting work order scrape job');
  try {
    // Initialize API URL if not already done
    const baseUrl = await initializeApiBaseUrl();
    if (!baseUrl) {
      throw new Error('Could not connect to server. Please make sure the server is running.');
    }
    
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error starting work order scrape:', error);
    throw error;
  }
};

// Start a scrape job for dispensers
export const startDispenserScrapeJob = async (): Promise<any> => {
  console.log('Starting dispenser scrape job');
  try {
    // Initialize API URL if not already done
    const baseUrl = await initializeApiBaseUrl();
    if (!baseUrl) {
      throw new Error('Could not connect to server. Please make sure the server is running.');
    }
    
    const response = await fetch(`${baseUrl}/api/dispenser-scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error starting dispenser scrape:', error);
    throw error;
  }
};

// Get status of a work order scrape job
export const getScrapeStatus = async (): Promise<ScrapeStatus> => {
  try {
    // Initialize API URL if not already done
    const baseUrl = await initializeApiBaseUrl();
    if (!baseUrl) {
      return {
        status: 'error',
        progress: 0,
        message: 'Could not connect to server. Please make sure the server is running.',
        error: 'Server connection failed'
      };
    }
    
    const response = await fetch(`${baseUrl}/api/status`);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting scrape status:', error);
    return {
      status: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'Failed to get status',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Get status of a dispenser scrape job
export const getDispenserScrapeStatus = async (): Promise<ScrapeStatus> => {
  try {
    // Initialize API URL if not already done
    const baseUrl = await initializeApiBaseUrl();
    if (!baseUrl) {
      return {
        status: 'error',
        progress: 0,
        message: 'Could not connect to server. Please make sure the server is running.',
        error: 'Server connection failed'
      };
    }
    
    const response = await fetch(`${baseUrl}/api/dispenser-status`);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting dispenser scrape status:', error);
    return {
      status: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'Failed to get status',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Check all scrape statuses at once
export const checkAllScrapeStatus = async (): Promise<{
  workOrder: ScrapeStatus;
  dispenser: ScrapeStatus;
}> => {
  return {
    workOrder: await getScrapeStatus(),
    dispenser: await getDispenserScrapeStatus()
  };
};

// Clear dispenser data for a specific order ID
export const clearDispenserData = async (orderId: string): Promise<any> => {
  console.log(`Clearing dispenser data for order ID: ${orderId}`);
  try {
    // Initialize API URL if not already done
    const baseUrl = await initializeApiBaseUrl();
    if (!baseUrl) {
      throw new Error('Could not connect to server. Please make sure the server is running.');
    }
    
    const response = await fetch(`${baseUrl}/api/clear-dispenser-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: orderId })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error clearing dispenser data:', error);
    throw error;
  }
};

// Force rescrape dispenser data for a specific order ID
export const forceRescrapeDispenserData = async (orderId: string): Promise<any> => {
  console.log(`Force rescraping dispenser data for order ID: ${orderId}`);
  try {
    // Initialize API URL if not already done
    const baseUrl = await initializeApiBaseUrl();
    if (!baseUrl) {
      throw new Error('Could not connect to server. Please make sure the server is running.');
    }
    
    const response = await fetch(`${baseUrl}/api/force-rescrape-dispenser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: orderId })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error rescraping dispenser data:', error);
    throw error;
  }
};

// Get work orders
export const getWorkOrders = async (): Promise<any> => {
  console.log('Getting work orders');
  try {
    // Initialize API URL if not already done
    const baseUrl = await initializeApiBaseUrl();
    if (!baseUrl) {
      throw new Error('Could not connect to server. Please make sure the server is running.');
    }
    
    const response = await fetch(`${baseUrl}/api/work-orders`);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting work orders:', error);
    return {
      success: false,
      workOrders: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Mock systemLogs object
export const systemLogs = {
  server: {
    info: (message: string) => console.log(`[SERVER INFO] ${message}`),
    success: (message: string) => console.log(`[SERVER SUCCESS] ${message}`),
    warning: (message: string) => console.log(`[SERVER WARNING] ${message}`),
    error: (message: string) => console.log(`[SERVER ERROR] ${message}`)
  },
  formPrep: {
    info: (message: string) => console.log(`[FORM PREP INFO] ${message}`),
    success: (message: string) => console.log(`[FORM PREP SUCCESS] ${message}`),
    warning: (message: string) => console.log(`[FORM PREP WARNING] ${message}`),
    error: (message: string) => console.log(`[FORM PREP ERROR] ${message}`)
  }
};

// Get scrape logs by type
export const getScrapeLogs = async (type: 'server' | 'formPrep'): Promise<any[]> => {
  try {
    // Initialize API URL if not already done
    const baseUrl = await initializeApiBaseUrl();
    if (!baseUrl) {
      console.error('Could not connect to server to get logs');
      return [];
    }
    
    const response = await fetch(`${baseUrl}/api/scrape-logs/${type}`);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.logs || [];
  } catch (error) {
    console.error(`Error getting ${type} logs:`, error);
    return [];
  }
};
