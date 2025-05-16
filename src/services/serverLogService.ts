/**
 * Server Logs Service
 * Provides functionality to fetch and manage server logs.
 */

import { initializeServerConnection } from '../utils/serverUtils';

/**
 * Fetch server logs from the API
 * @param {number} maxLines - Maximum number of lines to retrieve (default: 100)
 * @returns {Promise<Object>} - Server logs data
 */
export const fetchServerLogs = async (maxLines = 100) => {
  try {
    // Initialize API base URL
    const baseUrl = await initializeServerConnection();
    if (!baseUrl) {
      throw new Error('Could not connect to server to fetch logs');
    }

    // Fetch logs from the API
    const response = await fetch(`${baseUrl}/api/server-logs?maxLines=${maxLines}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch server logs: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching server logs:', error);
    throw error;
  }
};

/**
 * Clear server logs
 * @returns {Promise<Object>} - Response data
 */
export const clearServerLogs = async () => {
  try {
    // Initialize API base URL
    const baseUrl = await initializeServerConnection();
    if (!baseUrl) {
      throw new Error('Could not connect to server to clear logs');
    }

    // Send request to clear logs
    const response = await fetch(`${baseUrl}/api/clear-server-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to clear server logs: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error clearing server logs:', error);
    throw error;
  }
};

/**
 * Get the server log file path
 * @returns {Promise<string>} - Path to the server log file
 */
export const getServerLogFilePath = async () => {
  try {
    const logsData = await fetchServerLogs(1); // Just fetch minimal logs to get the file path
    return logsData.filePath || '';
  } catch (error) {
    console.error('Error getting server log file path:', error);
    return '';
  }
};

export default {
  fetchServerLogs,
  clearServerLogs,
  getServerLogFilePath,
};
