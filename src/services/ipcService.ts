/**
 * IPC Service for communicating with the Electron main process
 */

// Import the ElectronAPI interface
import { ElectronAPI } from '../types/electron';

// Declare the global window interface
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

/**
 * Get the server port from Electron main process
 * Falls back to 3001 if not running in Electron or port can't be retrieved
 * @returns The server port
 */
export const getServerPort = async (): Promise<number> => {
  // Check if we're running in Electron and have access to the IPC bridge
  if (window.electron?.getServerPort) {
    try {
      // Get port from Electron main process
      const port = await window.electron.getServerPort();
      return port;
    } catch (error) {
      console.error('Error getting server port from Electron:', error);
    }
  }
  
  // Try to detect the server port by attempting connections
  const portsToTry = [3001, 3002, 3003, 3004, 3005];
  
  for (const port of portsToTry) {
    try {
      // Try to ping the API server on this port
      const response = await fetch(`http://localhost:${port}/api/ping`, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(1000) // Timeout after 1 second
      });
      
      if (response.ok) {
        console.log(`Found API server on port ${port}`);
        return port;
      }
    } catch (error) {
      console.log(`Port ${port} not available`);
    }
  }
  
  // Default to 3001 if not in Electron or if error occurs
  console.warn('Could not find server on any port, defaulting to 3001');
  return 3001;
};

/**
 * Update Fossa credentials in the .env file via Electron IPC
 */
export const updateFossaCredentials = async (email: string, password: string): Promise<{ success: boolean, message: string }> => {
  try {
    console.log('Starting credential verification process in ipcService...');
    
    // Check if we're in Electron environment
    if (window.electron?.updateFossaCredentials) {
      console.log('Electron API available, calling updateFossaCredentials...');
      const result = await window.electron.updateFossaCredentials(email, password);
      console.log('Received verification result:', result);
      return result;
    }
    
    // If not in Electron or if method is not available
    console.error('Electron API not available for credential verification');
    return Promise.reject(new Error('Cannot update credentials: Electron API not available'));
  } catch (error) {
    console.error('Error updating Fossa credentials:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Test Fossa credentials without updating the .env file
 */
export const testFossaCredentials = async (email: string, password: string): Promise<{ success: boolean, message: string }> => {
  try {
    console.log('Starting credential testing process in ipcService...');
    
    // Check if we're in Electron environment
    if (window.electron?.testFossaCredentials) {
      console.log('Electron API available, calling testFossaCredentials...');
      const result = await window.electron.testFossaCredentials(email, password);
      console.log('Received test result:', result);
      return result;
    }
    
    // If not in Electron or if method is not available
    console.error('Electron API not available for credential testing');
    return Promise.reject(new Error('Cannot test credentials: Electron API not available'));
  } catch (error) {
    console.error('Error testing Fossa credentials:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}; 