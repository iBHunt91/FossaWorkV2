import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import { 
  info, success, warn, error, section, 
  configure as configureLogger 
} from './scripts/utils/logger.js';

// Configure logger for Windows compatibility
configureLogger({
  useColors: process.platform !== 'win32',
  useSimpleFormat: process.platform === 'win32'
});

// Add this at startup 
section('Fossa Monitor Startup');
info('App Info', [
  `Platform: ${process.platform}`,
  `Node.js: ${process.version}`,
  `Electron: ${process.versions.electron}`
]);

// ... existing code ...

// At app ready
app.on('ready', async () => {
  try {
    section('Application Ready');
    info('Creating browser window', 'Setting up main application window');
    
    createWindow();
    success('Window Created', 'Main application window initialized successfully');
    
    // ... existing code ...
  } catch (e) {
    error('Startup Error', e);
  }
});

// ... existing code ...

function createWindow() {
  try {
    info('Window Configuration', 'Setting up main window parameters');
    // ... existing code ...
    
    mainWindow.once('ready-to-show', () => {
      success('Window Ready', 'Main window is ready to be displayed');
      mainWindow.show();
    });
    
    // Log any window errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      error('Window Load Failed', { 
        errorCode, 
        errorDescription 
      });
    });
    
    // ... existing code ...
  } catch (e) {
    error('Window Creation Error', e);
  }
}

// ... existing code ... 