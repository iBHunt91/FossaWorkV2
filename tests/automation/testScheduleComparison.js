import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { analyzeScheduleChanges } from './scripts/utils/scheduleComparator.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create test data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Import the compareSchedules function directly for testing
import { compareSchedules } from './scripts/utils/scheduleComparator.js';

// Create sample schedules with a job swap
function createTestSchedules() {
    // Create base schedules
    const baseSchedule = {
        workOrders: [
            {
                id: "1001",
                customer: {
                    name: "Store One",
                    storeNumber: "S001",
                    address: {
                        cityState: "Springfield IL"
                    }
                },
                visits: {
                    nextVisit: {
                        date: "2023-11-01"
                    }
                },
                services: [
                    { type: "dispenser" },
                    { type: "dispenser" },
                    { type: "other" }
                ]
            },
            {
                id: "1002",
                customer: {
                    name: "Store Two",
                    storeNumber: "S002",
                    address: {
                        cityState: "Shelbyville IN"
                    }
                },
                visits: {
                    nextVisit: {
                        date: "2023-11-05"
                    }
                },
                services: [
                    { type: "dispenser" },
                    { type: "other" }
                ]
            },
            {
                id: "1003",
                customer: {
                    name: "Store Three",
                    storeNumber: "S003",
                    address: {
                        cityState: "Capital City NV"
                    }
                },
                visits: {
                    nextVisit: {
                        date: "2023-11-10"
                    }
                },
                services: [
                    { type: "dispenser" },
                    { type: "dispenser" },
                    { type: "dispenser" },
                    { type: "other" }
                ]
            }
        ]
    };

    // Create a previous schedule
    const previousSchedule = JSON.parse(JSON.stringify(baseSchedule));
    
    // Create a current schedule with swapped dates between jobs 1001 and 1002
    const currentSchedule = JSON.parse(JSON.stringify(baseSchedule));
    currentSchedule.workOrders[0].visits.nextVisit.date = "2023-11-05"; // Job 1001 now on 11-05
    currentSchedule.workOrders[1].visits.nextVisit.date = "2023-11-01"; // Job 1002 now on 11-01
    
    // Also add a new job and remove one
    currentSchedule.workOrders.push({
        id: "1004",
        customer: {
            name: "Store Four",
            storeNumber: "S004",
            address: {
                cityState: "Ogdenville OR"
            }
        },
        visits: {
            nextVisit: {
                date: "2023-11-15"
            }
        },
        services: [
            { type: "dispenser" },
            { type: "dispenser" },
            { type: "other" }
        ]
    });
    
    // Remove job 1003
    currentSchedule.workOrders.splice(2, 1);
    
    // Print out the job IDs to verify
    console.log("Previous schedule job IDs:", previousSchedule.workOrders.map(job => job.id));
    console.log("Current schedule job IDs:", currentSchedule.workOrders.map(job => job.id));
    
    return { previousSchedule, currentSchedule };
}

// Run a direct test of the compare function
function testCompareSchedulesDirectly() {
    console.log("\nDirect test of compareSchedules function:");
    const { previousSchedule, currentSchedule } = createTestSchedules();
    
    // Call compareSchedules directly
    const changes = compareSchedules(currentSchedule, previousSchedule);
    
    console.log("\nDirect test results:");
    console.log("--------------------");
    console.log(`Jobs Swapped: ${changes.summary.swapped}`);
    console.log(`Jobs Added: ${changes.summary.added}`);
    console.log(`Jobs Removed: ${changes.summary.removed}`);
    console.log(`Jobs Modified: ${changes.summary.modified}`);
    
    // Check if the changes contain an 'added' entry for job 1004
    const hasAddedJob = changes.critical.some(change => 
        change.type === 'added' && change.jobId === '1004'
    );
    
    console.log("\nAdded job 1004 detected:", hasAddedJob ? "Yes ✅" : "No ❌");
    
    // Log all critical changes for inspection
    console.log("\nAll critical changes:");
    changes.critical.forEach((change, i) => {
        console.log(`Change ${i + 1}:`, change.type, change.jobId || 'N/A');
    });
    
    return changes;
}

// Write schedules to files
function setupTestFiles() {
    const { previousSchedule, currentSchedule } = createTestSchedules();
    
    // Write test files using the correct names expected by dataManager.js
    fs.writeFileSync(path.join(dataDir, 'scraped_content.json'), JSON.stringify(currentSchedule, null, 2));
    fs.writeFileSync(path.join(dataDir, 'scraped_content.previous.json'), JSON.stringify(previousSchedule, null, 2));
    
    console.log("Files written to:");
    console.log(`- ${path.join(dataDir, 'scraped_content.json')}`);
    console.log(`- ${path.join(dataDir, 'scraped_content.previous.json')}`);
}

// Main test function
async function runTest() {
    console.log('Setting up test files...');
    setupTestFiles();
    
    // First run a direct test
    const directTestChanges = testCompareSchedulesDirectly();
    
    console.log('\nAnalyzing schedule changes using analyzeScheduleChanges...');
    const changes = analyzeScheduleChanges();
    
    if (!changes) {
        console.log('Error: No changes detected or error occurred.');
        return;
    }
    
    console.log('\nTest Results from analyzeScheduleChanges:');
    console.log('------------------------');
    console.log(`Jobs Swapped: ${changes.summary.swapped}`);
    console.log(`Jobs Added: ${changes.summary.added}`);
    console.log(`Jobs Removed: ${changes.summary.removed}`);
    console.log(`Jobs Modified: ${changes.summary.modified}`);
    
    console.log('\nSwap Detection Test:', changes.summary.swapped === 2 ? 'PASSED ✅' : 'FAILED ❌');
    console.log('Add Detection Test:', changes.summary.added === 1 ? 'PASSED ✅' : 'FAILED ❌');
    console.log('Remove Detection Test:', changes.summary.removed === 1 ? 'PASSED ✅' : 'FAILED ❌');
    
    console.log('\nFull change report was written to data/schedule_changes.txt');
}

// Run the test
runTest().catch(err => {
    console.error('Test failed with error:', err);
}); 