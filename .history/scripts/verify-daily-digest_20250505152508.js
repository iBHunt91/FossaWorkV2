/**
 * Script to verify daily digest functionality is working
 */

import { sendScheduleChangeNotifications } from './notifications/notificationService.js';
import { getActiveUser } from '../server/utils/userManager.js';
import { loadUsers, getUserNotificationSettings } from './user/userService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIGEST_STORAGE_DIR = path.join(__dirname, '..', 'data', 'notification-digests');

// Create test change
const testChange = {
  allChanges: [
    {
      type: 'added',
      jobId: 'verify-digest-test-job',
      storeName: 'Digest Test Store',
      storeNumber: '8888',
      location: 'Digest Test Location',
      date: new Date().toISOString(),
      dispensers: 'Digest Test Dispensers'
    }
  ],
  summary: {
    added: 1,
    removed: 0,
    modified: 0,
    swapped: 0
  }
};

async function verifyDailyDigest() {
  try {
    console.log('=== DAILY DIGEST VERIFICATION ===');
    
    // Get the current user
    const userId = getActiveUser();
    if (!userId) {
      console.error('No active user found. Please log in first.');
      return;
    }
    
    // Get user data
    const users = await loadUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      console.error(`User ${userId} not found in database.`);
      return;
    }
    
    // Get notification settings
    const notificationSettings = await getUserNotificationSettings(userId);
    console.log(`Current notification settings for user ${userId}:`, 
      JSON.stringify(notificationSettings, null, 2));
    
    // Check frequency setting
    const frequency = notificationSettings.email?.frequency || 'immediate';
    if (frequency !== 'daily') {
      console.log(`WARNING: User frequency is set to "${frequency}", not "daily"`);
      console.log('This script may still work, but ideally you should set frequency to "daily" in the UI first');
    }
    
    // Check if digest directory exists
    if (!fs.existsSync(DIGEST_STORAGE_DIR)) {
      fs.mkdirSync(DIGEST_STORAGE_DIR, { recursive: true });
      console.log(`Created digest directory: ${DIGEST_STORAGE_DIR}`);
    }
    
    // Check for and delete any existing digest file
    const digestFilePath = path.join(DIGEST_STORAGE_DIR, `${userId}-digest.json`);
    if (fs.existsSync(digestFilePath)) {
      fs.unlinkSync(digestFilePath);
      console.log(`Deleted existing digest file: ${digestFilePath}`);
    }
    
    // Simulate a schedule change notification
    console.log('Simulating a schedule change notification...');
    const result = await sendScheduleChangeNotifications(testChange, user);
    console.log('Notification result:', result);
    
    // Check if digest file was created
    console.log('Checking if digest file was created...');
    
    // Wait a moment for file operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (fs.existsSync(digestFilePath)) {
      console.log(`✅ SUCCESS: Digest file was created at ${digestFilePath}`);
      
      // Read the file contents
      const digestContent = fs.readFileSync(digestFilePath, 'utf8');
      const digestData = JSON.parse(digestContent);
      console.log(`Digest file contains ${digestData.length} change(s):`);
      
      // Display digest content
      digestData.forEach((change, index) => {
        console.log(`Change ${index+1}:`);
        console.log(` - Job ID: ${change.allChanges[0].jobId}`);
        console.log(` - Type: ${change.allChanges[0].type}`);
        console.log(` - Timestamp: ${change.timestamp}`);
      });
      
      console.log('DAILY DIGEST IS WORKING CORRECTLY!');
    } else {
      console.log(`❌ ERROR: Digest file was NOT created at ${digestFilePath}`);
      console.log('DAILY DIGEST IS NOT WORKING CORRECTLY.');
    }
    
  } catch (error) {
    console.error('Error verifying daily digest:', error);
  }
}

// Run the verification
verifyDailyDigest(); 