// Test script to verify notification improvements

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { sendScheduleChangeNotifications } from './scripts/notifications/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create test change data with a mixture of changes to test
const testChanges = {
    critical: [
        // Test removal with dispenser count
        {
            type: 'removed',
            jobId: 'W-123396',
            store: '#5450',
            storeName: 'Wawa',
            dispensers: 3, // Ensure this has an actual value
            location: 'Fort, Meade',
            date: '04/21/2025'
        },
        // Test date change with dispenser count
        {
            type: 'date_changed',
            jobId: 'W-126685',
            store: '#40334',
            storeName: '7-Eleven Stores, Inc',
            location: 'Bartow, FL',
            dispensers: 2, // Ensure this has an actual value
            oldDate: '04/28/2025',
            newDate: '04/23/2025'
        },
        // Test another date change
        {
            type: 'date_changed',
            jobId: 'W-110174',
            store: '#5277',
            storeName: 'Wawa',
            location: 'US, 27',
            dispensers: 4, // Ensure this has an actual value
            oldDate: '04/23/2025',
            newDate: '04/28/2025'
        },
        // Test a swap with dispenser counts
        {
            type: 'swap',
            job1Id: 'W-126685',
            job1Store: '#40334',
            job1StoreName: '7-Eleven Stores, Inc',
            job1Location: 'Bartow, FL',
            job1Dispensers: 2, // Ensure this has an actual value
            job2Id: 'W-110174',
            job2Store: '#5277',
            job2StoreName: 'Wawa',
            job2Location: 'US, 27',
            job2Dispensers: 4, // Ensure this has an actual value
            date1: '04/28/2025',
            date2: '04/23/2025'
        }
    ],
    high: [],
    medium: [],
    low: [],
    summary: {
        removed: 1,
        added: 0,
        modified: 2,
        swapped: 2
    }
};

// Run the test
async function runTest() {
    console.log('Testing notifications with improved dispenser information and complete Pushover alerts...');
    
    try {
        // Send notifications with our test changes
        const result = await sendScheduleChangeNotifications(testChanges);
        
        console.log('\nNotification results:');
        console.log('====================');
        console.log(`Overall success: ${result.success ? 'YES ✅' : 'NO ❌'}`);
        
        if (result.results.email) {
            console.log(`Email notification: ${result.results.email.success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
        } else {
            console.log('Email notification: Not sent');
        }
        
        if (result.results.pushover) {
            const pushoverResults = Array.isArray(result.results.pushover) ? 
                result.results.pushover : [result.results.pushover];
            
            console.log(`Pushover notification: ${pushoverResults.some(r => r.success) ? 'SUCCESS ✅' : 'FAILED ❌'}`);
            
            pushoverResults.forEach((pushoverResult, i) => {
                if (pushoverResult.success) {
                    console.log(`  User ${i+1}: SUCCESS ✅`);
                } else {
                    console.log(`  User ${i+1}: FAILED ❌ - ${pushoverResult.error ? JSON.stringify(pushoverResult.error) : 'Unknown error'}`);
                }
            });
        } else {
            console.log('Pushover notification: Not sent');
        }
        
        console.log('\nCheck your email and Pushover app to verify:');
        console.log('1. Dispenser counts now display correctly (not "undefined" or "0")');
        console.log('2. Pushover alerts now include all changes (removals, date changes, and swaps)');
        console.log('3. All changes have correct information in both notifications');
        
    } catch (error) {
        console.error('Error during test:', error);
    }
}

// Run the test
runTest(); 