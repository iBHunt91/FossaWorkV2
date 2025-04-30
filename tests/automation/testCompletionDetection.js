// Test script for automatic job completion detection

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Format date as MM/DD/YYYY
function formatDate(date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

// Generate test schedules
function createTestSchedules() {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Format today's date for job data
    const todayStr = formatDate(today);
    
    // Get tomorrow's date
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);
    
    // Get a future date (5 days from now)
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 5);
    const futureDateStr = formatDate(futureDate);
    
    // Create previous schedule with jobs for today, tomorrow, and future
    const previousSchedule = {
        workOrders: [
            {
                id: "W-101",
                customer: {
                    name: "Today Store",
                    storeNumber: "#5001",
                    address: {
                        cityState: "Springfield IL"
                    }
                },
                visits: {
                    nextVisit: {
                        date: todayStr
                    }
                },
                services: [
                    { type: "dispenser" },
                    { type: "dispenser" }
                ]
            },
            {
                id: "W-102",
                customer: {
                    name: "Tomorrow Store",
                    storeNumber: "#5002",
                    address: {
                        cityState: "Shelbyville IN"
                    }
                },
                visits: {
                    nextVisit: {
                        date: tomorrowStr
                    }
                },
                services: [
                    { type: "dispenser" }
                ]
            },
            {
                id: "W-103",
                customer: {
                    name: "Future Store",
                    storeNumber: "#5003",
                    address: {
                        cityState: "Capital City NV"
                    }
                },
                visits: {
                    nextVisit: {
                        date: futureDateStr
                    }
                },
                services: [
                    { type: "dispenser" },
                    { type: "dispenser" },
                    { type: "dispenser" }
                ]
            }
        ]
    };
    
    // Create current schedule with some jobs removed
    const currentSchedule = {
        workOrders: [
            // "W-101" removed (today's job) - should be auto-detected as completed
            {
                id: "W-102",
                customer: {
                    name: "Tomorrow Store",
                    storeNumber: "#5002",
                    address: {
                        cityState: "Shelbyville IN"
                    }
                },
                visits: {
                    nextVisit: {
                        date: tomorrowStr
                    }
                },
                services: [
                    { type: "dispenser" }
                ]
            },
            // "W-103" removed (future job) - should be detected as genuinely removed
        ]
    };
    
    return { previousSchedule, currentSchedule, today: todayStr, tomorrow: tomorrowStr, future: futureDateStr };
}

// Clean up completed jobs file to start fresh
const completedJobsPath = path.join(__dirname, 'data/completed_jobs.json');
if (fs.existsSync(completedJobsPath)) {
    fs.unlinkSync(completedJobsPath);
    console.log('Removed existing completed jobs file for clean test');
}

// Write test data to the correct files used by the application
const { previousSchedule, currentSchedule, today, tomorrow, future } = createTestSchedules();
fs.writeFileSync(path.join(dataDir, 'scraped_content.previous.json'), JSON.stringify(previousSchedule, null, 2));
fs.writeFileSync(path.join(dataDir, 'scraped_content.json'), JSON.stringify(currentSchedule, null, 2));

console.log('Test data created:');
console.log(`- Today's date: ${today}`);
console.log(`- Job W-101 scheduled for today - was removed in current schedule`);
console.log(`- Job W-103 scheduled for ${future} - was removed in current schedule`);
console.log(`- Job W-102 scheduled for ${tomorrow} - still exists in current schedule`);

// Import and run the schedule comparison
import { analyzeScheduleChanges } from './scripts/utils/scheduleComparator.js';

console.log('\nRunning schedule comparison...');
const changes = analyzeScheduleChanges();

if (changes) {
    console.log('\nTest Results:');
    console.log('----------------');
    
    // Check for completed jobs (should be W-101)
    const completedJobs = changes.low.filter(change => change.type === 'completed');
    const removedJobs = changes.critical.filter(change => change.type === 'removed');
    
    console.log(`Jobs detected as completed: ${completedJobs.length}`);
    completedJobs.forEach(job => {
        console.log(`- ${job.jobId} (${job.storeName}) scheduled for ${job.date}${job.autoDetected ? ' - auto-detected ✅' : ''}`);
    });
    
    console.log(`\nJobs detected as removed: ${removedJobs.length}`);
    removedJobs.forEach(job => {
        console.log(`- ${job.jobId} (${job.storeName}) scheduled for ${job.date}`);
    });
    
    // Check the completed jobs file to see if the auto-completed job was added
    if (fs.existsSync(completedJobsPath)) {
        const completedJobsData = JSON.parse(fs.readFileSync(completedJobsPath, 'utf8'));
        console.log(`\nCompleted jobs stored in file: ${completedJobsData.length}`);
        completedJobsData.forEach(job => {
            console.log(`- ${job.jobId} (${job.storeName}) on ${job.date}`);
        });
    } else {
        console.log('\nNo completed jobs file was created');
    }
    
    // Verify test success
    const todayJobCompletedCorrectly = completedJobs.some(job => job.jobId === 'W-101' && job.autoDetected);
    const futureJobRemovedCorrectly = removedJobs.some(job => job.jobId === 'W-103');
    
    console.log('\nTest Summary:');
    console.log(`- Today's job auto-detected as completed: ${todayJobCompletedCorrectly ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`- Future job correctly marked as removed: ${futureJobRemovedCorrectly ? 'PASSED ✅' : 'FAILED ❌'}`);
    
} else {
    console.log('Error: No changes detected or an error occurred');
} 