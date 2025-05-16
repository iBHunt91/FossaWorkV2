import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { resolveUserFilePath } from '../../server/utils/userManager.js';
import { compareSchedules } from '../utils/scheduleComparator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test the completed jobs logic by simulating various scenarios
 * @param {string} userId - Optional user ID to test with
 */
export async function testCompletedJobsLogic(userId) {
    console.log('=== TESTING COMPLETED JOBS LOGIC ===');
    
    // Use provided user ID, command line argument, or default
    const TEST_USER_ID = userId || process.argv[2] || '7bea3bdb7e8e303eacaba442bd824004';
    console.log(`Using test user ID: ${TEST_USER_ID}`);
    
    // Create sample schedule data
    const previousSchedule = {
        workOrders: [
            createSampleJob('W-111111', 'Store #123', '2023-05-10'),
            createSampleJob('W-222222', 'Store #456', '2023-05-11'), 
            createSampleJob('W-333333', 'Store #789', '2023-05-12'), // This one will be removed but completed
            createSampleJob('W-444444', 'Store #101', '2023-05-13')  // This one will be truly removed
        ],
        metadata: {
            timestamp: new Date().toISOString(),
            count: 4
        }
    };
    
    const currentSchedule = {
        workOrders: [
            createSampleJob('W-111111', 'Store #123', '2023-05-10'),            // Unchanged
            createSampleJob('W-222222', 'Store #456', '2023-05-15'),            // Date changed
            createSampleJob('W-555555', 'Store #202', '2023-05-14')             // New job added
            // W-333333 is removed but completed
            // W-444444 is truly removed
        ],
        metadata: {
            timestamp: new Date().toISOString(),
            count: 3
        }
    };
    
    // Create and save completed jobs data with W-333333 marked as completed
    const completedJobsPath = resolveUserFilePath('completed_jobs.json', TEST_USER_ID);
    const completedJobsData = {
        completedJobs: ['W-333333'],
        metadata: {
            timestamp: new Date().toISOString(),
            user: TEST_USER_ID,
            lastScrapeCount: 1
        }
    };
    
    // Ensure the directory exists
    const dir = path.dirname(completedJobsPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save completed jobs data
    fs.writeFileSync(completedJobsPath, JSON.stringify(completedJobsData, null, 2));
    console.log(`Saved test completed jobs data to ${completedJobsPath}`);
    console.log(`Completed jobs in file: ${completedJobsData.completedJobs.join(', ')}`);
    
    // Run the schedule comparison
    console.log('\nRunning schedule comparison with completed job data...');
    const changes = compareSchedules(currentSchedule, previousSchedule, null, TEST_USER_ID);
    
    // Analyze results
    console.log('\n=== TEST RESULTS ===');
    console.log('Changes summary:', changes.summary);
    console.log(`Total detected changes: ${changes.allChanges.length}`);
    
    // Check if W-333333 (completed) was detected as removed
    const completedJobRemoved = changes.allChanges.some(change => 
        change.type === 'removed' && change.jobId === 'W-333333');
    
    // Check if W-444444 (truly removed) was detected as removed
    const removedJobDetected = changes.allChanges.some(change => 
        change.type === 'removed' && change.jobId === 'W-444444');
    
    // Check if date change was detected
    const dateChangeDetected = changes.allChanges.some(change => 
        change.type === 'date_changed' && change.jobId === 'W-222222');
    
    // Check if new job was detected
    const newJobDetected = changes.allChanges.some(change => 
        change.type === 'added' && change.jobId === 'W-555555');
    
    // Print test results
    console.log('\nTest Results:');
    console.log(`1. Completed job (W-333333) NOT detected as removed: ${!completedJobRemoved ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`2. Truly removed job (W-444444) detected as removed: ${removedJobDetected ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`3. Date change detected: ${dateChangeDetected ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`4. New job detected: ${newJobDetected ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    // Print all changes for detailed review
    console.log('\nDetailed Changes:');
    changes.allChanges.forEach(change => {
        console.log(`- Type: ${change.type}, Job ID: ${change.jobId || change.oldJobId || change.job1Id}`);
    });
    
    console.log('\n=== TEST COMPLETED ===');
}

/**
 * Helper function to create a sample job
 */
function createSampleJob(id, storeNumber, date) {
    return {
        id: id,
        customer: {
            name: `Test Store ${storeNumber}`,
            storeNumber: storeNumber,
            address: {
                street: '123 Main St',
                cityState: 'Anytown CA',
                city: 'Anytown'
            }
        },
        services: [
            {
                type: 'Meter Calibration',
                quantity: 5,
                description: 'Standard Calibration'
            }
        ],
        visits: {
            nextVisit: {
                date: date,
                time: '09:00 - 12:00'
            }
        }
    };
}

// Run the test
testCompletedJobsLogic().catch(err => console.error('Test failed:', err)); 