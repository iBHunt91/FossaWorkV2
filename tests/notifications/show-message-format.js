// Helper function to get visit ID
function getVisitId(id) {
    if (!id || !id.includes('-')) return id;
    return id.split('-')[1] || id;
}

// Sample changes object (similar to what the schedule comparator would produce)
const sampleChanges = {
    critical: [
        {
            type: 'replacement',
            removedJobId: '112041',
            removedStore: '#5133',
            removedDispensers: 8,
            removedLocation: 'Riverview, FL',
            addedJobId: '112042',
            addedStore: '#5286',
            addedDispensers: 6,
            addedLocation: 'Tampa, FL',
            date: '04/25/2025'
        },
        {
            type: 'removed',
            jobId: '112043',
            store: '#5134',
            dispensers: 4,
            location: 'Orlando, FL',
            date: '04/28/2025'
        }
    ],
    high: [
        {
            type: 'date_changed',
            jobId: '112044',
            store: '#5135',
            dispensers: 6,
            location: 'Miami, FL',
            oldDate: '04/30/2025',
            newDate: '05/02/2025'
        },
        {
            type: 'added',
            jobId: '112045',
            store: '#5136',
            dispensers: 10,
            location: 'Jacksonville, FL',
            date: '05/05/2025'
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

// Group changes by type for better readability
if (counts.replacement > 0) {
    message += `📅 REPLACEMENTS\n`;
    message += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
    [...sampleChanges.critical, ...sampleChanges.high]
        .filter(change => change.type === 'replacement')
        .forEach((change, index) => {
            if (index > 0) message += `\n`; // Add space between multiple items
            message += `• Visit #${getVisitId(change.removedJobId)} → #${getVisitId(change.addedJobId)}\n`;
            message += `  ${change.removedDispensers} → ${change.addedDispensers} Dispensers\n`;
            message += `  ${change.removedLocation} → ${change.addedLocation}\n`;
            message += `  📆 ${change.date}\n`;
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
            message += `• Visit #${getVisitId(change.jobId)}\n`;
            message += `  ${change.dispensers} Dispensers\n`;
            message += `  📍 ${change.location}\n`;
            message += `  📆 ${change.date}\n`;
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
            message += `• Visit #${getVisitId(change.jobId)}\n`;
            message += `  ${change.dispensers} Dispensers\n`;
            message += `  📍 ${change.location}\n`;
            message += `  📆 ${change.date}\n`;
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
            message += `• Visit #${getVisitId(change.jobId)}\n`;
            message += `  ${change.dispensers} Dispensers\n`;
            message += `  📍 ${change.location}\n`;
            message += `  📆 ${change.oldDate} → ${change.newDate}\n`;
        });
    message += `\n`;
}

// Add footer with timestamp
const date = new Date();
const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
message += `Updated: ${formattedDate}`;

console.log("\n==== TITLE ====");
console.log(subject);
console.log("\n==== MESSAGE ====");
console.log(message);
console.log("\n================"); 