const fs = require('fs');
const path = require('path');

// Ensure logs directories exist
const ensureLogDirectories = () => {
  const logsDir = path.join(__dirname, '../../logs');
  const serverLogsDir = path.join(logsDir, 'server');

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('Created logs directory');
  }

  // Create server logs directory if it doesn't exist
  if (!fs.existsSync(serverLogsDir)) {
    fs.mkdirSync(serverLogsDir, { recursive: true });
    console.log('Created server logs directory');
  }

  return { logsDir, serverLogsDir };
};

// Initialize directories and server log file path
const { serverLogsDir } = ensureLogDirectories();
const serverLogFile = path.join(serverLogsDir, 'server.log');

/**
 * Formats a log entry with timestamp and log level
 * @param {string} level - Log level (INFO, ERROR, etc.)
 * @param {string} message - The message to log
 * @param {Object} [data] - Optional data to include with the log
 * @returns {string} - Formatted log entry
 */
const formatLogEntry = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const dataString = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  return `[${timestamp}] [${level}] ${message}${dataString}\n`;
};

/**
 * Writes a log entry to the server log file
 * @param {string} level - Log level (INFO, ERROR, etc.)
 * @param {string} message - The message to log
 * @param {Object} [data] - Optional data to include with the log
 */
const writeToServerLog = (level, message, data = null) => {
  try {
    const logEntry = formatLogEntry(level, message, data);
    fs.appendFileSync(serverLogFile, logEntry);
  } catch (error) {
    console.error(`Error writing to server.log: ${error.message}`);
  }
};

/**
 * Reads the server log file
 * @param {number} [maxLines=100] - Maximum number of lines to return
 * @returns {string} - The log file contents (last maxLines)
 */
const readServerLog = (maxLines = 100) => {
  try {
    if (!fs.existsSync(serverLogFile)) {
      return '';
    }

    const logContent = fs.readFileSync(serverLogFile, 'utf8');
    const lines = logContent.split('\n');
    
    // Return the last maxLines lines
    return lines.slice(-maxLines).join('\n');
  } catch (error) {
    console.error(`Error reading server.log: ${error.message}`);
    return '';
  }
};

/**
 * Clears the server log file
 */
const clearServerLog = () => {
  try {
    fs.writeFileSync(serverLogFile, '');
  } catch (error) {
    console.error(`Error clearing server.log: ${error.message}`);
  }
};

// Export logger functions
module.exports = {
  serverLogFile,
  writeToServerLog,
  readServerLog,
  clearServerLog,
  
  // Logger functions by level
  info: (message, data) => writeToServerLog('INFO', message, data),
  success: (message, data) => writeToServerLog('SUCCESS', message, data),
  warning: (message, data) => writeToServerLog('WARNING', message, data),
  warn: (message, data) => writeToServerLog('WARNING', message, data),
  error: (message, data) => writeToServerLog('ERROR', message, data),
  debug: (message, data) => writeToServerLog('DEBUG', message, data),
  system: (message, data) => writeToServerLog('SYSTEM', message, data),
  network: (message, data) => writeToServerLog('NETWORK', message, data),
  progress: (message, data) => writeToServerLog('PROGRESS', message, data),
};
