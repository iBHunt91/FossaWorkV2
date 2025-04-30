import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Initialize environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Helper function to get visit ID
function getVisitId(id) {
    if (!id || !id.includes('-')) return id;
    return id.split('-')[1] || id;
}

async function sendEnhancedPushoverTest() {
    // Get credentials from environment variables
    const appToken = process.env.PUSHOVER_APP_TOKEN;
    const userKey = process.env.PUSHOVER_USER_KEY;

    // Sample changes object with more detailed information
    const sampleChanges = {
        critical: [
            {
                type: 'replacement',
                removedJobId: 'W-112041',
                removedStore: 'Circle #5133',
                removedDispensers: 8,
                removedLocation: 'Riverview, FL',
                addedJobId: 'W-112042',
                addedStore: 'Circle #5286',
                addedDispensers: 6,
                addedLocation: 'Tampa, FL',
                date: '04/25/2025',
                manufacturer: 'Gilbarco',
                service: 'Meter Calibration'
            },
            {
                type: 'removed',
                jobId: 'W-112043',
                store: '7-Eleven #5134',
                dispensers: 4,
                location: 'Orlando, FL',
                date: '04/28/2025',
                manufacturer: 'Gilbarco',
                service: 'Meter Calibration'
            }
        ],
        high: [
            {
                type: 'date_changed',
                jobId: 'W-112044',
                store: 'Wawa #5135',
                dispensers: 6,
                location: 'Miami, FL',
                oldDate: '04/30/2025',
                newDate: '05/02/2025',
                manufacturer: 'Gilbarco',
                service: 'Meter Calibration'
            },
            {
                type: 'added',
                jobId: 'W-112045',
                store: 'Speedway #5136',
                dispensers: 10,
                location: 'Jacksonville, FL',
                date: '05/05/2025',
                manufacturer: 'Gilbarco',
                service: 'Meter Calibration'
            }
        ]
    };

    // Count the number of each type of change
    const counts = {
        replacement: 0,
        removed: 0,
        added: 0,
        date_changed: 0
    };

    // Count changes by type
    [...sampleChanges.critical, ...sampleChanges.high].forEach(change => {
        if (counts[change.type] !== undefined) {
            counts[change.type]++;
        }
    });

    // Create a summary subject
    let subject = 'Schedule Changes: ';
    const parts = [];
    
    if (counts.replacement > 0) parts.push(`${counts.replacement} replaced`);
    if (counts.removed > 0) parts.push(`${counts.removed} removed`);
    if (counts.added > 0) parts.push(`${counts.added} added`);
    if (counts.date_changed > 0) parts.push(`${counts.date_changed} rescheduled`);
    
    subject += parts.join(', ');

    // Create a detailed message with all changes
    let message = ``;

    // Add a header with horizontal line
    message += `━━━━━━━━━━ FOSSA MONITOR ━━━━━━━━━━\n\n`;

    // Add a summary section at the top
    message += `📊 SUMMARY\n`;
    message += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
    message += `• Total Changes: ${sampleChanges.critical.length + sampleChanges.high.length}\n`;
    message += `• Critical: ${sampleChanges.critical.length}\n`;
    message += `• High Priority: ${sampleChanges.high.length}\n`;
    
    // Extract list of unique customer names
    const customers = new Set();
    [...sampleChanges.critical, ...sampleChanges.high].forEach(change => {
        if (change.removedStore) customers.add(change.removedStore.split('#')[0].trim());
        if (change.addedStore) customers.add(change.addedStore.split('#')[0].trim());
        if (change.store) customers.add(change.store.split('#')[0].trim());
    });
    
    if (customers.size > 0) {
        message += `• Customers: ${Array.from(customers).join(', ')}\n`;
    }
    
    message += `\n`;

    // Group changes by type for better readability
    if (counts.replacement > 0) {
        message += `📅 REPLACEMENTS\n`;
        message += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
        [...sampleChanges.critical, ...sampleChanges.high]
            .filter(change => change.type === 'replacement')
            .forEach((change, index) => {
                if (index > 0) message += `\n`; // Add space between multiple items
                message += `• ${change.removedStore} → ${change.addedStore}\n`;
                message += `  Visit #${getVisitId(change.removedJobId)} → #${getVisitId(change.addedJobId)}\n`;
                message += `  ${change.removedDispensers} → ${change.addedDispensers} Dispensers (${change.manufacturer})\n`;
                message += `  ${change.removedLocation} → ${change.addedLocation}\n`;
                message += `  📆 ${change.date} | ${change.service}\n`;
            });
        message += `\n`;
    }

    if (counts.removed > 0) {
        message += `❌ REMOVED VISITS\n`;
        message += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
        [...sampleChanges.critical, ...sampleChanges.high]
            .filter(change => change.type === 'removed')
            .forEach((change, index) => {
                if (index > 0) message += `\n`; // Add space between multiple items
                message += `• ${change.store}\n`;
                message += `  Visit #${getVisitId(change.jobId)}\n`;
                message += `  ${change.dispensers} Dispensers (${change.manufacturer})\n`;
                message += `  📍 ${change.location}\n`;
                message += `  📆 ${change.date} | ${change.service}\n`;
            });
        message += `\n`;
    }

    if (counts.added > 0) {
        message += `✅ NEW VISITS\n`;
        message += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
        [...sampleChanges.critical, ...sampleChanges.high]
            .filter(change => change.type === 'added')
            .forEach((change, index) => {
                if (index > 0) message += `\n`; // Add space between multiple items
                message += `• ${change.store}\n`;
                message += `  Visit #${getVisitId(change.jobId)}\n`;
                message += `  ${change.dispensers} Dispensers (${change.manufacturer})\n`;
                message += `  📍 ${change.location}\n`;
                message += `  📆 ${change.date} | ${change.service}\n`;
            });
        message += `\n`;
    }

    if (counts.date_changed > 0) {
        message += `🔄 RESCHEDULED\n`;
        message += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
        [...sampleChanges.critical, ...sampleChanges.high]
            .filter(change => change.type === 'date_changed')
            .forEach((change, index) => {
                if (index > 0) message += `\n`; // Add space between multiple items
                message += `• ${change.store}\n`;
                message += `  Visit #${getVisitId(change.jobId)}\n`;
                message += `  ${change.dispensers} Dispensers (${change.manufacturer})\n`;
                message += `  📍 ${change.location}\n`;
                message += `  📆 ${change.oldDate} → ${change.newDate} | ${change.service}\n`;
            });
        message += `\n`;
    }

    // Add footer with timestamp
    const date = new Date();
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `Updated: ${formattedDate}`;

    // Determine priority and sound based on the types of changes
    const priority = sampleChanges.critical.length > 0 ? 1 : 0;
    
    // Select appropriate sound based on priority and number of changes
    let sound = "pushover"; // default sound
    
    if (sampleChanges.critical.length > 0) {
        // Use more attention-grabbing sounds for critical changes
        if (sampleChanges.critical.length >= 3) {
            sound = "siren"; // Many critical changes
        } else {
            sound = "tugboat"; // A few critical changes
        }
    } else if (sampleChanges.high.length > 0) {
        // Use milder sounds for high priority changes
        if (sampleChanges.high.length >= 3) {
            sound = "bike"; // Many high priority changes
        } else {
            sound = "magic"; // A few high priority changes
        }
    }

    console.log("==== MESSAGE PREVIEW ====");
    console.log(`TITLE: ${subject}`);
    console.log("BODY:");
    console.log(message);
    console.log("========================");
    console.log(`Priority: ${priority} | Sound: ${sound}`);

    // Notification params
    const params = new URLSearchParams();
    params.append('token', appToken);
    params.append('user', userKey);
    params.append('message', message);
    params.append('title', subject);
    params.append('priority', priority);
    params.append('sound', sound);
    params.append('url', 'https://fossadispatch.com/schedule');
    params.append('url_title', 'View Schedule');

    try {
        // Send request to Pushover API
        console.log('Sending enhanced Pushover notification...');
        const response = await fetch('https://api.pushover.net/1/messages.json', {
            method: 'POST',
            body: params
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Pushover notification sent successfully:', data);
            return { success: true, data };
        } else {
            console.error('Error sending Pushover notification:', data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('Error sending Pushover notification:', error);
        return { success: false, error };
    }
}

sendEnhancedPushoverTest()
    .then(result => {
        console.log('Test completed with result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Test failed with error:', error);
        process.exit(1);
    }); 