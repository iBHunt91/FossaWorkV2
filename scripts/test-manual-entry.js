import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getActiveUser, resolveUserFilePath } from '../server/utils/userManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test script that simulates manually adding/removing jobs from scraped content
 * to verify the completed jobs detection works as expected
 */
async function testManualEntry() {
    try {
        console.log('Starting manual entry test...');
        
        // Get active user ID
        const userId = getActiveUser();
        console.log(`Active user: ${userId}`);
        
        // Get paths to the relevant files
        const scrapedContentPath = resolveUserFilePath('scraped_content.json', userId);
        const completedJobsPath = resolveUserFilePath('completed_jobs.json', userId);
        
        if (!fs.existsSync(scrapedContentPath)) {
            console.error('Scraped content file not found. Run a scrape first.');
            return;
        }
        
        if (!fs.existsSync(completedJobsPath)) {
            console.error('Completed jobs file not found. Run a completed jobs scrape first.');
            return;
        }
        
        // Load the scraped content
        const scrapedContent = JSON.parse(fs.readFileSync(scrapedContentPath, 'utf8'));
        console.log(`Loaded scraped content with ${scrapedContent.workOrders.length} jobs`);
        
        // Load the completed jobs
        const completedJobs = JSON.parse(fs.readFileSync(completedJobsPath, 'utf8'));
        console.log(`Loaded ${completedJobs.completedJobs.length} completed jobs:`, completedJobs.completedJobs);
        
        if (completedJobs.completedJobs.length === 0) {
            console.error('No completed jobs available for testing. Please run a completed jobs scrape first.');
            return;
        }
        
        // Backup the original files
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupScrapedContentPath = path.join(__dirname, `scraped_content_backup_${timestamp}.json`);
        const backupCompletedJobsPath = path.join(__dirname, `completed_jobs_backup_${timestamp}.json`);
        
        fs.writeFileSync(backupScrapedContentPath, JSON.stringify(scrapedContent, null, 2));
        fs.writeFileSync(backupCompletedJobsPath, JSON.stringify(completedJobs, null, 2));
        
        console.log(`Backed up original files:`);
        console.log(`- Scraped content: ${backupScrapedContentPath}`);
        console.log(`- Completed jobs: ${backupCompletedJobsPath}`);
        
        // Create a test job using one of the completed job IDs
        const testJobId = completedJobs.completedJobs[0];
        console.log(`\nTest job ID: ${testJobId}`);
        
        // Choose a template job from scraped content to clone
        const templateJob = scrapedContent.workOrders[0];
        console.log(`Using template job: ${templateJob.id}`);
        
        // Create a modified version of scraped content with the test job added
        const modifiedContent = JSON.parse(JSON.stringify(scrapedContent));
        
        // Clone the template job but change its ID to the completed job ID
        const testJob = JSON.parse(JSON.stringify(templateJob));
        testJob.id = testJobId;
        
        // Add the test job to the work orders
        modifiedContent.workOrders.push(testJob);
        
        // Save the modified content
        fs.writeFileSync(scrapedContentPath, JSON.stringify(modifiedContent, null, 2));
        console.log(`Added test job ${testJobId} to scraped content`);
        
        // Backup the current scraped content to the previous file
        const previousContentPath = resolveUserFilePath('scraped_content.previous.json', userId);
        fs.writeFileSync(previousContentPath, JSON.stringify(modifiedContent, null, 2));
        console.log(`Updated previous scraped content file`);
        
        // Now remove the test job to simulate it being "removed"
        const reducedContent = JSON.parse(JSON.stringify(modifiedContent));
        reducedContent.workOrders = reducedContent.workOrders.filter(job => job.id !== testJobId);
        
        // Save the reduced content
        fs.writeFileSync(scrapedContentPath, JSON.stringify(reducedContent, null, 2));
        console.log(`Removed test job ${testJobId} from current scraped content to simulate job removal`);
        
        console.log(`\nSetup complete. Now run the following command to test the detection:`);
        console.log(`node unified_scrape.js manual`);
        console.log(`\nThe system should detect that job ${testJobId} has been removed but NOT alert because it's in the completed jobs list.`);
        console.log(`\nAfter testing, run this command to restore original files:`);
        console.log(`node -e "require('fs').copyFileSync('${backupScrapedContentPath}', '${scrapedContentPath}'); require('fs').copyFileSync('${backupCompletedJobsPath}', '${completedJobsPath}'); console.log('Files restored')"`);
        
    } catch (error) {
        console.error('Error in manual entry test:', error);
    }
}

// Run the test
testManualEntry(); 