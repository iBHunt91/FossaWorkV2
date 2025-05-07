// Test script to simulate a change and trigger notifications

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { sendScheduleChangeNotifications } from '../../scripts/notifications/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '../..');
const dataDir = path.join(projectRoot, 'data');

// Load environment variables from .env file
dotenv.config({ path: path.join(projectRoot, '.env') });

// Also manually set the environment variables from .env
const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

console.log('Environment variables:');
console.log(`- PUSHOVER_APP_TOKEN: ${process.env.PUSHOVER_APP_TOKEN ? '✓ Loaded' : '✗ Not loaded'}`);
console.log(`- PUSHOVER_USER_KEY: ${process.env.PUSHOVER_USER_KEY ? '✓ Loaded' : '✗ Not loaded'}`);

console.log('Simulating schedule changes');

// Create simulated changes using the standardized format
const simulatedChanges = {
  critical: [
    {
      type: 'added',
      jobId: 'W-123456',
      store: '12345',
      storeName: 'Test Store Alpha',
      location: 'Test City, CA',
      date: new Date().toLocaleDateString(),
      dispensers: 4
    },
    {
      type: 'removed',
      jobId: 'W-234567',
      store: '23456',
      storeName: 'Test Store Bravo',
      location: 'Another City, TX',
      date: new Date().toLocaleDateString(),
      dispensers: 6
    }
  ],
  high: [
    {
      type: 'date_changed',
      jobId: 'W-345678',
      store: '34567',
      storeName: 'Test Store Charlie',
      location: 'Third City, FL',
      oldDate: new Date().toLocaleDateString(),
      newDate: new Date(Date.now() + 86400000).toLocaleDateString(),
      dispensers: 3
    }
  ],
  medium: [],
  low: [],
  summary: {
    removed: 1,
    added: 1,
    modified: 1,
    swapped: 0
  }
};

console.log('Changes to be sent:', JSON.stringify(simulatedChanges.summary, null, 2));

// Create a test user
const testUser = {
  id: 'test-user',
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

// Send notifications
sendScheduleChangeNotifications(simulatedChanges, testUser)
  .then(result => {
    console.log('Notification results:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Error sending notifications:', error);
  }); 