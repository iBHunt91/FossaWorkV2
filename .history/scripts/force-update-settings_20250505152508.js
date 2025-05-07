/**
 * Force update user notification settings to fix email frequency issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get correct directory references
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Import user manager functions
const userManagerPath = path.join(projectRoot, 'server', 'utils', 'userManager.js');
console.log(`Looking for userManager at: ${userManagerPath}`);
// Dynamic import
let getActiveUser;
try {
  const userManagerModule = await import(userManagerPath);
  getActiveUser = userManagerModule.getActiveUser;
  console.log('Successfully imported getActiveUser function');
} catch (error) {
  console.error('Error importing getActiveUser:', error);
  process.exit(1);
}

// Paths to user settings files
const dataDir = path.join(projectRoot, 'data');
const usersDir = path.join(dataDir, 'users');
const usersJsonPath = path.join(usersDir, 'users.json');

console.log('Project root:', projectRoot);
console.log('Data directory:', dataDir);
console.log('Users directory:', usersDir);
console.log('Users JSON path:', usersJsonPath);

/**
 * Force update the user's notification settings to daily digest
 */
async function forceUpdateSettings() {
  console.log('=== FORCE UPDATE NOTIFICATION SETTINGS ===');
  
  // Check if users.json exists
  if (!fs.existsSync(usersJsonPath)) {
    console.error(`Error: users.json not found at ${usersJsonPath}`);
    return;
  }
  
  // Get the current user ID
  const userId = getActiveUser();
  if (!userId) {
    console.error('Error: No active user found');
    return;
  }
  
  console.log(`Updating settings for user ID: ${userId}`);
  
  try {
    // Load the users file
    const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
    
    if (!Array.isArray(usersData)) {
      console.error('Error: users.json does not contain an array');
      return;
    }
    
    // Find the user
    const userIndex = usersData.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      console.error(`Error: User with ID ${userId} not found in users.json`);
      return;
    }
    
    // Get the current user
    const user = usersData[userIndex];
    console.log('Current user:', {
      id: user.id,
      email: user.email,
      label: user.label
    });
    
    // Check if notification settings exist
    if (!user.notificationSettings) {
      user.notificationSettings = {};
      console.log('Created new notificationSettings object');
    }
    
    // Update email settings
    if (!user.notificationSettings.email) {
      user.notificationSettings.email = {};
      console.log('Created new email settings object');
    }
    
    // Set the frequency to daily
    user.notificationSettings.email.enabled = true;
    user.notificationSettings.email.frequency = 'daily';
    user.notificationSettings.email.deliveryTime = '18:00';
    
    // Enable notifications overall
    user.notificationSettings.enabled = true;
    
    // Update the user in the array
    usersData[userIndex] = user;
    
    // Write the updated data back to the file
    fs.writeFileSync(usersJsonPath, JSON.stringify(usersData, null, 2), 'utf8');
    
    console.log('Updated notification settings in users.json:');
    console.log(JSON.stringify(user.notificationSettings, null, 2));
    
    // Update email_settings.json file as well for consistency
    const userDir = path.join(usersDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
      console.log(`Created user directory: ${userDir}`);
    }
    
    const emailSettingsPath = path.join(userDir, 'email_settings.json');
    const emailSettings = {
      recipientEmail: user.email || user.configuredEmail,
      showJobId: true,
      showStoreNumber: true,
      showStoreName: true,
      showLocation: true,
      showDate: true,
      showDispensers: true,
      enabled: true,
      frequency: 'daily',
      deliveryTime: '18:00',
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(emailSettingsPath, JSON.stringify(emailSettings, null, 2), 'utf8');
    console.log(`Updated ${emailSettingsPath}`);
    
    console.log('Settings update completed successfully.');
    console.log('You should now be able to use Daily Digest mode.');
  } catch (error) {
    console.error('Error updating settings:', error);
  }
}

// Run the update
forceUpdateSettings(); 