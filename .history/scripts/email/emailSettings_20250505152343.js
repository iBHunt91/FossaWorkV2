import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define path to settings file
const userSettingsPath = path.join(__dirname, '..', '..', 'data', 'user-settings.json');
const defaultSettingsPath = path.join(__dirname, '..', '..', 'data', 'email-settings.json');

/**
 * Get the user's email settings
 * @returns {Object} The user's email settings
 */
export async function getUserEmailSettings() {
  // Import directly from notifications/emailService to avoid duplication
  const { getUserEmailSettings: getSettings } = await import('../notifications/emailService.js');
  return getSettings();
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