/**
 * Test file to ensure server logging functionality is working
 */

const fs = require('fs');
const path = require('path');

// Path to the logs directory
const logsDir = path.join(__dirname, '..', 'logs');
const serverLogsDir = path.join(logsDir, 'server');
const serverLogFile = path.join(serverLogsDir, 'server.log');

// Ensure log directories exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('Created logs directory');
}

if (!fs.existsSync(serverLogsDir)) {
  fs.mkdirSync(serverLogsDir, { recursive: true });
  console.log('Created server logs directory');
}

// Function to write a test log entry
const writeTestLog = (message) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [TEST] ${message}\n`;
  
  try {
    fs.appendFileSync(serverLogFile, logEntry);
    console.log(`Successfully wrote log entry: ${message}`);
    return true;
  } catch (error) {
    console.error(`Error writing to log file: ${error.message}`);
    return false;
  }
};

// Write a few test log entries
console.log('Writing test log entries...');
writeTestLog('Server log test entry 1');
writeTestLog('Server log test entry 2');
writeTestLog('Server log test entry 3 with JSON data: ' + JSON.stringify({
  test: true,
  timestamp: Date.now(),
  data: {
    value: 'test',
    count: 42
  }
}));

// Read the log file to verify it's working
try {
  if (fs.existsSync(serverLogFile)) {
    const logContent = fs.readFileSync(serverLogFile, 'utf8');
    console.log('\nLog file content:');
    console.log(logContent);
    console.log('\nServer log file exists at:', serverLogFile);
  } else {
    console.error('Server log file does not exist!');
  }
} catch (error) {
  console.error(`Error reading log file: ${error.message}`);
}
