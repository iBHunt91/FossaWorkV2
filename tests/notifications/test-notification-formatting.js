// Test script to verify consistent notification formatting
import { sendScheduleChangeEmail } from '../../scripts/email/emailService.js';
import { sendPushoverScheduleChange } from '../../scripts/pushover/pushoverService.js';
import { generateScheduleChangesHtml } from '../../scripts/notifications/formatService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

// Load environment variables
dotenv.config({ path: path.join(projectRoot, '.env') });

// Create sample test data with various types of changes
const testChanges = {
    critical: [
        {
            type: 'added',
            jobId: 'W-123456',
            store: '12345',
            storeName: 'Test Store 1',
            location: 'Test City, CA',
            date: '2023-12-15',
            dispensers: 4
        },
        {
            type: 'removed',
            jobId: 'W-234567',
            store: '23456',
            storeName: 'Test Store 2',
            location: 'Another City, TX',
            date: '2023-12-16',
            dispensers: 6
        }
    ],
    high: [
        {
            type: 'date_changed',
            jobId: 'W-345678',
            store: '34567',
            storeName: 'Test Store 3',
            location: 'Third City, FL',
            oldDate: '2023-12-17',
            newDate: '2023-12-20',
            dispensers: 3
        },
        {
            type: 'swap',
            job1Id: 'W-456789',
            job1Store: '45678',
            job1StoreName: 'Test Store 4',
            job1Location: 'Fourth City, NY',
            job1Dispensers: 5,
            oldDate1: '2023-12-21',
            newDate1: '2023-12-22',
            job2Id: 'W-567890',
            job2Store: '56789',
            job2StoreName: 'Test Store 5',
            job2Location: 'Fifth City, IL',
            job2Dispensers: 2,
            oldDate2: '2023-12-22',
            newDate2: '2023-12-21'
        }
    ],
    medium: [],
    low: [],
    summary: {
        removed: 1,
        added: 1,
        modified: 1,
        swapped: 1
    }
};

// Create a test user
const testUser = {
    id: 'test-user-1',
    name: 'Test User',
    email: process.env.TEST_EMAIL || 'user@example.com',
    pushoverKey: process.env.PUSHOVER_USER_KEY || '',
    preferences: {
        display: {
            display_fields: {
                JOB_ID: true,
                STORE_NUMBER: true,
                STORE_NAME: true,
                LOCATION: true,
                DATE: true,
                DISPENSERS: true
            }
        }
    },
    notificationSettings: {
        email: {
            enabled: true
        },
        pushover: {
            enabled: true,
            priority: 0,
            sound: 'pushover'
        }
    }
};

// Function to test all notification channels with the same data
async function testNotifications() {
    try {
        console.log('=== Testing Notification Formatting ===');
        console.log('Testing with sample changes:', JSON.stringify(testChanges.summary, null, 2));

        // Generate HTML output using the centralized formatService
        console.log('\n--- Testing formatService directly ---');
        const htmlContent = generateScheduleChangesHtml(testChanges, new Date(), testUser);
        console.log('Generated HTML content length:', htmlContent.length);
        console.log('HTML content excerpt:', htmlContent.substring(0, 200) + '...');

        // Test email notification
        console.log('\n--- Testing Email Notification ---');
        const emailResult = await sendScheduleChangeEmail(testChanges, testUser);
        console.log('Email notification result:', emailResult);

        // Test Pushover notification
        console.log('\n--- Testing Pushover Notification ---');
        const pushoverResult = await sendPushoverScheduleChange(testChanges, testUser);
        console.log('Pushover notification result:', pushoverResult);

        console.log('\n=== Notification Tests Complete ===');
        return { success: true, email: emailResult, pushover: pushoverResult };
    } catch (error) {
        console.error('Error testing notifications:', error);
        return { success: false, error: error.message };
    }
}

// Run the test
testNotifications()
    .then(result => {
        console.log('\nTest Result:', result.success ? 'SUCCESS' : 'FAILURE');
        if (!result.success) {
            console.error('Error:', result.error);
            process.exit(1);
        }
        process.exit(0);
    })
    .catch(error => {
        console.error('Unexpected error during test:', error);
        process.exit(1);
    }); 