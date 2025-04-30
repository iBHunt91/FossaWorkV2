// Test script to verify dispenser-scrape log file creation
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`Created logs directory at ${logsDir}`);
} else {
    console.log(`Logs directory already exists at ${logsDir}`);
}

// Test creation of dispenser-scrape log file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFilePath = path.join(logsDir, `dispenser-scrape-${timestamp}.log`);

try {
    // Try to create and write to the file
    fs.writeFileSync(logFilePath, `Test entry created at ${new Date().toISOString()}\n`);
    console.log(`Successfully created log file at: ${logFilePath}`);
    
    // Append some more data
    fs.appendFileSync(logFilePath, `Another entry added at ${new Date().toISOString()}\n`);
    console.log(`Successfully appended to log file`);
    
    // Read and display the file contents
    const contents = fs.readFileSync(logFilePath, 'utf8');
    console.log(`Log file contents:\n${contents}`);
    
    console.log('Test completed successfully');
} catch (error) {
    console.error(`Error creating or writing to log file: ${error.message}`);
    console.error(error);
} 