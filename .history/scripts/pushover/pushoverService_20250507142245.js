// Remove the circular imports and re-exports
// import { sendPushoverNotification, ... } from '../notifications/pushoverService.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import { getVisitId } from '../notifications/formatService.js';

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

/**
 * Get the app token from user settings or environment variables
 * @param {string} userId - The user ID to get the app token for (optional)
 * @returns {string} The app token
 */
function getAppToken(userId = null) {
  const settings = getUserPushoverSettings(userId);
  return settings.appToken || process.env.PUSHOVER_APP_TOKEN || envVars.PUSHOVER_APP_TOKEN;
}

/**
 * Get the user key from user settings or environment variables
 * @param {string} userId - The user ID to get the user key for (optional)
 * @returns {string} The user key
 */
function getUserKey(userId = null) {
  const settings = getUserPushoverSettings(userId);
  return settings.userKey || process.env.PUSHOVER_USER_KEY || envVars.PUSHOVER_USER_KEY;
}

/**
 * Send a notification via Pushover API
 * @param {Object} options - Notification options
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {number} [options.priority=0] - Priority (-2 to 2)
 * @param {string} [options.sound] - Sound to play
 * @param {string} [options.url] - URL to open when notification is tapped
 * @param {string} [options.url_title] - Title for the URL
 * @param {string} [options.device] - Device to send to
 * @param {number} [options.retry=60] - How often to retry sending (seconds)
 * @param {number} [options.expire=3600] - How long to keep retrying (seconds)
 * @param {string} [options.html=0] - Whether to format message as HTML
 * @param {string} [options.userId] - User ID to get settings for
 * @returns {Promise<Object>} - Response from Pushover API
 */
export async function sendPushoverNotification(options) {
  // Ensure required parameters are present
  if (!options.message) {
    throw new Error('Message is required for Pushover notification');
  }

  // Get the app token and user key
  const appToken = options.appToken || getAppToken(options.userId);
  const userKey = options.userKey || getUserKey(options.userId);

  // Get user settings to check if notifications are enabled
  const settings = getUserPushoverSettings(options.userId);
  
  // Check if pushover notifications are enabled
  if (settings.preferences && settings.preferences.enabled === false) {
    console.log('Pushover notifications are disabled, skipping notification send');
    return { success: false, error: 'Pushover notifications are disabled' };
  }

  // Construct payload with required fields
  const params = new URLSearchParams();
  params.append('token', appToken);
  params.append('user', userKey);
  params.append('message', options.message);

  // Add optional parameters if provided
  if (options.title) params.append('title', options.title);
  if (options.priority !== undefined) params.append('priority', options.priority);
  if (options.sound) params.append('sound', options.sound);
  if (options.url) params.append('url', options.url);
  if (options.url_title) params.append('url_title', options.url_title);
  if (options.device) params.append('device', options.device);
  if (options.html) params.append('html', options.html);
  
  // Add retry and expire for emergency priority
  if (options.priority === 2) {
    params.append('retry', options.retry || 60);
    params.append('expire', options.expire || 3600);
  }

  try {
    // Send request to Pushover API
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      body: params
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Pushover notification sent successfully', data);
      return { success: true, data };
    } else {
      console.error('Error sending Pushover notification:', data);
      return { success: false, error: data };
    }
  } catch (error) {
    console.error('Error sending Pushover notification:', error);
    return { success: false, error };
  }
}

/**
 * Check if a display preference is enabled
 * @param {string} preference - The preference name
 * @param {boolean} defaultValue - Default value to use if not defined
 * @param {string} userId - User ID to get settings for (optional)
 * @returns {boolean} - Whether the preference is enabled
 */
function isDisplayEnabled(preference, defaultValue = true, userId = null) {
  const settings = getUserPushoverSettings(userId);
  
  switch (preference) {
    case 'JOB_ID':
      return settings.preferences.showJobId;
    case 'STORE_NUMBER':
      return settings.preferences.showStoreNumber;
    case 'STORE_NAME':
      return settings.preferences.showStoreName;
    case 'LOCATION':
      return settings.preferences.showLocation;
    case 'DATE':
      return settings.preferences.showDate;
    case 'DISPENSERS':
      return settings.preferences.showDispensers;
    default:
      // If preference is not found, check environment variable as fallback
      const envValue = process.env[`PUSHOVER_SHOW_${preference}`];
      if (envValue === undefined) return defaultValue;
      return envValue !== 'false';
  }
}

/**
 * Get the configured priority level from user settings
 * @param {string} userId - User ID to get settings for (optional)
 * @returns {number} - The Pushover priority level
 */
function getConfiguredPriorityLevel(userId = null) {
  const settings = getUserPushoverSettings(userId);
  const level = settings.preferences.priorityLevel || 'normal';
  const priorityMap = {
    'lowest': -2,
    'low': -1,
    'normal': 0,
    'high': 1,
    'emergency': 2
  };
  return priorityMap[level] || 0; // Default to normal priority
}

/**
 * Get the configured notification sound
 * @param {string} userId - User ID to get settings for (optional)
 * @returns {string} - The Pushover sound name
 */
function getConfiguredSound(userId = null) {
  const settings = getUserPushoverSettings(userId);
  return settings.preferences.sound || 'pushover';
}

/**
 * Send a test notification via Pushover
 * @param {string} userId - User ID to send test notification to (optional)
 * @returns {Promise<Object>} - Response from Pushover API
 */
export async function sendTestPushoverNotification(userId = null) {
  // Verify Pushover credentials exist before attempting to send
  const appToken = getAppToken(userId);
  const userKey = getUserKey(userId);
  
  if (!appToken || !userKey) {
    console.error('Pushover credentials not properly configured');
    throw new Error('Pushover application token or user key missing. Please configure Pushover settings first.');
  }
  
  // Create a nicely formatted test message with updated styling that matches our unified notification system
  const message = `
  <div style="font-family: Arial, sans-serif; margin: 0; padding: 10px;">
    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px;">
      <h2 style="color: #2c3e50; margin-bottom: 15px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
        🔔 Test Notification
      </h2>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 15px;">
        Your Pushover notification system is working correctly. Notifications will be sent when schedule changes occur.
      </p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3498db;">
        <h3 style="color: #2c3e50; margin: 0 0 10px 0;">📱 Connection Status</h3>
        <p style="margin: 8px 0; display: flex; align-items: center;">
          <span style="color: #2ecc71; font-weight: bold; margin-right: 5px;">✓</span> Pushover service connected successfully
        </p>
        <p style="margin: 8px 0;">• App Token: <span style="color: #2ecc71; font-weight: bold;">Connected</span></p>
        <p style="margin: 8px 0;">• User Key: <span style="color: #2ecc71; font-weight: bold;">Verified</span></p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #27ae60;">
        <h3 style="color: #2c3e50; margin: 0 0 10px 0;">ℹ️ Notification Info</h3>
        <p style="margin: 8px 0;">• Type: <span style="font-weight: bold;">System Test</span></p>
        <p style="margin: 8px 0;">• Sound: <span style="font-weight: bold;">${getConfiguredSound(userId) || 'Default'}</span></p>
        <p style="margin: 8px 0;">• Priority: <span style="font-weight: bold;">${getConfiguredPriorityLevel(userId) === 0 ? 'Normal' : (getConfiguredPriorityLevel(userId) === 1 ? 'High' : 'Emergency')}</span></p>
        <p style="margin: 8px 0;">• Time: <span style="font-weight: bold;">${new Date().toLocaleString()}</span></p>
      </div>
      
      <div style="padding-top: 10px; text-align: center; margin-top: 10px; border-top: 1px solid #dee2e6;">
        <p style="color: #7f8c8d; font-size: 12px; margin: 5px 0;">
          Fossa Monitor Notification System
        </p>
      </div>
    </div>
  </div>`;

  try {
    const result = await sendPushoverNotification({
      title: 'Fossa Monitor - Test Notification',
      message,
      priority: getConfiguredPriorityLevel(userId),
      sound: getConfiguredSound(userId),
      html: 1, // Enable HTML formatting
      userId: userId
    });
    return result;
  } catch (error) {
    console.error('Error sending test Pushover notification:', error);
    throw error;
  }
}

/**
 * Format message for schedule changes
 * @param {Object} changes - Schedule change data
 * @returns {string} - Formatted HTML message
 */
function formatScheduleChangeMessage(changes) {
  let message = '';
  
  // Add all changes section
  if (changes.allChanges && changes.allChanges.length > 0) {
    message += '\n';
    
    // Add removed jobs
    const removedJobs = changes.allChanges.filter(change => change.type === 'removed');
    if (removedJobs.length > 0) {
      for (const job of removedJobs) {
        message += `<b><font color="#FF3B30">━━━</font></b>\n`;
        message += `<b>🗑️ Removed Visit</b>\n`;
        
        // Combine visit ID, store and date on one line
        const visitId = getVisitId(job.jobId);
        message += `<b>#${visitId}</b> | ${job.store} | <b>Date:</b> ${job.date}\n`;
        
        // Create a compact location display
        let mapUrl;
        let displayAddress;
        
        if (job.address) {
          // Just use city for display to save space
          if (job.address.cityState) {
            displayAddress = job.address.cityState.split(' ')[0]; // Just the city
          } else if (job.location) {
            displayAddress = job.location;
          } else {
            displayAddress = 'Unknown';
          }
          
          // Create Google Maps URL
          const fullAddress = [
            job.address.street, 
            job.address.cityState, 
            job.address.county
          ].filter(Boolean).join(', ');
          
          mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
        } else {
          // Fall back to location field
          mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(job.location || 'Unknown')}`;
          displayAddress = job.location || 'Unknown';
        }
        
        // Combine location and dispensers on one line
        message += `<b>Location:</b> <a href="${mapUrl}">${displayAddress}</a> | <b>Dispensers:</b> ${job.dispensers || 0}\n`;
      }
    }
    
    // Add added jobs
    const addedJobs = changes.allChanges.filter(change => change.type === 'added');
    if (addedJobs.length > 0) {
      // Implementation of added jobs formatting
      // Similar pattern to removed jobs
      for (const job of addedJobs) {
        message += `<b><font color="#34C759">━━━</font></b>\n`;
        message += `<b>➕ Added Visit</b>\n`;
        
        // Combine visit ID, store and date on one line
        const visitId = getVisitId(job.jobId);
        message += `<b>#${visitId}</b> | ${job.store} | <b>Date:</b> ${job.date}\n`;
        
        // Create a compact location display
        let mapUrl;
        let displayAddress;
        
        if (job.address) {
          // Just use city for display to save space
          if (job.address.cityState) {
            displayAddress = job.address.cityState.split(' ')[0]; // Just the city
          } else if (job.location) {
            displayAddress = job.location;
          } else {
            displayAddress = 'Unknown';
          }
          
          // Create Google Maps URL
          const fullAddress = [
            job.address.street, 
            job.address.cityState, 
            job.address.county
          ].filter(Boolean).join(', ');
          
          mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
        } else {
          // Fall back to location field
          mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(job.location || 'Unknown')}`;
          displayAddress = job.location || 'Unknown';
        }
        
        // Combine location and dispensers on one line
        message += `<b>Location:</b> <a href="${mapUrl}">${displayAddress}</a> | <b>Dispensers:</b> ${job.dispensers || 0}\n`;
      }
    }
    
    // Add date changes, swapped jobs, and replacement jobs
    // Similar pattern to above
    // ...
  }

  return message;
}

/**
 * Send schedule change notifications via Pushover
 * @param {Array} changes - Array of change objects
 * @param {Array|Object} users - Array of user objects or a single user object
 * @returns {Promise<Array>} - Resolves with an array of responses when notification is sent
 */
export async function sendScheduleChangePushover(changes, users) {
  // Ensure users is an array
  const userArray = Array.isArray(users) ? users : (users ? [users] : []);
  
  if (userArray.length === 0) {
    console.log('No users to notify via Pushover');
    return [];
  }

  if (!changes || !changes.allChanges || changes.allChanges.length === 0) {
    console.log('No significant changes to notify via Pushover');
    return [];
  }

  console.log('Starting Pushover notification for schedule changes...');
  
  // Compose simple notification message
  const totalChanges = changes.allChanges.length;
  const title = `📅 ${totalChanges} Schedule Change${totalChanges !== 1 ? 's' : ''} Detected`;
  const message = formatScheduleChangeMessage(changes);
  
  // Send notification to each user
  const allPromises = [];
  
  for (const user of userArray) {
    // Get pushover settings for this user
    const userKey = user.pushoverKey || (user.pushoverSettings ? user.pushoverSettings.userKey : null);
    const userId = user.id;
    
    if (!userKey) {
      console.warn(`User ${userId || 'unknown'} has no Pushover key`);
      allPromises.push(Promise.resolve({ success: false, error: 'No Pushover key for user' }));
      continue;
    }
    
    console.log(`Sending Pushover notification to user ${userId || 'unknown'}`);
    
    try {
      const result = await sendPushoverNotification({
        title: title,
        message: message,
        userKey: userKey,
        userId: userId,
        priority: 0, // Normal priority
        sound: 'pushover',
        html: 1
      });
      
      if (result.success) {
        console.log(`Successfully sent Pushover notification to user ${userId || 'unknown'}`);
      } else {
        console.error(`Error sending Pushover notification to user ${userId || 'unknown'}:`, result.error);
      }
      
      allPromises.push(Promise.resolve(result));
    } catch (error) {
      console.error(`Error sending Pushover notification to user ${userId || 'unknown'}:`, error);
      allPromises.push(Promise.resolve({ success: false, error: error.message || error }));
    }
  }
  
  return Promise.all(allPromises);
}

/**
 * Creates Pushover parameters for notification
 * @param {Object} options - Basic notification options
 * @returns {Object} - Parameters for Pushover API
 */
export function createPushoverParams(options) {
  // Implementation of pushover parameters creation
  return {
    token: options.token || getAppToken(options.userId),
    user: options.user,
    message: options.message,
    title: options.title,
    priority: options.priority || 0,
    sound: options.sound || 'pushover',
    html: options.html || 1
  };
}

/**
 * Send a sample job notification via Pushover to test display preferences
 * @param {string} userId - User ID to send sample notification to (optional)
 * @returns {Promise<Object>} - Response from Pushover API
 */
export async function sendSampleJobPushover(userId = null) {
  // Implementation of sample job notification
  // ...
  return sendPushoverNotification({
    title: 'Fossa Monitor - Sample Job',
    message: 'Sample job notification',
    priority: 0,
    sound: 'pushover',
    userId: userId
  });
}

/**
 * Sends alert notifications via Pushover
 * @param {Array} alerts - Array of alert objects
 * @param {Array|Object} users - Array of user objects or a single user object
 * @returns {Promise<Array>} - Array of responses from Pushover API
 */
export async function sendAlertPushover(alerts, users) {
  // Implementation of alert notification
  // ...
  return Promise.resolve([]);
} 