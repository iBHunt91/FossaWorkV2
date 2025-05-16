import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define path to settings file
const userSettingsPath = path.join(__dirname, '..', '..', 'data', 'user-settings.json');
const defaultSettingsPath = path.join(__dirname, '..', '..', 'data', 'email-settings.json');

/**
 * Find the correct user settings file by checking various possible paths
 * @param {string} userId - The user ID to find settings for
 * @param {string} settingsFileName - Name of the settings file to find
 * @returns {string|null} - Path to the settings file or null if not found
 */
function findUserSettingsPath(userId = null, settingsFileName = 'email_settings.json') {
  try {
    // Base users directory
    const usersDir = path.join(__dirname, '../../data/users');
    
    // Check if a specific user ID was provided
    if (userId) {
      // Try direct path with provided user ID
      const directPath = path.join(usersDir, userId, settingsFileName);
      if (fs.existsSync(directPath)) {
        console.log(`Found email settings at direct path: ${directPath}`);
        return directPath;
      }
      
      // If not found, try to find it in the users directory by checking all subdirectories
      try {
        if (fs.existsSync(usersDir)) {
          const userDirs = fs.readdirSync(usersDir).filter(dir => 
            fs.statSync(path.join(usersDir, dir)).isDirectory());
          
          // Check if any directory contains the settings file
          for (const dir of userDirs) {
            const possiblePath = path.join(usersDir, dir, settingsFileName);
            if (fs.existsSync(possiblePath)) {
              console.log(`Found email settings in directory ${dir}: ${possiblePath}`);
              return possiblePath;
            }
          }
        }
      } catch (err) {
        console.error(`Error searching user directories for ${settingsFileName}:`, err);
      }
    }
    
    // Try the global settings file first (highest priority if no user-specific file)
    const globalSettingsPath = path.join(__dirname, '../../data/email-settings.json');
    if (fs.existsSync(globalSettingsPath)) {
      console.log(`Found global email settings at: ${globalSettingsPath}`);
      return globalSettingsPath;
    }
    
    // If we've reached here, try the user-settings.json file (compatibility)
    const userSettingsPath = path.join(__dirname, '../../data/user-settings.json');
    if (fs.existsSync(userSettingsPath)) {
      console.log(`Found legacy user settings at: ${userSettingsPath}`);
      return userSettingsPath;
    }
    
    // If no settings file was found anywhere, return null
    console.log(`Could not find ${settingsFileName} for any user or global settings`);
    return null;
  } catch (error) {
    console.error('Error finding user settings path:', error);
    return null;
  }
}

/**
 * Get user email settings
 * @param {string} userId - Optional user ID to get settings for
 * @returns {Object} Email settings
 */
export function getUserEmailSettings(userId = null) {
  try {
    // Default settings
    const defaultSettings = {
      smtpServer: '',
      smtpPort: 587,
      smtpUsername: '',
      smtpPassword: '',
      senderEmail: '',
      recipientEmail: '',
      tls: true
    };
    
    // Try to find the settings file
    const settingsPath = findUserSettingsPath(userId);
    
    // If no settings file was found, return defaults
    if (!settingsPath) {
      console.log('No email settings file found, using defaults');
      return defaultSettings;
    }
    
    // Load settings from the file
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsData);
    
    // Check which format the settings are in
    if (settings.smtp || settings.email) {
      // New format with separate smtp and email sections
      const smtp = settings.smtp || {};
      const email = settings.email || {};
      
      return {
        smtpServer: smtp.server || process.env.SMTP_SERVER || defaultSettings.smtpServer,
        smtpPort: smtp.port || parseInt(process.env.SMTP_PORT || '587'),
        smtpUsername: smtp.username || process.env.SMTP_USERNAME || defaultSettings.smtpUsername,
        smtpPassword: smtp.password || process.env.SMTP_PASSWORD || defaultSettings.smtpPassword,
        senderEmail: email.sender || process.env.SENDER_EMAIL || defaultSettings.senderEmail,
        recipientEmail: email.recipient || process.env.RECIPIENT_EMAIL || defaultSettings.recipientEmail,
        tls: smtp.tls === undefined ? true : smtp.tls
      };
    }
    
    // Old flat format or user-specific format
    return {
      smtpServer: settings.smtpServer || process.env.SMTP_SERVER || defaultSettings.smtpServer,
      smtpPort: settings.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
      smtpUsername: settings.smtpUsername || process.env.SMTP_USERNAME || defaultSettings.smtpUsername,
      smtpPassword: settings.smtpPassword || process.env.SMTP_PASSWORD || defaultSettings.smtpPassword,
      senderEmail: settings.senderEmail || process.env.SENDER_EMAIL || defaultSettings.senderEmail,
      recipientEmail: settings.recipientEmail || process.env.RECIPIENT_EMAIL || defaultSettings.recipientEmail,
      tls: settings.tls === undefined ? true : settings.tls
    };
  } catch (error) {
    console.error('Error getting email settings:', error);
    
    // Fall back to environment variables
    return {
      smtpServer: process.env.SMTP_SERVER || '',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpUsername: process.env.SMTP_USERNAME || '',
      smtpPassword: process.env.SMTP_PASSWORD || '',
      senderEmail: process.env.SENDER_EMAIL || '',
      recipientEmail: process.env.RECIPIENT_EMAIL || '',
      tls: true
    };
  }
}

/**
 * Save user email settings
 * @param {Object} settings - The settings to save
 * @param {string} userId - Optional user ID to save settings for
 * @returns {boolean} - Whether the save was successful
 */
export function saveUserEmailSettings(settings, userId = null) {
  try {
    let settingsPath;
    let targetDir;
    
    // If userId is provided, save to user-specific location
    if (userId) {
      const usersDir = path.join(__dirname, '../../data/users');
      targetDir = path.join(usersDir, userId);
      settingsPath = path.join(targetDir, 'email_settings.json');
    } else {
      // Try to find an existing settings file to update
      const existingPath = findUserSettingsPath();
      
      if (existingPath) {
        settingsPath = existingPath;
        targetDir = path.dirname(existingPath);
      } else {
        // Default to global settings location
        targetDir = path.join(__dirname, '../../data');
        settingsPath = path.join(targetDir, 'email-settings.json');
      }
    }
    
    // Ensure the directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Write the settings to the file
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`Email settings saved successfully to ${settingsPath}`);
    return true;
  } catch (error) {
    console.error('Error saving email settings:', error);
    return false;
  }
}

/**
 * Update the user's email settings
 * @param {Object} settings - The new settings
 */
export function updateEmailSettings(settings) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(userSettingsPath);
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Load existing settings if any
    let userSettings = {};
    if (fs.existsSync(userSettingsPath)) {
      userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    }
    
    // Update email settings
    userSettings.email = settings;
    
    // Write settings back to file
    fs.writeFileSync(userSettingsPath, JSON.stringify(userSettings, null, 2));
    return true;
  } catch (error) {
    console.error('Error updating email settings:', error);
    return false;
  }
} 