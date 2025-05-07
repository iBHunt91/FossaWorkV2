/**
 * Debug script to identify why email notification frequency is not working correctly
 */

import { loadUsers, updateUserNotificationSettings } from './user/userService.js';
import { processNotificationByFrequency } from './notifications/notificationScheduler.js';
import { getActiveUser } from '../server/utils/userManager.js';
import { sendScheduleChangeNotifications } from './notifications/notificationService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIGEST_STORAGE_DIR = path.join(__dirname, '..', 'data', 'notification-digests');

// Create sample change data for testing
const testChange = {
  allChanges: [
    {
      type: 'added',
      jobId: 'debug-job-123',
      storeName: 'Debug Test Store',
      storeNumber: '999',
      location: 'Debug Location',
      date: new Date().toISOString(),
      dispensers: 'Debug Dispensers'
    }
  ],
  summary: {
    added: 1,
    removed: 0,
    modified: 0,
    swapped: 0
  }
};

async function debugNotificationFrequency() {
  console.log('====== NOTIFICATION FREQUENCY DEBUG ======');
  console.log('Starting at:', new Date().toISOString());
  
  // 1. Check if the digest directory exists
  console.log('\nCHECKING DIRECTORY:');
  if (fs.existsSync(DIGEST_STORAGE_DIR)) {
    console.log(`✅ Digest directory exists: ${DIGEST_STORAGE_DIR}`);
    
    // List any existing digest files
    const files = fs.readdirSync(DIGEST_STORAGE_DIR);
    console.log(`Found ${files.length} digest files:`);
    files.forEach(file => console.log(` - ${file}`));
  } else {
    console.log(`❌ Digest directory does NOT exist: ${DIGEST_STORAGE_DIR}`);
  }
  
  // 2. Get current user and settings
  console.log('\nCHECKING USER:');
  const userId = getActiveUser();
  if (!userId) {
    console.error('❌ No active user found. Please log in first.');
    return;
  }
  
  console.log(`Active user ID: ${userId}`);
  
  // Load user data
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    console.error(`❌ User ${userId} not found in database.`);
    return;
  }
  
  console.log('User found in database:');
  console.log(` - ID: ${user.id}`);
  console.log(` - Email: ${user.email}`);
  console.log(` - Has notificationSettings: ${!!user.notificationSettings}`);
  
  // 3. Check notification settings
  console.log('\nCURRENT NOTIFICATION SETTINGS:');
  if (user.notificationSettings) {
    console.log(` - Enabled: ${user.notificationSettings.enabled}`);
    
    if (user.notificationSettings.email) {
      console.log(' Email settings:');
      console.log(` - Email enabled: ${user.notificationSettings.email.enabled}`);
      console.log(` - Frequency: ${user.notificationSettings.email.frequency || 'not set'}`);
      console.log(` - Delivery time: ${user.notificationSettings.email.deliveryTime || 'not set'}`);
    } else {
      console.log('❌ No email settings found in notificationSettings');
    }
  } else {
    console.log('❌ No notification settings found for user');
  }
  
  // 4. Force update to daily frequency to ensure settings are correct
  console.log('\nUPDATING USER TO DAILY FREQUENCY:');
  const updateResult = await updateUserNotificationSettings(userId, {
    email: {
      enabled: true,
      frequency: 'daily',
      deliveryTime: '18:00'
    }
  });
  
  console.log(`Update result: ${updateResult ? 'Success' : 'Failed'}`);
  
  // 5. Reload user to verify update
  const updatedUsers = await loadUsers();
  const updatedUser = updatedUsers.find(u => u.id === userId);
  
  console.log('\nVERIFYING UPDATED SETTINGS:');
  if (updatedUser.notificationSettings?.email?.frequency === 'daily') {
    console.log('✅ User frequency successfully updated to daily');
  } else {
    console.log(`❌ User frequency NOT updated correctly: ${updatedUser.notificationSettings?.email?.frequency}`);
  }
  
  // 6. Test direct call to processNotificationByFrequency
  console.log('\nTESTING DIRECT CALL TO processNotificationByFrequency:');
  console.log('User object with explicit settings:');
  console.log(` - Email enabled: ${updatedUser.notificationSettings?.email?.enabled}`);
  console.log(` - Email frequency: ${updatedUser.notificationSettings?.email?.frequency}`);
  
  const directResult = await processNotificationByFrequency(testChange, updatedUser);
  console.log('Direct call result:', directResult);
  
  // 7. Check if a digest file was created
  console.log('\nCHECKING FOR DIGEST FILE:');
  const digestFilePath = path.join(DIGEST_STORAGE_DIR, `${userId}-digest.json`);
  if (fs.existsSync(digestFilePath)) {
    console.log(`✅ Digest file exists: ${digestFilePath}`);
    try {
      const digestContent = fs.readFileSync(digestFilePath, 'utf8');
      const digestData = JSON.parse(digestContent);
      console.log(`Digest file contains ${digestData.length} change(s)`);
    } catch (error) {
      console.log(`❌ Error reading digest file: ${error.message}`);
    }
  } else {
    console.log(`❌ Digest file does NOT exist: ${digestFilePath}`);
  }
  
  // 8. Test the actual notification system directly
  console.log('\nTESTING FULL NOTIFICATION SYSTEM:');
  console.log('This simulates what happens when a real schedule change is detected');
  
  // Create a test change for the notification system
  const fullTestChange = {
    ...testChange,
    allChanges: [
      {
        ...testChange.allChanges[0],
        jobId: 'full-test-job-456'
      }
    ]
  };
  
  try {
    console.log('Calling sendScheduleChangeNotifications with test change...');
    const notificationResult = await sendScheduleChangeNotifications(fullTestChange, updatedUser);
    console.log('Full notification system result:', notificationResult);
  } catch (error) {
    console.log('❌ Error testing notification system:', error);
  }
  
  // 9. Check again for a digest file
  console.log('\nCHECKING FOR DIGEST FILE AFTER FULL TEST:');
  if (fs.existsSync(digestFilePath)) {
    console.log(`✅ Digest file exists: ${digestFilePath}`);
    try {
      const digestContent = fs.readFileSync(digestFilePath, 'utf8');
      const digestData = JSON.parse(digestContent);
      console.log(`Digest file contains ${digestData.length} change(s)`);
      
      // Print some details of the stored changes
      if (digestData.length > 0) {
        console.log('Most recent stored change:');
        console.log(` - Type: ${digestData[digestData.length-1].allChanges[0].type}`);
        console.log(` - Job ID: ${digestData[digestData.length-1].allChanges[0].jobId}`);
        console.log(` - Timestamp: ${digestData[digestData.length-1].timestamp}`);
      }
    } catch (error) {
      console.log(`❌ Error reading digest file: ${error.message}`);
    }
  } else {
    console.log(`❌ Digest file does NOT exist: ${digestFilePath}`);
  }
  
  console.log('\n====== DEBUG COMPLETE ======');
}

// Run the debug function
debugNotificationFrequency(); 