/**
 * Simple logger utility
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory where the module is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const LOG_LEVEL = process.env.LOG_LEVEL || 'DEBUG';
const LOG_DIR = path.join(__dirname, '../../logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Current log level (can be overridden by environment variable)
const currentLogLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

// Function to register for capturing logs to the UI logging system
let logToUiCallback = null;

/**
 * Register a callback function to capture logs to UI
 * @param {Function} callback - Function that takes log type and message
 */
const registerLogToUiCallback = (callback) => {
  logToUiCallback = callback;
};

/**
 * Format log message with timestamp
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} - Formatted log message
 */
const formatLog = (level, message) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
};

// Helper to log to UI if callback is registered
const logToUi = (level, component, message) => {
  if (logToUiCallback) {
    logToUiCallback('server', `[${level}] ${component ? `[${component}] ` : ''}${message}`);
  }
};

/**
 * Log a debug message
 * @param {string} component - Component name
 * @param {string} message - Message to log
 */
const debug = (component, message) => {
  if (currentLogLevel <= LOG_LEVELS.DEBUG) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.debug(formatLog('DEBUG', formattedMsg));
    logToUi('DEBUG', component, message);
  }
};

/**
 * Log an info message
 * @param {string} component - Component name
 * @param {string} message - Message to log
 */
const info = (component, message) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.info(formatLog('INFO', formattedMsg));
    logToUi('INFO', component, message);
  }
};

/**
 * Log a warning message
 * @param {string} component - Component name
 * @param {string} message - Message to log
 */
const warn = (component, message) => {
  if (currentLogLevel <= LOG_LEVELS.WARN) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.warn(formatLog('WARN', formattedMsg));
    logToUi('WARN', component, message);
  }
};

/**
 * Log an error message
 * @param {string} component - Component name
 * @param {string} message - Message to log
 */
const error = (component, message) => {
  if (currentLogLevel <= LOG_LEVELS.ERROR) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.error(formatLog('ERROR', formattedMsg));
    logToUi('ERROR', component, message);
  }
};

/**
 * Log a success message (using INFO level with success tag)
 * @param {string} component - Component name
 * @param {string} message - Message to log
 */
const success = (component, message) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.info(formatLog('SUCCESS', formattedMsg));
    logToUi('SUCCESS', component, message);
  }
};

/**
 * Log an HTTP access
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} responseTime - Response time in ms
 */
const access = (req, res, responseTime) => {
  // Skip logging for static assets
  if (req.url.startsWith('/static/') || req.url.includes('.')) {
    return;
  }

  const message = `${req.method} ${req.url} ${res.statusCode} ${responseTime}ms`;
  info('HTTP', message);
};

// Export the logger functions
export {
  debug,
  info,
  warn,
  error,
  success,
  access,
  registerLogToUiCallback
}; 