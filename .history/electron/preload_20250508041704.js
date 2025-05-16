const { contextBridge, ipcRenderer } = require('electron');
// Use the contextIsolation pattern by replacing direct requires with a safe API
// Remove direct Node.js module imports to avoid sandbox issues
// const fs = require('fs'); 
// const path = require('path');
// const { promisify } = require('util');

// Remove conversion of fs methods to promises since we won't use direct fs access
// const readFileAsync = promisify(fs.readFile);
// const writeFileAsync = promisify(fs.writeFile);
// const existsAsync = promisify(fs.exists);
// const mkdirAsync = promisify(fs.mkdir);
// const statAsync = promisify(fs.stat);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // Existing methods
    getStatus: () => ipcRenderer.invoke('get-status'),
    startScrape: () => ipcRenderer.invoke('start-scrape'),
    stopScrape: () => ipcRenderer.invoke('stop-scrape'),
    sendTestEmail: () => ipcRenderer.invoke('send-test-email'),
    sendTestNotification: () => ipcRenderer.invoke('send-test-notification'),
    openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    // Get the server port from the main process
    getServerPort: () => ipcRenderer.invoke('get-server-port'),
    // Update Fossa credentials in the .env file
    updateFossaCredentials: (email, password) => ipcRenderer.invoke('update-fossa-credentials', { email, password }),
    // Test Fossa credentials without saving them
    testFossaCredentials: (email, password) => ipcRenderer.invoke('test-fossa-credentials', { email, password }),
    // Open URL with login - opens a browser, logs in, and navigates to the URL
    openUrlWithLogin: (url, options = {}) => ipcRenderer.invoke('open-url-with-login', { url, ...options }),
    // Open URL with active user credentials - uses specific user's credentials to log in
    openUrlWithActiveUser: (payload) => ipcRenderer.invoke('open-url-with-active-user', payload),
    // Test schedule change notification system
    testScheduleChange: (options) => ipcRenderer.invoke('test-schedule-change', options),
    // Test alert notification system
    testAlertService: (options) => ipcRenderer.invoke('test-alert-service', options),
    // Prover preferences management
    getProverPreferences: () => ipcRenderer.invoke('get-prover-preferences'),
    updateProverPreferences: (preferencesData) => ipcRenderer.invoke('update-prover-preferences', preferencesData),
    scrapeProverInfo: () => ipcRenderer.invoke('scrape-prover-info'),
    // Force application reload - completely refreshes the Electron window
    reloadApp: () => ipcRenderer.invoke('reload-app'),
    // File system operations via IPC instead of direct Node.js access
    fs: {
      readFile: async (filePath, options = 'utf8') => ipcRenderer.invoke('fs-read-file', { filePath, options }),
      writeFile: async (filePath, data, options = 'utf8') => ipcRenderer.invoke('fs-write-file', { filePath, data, options }),
      exists: (filePath) => ipcRenderer.invoke('fs-exists', { filePath }),
      mkdir: async (dirPath, options = { recursive: true }) => ipcRenderer.invoke('fs-mkdir', { dirPath, options }),
      stat: async (filePath) => ipcRenderer.invoke('fs-stat', { filePath }),
      join: (...paths) => ipcRenderer.invoke('fs-join-path', { paths }),
      dirname: (filePath) => ipcRenderer.invoke('fs-dirname', { filePath })
    },
    onScapeProgress: (callback) => {
      // Remove existing listeners before adding new ones
      ipcRenderer.removeAllListeners('scrape-progress');
      ipcRenderer.on('scrape-progress', (event, progress) => callback(progress));
    },
    onNavigate: (callback) => {
      // Remove all existing listeners before adding new ones
      ipcRenderer.removeAllListeners('navigate-to-logs');
      ipcRenderer.removeAllListeners('navigate-to-history');
      ipcRenderer.removeAllListeners('navigate-to-dashboard');
      ipcRenderer.removeAllListeners('navigate-to-settings');
      
      // Add new listeners
      ipcRenderer.on('navigate-to-logs', () => callback('logs'));
      ipcRenderer.on('navigate-to-history', () => callback('history'));
      ipcRenderer.on('navigate-to-dashboard', () => callback('dashboard'));
      ipcRenderer.on('navigate-to-settings', (event, section) => callback('settings', section));
    },
    onSendTestEmail: (callback) => {
      // Remove existing listeners before adding new ones
      ipcRenderer.removeAllListeners('send-test-email');
      ipcRenderer.on('send-test-email', () => callback());
    },
    onTestNotificationResult: (callback) => {
      // Remove existing listeners before adding new ones
      ipcRenderer.removeAllListeners('test-notification-result');
      ipcRenderer.on('test-notification-result', (event, result) => callback(result));
    },
    onRequestNotificationPermission: (callback) => {
      // Remove existing listeners before adding new ones
      ipcRenderer.removeAllListeners('request-notification-permission');
      ipcRenderer.on('request-notification-permission', async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          ipcRenderer.send('notification-permission-granted');
        }
      });
    },
    // Handle backend status updates
    onBackendStatus: (callback) => {
      // Remove existing listeners before adding new ones
      ipcRenderer.removeAllListeners('backend-status');
      ipcRenderer.on('backend-status', (event, status) => callback(status));
    },
    onBackendError: (callback) => {
      // Remove existing listeners before adding new ones
      ipcRenderer.removeAllListeners('backend-error');
      ipcRenderer.on('backend-error', (event, error) => callback(error));
    },
    // Listen for automatic scrape completion events
    onScrapeComplete: (callback) => {
      // Remove existing listeners before adding new ones
      ipcRenderer.removeAllListeners('scrape-complete');
      ipcRenderer.on('scrape-complete', (event, data) => callback(data));
    },
    // Pushover API
    invoke: async (channel, ...args) => {
      const validChannels = [
        // ... existing channels ...
        
        // Pushover settings
        'settings:pushover:get',
        'settings:pushover:save',
        'settings:pushover:test',
        'settings:pushover:remove',
        
        // Pushover Open Client
        'settings:pushover:openclient:setup',
        'settings:pushover:openclient:start',
        'settings:pushover:openclient:stop',
        'settings:pushover:openclient:status'
      ];
      
      if (validChannels.includes(channel)) {
        return await ipcRenderer.invoke(channel, ...args);
      }
      
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }
  }
); 