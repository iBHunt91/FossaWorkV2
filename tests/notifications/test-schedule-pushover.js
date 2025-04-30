// Test script to send a schedule change notification via Pushover
import { sendScheduleChangePushover } from './scripts/notifications/pushoverService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function sendScheduleChangeTest() {
  console.log('Sending schedule change test notification...');

  // Create sample schedule changes with different priorities
  const sampleChanges = [
    {
      type: 'replacement',
      priority: 'critical',
      old_dispenser_id: 'D1001',
      new_dispenser_id: 'D1002',
      customer: 'ABC Fuel Stations',
      location: 'Station #42 - Downtown',
      store_location: 'Main Forecourt',
      reason: 'Touchscreen failure',
      manufacturer: 'Gilbarco'
    },
    {
      type: 'removed',
      priority: 'high',
      dispenser_id: 'D2045',
      customer: 'ABC Fuel Stations',
      location: 'Station #42 - Downtown',
      store_location: 'Secondary Forecourt',
      reason: 'Faulty flow meter',
      return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    },
    {
      type: 'added',
      priority: 'normal',
      dispenser_id: 'D3012',
      customer: 'ABC Fuel Stations',
      location: 'Station #42 - Downtown',
      store_location: 'Truck Lane',
      manufacturer: 'Wayne'
    },
    {
      type: 'date_changed',
      priority: 'normal',
      dispenser_id: 'D4089',
      old_date: new Date().toISOString(),
      new_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      customer: 'ABC Fuel Stations',
      location: 'Station #42 - Downtown',
      store_location: 'Car Wash Area'
    },
    {
      type: 'status_changed',
      priority: 'high',
      dispenser_id: 'D5023',
      old_status: 'Pending',
      new_status: 'In Progress',
      customer: 'ABC Fuel Stations',
      location: 'Station #42 - Downtown',
      store_location: 'Main Forecourt'
    }
  ];

  // Create a test user with the Pushover key from .env
  const testUser = {
    id: 'test-user',
    email: 'test@example.com',
    pushoverKey: process.env.PUSHOVER_USER_KEY,
    preferences: {
      notifications: {
        scheduleChanges: true
      }
    }
  };

  try {
    // Send the notification
    const result = await sendScheduleChangePushover(sampleChanges, [testUser]);
    console.log('Schedule change notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to send schedule change notification:', error);
    throw error;
  }
}

// Execute the test function
sendScheduleChangeTest()
  .then(() => console.log('Test completed.'))
  .catch(err => console.error('Test failed:', err)); 