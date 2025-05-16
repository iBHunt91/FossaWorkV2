import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendTestPushoverNotification, sendSampleJobPushover } from '../../scripts/notifications/pushoverService.js';
import { sendTestEmail, sendSampleJobEmail } from '../../scripts/email/emailService.js';
import { resolveUserFilePath, getActiveUser } from '../utils/userManager.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Env file path
const envPath = path.join(__dirname, '../../.env');

// Helper function to read .env file - legacy method, kept for backward compatibility
function readEnvFile() {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});
  return envVars;
}

// Helper function to update .env file - legacy method, kept for backward compatibility
function updateEnvVar(key, value) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  const keyExists = envContent.includes(`${key}=`);
  
  if (keyExists) {
    envContent = envContent.replace(
      new RegExp(`${key}=.*`, 'g'),
      `${key}=${value}`
    );
  } else {
    envContent += `\n${key}=${value}`;
  }
  
  fs.writeFileSync(envPath, envContent, 'utf8');
  process.env[key] = value;
  return true;
}

// Helper function to read user email settings
function readUserEmailSettings() {
  const emailSettingsPath = resolveUserFilePath('email_settings.json');
  if (!fs.existsSync(emailSettingsPath)) {
    // Return default settings
    return {
      recipientEmail: '',
      showJobId: true,
      showStoreNumber: true,
      showStoreName: true,
      showLocation: true,
      showDate: true,
      showDispensers: true
    };
  }
  
  try {
    const data = fs.readFileSync(emailSettingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading user email settings:', error);
    return {
      recipientEmail: '',
      showJobId: true,
      showStoreNumber: true,
      showStoreName: true,
      showLocation: true,
      showDate: true,
      showDispensers: true
    };
  }
}

// Helper function to save user email settings
function saveUserEmailSettings(settings) {
  const emailSettingsPath = resolveUserFilePath('email_settings.json');
  const dir = path.dirname(emailSettingsPath);
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Add a timestamp
  const dataToSave = {
    ...settings,
    lastUpdated: new Date().toISOString()
  };
  
  fs.writeFileSync(emailSettingsPath, JSON.stringify(dataToSave, null, 2), 'utf8');
  return true;
}

// Helper function to read user pushover settings
function readUserPushoverSettings() {
  const pushoverSettingsPath = resolveUserFilePath('pushover_settings.json');
  if (!fs.existsSync(pushoverSettingsPath)) {
    // Return default settings
    return {
      appToken: '',
      userKey: '',
      preferences: {
        showJobId: true,
        showStoreNumber: true,
        showStoreName: true,
        showLocation: true,
        showDate: true,
        showDispensers: true
      }
    };
  }
  
  try {
    const data = fs.readFileSync(pushoverSettingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading user pushover settings:', error);
    return {
      appToken: '',
      userKey: '',
      preferences: {
        showJobId: true,
        showStoreNumber: true,
        showStoreName: true,
        showLocation: true,
        showDate: true,
        showDispensers: true
      }
    };
  }
}

// Helper function to save user pushover settings
function saveUserPushoverSettings(settings) {
  const pushoverSettingsPath = resolveUserFilePath('pushover_settings.json');
  const dir = path.dirname(pushoverSettingsPath);
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Add a timestamp
  const dataToSave = {
    ...settings,
    lastUpdated: new Date().toISOString()
  };
  
  fs.writeFileSync(pushoverSettingsPath, JSON.stringify(dataToSave, null, 2), 'utf8');
  return true;
}

// Get Email settings
router.get('/email', (req, res) => {
  try {
    // Get user-specific email settings
    const emailSettings = readUserEmailSettings();
    
    res.json({
      success: true,
      ...emailSettings
    });
  } catch (error) {
    console.error('Error fetching email settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch email settings' });
  }
});

// Save Email settings
router.post('/email', async (req, res) => {
  try {
    const { recipientEmail, showJobId, showStoreNumber, showStoreName, showLocation, showDate, showDispensers, frequency, deliveryTime, enabled, preventReload } = req.body;
    
    if (!recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient email is required' 
      });
    }
    
    // Save to user-specific file
    const emailSettings = {
      recipientEmail,
      showJobId: showJobId !== false,
      showStoreNumber: showStoreNumber !== false,
      showStoreName: showStoreName !== false,
      showLocation: showLocation !== false,
      showDate: showDate !== false,
      showDispensers: showDispensers !== false,
      enabled: enabled !== false,
      frequency: frequency || 'immediate',
      deliveryTime: deliveryTime || '18:00'
    };
    
    // Save to email_settings.json file
    saveUserEmailSettings(emailSettings);
    
    // Get the current user ID
    const userId = getCurrentUserId();
    
    // Also save to notification settings in users.json
    if (userId) {
      console.log(`Updating notification settings for user ${userId} with frequency ${frequency} and deliveryTime ${deliveryTime}`);
      
      // Import updateUserNotificationSettings
      const { updateUserNotificationSettings } = await import('../../scripts/user/userService.js');
      
      // Update user notification settings
      await updateUserNotificationSettings(userId, {
        email: {
          enabled: enabled !== false,
          frequency: frequency || 'immediate',
          deliveryTime: deliveryTime || '18:00'
        },
        enabled: enabled !== false
      });
    } else {
      console.warn('No current user ID found, only updated email_settings.json');
    }
    
    // Only update environment variables if not preventing reload
    if (!preventReload) {
      // Update environment variables for backward compatibility
      updateEnvVar('VITE_RECIPIENT_EMAIL', recipientEmail);
      updateEnvVar('EMAIL_SHOW_JOB_ID', showJobId ? 'true' : 'false');
      updateEnvVar('EMAIL_SHOW_STORE_NUMBER', showStoreNumber ? 'true' : 'false');
      updateEnvVar('EMAIL_SHOW_STORE_NAME', showStoreName ? 'true' : 'false');
      updateEnvVar('EMAIL_SHOW_LOCATION', showLocation ? 'true' : 'false');
      updateEnvVar('EMAIL_SHOW_DATE', showDate ? 'true' : 'false');
      updateEnvVar('EMAIL_SHOW_DISPENSERS', showDispensers ? 'true' : 'false');
    } else {
      // Just update process.env without writing to file when preventReload is true
      process.env.VITE_RECIPIENT_EMAIL = recipientEmail;
      process.env.EMAIL_SHOW_JOB_ID = showJobId ? 'true' : 'false';
      process.env.EMAIL_SHOW_STORE_NUMBER = showStoreNumber ? 'true' : 'false';
      process.env.EMAIL_SHOW_STORE_NAME = showStoreName ? 'true' : 'false';
      process.env.EMAIL_SHOW_LOCATION = showLocation ? 'true' : 'false';
      process.env.EMAIL_SHOW_DATE = showDate ? 'true' : 'false';
      process.env.EMAIL_SHOW_DISPENSERS = showDispensers ? 'true' : 'false';
    }
    
    res.json({ success: true, message: 'Email settings saved successfully' });
  } catch (error) {
    console.error('Error saving email settings:', error);
    res.status(500).json({ success: false, message: 'Failed to save email settings' });
  }
});

// Function to get current user ID (usually from the user-settings.json file)
function getCurrentUserId() {
  try {
    // Check data/users/users.json first
    const usersJsonPath = path.join(__dirname, '../../data/users/users.json');
    if (fs.existsSync(usersJsonPath)) {
      const users = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
      
      // Find the most recently used user
      if (Array.isArray(users) && users.length > 0) {
        // Sort by lastUsed timestamp (most recent first)
        const sortedUsers = [...users].sort((a, b) => {
          const dateA = a.lastUsed ? new Date(a.lastUsed) : new Date(0);
          const dateB = b.lastUsed ? new Date(b.lastUsed) : new Date(0);
          return dateB - dateA;
        });
        
        return sortedUsers[0].id;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}

// Test Email notification
router.post('/email/test', async (req, res) => {
  try {
    const { recipientEmail } = req.body;
    
    if (!recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient email is required' 
      });
    }
    
    // Temporarily update env variable for the test
    process.env.VITE_RECIPIENT_EMAIL = recipientEmail;
    
    // Send test email
    await sendTestEmail();
    
    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send test email' 
    });
  }
});

// Send sample job email to test display preferences
router.post('/email/sample-job', async (req, res) => {
  try {
    const { recipientEmail, preferences } = req.body;
    
    if (!recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient email is required' 
      });
    }
    
    // Temporarily update env variables for the test
    process.env.VITE_RECIPIENT_EMAIL = recipientEmail;
    
    // Update display preferences if provided
    if (preferences) {
      process.env.EMAIL_SHOW_JOB_ID = preferences.showJobId ? 'true' : 'false';
      process.env.EMAIL_SHOW_STORE_NUMBER = preferences.showStoreNumber ? 'true' : 'false';
      process.env.EMAIL_SHOW_STORE_NAME = preferences.showStoreName ? 'true' : 'false';
      process.env.EMAIL_SHOW_LOCATION = preferences.showLocation ? 'true' : 'false';
      process.env.EMAIL_SHOW_DATE = preferences.showDate ? 'true' : 'false';
      process.env.EMAIL_SHOW_DISPENSERS = preferences.showDispensers ? 'true' : 'false';
    }
    
    // Send sample job email
    const result = await sendSampleJobEmail();
    
    if (result && result.success) {
      res.json({ success: true, message: 'Sample job email sent successfully' });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Failed to send sample job email' 
      });
    }
  } catch (error) {
    console.error('Error sending sample job email:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send sample job email' 
    });
  }
});

// Get Pushover settings
router.get('/pushover', (req, res) => {
  try {
    // Get user-specific pushover settings
    const pushoverSettings = readUserPushoverSettings();
    
    res.json({
      success: true,
      ...pushoverSettings
    });
  } catch (error) {
    console.error('Error fetching Pushover settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch Pushover settings' });
  }
});

// Save Pushover settings
router.post('/pushover', (req, res) => {
  try {
    const { appToken, userKey, preferences, preventReload } = req.body;
    
    if (!appToken || !userKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Application token and user key are required' 
      });
    }
    
    // Save to user-specific file
    const pushoverSettings = {
      appToken,
      userKey,
      preferences: {
        showJobId: preferences?.showJobId !== false,
        showStoreNumber: preferences?.showStoreNumber !== false,
        showStoreName: preferences?.showStoreName !== false,
        showLocation: preferences?.showLocation !== false,
        showDate: preferences?.showDate !== false,
        showDispensers: preferences?.showDispensers !== false
      }
    };
    
    saveUserPushoverSettings(pushoverSettings);
    
    // Only update environment variables if not preventing reload
    if (!preventReload) {
      // Update environment variables for backward compatibility
      updateEnvVar('PUSHOVER_APP_TOKEN', appToken);
      updateEnvVar('PUSHOVER_USER_KEY', userKey);
      
      if (preferences) {
        updateEnvVar('PUSHOVER_SHOW_JOB_ID', preferences.showJobId ? 'true' : 'false');
        updateEnvVar('PUSHOVER_SHOW_STORE_NUMBER', preferences.showStoreNumber ? 'true' : 'false');
        updateEnvVar('PUSHOVER_SHOW_STORE_NAME', preferences.showStoreName ? 'true' : 'false');
        updateEnvVar('PUSHOVER_SHOW_LOCATION', preferences.showLocation ? 'true' : 'false');
        updateEnvVar('PUSHOVER_SHOW_DATE', preferences.showDate ? 'true' : 'false');
        updateEnvVar('PUSHOVER_SHOW_DISPENSERS', preferences.showDispensers ? 'true' : 'false');
      }
    } else {
      // Just update process.env without writing to file when preventReload is true
      process.env.PUSHOVER_APP_TOKEN = appToken;
      process.env.PUSHOVER_USER_KEY = userKey;
      
      if (preferences) {
        process.env.PUSHOVER_SHOW_JOB_ID = preferences.showJobId ? 'true' : 'false';
        process.env.PUSHOVER_SHOW_STORE_NUMBER = preferences.showStoreNumber ? 'true' : 'false';
        process.env.PUSHOVER_SHOW_STORE_NAME = preferences.showStoreName ? 'true' : 'false';
        process.env.PUSHOVER_SHOW_LOCATION = preferences.showLocation ? 'true' : 'false';
        process.env.PUSHOVER_SHOW_DATE = preferences.showDate ? 'true' : 'false';
        process.env.PUSHOVER_SHOW_DISPENSERS = preferences.showDispensers ? 'true' : 'false';
      }
    }
    
    res.json({ success: true, message: 'Pushover settings saved successfully' });
  } catch (error) {
    console.error('Error saving Pushover settings:', error);
    res.status(500).json({ success: false, message: 'Failed to save Pushover settings' });
  }
});

// Test Pushover notification
router.post('/pushover/test', async (req, res) => {
  try {
    const { appToken, userKey, preferences } = req.body;
    
    if (!appToken || !userKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Application token and user key are required' 
      });
    }
    
    // Temporarily update env variables for the test
    process.env.PUSHOVER_APP_TOKEN = appToken;
    process.env.PUSHOVER_USER_KEY = userKey;
    
    // If preferences were provided, update them temporarily
    if (preferences) {
      process.env.PUSHOVER_SHOW_JOB_ID = preferences.showJobId ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_STORE_NUMBER = preferences.showStoreNumber ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_STORE_NAME = preferences.showStoreName ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_LOCATION = preferences.showLocation ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_DATE = preferences.showDate ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_DISPENSERS = preferences.showDispensers ? 'true' : 'false';
    }
    
    // Send test notification
    const result = await sendTestPushoverNotification();
    
    if (result.success) {
      res.json({ success: true, message: 'Test notification sent successfully' });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.error?.message || 'Failed to send test notification' 
      });
    }
  } catch (error) {
    console.error('Error sending test Pushover notification:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send test notification' 
    });
  }
});

// Send sample job pushover notification to test display preferences
router.post('/pushover/sample-job', async (req, res) => {
  try {
    const { appToken, userKey, preferences } = req.body;
    
    if (!appToken || !userKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Application token and user key are required' 
      });
    }
    
    // Temporarily update env variables for the test
    process.env.PUSHOVER_APP_TOKEN = appToken;
    process.env.PUSHOVER_USER_KEY = userKey;
    
    // If preferences were provided, update them temporarily
    if (preferences) {
      process.env.PUSHOVER_SHOW_JOB_ID = preferences.showJobId ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_STORE_NUMBER = preferences.showStoreNumber ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_STORE_NAME = preferences.showStoreName ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_LOCATION = preferences.showLocation ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_DATE = preferences.showDate ? 'true' : 'false';
      process.env.PUSHOVER_SHOW_DISPENSERS = preferences.showDispensers ? 'true' : 'false';
    }
    
    // Send sample job notification
    const result = await sendSampleJobPushover();
    
    if (result.success) {
      res.json({ success: true, message: 'Sample job notification sent successfully' });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.error?.message || 'Failed to send sample job notification' 
      });
    }
  } catch (error) {
    console.error('Error sending sample job Pushover notification:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send sample job notification' 
    });
  }
});

// Get scrape suspension status
router.get('/scrape-suspension', (req, res) => {
  try {
    // Read .env file
    const envVars = readEnvFile();
    
    // Default to false if setting doesn't exist
    const isSuspended = envVars.SUSPEND_HOURLY_SCRAPE === 'true';
    const suspendUntil = envVars.SUSPEND_HOURLY_SCRAPE_UNTIL || null;
    
    res.json({
      success: true,
      isSuspended,
      suspendUntil
    });
  } catch (error) {
    console.error('Error fetching scrape suspension status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch scrape suspension status' });
  }
});

// Update scrape suspension status
router.post('/scrape-suspension', (req, res) => {
  try {
    const { isSuspended, suspendUntil } = req.body;
    
    // Update .env variables
    updateEnvVar('SUSPEND_HOURLY_SCRAPE', isSuspended ? 'true' : 'false');
    updateEnvVar('SUSPEND_HOURLY_SCRAPE_UNTIL', suspendUntil || '');
    
    const message = isSuspended 
      ? suspendUntil 
        ? `Hourly scraping suspended until ${new Date(suspendUntil).toLocaleString()}`
        : 'Hourly scraping suspended indefinitely'
      : 'Hourly scraping resumed';
      
    res.json({ success: true, message });
  } catch (error) {
    console.error('Error updating scrape suspension status:', error);
    res.status(500).json({ success: false, message: 'Failed to update scrape suspension status' });
  }
});

export default router; 