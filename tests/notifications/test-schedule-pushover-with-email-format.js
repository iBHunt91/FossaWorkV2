// Test script to send Pushover notifications with email-like HTML formatting
import { createPushoverParams } from './scripts/notifications/pushoverService.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to get visit ID
function getVisitId(id) {
  // If id is already just the number, return it
  if (!id || !id.includes('-')) return id || '';
  // Otherwise, extract the number part
  return id.split('-')[1] || id;
}

async function sendRichHTMLPushoverTest() {
  console.log('Sending rich HTML-formatted Pushover notification...');
  
  // Sample schedule changes - similar to the email format
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

  // Create an email-like HTML content
  let message = `<b>📅 SCHEDULE CHANGES</b><br><br>`;
  
  // Critical changes with red styling
  if (testChanges.critical.length > 0) {
    message += `<span style="color: #e74c3c; font-weight: bold;">⚠️ CRITICAL CHANGES (${testChanges.critical.length})</span><br><br>`;
    
    testChanges.critical.forEach(change => {
      if (change.type === 'replacement') {
        message += `<div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid #e74c3c;">`;
        message += `<b>Replaced Visit</b><br>`;
        message += `<b>Removed:</b> Visit #${getVisitId(change.removedJobId)} - ${change.removedDispensers} dispensers (${change.removedLocation})<br>`;
        message += `<b>Added:</b> Visit #${getVisitId(change.addedJobId)} - ${change.addedDispensers} dispensers (${change.addedLocation})<br>`;
        message += `<b>Date:</b> ${change.date}<br>`;
        message += `</div>`;
      } else if (change.type === 'removed') {
        message += `<div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid #e74c3c;">`;
        message += `<b>Removed Visit</b><br>`;
        message += `Visit #${getVisitId(change.jobId)} - ${change.dispensers} dispensers<br>`;
        message += `<b>Location:</b> ${change.location}<br>`;
        message += `<b>Date:</b> ${change.date}<br>`;
        message += `</div>`;
      }
    });
  }
  
  // High priority changes with orange styling
  if (testChanges.high.length > 0) {
    message += `<span style="color: #f39c12; font-weight: bold;">⚠️ HIGH PRIORITY CHANGES (${testChanges.high.length})</span><br><br>`;
    
    testChanges.high.forEach(change => {
      if (change.type === 'date_changed') {
        message += `<div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid #f39c12;">`;
        message += `<b>Date Changed</b><br>`;
        message += `Visit #${getVisitId(change.jobId)} - ${change.dispensers} dispensers<br>`;
        message += `<b>Location:</b> ${change.location}<br>`;
        message += `<b>From:</b> ${change.oldDate}<br>`;
        message += `<b>To:</b> ${change.newDate}<br>`;
        message += `</div>`;
      }
    });
  }
  
  // Add summary and action items
  message += `<br><b>📊 SUMMARY</b><br>`;
  message += `Total changes: ${testChanges.critical.length + testChanges.high.length}<br>`;
  message += `Critical: ${testChanges.critical.length}<br>`;
  message += `High priority: ${testChanges.high.length}<br><br>`;
  
  message += `<b>🔍 ACTIONS REQUIRED</b><br>`;
  message += `• Review schedule changes immediately<br>`;
  message += `• Update team calendar<br>`;
  message += `• Confirm resources availability<br><br>`;
  
  message += `<i>Generated: ${new Date().toLocaleString()}</i>`;
  
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
    console.log('Rich HTML Pushover notification sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to send Pushover notification:', error.message);
    throw error;
  }
}

// Execute the test function
sendRichHTMLPushoverTest()
  .then(() => console.log('Test completed.'))
  .catch(err => console.error('Test failed:', err)); 