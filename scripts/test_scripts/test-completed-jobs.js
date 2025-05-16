import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeCompletedJobs } from './scrapers/completedJobsScrape.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple test function
async function runTest() {
    console.log('Starting test of completed jobs scraper...');
    
    try {
        // Run the completed jobs scraper
        const result = await scrapeCompletedJobs({
            isManual: true,
            progressCallback: (progress, message) => {
                console.log(`Progress: ${progress}% - ${message}`);
            }
        });
        
        console.log('Completed jobs scraper test completed:');
        console.log('Success:', result.success);
        console.log('Error:', result.error);
        console.log('Completed job count:', result.completedJobs.length);
        console.log('Completed job IDs:', result.completedJobs.slice(0, 5), '...');
    } catch (error) {
        console.error('Test failed with error:', error);
    }
}

// Run the test
runTest().catch(error => {
    console.error('Unhandled error in test:', error);
}); 