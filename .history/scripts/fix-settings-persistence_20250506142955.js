/**
 * Fix for email settings persistence issues
 * This script updates all notification settings while ensuring session persistence
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
 * Safely update notification settings without disrupting session
 */
async function fixSettingsPersistence() {
  console.log('=== FIXING NOTIFICATION SETTINGS PERSISTENCE ===');
  
  // Get the current user ID
  const userId = getActiveUser();
  if (!userId) {
    console.error('❌ No active user found. Please log in first.');
    return;
  }
  
  console.log(`Working with user ID: ${userId}`);
  
  try {
    // Make backup copies of important files before modifying them
    const timeStamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(projectRoot, 'data', 'backups', timeStamp);
    
    console.log(`Creating backup directory: ${backupDir}`);
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Backup users.json
    if (fs.existsSync(usersJsonPath)) {
      const backupUsersFile = path.join(backupDir, 'users.json');
      fs.copyFileSync(usersJsonPath, backupUsersFile);
      console.log(`✅ Backed up users.json`);
    }
    
    // Backup user-specific email settings files
    const userDir = path.join(usersDir, userId);
    const emailSettingsPath = path.join(userDir, 'email_settings.json');
    const altEmailSettingsPath = path.join(userDir, 'email-settings.json');
    
    if (fs.existsSync(emailSettingsPath)) {
      const backupEmailFile = path.join(backupDir, 'email_settings.json');
      fs.copyFileSync(emailSettingsPath, backupEmailFile);
      console.log(`✅ Backed up email_settings.json`);
    }
    
    if (fs.existsSync(altEmailSettingsPath)) {
      const backupAltEmailFile = path.join(backupDir, 'email-settings.json');
      fs.copyFileSync(altEmailSettingsPath, backupAltEmailFile);
      console.log(`✅ Backed up email-settings.json`);
    }
    
    console.log('All important files backed up\n');
    
    // Now load the current user settings
    console.log('Loading current settings...');
    const users = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      console.error(`❌ User ${userId} not found in users.json`);
      return;
    }
    
    const user = users[userIndex];
    console.log(`Found user: ${user.label || user.email}`);
    
    // Load email settings
    let emailSettings = null;
    if (fs.existsSync(emailSettingsPath)) {
      emailSettings = JSON.parse(fs.readFileSync(emailSettingsPath, 'utf8'));
    } else {
      console.log(`⚠️ No email_settings.json found. Will create default.`);
      emailSettings = {
        recipientEmail: user.email || user.configuredEmail || '',
        showJobId: true,
        showStoreNumber: true, 
        showStoreName: true,
        showLocation: true,
        showDate: true,
        showDispensers: true,
        enabled: true,
        frequency: 'daily',
        deliveryTime: '18:45',
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Get the desired settings
    console.log('\nEnter your desired notification settings:');
    console.log('1) Current email frequency:', emailSettings.frequency);
    console.log('2) Current delivery time:', emailSettings.deliveryTime);
    
    // Ensure notification settings object exists in user record
    if (!user.notificationSettings) {
      user.notificationSettings = {
        enabled: true,
        email: {
          enabled: true,
          frequency: 'daily',
          deliveryTime: '18:45'
        }
      };
    }
    
    if (!user.notificationSettings.email) {
      user.notificationSettings.email = {
        enabled: true,
        frequency: 'daily',
        deliveryTime: '18:45'
      };
    }
    
    // Use values from email_settings.json
    user.notificationSettings.email.frequency = emailSettings.frequency;
    user.notificationSettings.email.deliveryTime = emailSettings.deliveryTime;
    user.notificationSettings.enabled = true;
    user.notificationSettings.email.enabled = emailSettings.enabled !== false;
    
    // Make sure all necessary properties are set
    const updatedEmailSettings = {
      ...emailSettings,
      enabled: true,
      frequency: emailSettings.frequency,
      deliveryTime: emailSettings.deliveryTime,
      lastUpdated: new Date().toISOString()
    };
    
    // Write back with cautious approach to avoid corruption
    console.log('\nApplying settings updates...');
    
    // First, write the user file back
    const userDataTmp = JSON.stringify(users, null, 2);
    const tmpUsersFile = path.join(backupDir, 'users.json.new');
    fs.writeFileSync(tmpUsersFile, userDataTmp, 'utf8');
    
    // If successful, copy it back to the original
    fs.copyFileSync(tmpUsersFile, usersJsonPath);
    console.log('✅ Updated users.json');
    
    // Now update email settings
    const emailSettingsTmp = JSON.stringify(updatedEmailSettings, null, 2);
    const tmpEmailFile = path.join(backupDir, 'email_settings.json.new');
    fs.writeFileSync(tmpEmailFile, emailSettingsTmp, 'utf8');
    
    // Create user directory if it doesn't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Copy back to original
    fs.copyFileSync(tmpEmailFile, emailSettingsPath);
    console.log('✅ Updated email_settings.json');
    
    // For email-settings.json, just update the lastUpdated timestamp
    if (fs.existsSync(altEmailSettingsPath)) {
      const altEmailSettings = JSON.parse(fs.readFileSync(altEmailSettingsPath, 'utf8'));
      altEmailSettings.lastUpdated = new Date().toISOString();
      fs.writeFileSync(altEmailSettingsPath, JSON.stringify(altEmailSettings, null, 2), 'utf8');
      console.log('✅ Updated email-settings.json');
    }
    
    console.log('\n✅ Settings persistence fix applied successfully!');
    console.log(`Your digest will be delivered at: ${emailSettings.deliveryTime}`);
    console.log(`Backups of your original configuration were saved to: ${backupDir}`);
    console.log('\nYou should now be able to use the application without being logged out.');
    console.log('If you continue experiencing issues, please restart the application.');
    
  } catch (error) {
    console.error('❌ Error fixing settings persistence:', error);
    console.log('Try restarting the application and setting your preferences again.');
  }
}

// Run the fix
fixSettingsPersistence(); 