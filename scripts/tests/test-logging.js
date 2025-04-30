// Simple test script to verify logging is working
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(path.resolve(__dirname, '../../'), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`Created logs directory at ${logsDir}`);
} else {
    console.log(`Logs directory already exists at ${logsDir}`);
}

// Helper to log progress to console with timestamps
function logProgress(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Create a log file 
const logFilePath = path.join(logsDir, `test-log-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Capture console output to file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function() {
    const args = Array.from(arguments);
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    logStream.write(message + '\n');
    originalConsoleLog.apply(console, args);
};

console.error = function() {
    const args = Array.from(arguments);
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    logStream.write('[ERROR] ' + message + '\n');
    originalConsoleError.apply(console, args);
};

logProgress('Starting test script with enhanced logging');
logProgress('✅ SUCCESS: This is a success message');
logProgress('⚠️ WARNING: This is a warning message');
logProgress('❌ ERROR: This is an error message');
logProgress('🔍 INFO: This is an information message');
logProgress('→ STEP: This is a step in progress');

// Log some timing information
const startTime = new Date();
logProgress(`Started at ${startTime.toISOString()}`);

setTimeout(() => {
    const endTime = new Date();
    const elapsedTime = Math.round((endTime - startTime) / 1000);
    logProgress(`Finished at ${endTime.toISOString()}`);
    logProgress(`Elapsed time: ${elapsedTime} seconds`);
    
    logProgress(`
========== TEST COMPLETE ==========
All log messages were written to: ${logFilePath}
========================================
`);
    
    logStream.end();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.log('Logging test completed successfully.');
}, 2000); 