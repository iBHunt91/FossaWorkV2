/**
 * Test script to verify notification frequency settings are working correctly
 * Tests both "immediate" and "daily" frequency modes
 */

import { loadUsers, updateUserNotificationSettings } from './user/userService.js';
import { processNotificationByFrequency } from './notifications/notificationScheduler.js';
import { getActiveUser } from '../server/utils/userManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create sample change data for testing
const testChange = {
  allChanges: [
    {
      type: 'added',
      jobId: 'test-job-123',
      storeName: 'Test Store',
      storeNumber: '1234',
      location: 'Test Location',
      date: new Date().toISOString(),
      dispensers: 'Test Dispensers'
    }
  ],
  summary: {
    added: 1,
    removed: 0,
    modified: 0,
    swapped: 0
  }
};

// Path to digest storage directory
const DIGEST_STORAGE_DIR = path.join(__dirname, '..', 'data', 'notification-digests');

/**
 * Main test function
 */
async function testNotificationFrequency() {
  try {
    console.log('Starting notification frequency test...');
    
    // Get the current user ID
    const userId = getActiveUser();
    if (!userId) {
      console.error('No active user found. Please log in first.');
      process.exit(1);
    }
    
    // Get the current user data
    const users = await loadUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      console.error(`User ${userId} not found.`);
      process.exit(1);
    }
    
    console.log(`Testing for user: ${userId} (${user.email || 'no email'})`);
    
    // Get current notification settings
    const currentFrequency = user.notificationSettings?.email?.frequency || 'immediate';
    console.log(`Current frequency setting: ${currentFrequency}`);
    
    // First test with "immediate" setting
    console.log('\n---------- Testing IMMEDIATE frequency ----------');
    await updateUserNotificationSettings(userId, {
      email: {
        enabled: true,
        frequency: 'immediate'
      }
    });
    
    // Reload user to verify settings were updated
    const updatedUsers = await loadUsers();
    const updatedUser = updatedUsers.find(u => u.id === userId);
    console.log(`Updated frequency setting: ${updatedUser.notificationSettings?.email?.frequency}`);
    console.log('Full notification settings:', JSON.stringify(updatedUser.notificationSettings, null, 2));
    
    // Process a test notification with proper settings
    console.log('Processing test notification with immediate setting...');
    
    // Make sure notificationSettings is explicitly included in the user object
    const userWithImmediateSettings = {
      ...updatedUser,
      notificationSettings: {
        enabled: true,
        email: {
          enabled: true,
          frequency: 'immediate'
        },
        pushover: {
          enabled: true,
          priority: 'normal'
        }
      }
    };
    
    console.log('User object with explicit settings:');
    console.log('- Email enabled:', userWithImmediateSettings.notificationSettings?.email?.enabled);
    console.log('- Email frequency:', userWithImmediateSettings.notificationSettings?.email?.frequency);
    
    const immediateResult = await processNotificationByFrequency(testChange, userWithImmediateSettings);
    console.log('Result:', immediateResult);
    
    if (immediateResult.type === 'immediate') {
      console.log('✅ IMMEDIATE test PASSED - Email was sent immediately as expected');
    } else {
      console.log('❌ IMMEDIATE test FAILED - Email was not sent immediately');
    }
    
    // Next test with "daily" setting
    console.log('\n---------- Testing DAILY frequency ----------');
    await updateUserNotificationSettings(userId, {
      email: {
        enabled: true,
        frequency: 'daily'
      }
    });
    
    // Reload user to verify settings were updated
    const dailyUsers = await loadUsers();
    const dailyUser = dailyUsers.find(u => u.id === userId);
    console.log(`Updated frequency setting: ${dailyUser.notificationSettings?.email?.frequency}`);
    console.log('Full notification settings:', JSON.stringify(dailyUser.notificationSettings, null, 2));
    
    // Delete any existing digest file to start clean
    const digestFilePath = path.join(DIGEST_STORAGE_DIR, `${userId}-digest.json`);
    if (fs.existsSync(digestFilePath)) {
      fs.unlinkSync(digestFilePath);
      console.log(`Deleted existing digest file: ${digestFilePath}`);
    }
    
    // Process a test notification with proper settings
    console.log('Processing test notification with daily setting...');
    
    // Make sure notificationSettings is explicitly included in the user object
    const userWithSettings = {
      ...dailyUser,
      notificationSettings: {
        enabled: true,
        email: {
          enabled: true,
          frequency: 'daily'
        },
        pushover: {
          enabled: true,
          priority: 'normal'
        }
      }
    };
    
    console.log('User object with explicit settings:');
    console.log('- Email enabled:', userWithSettings.notificationSettings?.email?.enabled);
    console.log('- Email frequency:', userWithSettings.notificationSettings?.email?.frequency);
    
    const dailyResult = await processNotificationByFrequency(testChange, userWithSettings);
    console.log('Result:', dailyResult);
    
    // Check if digest file was created
    const digestFileExists = fs.existsSync(digestFilePath);
    console.log(`Digest file exists: ${digestFileExists}`);
    
    if (dailyResult.type === 'daily_digest_stored' && digestFileExists) {
      console.log('✅ DAILY test PASSED - Changes were stored for digest as expected');
      
      // Examine the digest file contents
      const digestContent = fs.readFileSync(digestFilePath, 'utf8');
      const digestData = JSON.parse(digestContent);
      console.log(`Digest file contains ${digestData.length} change(s)`);
    } else {
      console.log('❌ DAILY test FAILED - Changes were not stored for digest');
    }
    
    // Restore original settings
    console.log('\n---------- Restoring original settings ----------');
    await updateUserNotificationSettings(userId, {
      email: {
        frequency: currentFrequency
      }
    });
    console.log(`Restored frequency setting to: ${currentFrequency}`);
    
    console.log('\nNotification frequency test completed.');
  } catch (error) {
    console.error('Error testing notification frequency:', error);
  }
}

// Import the dirname function
import { dirname } from 'path';

// Run the test
testNotificationFrequency(); 