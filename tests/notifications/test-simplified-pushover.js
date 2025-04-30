// Test script to send Pushover notifications with simplified format
import { createPushoverParams } from './scripts/notifications/pushoverService.js';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Helper function to get visit ID
function getVisitId(id) {
  // If id is already just the number, return it
  if (!id || !id.includes('-')) return id || '';
  // Otherwise, extract the number part
  return id.split('-')[1] || id;
}

async function sendSimplifiedPushoverTest() {
  console.log('Sending simplified Pushover notification...');
  
  // Sample schedule changes
  const testChanges = {
    critical: [
      {
        type: 'replacement',
        removedJobId: 'W-112041',
        removedStore: '#5133',
        removedDispensers: 8,
        removedLocation: 'Riverview, FL',
        addedJobId: 'W-112042',
        addedStore: '#5286',
        addedDispensers: 6,
        addedLocation: 'Riverview, FL',
        date: '04/14/2025'
      },
      {
        type: 'removed',
        jobId: 'W-112043',
        store: '#5134',
        dispensers: 4,
        location: 'Tampa, FL',
        date: '04/15/2025'
      }
    ],
    high: [
      {
        type: 'date_changed',
        jobId: 'W-112044',
        store: '#5135',
        dispensers: 6,
        location: 'Orlando, FL',
        oldDate: '04/14/2025',
        newDate: '04/16/2025'
      }
    ]
  };

  // Create a simplified HTML content
  let message = `<b>📅 SCHEDULE CHANGES</b><br><br>`;
  
  // Process all changes without separate headers for priority levels
  const allChanges = [...testChanges.critical, ...testChanges.high];
  
  allChanges.forEach(change => {
    if (change.type === 'replacement') {
      // Use a red left border for critical changes
      const borderColor = testChanges.critical.includes(change) ? '#e74c3c' : '#f39c12';
      
      message += `<div style="margin-bottom: 15px; padding: 10px; border-left: 3px solid ${borderColor};">`;
      message += `<b>Visit Change ID #${getVisitId(change.removedJobId)} → #${getVisitId(change.addedJobId)}</b><br>`;
      message += `${change.removedStore} → ${change.addedStore}<br>`;
      message += `${change.removedDispensers} → ${change.addedDispensers} dispensers<br>`;
      message += `<b>Location:</b> ${change.removedLocation}<br>`;
      message += `<b>Date:</b> ${change.date}<br>`;
      message += `</div>`;
    } 
    else if (change.type === 'removed') {
      const borderColor = testChanges.critical.includes(change) ? '#e74c3c' : '#f39c12';
      
      message += `<div style="margin-bottom: 15px; padding: 10px; border-left: 3px solid ${borderColor};">`;
      message += `<b>🗑️ Visit #${getVisitId(change.jobId)} Removed</b><br>`;
      message += `${change.store} - ${change.dispensers} dispensers<br>`;
      message += `<b>Location:</b> ${change.location}<br>`;
      message += `<b>Date:</b> ${change.date}<br>`;
      message += `</div>`;
    }
    else if (change.type === 'date_changed') {
      const borderColor = testChanges.critical.includes(change) ? '#e74c3c' : '#f39c12';
      
      message += `<div style="margin-bottom: 15px; padding: 10px; border-left: 3px solid ${borderColor};">`;
      message += `<b>📆 Visit #${getVisitId(change.jobId)} Rescheduled</b><br>`;
      message += `${change.store} - ${change.dispensers} dispensers<br>`;
      message += `<b>Location:</b> ${change.location}<br>`;
      message += `<b>Changed:</b> ${change.oldDate} → ${change.newDate}<br>`;
      message += `</div>`;
    }
  });
  
  // Generate a dashboard URL
  const dashboardURL = 'https://app.workfossa.com/schedule';

  // Create test user with Pushover key from .env
  const testUser = {
    id: 'test-user',
    email: 'test@example.com',
    pushoverKey: process.env.PUSHOVER_USER_KEY
  };

  try {
    // Create enhanced notification parameters
    const params = createPushoverParams(
      {
        message,
        title: '📅 Schedule Changes Alert',
        user: testUser.pushoverKey,
        priority: 1,
        sound: 'classical'
      },
      {
        url: dashboardURL,
        url_title: 'View Schedule',
        timestamp: Math.floor(Date.now() / 1000)
      }
    );
    
    // Send the notification
    const response = await axios.post('https://api.pushover.net/1/messages.json', params);
    console.log('Simplified Pushover notification sent successfully:', response.data);
    
    // Show the message in the console
    console.log("\nNotification Message Content:");
    console.log(message);
    
    return response.data;
  } catch (error) {
    console.error('Failed to send Pushover notification:', error.message);
    throw error;
  }
}

// Execute the test function
sendSimplifiedPushoverTest()
  .then(() => console.log('Test completed.'))
  .catch(err => console.error('Test failed:', err)); 