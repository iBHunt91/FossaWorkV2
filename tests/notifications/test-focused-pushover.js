// Test script to send Pushover notifications focused on key schedule changes
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

async function sendFocusedPushoverTest() {
  console.log('Sending styled schedule changes notification...');
  
  // Sample schedule changes focused on the three key scenarios
  const changes = [
    // Scenario 1: Job added to a day that already had something scheduled
    {
      type: 'added_to_existing_day',
      jobId: 'W-112042',
      store: '#5286',
      dispensers: 6,
      location: 'Riverview, FL',
      date: '04/14/2025',
      existingJobs: 2,
      priority: 'high'
    },
    
    // Scenario 2: Job removed that was previously scheduled
    {
      type: 'removed',
      jobId: 'W-112043',
      store: '#5134',
      dispensers: 4,
      location: 'Tampa, FL',
      date: '04/15/2025',
      priority: 'critical'
    },
    
    // Scenario 3: Job added to a day that previously had nothing scheduled
    {
      type: 'added_to_empty_day',
      jobId: 'W-112044',
      store: '#5135',
      dispensers: 6,
      location: 'Orlando, FL',
      date: '04/16/2025',
      priority: 'normal'
    }
  ];

  // Create a focused HTML content with enhanced styling - no Schedule Changes header
  let message = '';
  
  changes.forEach(change => {
    // Use blue styling for all notifications
    const colors = {
      border: '#3498db',
      background: '#EEF7FC',
      header: '#2980b9'
    };
    
    // Create a card-like styling with blue background
    message += `<div style="margin-bottom: 12px; padding: 8px 12px; border-left: 4px solid ${colors.border}; background-color: ${colors.background}; border-radius: 0 3px 3px 0;">`;
    
    if (change.type === 'added_to_existing_day') {
      message += `<div style="color: ${colors.header}; font-weight: bold; margin-bottom: 6px;">➕ Visit Added</div>`;
      message += `<div style="padding-left: 4px;">`;
      message += `<b>Visit:</b> #${getVisitId(change.jobId)}<br>`;
      message += `<b>Store:</b> ${change.store}<br>`;
      message += `<b>Location:</b> ${change.location}<br>`;
      message += `<b>Date:</b> ${change.date}<br>`;
      message += `<b>Dispensers:</b> ${change.dispensers}`;
      message += `</div>`;
    } 
    else if (change.type === 'removed') {
      message += `<div style="color: ${colors.header}; font-weight: bold; margin-bottom: 6px;">🗑️ Visit Removed</div>`;
      message += `<div style="padding-left: 4px;">`;
      message += `<b>Visit:</b> #${getVisitId(change.jobId)}<br>`;
      message += `<b>Store:</b> ${change.store}<br>`;
      message += `<b>Location:</b> ${change.location}<br>`;
      message += `<b>Date:</b> ${change.date}<br>`;
      message += `<b>Dispensers:</b> ${change.dispensers}`;
      message += `</div>`;
    }
    else if (change.type === 'added_to_empty_day') {
      message += `<div style="color: ${colors.header}; font-weight: bold; margin-bottom: 6px;">📆 Visit Added</div>`;
      message += `<div style="padding-left: 4px;">`;
      message += `<b>Visit:</b> #${getVisitId(change.jobId)}<br>`;
      message += `<b>Store:</b> ${change.store}<br>`;
      message += `<b>Location:</b> ${change.location}<br>`;
      message += `<b>Date:</b> ${change.date}<br>`;
      message += `<b>Dispensers:</b> ${change.dispensers}`;
      message += `</div>`;
    }
    
    message += `</div>`;
  });
  
  // Create test user with Pushover key from .env
  const testUser = {
    id: 'test-user',
    email: 'test@example.com',
    pushoverKey: process.env.PUSHOVER_USER_KEY
  };

  try {
    // Create enhanced notification parameters without URL
    const params = createPushoverParams(
      {
        message,
        title: '📅 Schedule Updates',
        user: testUser.pushoverKey,
        priority: 1,
        sound: 'classical'
      },
      {
        timestamp: Math.floor(Date.now() / 1000)
      }
    );
    
    // Send the notification
    const response = await axios.post('https://api.pushover.net/1/messages.json', params);
    console.log('Enhanced Pushover notification sent successfully:', response.data);
    
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
sendFocusedPushoverTest()
  .then(() => console.log('Test completed.'))
  .catch(err => console.error('Test failed:', err)); 