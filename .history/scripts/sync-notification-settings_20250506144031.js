/**
 * Script to synchronize notification settings across different files
 * This script ensures email settings are consistent across all locations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getActiveUser } from '../server/utils/userManager.js';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const usersDir = path.join(dataDir, 'users');
const usersJsonPath = path.join(usersDir, 'users.json');

/**
 * Synchronize notification settings for the current user
 */
async function syncNotificationSettings() {
  console.log('=== SYNCHRONIZING NOTIFICATION SETTINGS ===');
  
  // Get the current user ID
  const userId = getActiveUser();
  if (!userId) {
    console.error('Error: No active user found');
    return;
  }
  
  console.log(`Synchronizing settings for user ID: ${userId}`);
  
  try {
    // Check if users.json exists
    if (!fs.existsSync(usersJsonPath)) {
      console.error(`Error: users.json not found at ${usersJsonPath}`);
      return;
    }
    
    // Load users data
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
    
    const user = usersData[userIndex];
    console.log(`Found user: ${user.label || user.email}`);
    
    // Get user's email_settings.json path
    const userDir = path.join(usersDir, userId);
    const emailSettingsPath = path.join(userDir, 'email_settings.json');
    
    // Check if email_settings.json exists
    if (!fs.existsSync(emailSettingsPath)) {
      console.log(`No email_settings.json found for user. Creating a default one.`);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      
      // Create default email settings
      const defaultEmailSettings = {
        recipientEmail: user.email || user.configuredEmail,
        showJobId: true,
        showStoreNumber: true,
        showStoreName: true,
        showLocation: true,
        showDate: true,
        showDispensers: true,
        enabled: true,
        frequency: 'immediate',
        deliveryTime: '18:00',
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(emailSettingsPath, JSON.stringify(defaultEmailSettings, null, 2), 'utf8');
      console.log(`Created default email_settings.json for user ${userId}`);
    }
    
    // Load email_settings.json
    console.log(`Loading email settings from ${emailSettingsPath}`);
    const emailSettings = JSON.parse(fs.readFileSync(emailSettingsPath, 'utf8'));
    console.log('Email settings:', JSON.stringify(emailSettings, null, 2));
    
    // Get current notification settings from users.json
    const notificationSettings = user.notificationSettings || {};
    console.log('Current notification settings in users.json:', JSON.stringify(notificationSettings, null, 2));
    
    // Determine which settings to use (prioritize email_settings.json for frequency and delivery time)
    const frequency = emailSettings.frequency || notificationSettings.email?.frequency || 'immediate';
    const deliveryTime = emailSettings.deliveryTime || notificationSettings.email?.deliveryTime || '18:00';
    
    console.log(`\nDetermined settings to use:`);
    console.log(`- Frequency: ${frequency}`);
    console.log(`- Delivery time: ${deliveryTime}`);
    
    // Update notification settings in users.json
    if (!user.notificationSettings) {
      user.notificationSettings = {};
    }
    
    if (!user.notificationSettings.email) {
      user.notificationSettings.email = {};
    }
    
    // Update email settings
    user.notificationSettings.email.enabled = emailSettings.enabled !== false;
    user.notificationSettings.email.frequency = frequency;
    user.notificationSettings.email.deliveryTime = deliveryTime;
    user.notificationSettings.enabled = true;
    
    // Save updated users.json
    usersData[userIndex] = user;
    fs.writeFileSync(usersJsonPath, JSON.stringify(usersData, null, 2), 'utf8');
    console.log(`\nUpdated users.json with synchronized settings`);
    
    // Also ensure email_settings.json has the same values
    emailSettings.frequency = frequency;
    emailSettings.deliveryTime = deliveryTime;
    emailSettings.lastUpdated = new Date().toISOString();
    fs.writeFileSync(emailSettingsPath, JSON.stringify(emailSettings, null, 2), 'utf8');
    console.log(`Updated email_settings.json with synchronized settings`);
    
    // Update email-settings.json if it exists
    const altEmailSettingsPath = path.join(userDir, 'email-settings.json');
    if (fs.existsSync(altEmailSettingsPath)) {
      const altEmailSettings = JSON.parse(fs.readFileSync(altEmailSettingsPath, 'utf8'));
      altEmailSettings.lastUpdated = new Date().toISOString();
      fs.writeFileSync(altEmailSettingsPath, JSON.stringify(altEmailSettings, null, 2), 'utf8');
      console.log(`Updated email-settings.json with synchronized settings`);
    }
    
    console.log('\n✅ Notification settings have been successfully synchronized!');
    console.log('Settings are now consistent across all files.');
    
  } catch (error) {
    console.error('Error synchronizing notification settings:', error);
  }
}

// Run the synchronization
syncNotificationSettings(); 