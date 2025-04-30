import { scrapeDispenserInfo } from './dispenserScrape.js';
import fs from 'fs';

console.log('Test runner starting');

// Create a log directory if it doesn't exist
const logDir = './logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Create a log file with timestamp
const timestamp = new Date().toISOString().replace(/:/g, '-');
const logFile = `${logDir}/scrape-log-${timestamp}.txt`;

// Function to write to log file
function log(message) {
    console.log(message);
    fs.appendFileSync(logFile, message + '\n');
}

log(`Starting scrape test at ${new Date().toLocaleString()}`);

// Execute the scrape function
scrapeDispenserInfo()
    .then(result => {
        log(`Scrape completed successfully: ${result}`);
        log(`Test completed at ${new Date().toLocaleString()}`);
        process.exit(0);
    })
    .catch(error => {
        log(`Scrape failed with error: ${error.message}`);
        log(`Error details: ${error.stack || 'No stack trace'}`);
        log(`Test failed at ${new Date().toLocaleString()}`);
        process.exit(1);
    }); 