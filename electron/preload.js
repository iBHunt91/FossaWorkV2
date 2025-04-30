const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // You can expose specific methods or properties here
    // For example:
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
    openUrlWithLogin: (url) => ipcRenderer.invoke('open-url-with-login', { url }),
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
    onScapeProgress: (callback) => {
      ipcRenderer.on('scrape-progress', (event, progress) => callback(progress));
    },
    onNavigate: (callback) => {
      ipcRenderer.on('navigate-to-logs', () => callback('logs'));
      ipcRenderer.on('navigate-to-history', () => callback('history'));
      ipcRenderer.on('navigate-to-dashboard', () => callback('dashboard'));
      ipcRenderer.on('navigate-to-settings', () => callback('settings'));
    },
    onSendTestEmail: (callback) => {
      ipcRenderer.on('send-test-email', () => callback());
    },
    onTestNotificationResult: (callback) => {
      ipcRenderer.on('test-notification-result', (event, result) => callback(result));
    },
    onRequestNotificationPermission: (callback) => {
      ipcRenderer.on('request-notification-permission', async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          ipcRenderer.send('notification-permission-granted');
        }
      });
    },
    // Handle backend status updates
    onBackendStatus: (callback) => {
      ipcRenderer.on('backend-status', (event, status) => callback(status));
    },
    onBackendError: (callback) => {
      ipcRenderer.on('backend-error', (event, error) => callback(error));
    },
    // Listen for automatic scrape completion events
    onScrapeComplete: (callback) => {
      ipcRenderer.on('scrape-complete', (event, data) => callback(data));
    }
  }
); 