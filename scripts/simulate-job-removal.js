import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getActiveUser, resolveUserFilePath } from '../server/utils/userManager.js';
import { compareSchedules } from './utils/scheduleComparator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simulate a job removal to test if it's detected as a completed job
 */
async function simulateJobRemoval() {
    try {
        console.log('Starting job removal simulation...');
        
        // Get active user
        const userId = getActiveUser();
        console.log(`Current active user: ${userId}`);
        
        // Get paths to the current and previous scrape files
        const scrapedContentPath = resolveUserFilePath('scraped_content.json', userId);
        const previousScrapePath = resolveUserFilePath('scraped_content.previous.json', userId);
        
        // Make sure both files exist
        if (!fs.existsSync(scrapedContentPath) || !fs.existsSync(previousScrapePath)) {
            console.log('Required files do not exist. Run a manual scrape first.');
            return;
        }
        
        // Read the current file
        const currentContent = JSON.parse(fs.readFileSync(scrapedContentPath, 'utf8'));
        console.log(`Current content has ${currentContent.workOrders.length} jobs`);
        
        // Get the completed jobs
        const completedJobsPath = resolveUserFilePath('completed_jobs.json', userId);
        
        if (!fs.existsSync(completedJobsPath)) {
            console.log('No completed jobs file found. Run a completed jobs scrape first.');
            return;
        }
        
        const completedJobsData = JSON.parse(fs.readFileSync(completedJobsPath, 'utf8'));
        console.log(`Found ${completedJobsData.completedJobs.length} completed jobs:`, completedJobsData.completedJobs);
        
        if (completedJobsData.completedJobs.length === 0) {
            console.log('No completed jobs available for testing. Run a completed jobs scrape first.');
            return;
        }
        
        // Create a modified version of the current content with one job removed
        // Use a job ID from the completed jobs list
        const testJobId = completedJobsData.completedJobs[0];
        console.log(`Test job ID for removal: ${testJobId}`);
        
        // Create modified schedule for testing (copy first, then modify)
        const modifiedContent = JSON.parse(JSON.stringify(currentContent));
        
        // Check if the test job exists in the current content
        const jobToRemoveIndex = modifiedContent.workOrders.findIndex(job => job.id === testJobId);
        
        if (jobToRemoveIndex === -1) {
            console.log(`Job ${testJobId} not found in current content. Choose a different job ID.`);
            // Let's try to use a job that does exist
            if (modifiedContent.workOrders.length > 0) {
                const existingJobId = modifiedContent.workOrders[0].id;
                console.log(`Using existing job ID instead: ${existingJobId}`);
                // Add this job ID to the completed jobs list for testing
                completedJobsData.completedJobs.push(existingJobId);
                fs.writeFileSync(completedJobsPath, JSON.stringify(completedJobsData, null, 2));
                console.log(`Added job ${existingJobId} to completed jobs list for testing`);
                // Now remove this job from the modified content
                modifiedContent.workOrders.splice(0, 1);
                console.log(`Removed job ${existingJobId} from modified content for testing`);
            } else {
                console.log('No jobs available for testing.');
                return;
            }
        } else {
            // Remove the job from the modified content
            modifiedContent.workOrders.splice(jobToRemoveIndex, 1);
            console.log(`Removed job ${testJobId} from modified content for testing`);
        }
        
        // Save temporary files for testing
        const tempPreviousPath = path.join(__dirname, 'temp_previous.json');
        const tempCurrentPath = path.join(__dirname, 'temp_current.json');
        
        // Save the original content as "previous"
        fs.writeFileSync(tempPreviousPath, JSON.stringify(currentContent, null, 2));
        // Save the modified content (with job removed) as "current"
        fs.writeFileSync(tempCurrentPath, JSON.stringify(modifiedContent, null, 2));
        
        console.log('Created temporary test files:');
        console.log(`  Previous: ${tempPreviousPath}`);
        console.log(`  Current: ${tempCurrentPath}`);
        
        // Now compare the schedules
        console.log('\nComparing schedules...');
        const changes = compareSchedules(modifiedContent, currentContent, null, userId);
        
        console.log('\nComparison results:');
        console.log('  Summary:', changes.summary);
        console.log('  Total changes:', changes.allChanges.length);
        
        // Check if our test job was filtered out
        const jobWasFiltered = true;
        for (const change of changes.allChanges) {
            if (change.type === 'removed' && 
                ((change.jobId === testJobId) || 
                 (change.oldJobId === testJobId))) {
                console.log(`❌ FAILURE: Job ${testJobId} was detected as removed but should have been filtered out as completed!`);
                jobWasFiltered = false;
                break;
            }
        }
        
        if (jobWasFiltered) {
            console.log(`✅ SUCCESS: Job was correctly filtered out as a completed job!`);
        }
        
        // Clean up temporary files
        console.log('\nCleaning up temporary files...');
        fs.unlinkSync(tempPreviousPath);
        fs.unlinkSync(tempCurrentPath);
        console.log('Temporary files removed.');
    } catch (error) {
        console.error('Error in job removal simulation:', error);
        console.error(error.stack);
    }
}

// Run the simulation
simulateJobRemoval(); 