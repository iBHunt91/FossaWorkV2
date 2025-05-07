// A focused test to verify the add detection logic

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create test data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Set up test data with expected job ID format based on real data
const previousSchedule = {
    workOrders: [
        {
            id: "W-101",
            customer: {
                name: "Store One",
                storeNumber: "#5001",
                address: {
                    cityState: "Springfield IL"
                }
            },
            visits: {
                nextVisit: {
                    date: "04/01/2025"
                }
            },
            services: [
                { type: "dispenser" },
                { type: "dispenser" },
                { type: "other" }
            ]
        },
        {
            id: "W-102",
            customer: {
                name: "Store Two",
                storeNumber: "#5002",
                address: {
                    cityState: "Shelbyville IN"
                }
            },
            visits: {
                nextVisit: {
                    date: "04/05/2025"
                }
            },
            services: [
                { type: "dispenser" },
                { type: "other" }
            ]
        }
    ]
};

const currentSchedule = {
    workOrders: [
        {
            id: "W-101",
            customer: {
                name: "Store One",
                storeNumber: "#5001",
                address: {
                    cityState: "Springfield IL"
                }
            },
            visits: {
                nextVisit: {
                    date: "04/01/2025"
                }
            },
            services: [
                { type: "dispenser" },
                { type: "dispenser" },
                { type: "other" }
            ]
        },
        {
            id: "W-102",
            customer: {
                name: "Store Two",
                storeNumber: "#5002",
                address: {
                    cityState: "Shelbyville IN"
                }
            },
            visits: {
                nextVisit: {
                    date: "04/05/2025"
                }
            },
            services: [
                { type: "dispenser" },
                { type: "other" }
            ]
        },
        {
            id: "W-103", // New job added
            customer: {
                name: "Store Three",
                storeNumber: "#5003",
                address: {
                    cityState: "Capital City NV"
                }
            },
            visits: {
                nextVisit: {
                    date: "04/10/2025"
                }
            },
            services: [
                { type: "dispenser" },
                { type: "dispenser" },
                { type: "other" }
            ]
        }
    ]
};

// Write the schedules to the correct files
fs.writeFileSync(path.join(dataDir, 'scraped_content.json'), JSON.stringify(currentSchedule, null, 2));
fs.writeFileSync(path.join(dataDir, 'scraped_content.previous.json'), JSON.stringify(previousSchedule, null, 2));

console.log('Test data written to:');
console.log(`- ${path.join(dataDir, 'scraped_content.json')}`);
console.log(`- ${path.join(dataDir, 'scraped_content.previous.json')}`);

// Direct test of our job add function
import { compareSchedules } from './scripts/utils/scheduleComparator.js';

console.log('\nRunning direct test of compareSchedules:');
const changes = compareSchedules(currentSchedule, previousSchedule);

console.log('\nTest Results:');
console.log('--------------');
console.log(`Jobs Added: ${changes.summary.added}`);
console.log(`Jobs Removed: ${changes.summary.removed}`);
console.log(`Jobs Modified: ${changes.summary.modified}`);
console.log(`Jobs Swapped: ${changes.summary.swapped}`);

// Check for the added job
const hasAddedJob = changes.critical.some(change => 
    change.type === 'added' && change.jobId === 'W-103'
);

console.log('\nAdded job W-103 detected:', hasAddedJob ? 'Yes ✅' : 'No ❌');

// Log all critical changes
console.log('\nAll critical changes:');
changes.critical.forEach((change, i) => {
    console.log(`Change ${i + 1}:`, change.type, change.jobId || 'N/A');
});

// Now test the full flow with analyzeScheduleChanges
import { analyzeScheduleChanges } from './scripts/utils/scheduleComparator.js';

console.log('\nRunning full test with analyzeScheduleChanges:');
const fullChanges = analyzeScheduleChanges();

if (fullChanges) {
    console.log('\nFull Test Results:');
    console.log('-----------------');
    console.log(`Jobs Added: ${fullChanges.summary.added}`);
    console.log(`Jobs Removed: ${fullChanges.summary.removed}`);
    console.log(`Jobs Modified: ${fullChanges.summary.modified}`);
    console.log(`Jobs Swapped: ${fullChanges.summary.swapped}`);
    
    console.log('\nAdd Detection Test:', fullChanges.summary.added === 1 ? 'PASSED ✅' : 'FAILED ❌');
} else {
    console.log('Error: No changes detected or error occurred in analyzeScheduleChanges()');
} 