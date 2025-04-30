// Script to simulate a change in schedule by modifying the current data file

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { analyzeScheduleChanges } from '../../scripts/utils/scheduleComparator.js';
import { sendScheduleChangeNotifications } from '../../scripts/notifications/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

// Path to data files
const currentPath = path.join(projectRoot, 'data', 'scraped_content.json');
const previousPath = path.join(projectRoot, 'data', 'scraped_content.previous.json');

console.log('Testing change detection:');
console.log('- Current file: ' + currentPath);
console.log('- Previous file: ' + previousPath);

// Check if files exist
if (!fs.existsSync(currentPath)) {
    console.error(`Current file doesn't exist: ${currentPath}`);
    process.exit(1);
}

if (!fs.existsSync(previousPath)) {
    console.error(`Previous file doesn't exist: ${previousPath}`);
    process.exit(1);
}

// Create a backup of the current file
const backupPath = path.join(projectRoot, 'data', `scraped_content.backup-${Date.now()}.json`);
fs.copyFileSync(currentPath, backupPath);
console.log(`Created backup: ${backupPath}`);

async function runTest() {
    try {
        // Read the current file
        const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
        console.log(`Current file has ${currentData.workOrders.length} work orders`);
    
        // Check if there are any work orders
        if (!currentData.workOrders || currentData.workOrders.length === 0) {
            console.error('No work orders in current file');
            process.exit(1);
        }
    
        // Modify the current file to simulate a change
        // 1. Remove a work order
        const removedJob = currentData.workOrders.splice(0, 1)[0];
        console.log(`Removed job: ${removedJob.id} (${removedJob.customer?.name || 'unknown'})`);
    
        // 2. Add a new work order with a different ID
        const newJob = JSON.parse(JSON.stringify(removedJob));
        newJob.id = 'W-' + Math.floor(Math.random() * 100000); // Random new ID
        currentData.workOrders.push(newJob);
        console.log(`Added new job: ${newJob.id} (based on removed job)`);
    
        // 3. Change the date of another work order if there are multiple
        if (currentData.workOrders.length > 1) {
            const jobToChange = currentData.workOrders[1];
            if (jobToChange.visits && jobToChange.visits.nextVisit && jobToChange.visits.nextVisit.date) {
                const originalDate = jobToChange.visits.nextVisit.date;
                // Change date to tomorrow
                const date = new Date();
                date.setDate(date.getDate() + 1);
                const newDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
                
                jobToChange.visits.nextVisit.date = newDate;
                console.log(`Changed job ${jobToChange.id} date from ${originalDate} to ${newDate}`);
            }
        }
    
        // Save the modified file
        fs.writeFileSync(currentPath, JSON.stringify(currentData, null, 2));
        console.log('Saved modified current file');
    
        // Analyze schedule changes
        console.log('\nAnalyzing schedule changes...');
        const changes = analyzeScheduleChanges();
        
        if (!changes) {
            console.log('No changes detected');
            return;
        }
    
        console.log('Changes detected:');
        console.log(`- Critical: ${changes.critical.length}`);
        console.log(`- High: ${changes.high.length}`);
        console.log(`- Medium: ${changes.medium.length}`);
        console.log(`- Low: ${changes.low.length}`);
    
        // Send notifications if there are significant changes
        if (changes.critical.length > 0 || changes.high.length > 0) {
            console.log('\nSending notifications...');
            const result = await sendScheduleChangeNotifications(changes);
            console.log('Notification result:');
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('\nNo significant changes to send notifications for');
        }
    } catch (error) {
        console.error('Error:', error);
        
        // Restore the backup if there was an error
        console.log('Restoring backup...');
        fs.copyFileSync(backupPath, currentPath);
        console.log('Backup restored');
    } finally {
        console.log('\nDon\'t forget to restore the backup file if needed:');
        console.log(`copy "${backupPath}" "${currentPath}"`);
    }
}

// Run the test
runTest().catch(error => {
    console.error('Unhandled error:', error);
    // Restore the backup if there was an error
    fs.copyFileSync(backupPath, currentPath);
    console.log('Backup restored due to unhandled error');
}); 