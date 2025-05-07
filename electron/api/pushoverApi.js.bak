// Pushover API endpoints for Electron
import { ipcMain } from 'electron';
import { getUserPushoverSettings, saveUserPushoverSettings, sendTestPushoverNotification } from '../../scripts/pushover/pushoverService.js';
import { 
  setupPushoverOpenClient, 
  startOpenClient, 
  stopOpenClient, 
  getOpenClientStatus 
} from '../../scripts/pushover/pushoverOpenClient.js';

export function setupPushoverApi() {
  // Get Pushover settings
  ipcMain.handle('settings:pushover:get', async () => {
    try {
      const settings = getUserPushoverSettings();
      // Remove sensitive data before sending to renderer
      const { userSecret, ...safeSettings } = settings;
      return {
        success: true,
        ...safeSettings,
        // Include a flag indicating whether Open Client is set up
        openClientSetup: !!settings.userSecret && !!settings.deviceId,
        // Include if client is enabled or needs reconnect
        openClientEnabled: settings.openClientEnabled !== false,
        openClientNeedsReconnect: !!settings.openClientNeedsReconnect
      };
    } catch (error) {
      console.error('Error getting Pushover settings:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });

  // Save Pushover settings
  ipcMain.handle('settings:pushover:save', async (_, settings) => {
    try {
      const success = saveUserPushoverSettings(settings);
      return {
        success,
        message: success ? 'Pushover settings saved successfully' : 'Failed to save Pushover settings'
      };
    } catch (error) {
      console.error('Error saving Pushover settings:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });

  // Send test Pushover notification
  ipcMain.handle('settings:pushover:test', async (_, settings) => {
    try {
      const result = await sendTestPushoverNotification(settings);
      return {
        success: result.success,
        message: result.success ? 'Test notification sent successfully' : result.error
      };
    } catch (error) {
      console.error('Error sending test Pushover notification:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });

  // Setup Pushover Open Client
  ipcMain.handle('settings:pushover:openclient:setup', async (_, { email, password }) => {
    try {
      const result = await setupPushoverOpenClient(email, password);
      return result;
    } catch (error) {
      console.error('Error setting up Pushover Open Client:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });

  // Start Pushover Open Client
  ipcMain.handle('settings:pushover:openclient:start', async () => {
    try {
      const result = await startOpenClient();
      return result;
    } catch (error) {
      console.error('Error starting Pushover Open Client:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });

  // Stop Pushover Open Client
  ipcMain.handle('settings:pushover:openclient:stop', async () => {
    try {
      const result = stopOpenClient();
      return result;
    } catch (error) {
      console.error('Error stopping Pushover Open Client:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });

  // Get Pushover Open Client status
  ipcMain.handle('settings:pushover:openclient:status', async () => {
    try {
      const result = getOpenClientStatus();
      return result;
    } catch (error) {
      console.error('Error getting Pushover Open Client status:', error);
      return {
        success: false,
        message: error.message,
        enabled: false,
        isSetup: false,
        messages: []
      };
    }
  });
} 