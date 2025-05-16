// Re-export all functions from the notifications/pushoverService.js file
export {
  sendPushoverNotification,
  sendScheduleChangePushover,
  sendTestPushoverNotification,
  sendSampleJobPushover,
  sendAlertPushover,
  createPushoverParams
} from '../notifications/pushoverService.js';

// Import needed modules for getUserPushoverSettings
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file for backward compatibility
let envVars = {};
try {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envVars = envContent.split('\n').reduce((acc, line) => {
      const [key, value] = line.split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }
} catch (err) {
  console.error('Error loading .env file:', err);
}

/**
 * Find the correct user settings file by checking various possible paths
 * @param {string} userId - The user ID to find settings for
 * @param {string} settingsFileName - Name of the settings file to find
 * @returns {string|null} - Path to the settings file or null if not found
 */
function findUserSettingsPath(userId = null, settingsFileName = 'pushover_settings.json') {
  try {
    // Base users directory
    const usersDir = path.join(__dirname, '../../data/users');
    
    // Check if a specific user ID was provided
    if (userId) {
      // Try direct path with provided user ID
      const directPath = path.join(usersDir, userId, settingsFileName);
      if (fs.existsSync(directPath)) {
        console.log(`Found settings at direct path: ${directPath}`);
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
              console.log(`Found settings in directory ${dir}: ${possiblePath}`);
              return possiblePath;
            }
          }
        }
      } catch (err) {
        console.error(`Error searching user directories for ${settingsFileName}:`, err);
      }
    }
    
    // If we've reached here, try the active user directory (older path convention)
    const legacyUserDir = path.join(__dirname, '../../data/user');
    const legacyPath = path.join(legacyUserDir, settingsFileName);
    if (fs.existsSync(legacyPath)) {
      console.log(`Found settings at legacy path: ${legacyPath}`);
      return legacyPath;
    }
    
    // If no settings file was found anywhere, return null
    console.log(`Could not find ${settingsFileName} for any user`);
    return null;
  } catch (error) {
    console.error('Error finding user settings path:', error);
    return null;
  }
}

/**
 * Get user pushover settings from user file
 * @param {string} userId - The user ID to get settings for (optional)
 * @returns {Object} The user's pushover settings
 */
export function getUserPushoverSettings(userId = null) {
  try {
    // Try to find the settings file
    const settingsPath = findUserSettingsPath(userId, 'pushover_settings.json');
    
    // If no settings file was found, fall back to environment variables
    if (!settingsPath) {
      console.log('No pushover settings file found, using environment variables');
      return {
        appToken: process.env.PUSHOVER_APP_TOKEN || envVars.PUSHOVER_APP_TOKEN || '',
        userKey: process.env.PUSHOVER_USER_KEY || envVars.PUSHOVER_USER_KEY || '',
        preferences: {
          showJobId: process.env.PUSHOVER_SHOW_JOB_ID !== 'false',
          showStoreNumber: process.env.PUSHOVER_SHOW_STORE_NUMBER !== 'false',
          showStoreName: process.env.PUSHOVER_SHOW_STORE_NAME !== 'false',
          showLocation: process.env.PUSHOVER_SHOW_LOCATION !== 'false',
          showDate: process.env.PUSHOVER_SHOW_DATE !== 'false',
          showDispensers: process.env.PUSHOVER_SHOW_DISPENSERS !== 'false',
          priorityLevel: process.env.PUSHOVER_PRIORITY_LEVEL || 'normal',
          sound: process.env.PUSHOVER_SOUND || 'pushover'
        }
      };
    }
    
    // Read and parse the settings file
    try {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return {
        appToken: data.appToken || process.env.PUSHOVER_APP_TOKEN || '',
        userKey: data.userKey || process.env.PUSHOVER_USER_KEY || '',
        preferences: {
          showJobId: data.preferences?.showJobId !== false,
          showStoreNumber: data.preferences?.showStoreNumber !== false,
          showStoreName: data.preferences?.showStoreName !== false,
          showLocation: data.preferences?.showLocation !== false,
          showDate: data.preferences?.showDate !== false,
          showDispensers: data.preferences?.showDispensers !== false,
          priorityLevel: data.preferences?.priorityLevel || 'normal',
          sound: data.preferences?.sound || 'pushover'
        }
      };
    } catch (error) {
      console.error('Error reading user pushover settings:', error);
      // Fall back to environment variables
      return {
        appToken: process.env.PUSHOVER_APP_TOKEN || envVars.PUSHOVER_APP_TOKEN || '',
        userKey: process.env.PUSHOVER_USER_KEY || envVars.PUSHOVER_USER_KEY || '',
        preferences: {
          showJobId: process.env.PUSHOVER_SHOW_JOB_ID !== 'false',
          showStoreNumber: process.env.PUSHOVER_SHOW_STORE_NUMBER !== 'false',
          showStoreName: process.env.PUSHOVER_SHOW_STORE_NAME !== 'false',
          showLocation: process.env.PUSHOVER_SHOW_LOCATION !== 'false',
          showDate: process.env.PUSHOVER_SHOW_DATE !== 'false',
          showDispensers: process.env.PUSHOVER_SHOW_DISPENSERS !== 'false',
          priorityLevel: process.env.PUSHOVER_PRIORITY_LEVEL || 'normal',
          sound: process.env.PUSHOVER_SOUND || 'pushover'
        }
      };
    }
  } catch (error) {
    console.error('Error getting user pushover settings:', error);
    // Provide default values if anything goes wrong
    return {
      appToken: '',
      userKey: '',
      preferences: {
        showJobId: true,
        showStoreNumber: true,
        showStoreName: true,
        showLocation: true,
        showDate: true,
        showDispensers: true,
        priorityLevel: 'normal',
        sound: 'pushover'
      }
    };
  }
}

/**
 * Save user pushover settings to user file
 * @param {Object} settings - The settings to save
 * @param {string} userId - The user ID to save settings for (optional)
 * @returns {boolean} - Whether the save was successful
 */
export function saveUserPushoverSettings(settings, userId = null) {
  try {
    // Base users directory
    const usersDir = path.join(__dirname, '../../data/users');
    let userDir;
    let settingsPath;
    
    // If a specific user ID was provided
    if (userId) {
      userDir = path.join(usersDir, userId);
      settingsPath = path.join(userDir, 'pushover_settings.json');
    } else {
      // Try to find an existing settings file to update
      const existingPath = findUserSettingsPath(null, 'pushover_settings.json');
      if (existingPath) {
        settingsPath = existingPath;
        userDir = path.dirname(existingPath);
      } else {
        // Fall back to the first directory in users if no settings file exists
        try {
          if (fs.existsSync(usersDir)) {
            const userDirs = fs.readdirSync(usersDir).filter(dir => 
              fs.statSync(path.join(usersDir, dir)).isDirectory());
            
            if (userDirs.length > 0) {
              userDir = path.join(usersDir, userDirs[0]);
              settingsPath = path.join(userDir, 'pushover_settings.json');
            } else {
              // Fall back to data/users directory itself if no subdirectories
              userDir = usersDir;
              settingsPath = path.join(userDir, 'pushover_settings.json');
            }
          } else {
            // Fall back to legacy path if users directory doesn't exist
            userDir = path.join(__dirname, '../../data/user');
            settingsPath = path.join(userDir, 'pushover_settings.json');
          }
        } catch (err) {
          console.error(`Error finding directory to save pushover settings:`, err);
          // Fall back to legacy path
          userDir = path.join(__dirname, '../../data/user');
          settingsPath = path.join(userDir, 'pushover_settings.json');
        }
      }
    }
    
    // Ensure the directory exists
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Write settings to file
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`Pushover settings saved successfully at ${settingsPath}`);
    return true;
  } catch (error) {
    console.error('Error saving pushover settings:', error);
    return false;
  }
} 