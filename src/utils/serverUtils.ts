/**
 * Utility functions for server communication
 */

/**
 * Attempt to find a working server port by testing common ports
 * @returns The base URL of the server if found, empty string otherwise
 */
export const findWorkingServerPort = async (): Promise<string> => {
  const ports = [3001, 3002, 3003, 3004, 3005]; // Common ports the server might use
  
  // Try connecting to each possible port
  for (const port of ports) {
    try {
      // Set a short timeout for each attempt
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      const response = await fetch(`http://localhost:${port}/health`, {
        signal: controller.signal,
      }).catch(e => {
        if (e.name === 'AbortError') {
          return { ok: false };
        }
        throw e;
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`Found working server on port ${port}`);
        return `http://localhost:${port}`;
      }
    } catch (error) {
      console.log(`Server not available on port ${port}`);
    }
  }
  
  console.warn('No working server port found');
  return '';
};

/**
 * Check if the server is available
 * @param baseUrl The base URL to check
 * @returns True if the server is available, false otherwise
 */
export const isServerAvailable = async (baseUrl: string): Promise<boolean> => {
  if (!baseUrl) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
};

/**
 * Initialize the server connection by finding a working port
 * @returns The base URL to use for API calls
 */
export const initializeServerConnection = async (): Promise<string> => {
  try {
    // First check for environment variables that might specify the server URL
    if (typeof window !== 'undefined') {
      // Check if we're running in development with a proxy defined in vite
      if (import.meta.env?.DEV && typeof import.meta.env.VITE_API_URL === 'string') {
        console.log(`Using API URL from VITE_API_URL: ${import.meta.env.VITE_API_URL}`);
        return import.meta.env.VITE_API_URL;
      }
      
      // If we're running in a browser with a specific port, use the same origin
      if (window.location.port) {
        const sameOriginUrl = window.location.origin;
        if (await isServerAvailable(sameOriginUrl)) {
          console.log(`Using same origin for API: ${sameOriginUrl}`);
          return sameOriginUrl;
        }
      }
    }
    
    // If we can't use same origin, try to find a working port
    return await findWorkingServerPort();
  } catch (error) {
    console.error('Error initializing server connection:', error);
    return '';
  }
};
