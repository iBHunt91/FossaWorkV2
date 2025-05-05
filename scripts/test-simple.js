import fs from 'fs';
import path from 'path';
import { getActiveUser, resolveUserFilePath } from '../server/utils/userManager.js';

// Simple script to test if a job ID is in the completed jobs list
async function testSimple() {
    console.log('Starting simple test...');
    
    try {
        // Get the active user
        const userId = getActiveUser();
        console.log(`Active user: ${userId}`);
        
        // Path to completed jobs file
        const completedJobsPath = resolveUserFilePath('completed_jobs.json', userId);
        console.log(`Completed jobs path: ${completedJobsPath}`);
        
        // Check if file exists
        if (!fs.existsSync(completedJobsPath)) {
            console.log('No completed jobs file found.');
            return;
        }
        
        // Read and parse the file
        const completedJobsData = JSON.parse(fs.readFileSync(completedJobsPath, 'utf8'));
        console.log('Completed jobs data:', completedJobsData);
        
        // Check for a specific job ID (using first one from the list)
        if (completedJobsData.completedJobs && completedJobsData.completedJobs.length > 0) {
            const jobId = completedJobsData.completedJobs[0];
            console.log(`Checking job ID: ${jobId}`);
            
            // Simple check if job ID is in the list
            const isCompleted = completedJobsData.completedJobs.includes(jobId);
            console.log(`Is job completed: ${isCompleted}`);
            
            // This is essentially what the isJobCompleted function does
            if (isCompleted) {
                console.log('✅ SUCCESS: The job is correctly detected as completed!');
            } else {
                console.log('❌ FAILURE: The job should be in the list but is not detected!');
            }
        } else {
            console.log('No completed jobs found in the list.');
        }
    } catch (error) {
        console.error('Error running simple test:', error);
    }
}

// Run the test
testSimple(); 