// Script to mark a job as completed to avoid false "removal" alerts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getLatestScrapeFile } from './utils/dataManager.js';
import { trackCompletedJob } from './utils/scheduleComparator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to mark a job as completed
function markJobAsCompleted(jobId) {
    // Get the latest schedule data
    const latestFile = getLatestScrapeFile();
    if (!latestFile || !fs.existsSync(latestFile)) {
        console.error('No schedule data found. Please run a scrape first.');
        return false;
    }

    try {
        // Load the schedule
        const schedule = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        
        // Find the job in the schedule
        const job = schedule.workOrders.find(job => job.id === jobId);
        
        if (!job) {
            console.error(`Job #${jobId} not found in the latest schedule.`);
            return false;
        }
        
        // Extract job details
        const {
            id,
            customer: { name: storeName, storeNumber: store, address },
            visits: { nextVisit: { date } },
            services
        } = job;
        
        // Calculate location string
        const location = address ? 
            `${address.cityState.split(' ')[0]}, ${address.cityState.split(' ')[1]}` : 
            'Unknown';
        
        // Count dispensers
        const dispensers = services.filter(s => s.type === 'dispenser').length;
        
        // Track the job as completed
        trackCompletedJob(id, date, store, storeName, dispensers, location);
        
        console.log(`✅ Marked job #${id} at ${storeName} (${store}) as completed.`);
        return true;
    } catch (error) {
        console.error('Error marking job as completed:', error);
        return false;
    }
}

// Process command line arguments
function processArgs() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        console.log('\nUsage: node markJobCompleted.js <job-id>\n');
        console.log('Mark a job as completed to avoid false "removal" alerts');
        console.log('Example: node markJobCompleted.js W-123456\n');
        return;
    }
    
    const jobId = args[0];
    markJobAsCompleted(jobId);
}

// Run the script
processArgs(); 