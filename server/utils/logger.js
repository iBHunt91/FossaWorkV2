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
 * Log a debug message
 * @param {string} message - Message to log
 */
const debug = (message) => {
  if (currentLogLevel <= LOG_LEVELS.DEBUG) {
    console.debug(formatLog('DEBUG', message));
  }
};

/**
 * Log an info message
 * @param {string} message - Message to log
 */
const info = (message) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    console.info(formatLog('INFO', message));
  }
};

/**
 * Log a warning message
 * @param {string} message - Message to log
 */
const warn = (message) => {
  if (currentLogLevel <= LOG_LEVELS.WARN) {
    console.warn(formatLog('WARN', message));
  }
};

/**
 * Log an error message
 * @param {string} message - Message to log
 */
const error = (message) => {
  if (currentLogLevel <= LOG_LEVELS.ERROR) {
    console.error(formatLog('ERROR', message));
  }
};

// Export the logger functions
export {
  debug,
  info,
  warn,
  error
}; 