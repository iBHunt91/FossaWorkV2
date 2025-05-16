/**
 * Enhanced logger utility with file-based logging capability
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
const SERVER_LOG_DIR = path.join(LOG_DIR, 'server');
const SERVER_LOG_FILE = path.join(SERVER_LOG_DIR, 'server.log');

// Create logs directories if they don't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

if (!fs.existsSync(SERVER_LOG_DIR)) {
  fs.mkdirSync(SERVER_LOG_DIR, { recursive: true });
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

/**
 * Write log to file
 * @param {string} level - Log level
 * @param {string} component - Component name
 * @param {string} message - Message to log
 * @param {Error} [err] - Optional error object
 */
const writeToFile = (level, component, message, err = null) => {
  try {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    let logEntry = formatLog(level, formattedMsg);
    
    // Add error stack if provided
    if (err && err.stack) {
      logEntry += `\n${err.stack}\n`;
    }
    
    // Append new line
    logEntry += '\n';
    
    // Append to file
    fs.appendFileSync(SERVER_LOG_FILE, logEntry);
  } catch (error) {
    // Fallback to console if file writing fails
    console.error(`Failed to write to log file: ${error.message}`);
  }
};

// Helper to log to UI if callback is registered
const logToUi = (level, component, message) => {
  if (logToUiCallback) {
    logToUiCallback('server', `[${level}] ${component ? `[${component}] ` : ''}${message}`);
  }
};

/**
 * Log a debug message
 * @param {string} message - Message to log
 * @param {string} component - Component name
 * @param {Error} [err] - Optional error object
 */
const debug = (message, component, err = null) => {
  if (currentLogLevel <= LOG_LEVELS.DEBUG) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.debug(formatLog('DEBUG', formattedMsg));
    writeToFile('DEBUG', component, message, err);
    logToUi('DEBUG', component, message);
  }
};

/**
 * Log an info message
 * @param {string} message - Message to log
 * @param {string} component - Component name
 * @param {Error} [err] - Optional error object
 */
const info = (message, component, err = null) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.info(formatLog('INFO', formattedMsg));
    writeToFile('INFO', component, message, err);
    logToUi('INFO', component, message);
  }
};

/**
 * Log a warning message
 * @param {string} message - Message to log
 * @param {string} component - Component name
 * @param {Error} [err] - Optional error object
 */
const warn = (message, component, err = null) => {
  if (currentLogLevel <= LOG_LEVELS.WARN) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.warn(formatLog('WARN', formattedMsg));
    writeToFile('WARN', component, message, err);
    logToUi('WARN', component, message);
  }
};

/**
 * Log an error message
 * @param {string} message - Message to log
 * @param {string} component - Component name
 * @param {Error} [err] - Optional error object
 */
const error = (message, component, err = null) => {
  if (currentLogLevel <= LOG_LEVELS.ERROR) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.error(formatLog('ERROR', formattedMsg));
    writeToFile('ERROR', component, message, err);
    logToUi('ERROR', component, message);
  }
};

/**
 * Log a success message (using INFO level with success tag)
 * @param {string} message - Message to log
 * @param {string} component - Component name
 * @param {Error} [err] - Optional error object
 */
const success = (message, component, err = null) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    const formattedMsg = component ? `[${component}] ${message}` : message;
    console.info(formatLog('SUCCESS', formattedMsg));
    writeToFile('SUCCESS', component, message, err);
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
  info(message, 'HTTP');
};

/**
 * Read the server log file
 * @param {number} [maxLines=100] - Maximum number of lines to return
 * @returns {string} - The log file contents
 */
const readServerLog = (maxLines = 100) => {
  try {
    if (!fs.existsSync(SERVER_LOG_FILE)) {
      return 'No server log file found';
    }

    const logContent = fs.readFileSync(SERVER_LOG_FILE, 'utf8');
    const lines = logContent.split('\n');
    
    // Return the last maxLines lines
    return lines.slice(-maxLines).join('\n');
  } catch (error) {
    console.error(`Error reading server log: ${error.message}`);
    return `Error reading server log: ${error.message}`;
  }
};

/**
 * Get the server log file path
 * @returns {string} - Path to the log file
 */
const getServerLogPath = () => {
  return SERVER_LOG_FILE;
};

/**
 * Clear the server log file
 */
const clearServerLog = () => {
  try {
    fs.writeFileSync(SERVER_LOG_FILE, '');
    console.info('Server log cleared');
  } catch (error) {
    console.error(`Error clearing server log: ${error.message}`);
  }
};

// Export the logger functions
export {
  debug,
  info,
  warn,
  error,
  success,
  access,
  readServerLog,
  getServerLogPath,
  clearServerLog,
  registerLogToUiCallback
};