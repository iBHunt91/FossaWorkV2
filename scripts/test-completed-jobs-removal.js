import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getActiveUser, resolveUserFilePath } from '../server/utils/userManager.js';
// Debug just importing the scheduleComparator.js directly
console.log('Before importing scheduleComparator');
import * as scheduleComparator from './utils/scheduleComparator.js';
console.log('imported scheduleComparator:', Object.keys(scheduleComparator));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test script to check if the isJobCompleted function is working correctly
 */
async function runTest() {
    console.log('Starting test function...');
    try {
        console.log('Testing completed jobs removal detection...');
        
        // Get active user
        const userId = getActiveUser();
        console.log(`Current active user: ${userId}`);
        
        // Get the path to the completed jobs file
        const completedJobsPath = resolveUserFilePath('completed_jobs.json', userId);
        console.log(`Looking for completed jobs at: ${completedJobsPath}`);
        
        // Check if file exists
        if (!fs.existsSync(completedJobsPath)) {
            console.log('No completed jobs file found. Please run a scrape first.');
            return;
        }
        
        // Read the completed jobs
        const completedJobsData = JSON.parse(fs.readFileSync(completedJobsPath, 'utf8'));
        console.log(`Found ${completedJobsData.completedJobs.length} completed jobs:`, completedJobsData.completedJobs);
        
        // Test isJobCompleted for the first completed job
        if (completedJobsData.completedJobs.length > 0) {
            const testJobId = completedJobsData.completedJobs[0];
            
            console.log(`Testing isJobCompleted with job ID: ${testJobId}`);
            
            // Use the imported function from scheduleComparator
            const result = scheduleComparator.isJobCompleted(testJobId, userId);
            console.log(`isJobCompleted result: ${result}`);
            
            if (result) {
                console.log('✅ SUCCESS: Job was correctly detected as completed!');
            } else {
                console.log('❌ FAILURE: Job was not detected as completed!');
            }
            
            // Test with a non-existent job ID
            const fakeJobId = 'W-999999';
            const fakeResult = scheduleComparator.isJobCompleted(fakeJobId, userId);
            console.log(`Testing with fake job ID ${fakeJobId}: ${fakeResult}`);
            
            if (!fakeResult) {
                console.log('✅ SUCCESS: Fake job was correctly NOT detected as completed!');
            } else {
                console.log('❌ FAILURE: Fake job was incorrectly detected as completed!');
            }
        } else {
            console.log('No completed jobs found in the data to test with.');
        }
    } catch (error) {
        console.error('Error testing completed jobs:', error);
        console.error(error.stack);
    }
}

// Run the test
console.log('About to run test function');
runTest(); 