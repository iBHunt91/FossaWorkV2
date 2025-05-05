/**
 * Script to manually trigger a digest check
 * This can help diagnose issues with daily digest delivery
 */

import { processDailyDigests, sendDailyDigestForUser } from './notifications/notificationScheduler.js';
import { getActiveUser } from '../server/utils/userManager.js';
import { loadUsers, getUserNotificationSettings } from './user/userService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIGEST_STORAGE_DIR = path.join(__dirname, '..', 'data', 'notification-digests');

// Function to display current time
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString();
}

// Function to check digest files
function checkDigestFiles() {
  console.log('\nChecking existing digest files:');
  
  if (!fs.existsSync(DIGEST_STORAGE_DIR)) {
    console.log(`- Digest directory doesn't exist: ${DIGEST_STORAGE_DIR}`);
    return;
  }
  
  const files = fs.readdirSync(DIGEST_STORAGE_DIR);
  
  if (files.length === 0) {
    console.log('- No digest files found');
    return;
  }
  
  console.log(`- Found ${files.length} digest files:`);
  files.forEach(file => {
    const filePath = path.join(DIGEST_STORAGE_DIR, file);
    const stats = fs.statSync(filePath);
    let fileContents;
    
    try {
      fileContents = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`  * ${file}: ${fileContents.length} changes, last modified ${stats.mtime.toLocaleString()}`);
      
      // Show details of first change
      if (fileContents.length > 0 && fileContents[0].allChanges && fileContents[0].allChanges.length > 0) {
        const firstChange = fileContents[0].allChanges[0];
        console.log(`    First change: ${firstChange.type} - Job ID: ${firstChange.jobId}`);
        console.log(`    Store: ${firstChange.storeName} (${firstChange.store}), Location: ${firstChange.location}`);
        console.log(`    Date: ${firstChange.date}, Timestamp: ${fileContents[0].timestamp}`);
      }
    } catch (err) {
      console.log(`  * ${file}: ERROR reading file - ${err.message}`);
    }
  });
}

// Function to run option 1 - normal digest check
async function runNormalDigestCheck() {
  console.log('\nRunning normal digest check (respecting time window)...');
  const result = await processDailyDigests();
  console.log('Result:', JSON.stringify(result, null, 2));
  
  if (result.processed === 0) {
    console.log('\nℹ️ No digests were sent. This could be because:');
    console.log('- It\'s not within the delivery time window');
    console.log('- There are no digest files to send');
    console.log('- Email notifications are disabled');
  }
}

// Function to run option 2 - force send digest
async function forceSendDigest(userId) {
  console.log('\nForce sending digest for current user...');
  const sendResult = await sendDailyDigestForUser(userId);
  console.log('Result:', JSON.stringify(sendResult, null, 2));
  
  if (!sendResult.sent) {
    console.log(`\nℹ️ No digest was sent. Reason: ${sendResult.reason || 'unknown'}`);
    if (sendResult.reason === 'no_digest_file') {
      console.log('There is no digest file for this user. Try making some schedule changes first.');
    }
  } else {
    console.log('\n✅ Digest sent successfully!');
  }
}

// Main function to trigger the digest check
async function triggerDigestCheck() {
  console.log(`=== MANUAL DIGEST CHECK (${getCurrentTime()}) ===`);
  
  // Get the current user
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
  
  console.log(`User: ${user.label || user.email}`);
  
  // Check notification settings
  const settings = await getUserNotificationSettings(userId);
  console.log('\nNotification settings:');
  console.log(`- Email enabled: ${settings.email?.enabled}`);
  console.log(`- Frequency: ${settings.email?.frequency}`);
  console.log(`- Delivery time: ${settings.email?.deliveryTime}`);
  
  // Check digest files
  checkDigestFiles();
  
  // Menu options
  console.log('\nChoose an option:');
  console.log('1. Run normal digest check (respects time window)');
  console.log('2. Force send digest now (ignores time window)');
  console.log('3. Exit');
  
  // Read user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('\nEnter option number: ', async (option) => {
    try {
      switch (option) {
        case '1':
          await runNormalDigestCheck();
          break;
          
        case '2':
          await forceSendDigest(userId);
          break;
          
        case '3':
        default:
          console.log('Exiting...');
          break;
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      rl.close();
    }
  });
}

// Run the function
triggerDigestCheck(); 