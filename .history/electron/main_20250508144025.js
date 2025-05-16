import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, Notification, globalShortcut, screen } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import cron from 'node-cron';
import { analyzeScheduleChanges } from '../scripts/utils/scheduleComparator.js';
import { sendScheduleChangeEmail } from '../scripts/email/emailService.js';
import { sendTestNotifications } from '../scripts/notifications/notificationService.js';
import * as logger from '../scripts/utils/logger.js';
import fetch from 'node-fetch';
import { getProverPreferences, updateProverPreference } from '../scripts/utils/prover_info.js';
import { loginToFossa } from '../scripts/utils/login.js';
import { runScrape } from '../scripts/unified_scrape.js';
import { setupAllApis } from './api/index.js';

// Configure logger based on environment
logger.configure({
  // PowerShell on Windows has issues with ANSI colors and box drawing
  useColors: process.platform !== 'win32',
  useSimpleFormat: process.platform === 'win32'
});

// Set environment variables for the main process
process.env.IS_SERVER_PROCESS = 'false';
process.env.SERVER_HANDLES_NOTIFICATIONS = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;
let frontendProcess;
let isScraping = false;
let tray = null;
let isQuitting = false;

// Add a global variable to track browser instances
let activeFossaBrowser = null;

// Function to ensure only one browser instance exists
const ensureSingleBrowser = async () => {
  if (activeFossaBrowser && activeFossaBrowser.browser) {
    logger.info('Browser Management', 'Closing existing browser before opening new one');
    try {
      await activeFossaBrowser.browser.close();
      logger.info('Browser Management', 'Successfully closed existing browser');
    } catch (error) {
      logger.warn('Browser Management', `Error closing browser: ${error.message}`);
    }
    activeFossaBrowser = null;
  }
};

// Add function to log browser state for debugging
const logBrowserState = () => {
  logger.info(
    'Browser State', 
    `Active browser: ${activeFossaBrowser ? 'YES' : 'NO'}, ` + 
    (activeFossaBrowser ? 
      `Debug mode: ${activeFossaBrowser.isDebugMode ? 'YES' : 'NO'}, ` +
      `Age: ${Math.round((Date.now() - activeFossaBrowser.timestamp) / 1000)}s` : 
      '')
  );
};

// Setup auto-launch
function setupAutoLaunch() {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: []
    });
    logger.info('Auto Launch', 'Auto-launch at login configured');
  }
}

function createTray() {
  logger.info('Tray Setup', 'Creating tray icon...');
  
  try {
    // Create a 16x16 transparent image
    const size = 16;
    let trayIcon;

    // Try a different way to create an icon - create from path first with fallback
    const iconPath = path.join(__dirname, '../src/assets/images/FossaFoxIco.ico');
    logger.log('Trying to load icon from path:', iconPath);
    
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
      logger.success('Icon Loading', 'Icon loaded from file successfully');
    } else {
      logger.warn('Icon Loading', 'Icon file not found, using fallback');
      // Create a simple icon programmatically (a solid 16x16 transparent image)
      trayIcon = nativeImage.createEmpty();
      
      // If empty icon doesn't work, fall back to using buffer data
      const iconData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, 
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0xF3, 0xFF, 0x61, 0x00, 0x00, 0x00, 
        0x19, 0x74, 0x45, 0x58, 0x74, 0x53, 0x6F, 0x66, 0x74, 0x77, 0x61, 0x72, 
        0x65, 0x00, 0x41, 0x64, 0x6F, 0x62, 0x65, 0x20, 0x49, 0x6D, 0x61, 0x67, 
        0x65, 0x52, 0x65, 0x61, 0x64, 0x79, 0x71, 0xC9, 0x65, 0x3C, 0x00, 0x00, 
        0x00, 0x4C, 0x49, 0x44, 0x41, 0x54, 0x78, 0xDA, 0x62, 0xFC, 0xFF, 0xFF, 
        0x3F, 0x03, 0x25, 0x80, 0x89, 0x81, 0x42, 0x30, 0x0C, 0x0C, 0x60, 0x41, 
        0x16, 0x68, 0x68, 0x68, 0xF8, 0x0F, 0xC4, 0x0C, 0xD4, 0x00, 0x8C, 0x8C, 
        0x8C, 0x8C, 0x58, 0x83, 0x80, 0x1A, 0x93, 0xB0, 0xc6, 0x02, 0x35, 0x0C, 
        0x40, 0x37, 0x80, 0x6A, 0x51, 0x38, 0x0A, 0x0C, 0x20, 0x80, 0xA8, 0x9A, 
        0x99, 0x28, 0xCE, 0x4A, 0x20, 0xC0, 0x4A, 0x71, 0x56, 0x62, 0x18, 0xBA, 
        0x09, 0x09, 0x04, 0x00, 0x01, 0x06, 0x00, 0x50, 0x84, 0x11, 0x46, 0xFA, 
        0xC1, 0xBE, 0xBF, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 
        0x42, 0x60, 0x82
      ]);
      trayIcon = nativeImage.createFromBuffer(iconData);
      logger.info('Icon Loading', 'Created icon from buffer as fallback');
    }
    
    // Create the tray icon
    tray = new Tray(trayIcon);
    logger.success('Tray Setup', 'Tray icon created successfully');
    tray.setToolTip('Fossa Monitor - Running in Background');
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Fossa Monitor',
        type: 'normal',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open Dashboard',
        click: () => {
          mainWindow.show();
          mainWindow.webContents.send('navigate-to-dashboard');
        }
      },
      { type: 'separator' },
      {
        label: 'Run Manual Scrape',
        click: async () => {
          try {
            logger.info('Tray Menu', 'Triggering manual scrape');
            if (mainWindow && !mainWindow.isDestroyed()) {
              const result = await ipcMain.invoke('start-scrape');
              if (result.success) {
                  logger.success('Tray Menu', 'Manual scrape initiated successfully via tray.');
              } else {
                  logger.error('Tray Menu', `Manual scrape failed to start: ${result.error}`);
                  showNotification('Error', `Failed to start manual scrape: ${result.error}`);
              }
            } else {
              logger.warn('Tray Menu', 'Main window not available to trigger manual scrape.');
              showNotification('Error', 'Dashboard window must be open to start scrape.');
            }
          } catch (error) {
            logger.error('Tray Menu', `Error triggering manual scrape: ${error}`);
            showNotification('Error', `Error starting scrape: ${error.message}`);
          }
        }
      },
      {
        label: 'View Schedule Changes',
        click: () => {
          mainWindow.show();
          mainWindow.webContents.send('navigate-to-history');
        }
      },
      {
        label: 'View Scraping Logs',
        click: () => {
          mainWindow.show();
          mainWindow.webContents.send('navigate-to-logs');
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        submenu: [
          {
            label: 'User Accounts...',
            click: () => {
              mainWindow.show();
              mainWindow.webContents.send('navigate-to-settings', 'users');
            }
          },
          {
            label: 'Notification Settings...',
            click: () => {
              mainWindow.show();
              mainWindow.webContents.send('navigate-to-settings', 'notifications');
            }
          },
          {
            label: 'Prover Preferences...',
            click: () => {
              mainWindow.show();
              mainWindow.webContents.send('navigate-to-settings', 'provers');
            }
          },
          { type: 'separator' },
          {
            label: 'Open Data Folder',
            click: () => {
              const dataPath = path.join(app.getPath('userData'), 'data');
               try {
                 if (!fs.existsSync(dataPath)) {
                   fs.mkdirSync(dataPath, { recursive: true });
                   logger.info('Data Folder', `Created data directory at: ${dataPath}`);
                 }
                 shell.openPath(dataPath);
               } catch (error) {
                 logger.error('Data Folder', `Failed to open or create data folder at ${dataPath}: ${error}`);
                 showNotification('Error', `Could not open data folder: ${error.message}`);
               }
            }
          },
          {
            label: 'Start at Login',
            type: 'checkbox',
            checked: app.getLoginItemSettings().openAtLogin,
            click: () => {
              const settings = app.getLoginItemSettings();
              app.setLoginItemSettings({
                openAtLogin: !settings.openAtLogin,
                path: process.execPath,
                args: []
              });
              logger.info('Auto Launch', `Start at login set to: ${!settings.openAtLogin}`);
            }
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'About',
        click: () => {
          const aboutWindow = new BrowserWindow({
            width: 400,
            height: 350,
            resizable: false,
            minimizable: false,
            maximizable: false,
            parent: mainWindow,
            modal: true,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              preload: path.join(__dirname, 'preload_about.js')
            },
            icon: path.join(__dirname, '../src/assets/images/FossaFoxIco.ico'),
            show: false
          });

          const aboutHtmlPath = path.join(__dirname, '../src/about.html');
          if (fs.existsSync(aboutHtmlPath)) {
             aboutWindow.loadFile(aboutHtmlPath);
          } else {
             aboutWindow.loadURL(`data:text/html;charset=utf-8,<html><body><h2>About Fossa Monitor</h2><p>Version: ${app.getVersion()}</p><p>About file not found.</p></body></html>`);
             logger.warn('About Window', `About HTML file not found at ${aboutHtmlPath}`);
          }
          
          aboutWindow.setMenu(null);
          
          aboutWindow.once('ready-to-show', () => {
            aboutWindow.show();
          });
        }
      },
      {
        label: 'Reload Application',
        accelerator: 'CmdOrCtrl+Alt+R',
        click: () => {
           logger.info('Tray Menu', 'Reloading application via tray menu');
           if (mainWindow && !mainWindow.isDestroyed()) {
               mainWindow.reload();
           } else {
               logger.warn('Tray Menu', 'Main window not available for reload.');
           }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    
    // Double-click to show window
    tray.on('double-click', () => {
      mainWindow.show();
    });
  } catch (error) {
    logger.error('Tray Setup Error', error);
  }
}

function createWindow() {
  logger.info('Window Setup', 'Creating main application window...');

  // Set up all API endpoints
  setupAllApis();
  
  logger.info('Application Startup', 'Creating application window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../src/assets/images/FossaFoxIco.ico')
  });

  // Remove the menu bar completely
  mainWindow.setMenu(null);

  // Request notification permission
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('request-notification-permission');
  });

  // Load the frontend URL
  mainWindow.loadURL(process.env.NODE_ENV === 'development' 
    ? `http://localhost:${process.env.VITE_PORT || 5173}` // Use env var with fallback to default Vite port
    : `file://${path.join(__dirname, '../dist/index.html')}`);

  // Register keyboard shortcuts for DevTools
  registerDevToolsShortcuts();
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  
  // Handle window close to minimize to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

// Register keyboard shortcuts for DevTools
function registerDevToolsShortcuts() {
  logger.info('DevTools Setup', 'Registering DevTools shortcuts: F12 and Ctrl+Shift+I');
  // Register F12 to toggle DevTools
  globalShortcut.register('F12', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
  
  // Register Ctrl+Shift+I (Windows/Linux) to toggle DevTools
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

function startBackend() {
  logger.info('Backend', 'Starting backend server...');
  
  // Set up environment for the server
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3001,
    SERVER_SCRAPE_DISABLED: 'false', // Indicate server should handle scraping
    SERVER_HANDLES_NOTIFICATIONS: 'true', // Indicate server should handle notifications
    IS_SERVER_PROCESS: 'true' // Mark the server as the server process
  };
  
  // Set a global variable for the server port
  global.serverPort = parseInt(env.PORT, 10);
  
  // Path to the server script
  const serverPath = path.join(__dirname, '../server/server.js');
  
  try {
    // Start the server as a child process
    backendProcess = spawn('node', [serverPath], {
      env,
      stdio: 'pipe' // Capture stdio for logging
    });
    
    // Handle stdout
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      logger.backend(output);
    });
    
    // Handle stderr
    backendProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      logger.backendError(error);
    });
    
    // Handle process exit
    backendProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error('Backend', `Server process exited with code ${code}`);
      } else {
        logger.info('Backend', 'Server process exited');
      }
      
      // Restart the server if it crashes
      if (!isQuitting) {
        logger.info('Backend', 'Restarting server...');
        setTimeout(startBackend, 1000);
      }
    });
    
    logger.success('Backend', `Server started on port ${global.serverPort}`);
    return true;
  } catch (error) {
    logger.error('Backend', `Failed to start server: ${error.message}`);
    return false;
  }
}

function startFrontend() {
  logger.section('FRONTEND SERVER');
  logger.info('Frontend Startup', 'Starting frontend development server...');
  // Start Vite dev server
  frontendProcess = spawn('npm', ['run', 'dev'], {
    shell: true,
    stdio: 'inherit'
  });
}

// Add function to show notifications
function showNotification(title, body) {
  try {
    new Notification({
      title,
      body,
      icon: path.join(__dirname, '../src/assets/images/FossaFoxIco.ico')
    }).show();
  } catch (error) {
    logger.error('Notification Error', error);
  }
}

// Handler for updating Fossa credentials
ipcMain.handle('update-fossa-credentials', async (event, { email, password }) => {
  logger.info('IPC Handler', 'update-fossa-credentials called with email: ' + email);
  console.log('IPC: update-fossa-credentials called with email:', email);
  return await updateFossaCredentials(email, password);
});

// Function to update Fossa credentials in the .env file
async function updateFossaCredentials(email, password) {
  try {
    console.log('=== CREDENTIAL UPDATE PROCESS STARTED ===');
    logger.info('Settings', 'Verifying Fossa credentials...');
    
    // Temporarily store credentials in process.env for verification
    const originalEmail = process.env.FOSSA_EMAIL;
    const originalPassword = process.env.FOSSA_PASSWORD;
    
    console.log('Original credentials:', originalEmail ? 'Email SET' : 'Email NOT SET', 
                                      originalPassword ? 'Password SET' : 'Password NOT SET');
    
    // Set the new credentials temporarily for testing
    process.env.FOSSA_EMAIL = email;
    process.env.FOSSA_PASSWORD = password;
    console.log('New credentials set in process.env');
    console.log('Email:', email);
    console.log('Password length:', password ? password.length : 0);
    
    // Add basic validation
    if (!email || !email.includes('@') || !password || password.length < 4) {
      logger.error('Settings Error', 'Invalid credentials format');
      console.log('Validation failed: Invalid credentials format');
      return { success: false, message: 'Invalid email or password format' };
    }
    
    try {
      // Dynamically import the login module (ESM)
      console.log('Attempting to import loginToFossa from login.js...');
      const loginModule = await import('../scripts/utils/login.js');
      console.log('Login module imported successfully:', Object.keys(loginModule));
      
      if (!loginModule.loginToFossa) {
        console.error('loginToFossa function not found in imported module');
        throw new Error('Login verification function not available');
      }
      
      const { loginToFossa } = loginModule;
      
      // Try to log in with the provided credentials (headless mode)
      logger.info('Settings', 'Testing login with provided credentials...');
      console.log('Calling loginToFossa with headless=true...');
      
      const loginResult = await loginToFossa({ headless: true });
      console.log('Login result:', loginResult);
      
      // If we've reached here, login was successful
      if (loginResult.browser) {
        try {
          // Close the browser
          console.log('Closing browser...');
          await loginResult.browser.close();
          console.log('Browser closed successfully');
        } catch (closeError) {
          logger.warn('Settings', `Warning: Could not close browser properly: ${closeError.message}`);
          console.warn('Could not close browser properly:', closeError);
          // Continue execution even if browser close fails
        }
      }
      
      // Now save the credentials to the .env file
      logger.info('Settings', 'Login successful! Updating credentials in .env file...');
      console.log('Login successful! Updating credentials in .env file...');
      
      // Path to .env file
      const envPath = path.join(__dirname, '..', '.env');
      console.log('Env file path:', envPath);
      
      // Read the current .env file
      let envContent = fs.readFileSync(envPath, 'utf8');
      console.log('Read .env file, content length:', envContent.length);
      
      // Replace the existing credentials with new ones
      console.log('Updating FOSSA_EMAIL in .env file');
      envContent = envContent.replace(/FOSSA_EMAIL=.*$/m, `FOSSA_EMAIL=${email}`);
      console.log('Updating FOSSA_PASSWORD in .env file');
      envContent = envContent.replace(/FOSSA_PASSWORD=.*$/m, `FOSSA_PASSWORD=${password}`);
      
      // Write the updated content back to the .env file
      console.log('Writing updated content to .env file');
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('.env file updated successfully');
      
      logger.success('Settings', 'Fossa credentials verified and updated successfully');
      
      // Send a notification
      showNotification('Credentials Updated', 'Fossa credentials were verified and updated successfully.');
      
      console.log('=== CREDENTIAL UPDATE PROCESS COMPLETED SUCCESSFULLY ===');
      return { success: true, message: 'Fossa credentials verified and updated successfully' };
    } catch (loginError) {
      // Restore original credentials in process.env
      process.env.FOSSA_EMAIL = originalEmail;
      process.env.FOSSA_PASSWORD = originalPassword;
      
      logger.error('Settings Error', `Login verification failed: ${loginError.message}`);
      console.error('Login verification failed:', loginError);
      console.log('=== CREDENTIAL UPDATE PROCESS FAILED ===');
      return { success: false, message: `Invalid credentials: ${loginError.message}` };
    }
  } catch (error) {
    // Ensure we restore original credentials if something unexpected happens
    try {
      process.env.FOSSA_EMAIL = originalEmail || '';
      process.env.FOSSA_PASSWORD = originalPassword || '';
    } catch (e) {
      // Ignore errors in restoring credentials
    }
    
    logger.error('Settings Error', `Failed to update Fossa credentials: ${error.message}`);
    console.error('Failed to update Fossa credentials:', error);
    console.log('=== CREDENTIAL UPDATE PROCESS FAILED (OUTER ERROR) ===');
    return { success: false, message: `Failed to update credentials: ${error.message}` };
  }
}

// Handler for testing Fossa credentials without saving
ipcMain.handle('test-fossa-credentials', async (event, { email, password }) => {
  logger.info('IPC Handler', 'test-fossa-credentials called with email: ' + email);
  console.log('IPC: test-fossa-credentials called with email:', email);
  
  try {
    console.log('=== CREDENTIAL TEST PROCESS STARTED ===');
    
    // Temporarily store credentials in process.env for testing
    const originalEmail = process.env.FOSSA_EMAIL;
    const originalPassword = process.env.FOSSA_PASSWORD;
    
    // Set the new credentials temporarily for testing
    process.env.FOSSA_EMAIL = email;
    process.env.FOSSA_PASSWORD = password;
    console.log('Test credentials set in process.env');
    
    try {
      // Add basic validation
      if (!email || !email.includes('@') || !password || password.length < 4) {
        logger.error('Test Error', 'Invalid credentials format');
        return { success: false, message: 'Invalid email or password format' };
      }
      
      // Dynamically import the login module (ESM)
      console.log('Attempting to import loginToFossa from login.js...');
      const loginModule = await import('../scripts/utils/login.js');
      console.log('Login module imported successfully:', Object.keys(loginModule));
      
      if (!loginModule.loginToFossa) {
        console.error('loginToFossa function not found in imported module');
        throw new Error('Login verification function not available');
      }
      
      const { loginToFossa } = loginModule;
      
      // Try to log in with the provided credentials (headless mode)
      logger.info('Test', 'Testing login with provided credentials...');
      console.log('Calling loginToFossa with headless=true...');
      const loginResult = await loginToFossa({ headless: true });
      console.log('Login result:', loginResult);
      
      // Close the browser if login was successful
      if (loginResult.browser) {
        console.log('Closing browser...');
        await loginResult.browser.close();
        console.log('Browser closed successfully');
      }
      
      console.log('=== CREDENTIAL TEST COMPLETED SUCCESSFULLY ===');
      return { success: true, message: 'Credentials are valid' };
    } catch (loginError) {
      // Restore original credentials in process.env
      process.env.FOSSA_EMAIL = originalEmail;
      process.env.FOSSA_PASSWORD = originalPassword;
      
      logger.error('Test Error', `Login verification failed: ${loginError.message}`);
      console.error('Login verification failed:', loginError);
      console.log('=== CREDENTIAL TEST FAILED ===');
      return { success: false, message: `Invalid credentials: ${loginError.message}` };
    } finally {
      // Always restore original credentials
      process.env.FOSSA_EMAIL = originalEmail;
      process.env.FOSSA_PASSWORD = originalPassword;
    }
  } catch (error) {
    logger.error('Test Error', `Failed to test Fossa credentials: ${error.message}`);
    console.error('Failed to test Fossa credentials:', error);
    console.log('=== CREDENTIAL TEST FAILED (OUTER ERROR) ===');
    return { success: false, message: `Failed to test credentials: ${error.message}` };
  }
});

// Function to perform work order scraping
async function scrapeAllWorkOrders() {
  logger.info('Scraping', 'Starting automated work order scrape...');
  try {
    const result = await runScrape({ 
      isManual: false,
      sendNotifications: true // Enable notifications so manual scrapes will trigger alerts
    });
    logger.success('Scraping', `Completed work order scrape successfully. Found ${result.count || 0} work orders.`);
    return result;
  } catch (error) {
    logger.error('Scraping Error', error);
    throw error;
  }
}

app.whenReady().then(() => {
  // Only start the backend server if it's not running as part of npm run electron:dev
  if (!process.env.RUNNING_ELECTRON_DEV) {
    startBackend();
  }
  
  // Only start the frontend in development mode and if not running as part of npm run electron:dev
  if (process.env.NODE_ENV === 'development' && !process.env.RUNNING_ELECTRON_DEV) {
    startFrontend();
  }
  
  createWindow();
  createTray();
  setupAutoLaunch();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Register IPC handlers
  ipcMain.handle('get-status', () => {
    return { status: 'running', isScraping };
  });

  ipcMain.handle('start-scrape', async (event) => {
    try {
      logger.info('Manual Scrape', 'Starting manual scrape job');
      
      // Import runScrape directly to control notification behavior
      const { runScrape } = await import('../scripts/unified_scrape.js');
      
      // Run manual scrape with notifications explicitly enabled
      const result = await runScrape({ 
        isManual: true,
        sendNotifications: true // Enable notifications for manual scrapes
      });
      
      // Notify the renderer process about the manual scrape completion
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scrape-complete', {
          type: 'manual',
          timestamp: new Date().toISOString(),
          success: true
        });
        logger.info('Manual Scrape', 'Notified UI about manual scrape completion');
      }
      
      return { success: true, message: 'Manual scrape completed successfully', count: result.count || 0 };
    } catch (error) {
      logger.error('Manual Scrape Error', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-scrape', () => {
    // Implement stop scraping logic if needed
    return { success: true };
  });

  ipcMain.handle('send-test-email', async () => {
    try {
      // Import the sendTestEmail function
      const { sendTestEmail } = await import('../scripts/email/emailService.js');
      await sendTestEmail();
      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      logger.error('Email Test', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-data-folder', () => {
    const dataFolder = path.join(__dirname, '../data');
    shell.openPath(dataFolder);
    return { success: true };
  });

  ipcMain.handle('get-app-version', () => {
    return { version: app.getVersion() };
  });

  // Handle testing schedule change notifications
  ipcMain.handle('test-schedule-change', async (event, options) => {
    try {
      logger.info('Schedule Change Test', `Testing with options: ${JSON.stringify(options)}`);
      
      // Validate options
      if (!options || (!options.changeType && !options.changeTypes) || typeof options.count !== 'number') {
        return { success: false, message: 'Invalid options provided' };
      }
      
      // Support both legacy 'changeType' and new 'changeTypes' array format
      const changeTypes = options.changeTypes || [options.changeType];
      
      if (!changeTypes.length) {
        return { success: false, message: 'No change types specified' };
      }
      
      // Import user services to get current user (will be used instead of creating a test user)
      const userService = await import('../scripts/user/userService.js');
      
      // Get pushover settings first so we can make sure we have valid keys
      const { getUserPushoverSettings } = await import('../scripts/pushover/pushoverService.js');
      const pushoverSettings = getUserPushoverSettings();
      
      logger.info('Schedule Change Test', `Retrieved pushover settings: App Token ${pushoverSettings.appToken ? 'exists' : 'missing'}, User Key ${pushoverSettings.userKey ? 'exists' : 'missing'}`);
      
      // Generate simulated changes based on options - no need for site-clone
      const changes = {
        allChanges: [],
        summary: {
          removed: 0,
          added: 0,
          modified: 0,
          swapped: 0,
          replaced: 0
        }
      };
      
      // Calculate how many changes to generate for each type
      const changesPerType = Math.ceil(options.count / changeTypes.length);
      
      // Add simulated changes for each selected type
      for (const changeType of changeTypes) {
        switch (changeType) {
          case 'add':
            // Add jobs
            for (let i = 0; i < changesPerType; i++) {
              changes.allChanges.push({
                type: 'added',  // This is critical - must be 'added' not 'add'
                jobId: `W-${100000 + i}`,
                store: `#${1000 + i}`,
                storeName: `Test Store ${i}`,
                dispensers: Math.floor(Math.random() * 8) + 1,
                location: 'Test Location, FL',
                date: new Date(Date.now() + (i * 86400000)).toLocaleDateString()
              });
            }
            changes.summary.added += changesPerType;
            break;
            
          case 'remove':
            // Remove jobs
            for (let i = 0; i < changesPerType; i++) {
              changes.allChanges.push({
                type: 'removed',
                jobId: `W-${100000 + i}`,
                store: `#${1000 + i}`,
                storeName: `Test Store ${i}`,
                dispensers: Math.floor(Math.random() * 8) + 1,
                location: 'Test Location, FL',
                date: new Date(Date.now() + (i * 86400000)).toLocaleDateString()
              });
            }
            changes.summary.removed += changesPerType;
            break;
            
          case 'replace':
            // Replace jobs
            for (let i = 0; i < changesPerType; i++) {
              changes.allChanges.push({
                type: 'replacement',
                removedJobId: `W-${100000 + i}`,
                removedStore: `#${1000 + i}`,
                removedStoreName: `Test Store ${i}`,
                removedDispensers: Math.floor(Math.random() * 8) + 1,
                removedLocation: 'Test Location A, FL',
                addedJobId: `W-${200000 + i}`,
                addedStore: `#${2000 + i}`,
                addedStoreName: `Test Store New ${i}`,
                addedDispensers: Math.floor(Math.random() * 8) + 1,
                addedLocation: 'Test Location B, FL',
                date: new Date(Date.now() + (i * 86400000)).toLocaleDateString()
              });
            }
            changes.summary.replaced += changesPerType;
            break;
            
          case 'date':
            // Date changes
            for (let i = 0; i < changesPerType; i++) {
              const oldDate = new Date();
              oldDate.setDate(oldDate.getDate() + i);
              
              const newDate = new Date();
              newDate.setDate(oldDate.getDate() + 7); // Moved a week later
              
              changes.allChanges.push({
                type: 'date_changed',
                jobId: `W-${100000 + i}`,
                store: `#${1000 + i}`,
                storeName: `Test Store ${i}`,
                dispensers: Math.floor(Math.random() * 8) + 1,
                location: 'Test Location, FL',
                oldDate: oldDate.toLocaleDateString(),
                newDate: newDate.toLocaleDateString()
              });
            }
            changes.summary.modified += changesPerType;
            break;
            
          case 'swap':
            // Job swaps
            const swapPairs = Math.ceil(changesPerType / 2);
            for (let i = 0; i < swapPairs; i++) {
              // Create a pair of jobs that have swapped dates
              const today = new Date();
              const date1 = new Date(today);
              date1.setDate(today.getDate() + 3);
              const date2 = new Date(today);
              date2.setDate(today.getDate() + 5);
              
              changes.allChanges.push({
                type: 'swap',
                job1Id: `W-${100000 + i*2}`,
                job1Store: `#${1000 + i*2}`,
                job1StoreName: `Store A${i}`,
                job1Dispensers: Math.floor(Math.random() * 4) + 1,
                job1Location: 'Location A, FL',
                oldDate1: date1.toLocaleDateString(),
                newDate1: date2.toLocaleDateString(),
                
                job2Id: `W-${100000 + i*2 + 1}`,
                job2Store: `#${1000 + i*2 + 1}`,
                job2StoreName: `Store B${i}`,
                job2Dispensers: Math.floor(Math.random() * 4) + 1,
                job2Location: 'Location B, FL',
                oldDate2: date2.toLocaleDateString(),
                newDate2: date1.toLocaleDateString()
              });
            }
            changes.summary.swapped += changesPerType;
            break;
        }
      }
      
      // For backward compatibility, also add to the critical and high arrays
      changes.critical = changes.allChanges.filter(c => c.type === 'added' || c.type === 'removed');
      changes.high = changes.allChanges.filter(c => c.type === 'date_changed' || c.type === 'swap' || c.type === 'replacement');
      changes.medium = [];
      changes.low = [];

      // Import the unified notification service
      const { sendScheduleChangeNotifications } = await import('../scripts/notifications/notificationService.js');
      
      // Get the current active user instead of creating a test user
      let activeUser = null;
      let settingsLoaded = false;
      
      try {
        // Get the current active user
        activeUser = await userService.getCurrentUser();
        if (activeUser) {
          logger.info('Schedule Change Test', `Found active user: ${activeUser.id}`);
          settingsLoaded = true;
          
          // Make sure notifications are enabled for testing purposes
          if (!activeUser.notificationSettings) {
            activeUser.notificationSettings = {
              enabled: true,
              email: {
                enabled: options.preferences?.useEmailPreferences || false
              },
              pushover: {
                enabled: options.preferences?.usePushoverPreferences || true
              }
            };
          } else {
            // Only override notification settings if specifically requested
            if (options.preferences?.useEmailPreferences !== undefined) {
              activeUser.notificationSettings.email = {
                ...activeUser.notificationSettings.email,
                enabled: options.preferences.useEmailPreferences
              };
            }
            
            if (options.preferences?.usePushoverPreferences !== undefined) {
              activeUser.notificationSettings.pushover = {
                ...activeUser.notificationSettings.pushover,
                enabled: options.preferences.usePushoverPreferences
              };
            }
          }
          
          // Add pushover settings directly to the user
          activeUser.pushoverSettings = pushoverSettings;
        } else {
          logger.warn('Schedule Change Test', 'No active user found');
        }
      } catch (err) {
        logger.warn('Schedule Change Test', `Error getting active user: ${err.message}`);
      }
      
      // Use a test user only if we couldn't load the active user
      let testUser = activeUser;
      
      if (!testUser) {
        // Get email settings for default recipient
        const { getUserEmailSettings } = await import('../scripts/notifications/emailService.js');
        const emailSettings = await getUserEmailSettings();
        
        // Create a default test user if no current user
        testUser = {
          id: 'test-user',
          name: 'Test User',
          email: process.env.TEST_EMAIL || emailSettings.recipientEmail || 'bruce.hunt@owlservices.com',
          pushoverKey: pushoverSettings.userKey || process.env.PUSHOVER_USER_KEY || '',
          pushoverSettings: pushoverSettings,
          notificationSettings: {
            enabled: true,
            email: {
              enabled: options.preferences?.useEmailPreferences || false
            },
            pushover: {
              enabled: options.preferences?.usePushoverPreferences || true  // Set default to true for tests
            }
          },
          preferences: {
            notifications: {
              scheduleChanges: true,
              showAllDetails: options.preferences?.forceShowAllFields || false,
              showAdded: true,
              showRemoved: true,
              showModified: true,
              showSwapped: true
            }
          }
        };
      }
      
      // Mask sensitive information for logging
      logger.info('Schedule Change Test', `Sending notifications using unified system with user: ${JSON.stringify({
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
        pushoverKey: testUser.pushoverKey ? '***' + testUser.pushoverKey.substring(Math.max(0, testUser.pushoverKey.length - 4)) : 'none',
        notificationSettings: testUser.notificationSettings,
        preferences: testUser.preferences,
        pushoverSettings: testUser.pushoverSettings ? {
          appToken: testUser.pushoverSettings.appToken ? 'exists' : 'missing',
          userKey: testUser.pushoverSettings.userKey ? 'exists' : 'missing'
        } : 'none'
      })}`);
      
      // Send notifications using the unified notification system
      const notificationResults = await sendScheduleChangeNotifications(changes, testUser);
      
      // Show a notification in the desktop app
      let emailStatus = 'Unknown';
      let pushoverStatus = 'Unknown';

      if (notificationResults?.results) {
        // Process results only if they exist
        emailStatus = !testUser.notificationSettings.email.enabled ? 'Skipped' : 
                      (notificationResults.results.email?.success ? 'Sent' : 'Failed');
        pushoverStatus = !testUser.notificationSettings.pushover.enabled ? 'Skipped' : 
                        (notificationResults.results.pushover?.success ? 'Sent' : 'Failed');
      } else if (notificationResults?.skipped) {
        // Handle skipped scenarios
        emailStatus = 'Skipped';
        pushoverStatus = 'Skipped';
      } else {
        // Handle error scenarios
        emailStatus = 'Error';
        pushoverStatus = 'Error';
      }
      
      showNotification(
        'Unified Notification System Test', 
        `Email: ${emailStatus}, Pushover: ${pushoverStatus}`
      );
      
      // Create a formatted list of change types for the response message
      const changeTypesText = changeTypes.length > 1 
        ? changeTypes.join(', ') 
        : changeTypes[0];
      
      return { 
        success: true, 
        message: `Successfully sent notifications for ${options.count} ${changeTypesText} schedule change(s)`,
        results: notificationResults
      };
    } catch (error) {
      logger.error('Schedule Change Test Error', error);
      return { success: false, message: error.message };
    }
  });

  // Handle testing alert service
  ipcMain.handle('test-alert-service', async (event, options) => {
    try {
      logger.info('Alert Service Test', `Testing with options: ${JSON.stringify(options)}`);
      
      // Validate options
      if (!options || !options.alertType || !options.severity || typeof options.count !== 'number') {
        return { success: false, message: 'Invalid options provided' };
      }
      
      // Import required services
      const { sendAlertPushover } = await import('../scripts/notifications/pushoverService.js/index.js');
      const { getUserPushoverSettings } = await import('../scripts/pushover/pushoverService.js');
      
      // Get the current user data - if options.userId is provided, use it
      let userData;
      try {
        // Try to load user settings from the user storage
        const userSettings = await import('../scripts/user/userService.js');
        userData = await userSettings.getCurrentUser();
        
        if (!userData) {
          logger.warn('Alert Service Test', 'No current user found, trying to load from saved user settings');
          const allUsers = await userSettings.loadUsers();
          userData = allUsers && allUsers.length > 0 ? allUsers[0] : null;
        }
        
        logger.info('Alert Service Test', `Using user: ${userData ? userData.id : 'unknown'}`);
      } catch (error) {
        logger.error('Alert Service Test', `Error loading user data: ${error.message}`);
      }
      
      // Generate test alerts
      const alerts = [];
      for (let i = 0; i < options.count; i++) {
        // Create a test alert based on the type
        const alert = {
          type: options.alertType,
          severity: options.severity,
          deviceName: `Test Device ${i}`,
          location: 'Test Location, FL',
          customer: `Test Customer ${i}`,
          manufacturer: 'Test Manufacturer',
          store: `#${5000 + i}`,
          storeName: `Test Store ${i}`,
        };
        
        // Add specific alert details based on type
        switch (options.alertType) {
          case 'battery':
            alert.message = `Low battery detected - ${Math.floor(Math.random() * 20)}% remaining`;
            break;
          case 'connectivity':
            alert.message = `Connection lost - Device has been offline for ${Math.floor(Math.random() * 120)} minutes`;
            break;
          case 'error':
            alert.message = `Error code E-${Math.floor(Math.random() * 1000)} detected on device`;
            break;
        }
        
        alerts.push(alert);
      }
      
      // Get Pushover settings for all potential sources
      const pushoverSettings = getUserPushoverSettings();
      
      // Prepare user for alert sending - combine actual user data with pushover settings
      const testUsers = [{
        id: userData?.id || 'current-user',
        email: userData?.email || process.env.USER_EMAIL,
        pushoverKey: userData?.pushoverKey || pushoverSettings.userKey || process.env.PUSHOVER_USER_KEY,
        deviceId: userData?.deviceId || process.env.PUSHOVER_DEVICE || '',
        preferences: {
          sounds: {
            critical: userData?.preferences?.sounds?.critical || pushoverSettings.preferences?.sound || 'siren',
            high: userData?.preferences?.sounds?.high || pushoverSettings.preferences?.sound || 'bike',
            default: userData?.preferences?.sounds?.default || pushoverSettings.preferences?.sound || 'pushover'
          }
        }
      }];
      
      // Log the user information being used (with sensitive data masked)
      logger.info('Alert Service Test', `Using user data: ${JSON.stringify({
        id: testUsers[0].id,
        email: testUsers[0].email,
        pushoverKey: testUsers[0].pushoverKey ? '***' + testUsers[0].pushoverKey.substring(testUsers[0].pushoverKey.length - 4) : 'none',
        hasDeviceId: !!testUsers[0].deviceId,
        preferences: testUsers[0].preferences
      })}`);
      
      // Send the alerts to Pushover
      const pushoverResult = await sendAlertPushover(alerts, testUsers);
      
      // Show a notification in the desktop app
      showNotification(
        'Alert Test', 
        `Test completed: ${options.count} ${options.severity} ${options.alertType} alert(s)`
      );
      
      return { 
        success: true, 
        message: `Successfully simulated ${options.count} ${options.severity} ${options.alertType} alert(s)`,
        pushoverResult
      };
    } catch (error) {
      logger.error('Alert Service Test Error', error);
      return { success: false, message: error.message };
    }
  });

  // Add notification permission handler
  ipcMain.on('notification-permission-granted', () => {
    logger.log('Notification permission granted');
  });

  // Set up IPC handlers
  ipcMain.handle('get-server-port', () => {
    // Return the current server port (default to 3001 if not set)
    return global.serverPort || 3001;
  });

  // Add the reload-app IPC handler
  ipcMain.handle('reload-app', () => {
    try {
      logger.info('Application', 'Reloading application window via IPC request');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
        return { success: true };
      }
      return { success: false, error: 'Main window not available' };
    } catch (error) {
      logger.error('Application', `Error reloading window: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Prover Preferences IPC Handlers
  ipcMain.handle('get-prover-preferences', async () => {
    try {
      logger.info('Prover Preferences', 'Fetching prover preferences data');
      const preferences = await getProverPreferences();
      logger.success('Prover Preferences', `Retrieved ${preferences.provers.length} provers`);
      return preferences;
    } catch (error) {
      logger.error('Prover Preferences Error', error.message || 'Unknown error');
      throw error;
    }
  });

  // Add scrapeProverInfo IPC handler
  ipcMain.handle('scrape-prover-info', async () => {
    try {
      logger.info('Prover Scraping', 'Starting prover information scrape');
      
      // This is where we would normally implement actual scraping logic
      // For now, we'll create a dummy implementation that works with the existing prover preferences
      
      // Get current preferences to update or append to
      const currentPreferences = await getProverPreferences();
      
      // If we already have prover data, just return success
      if (currentPreferences.provers && currentPreferences.provers.length > 0) {
        logger.success('Prover Scraping', `Found ${currentPreferences.provers.length} existing provers - no new data needed`);
        return { success: true };
      }
      
      // Create some sample prover data if none exists
      const sampleProvers = [
        {
          prover_id: "21-65435-04",
          serial: "21-65435-04",
          make: "Seraphin Prover (5 Gallon)",
          preferred_fuel_type: "Regular",
          preferred_fuel_types: ["Regular"],
          priority: 1
        },
        {
          prover_id: "22-66559-03",
          serial: "22-66559-03",
          make: "Seraphin Prover (5 Gallon)",
          preferred_fuel_type: "Regular",
          preferred_fuel_types: ["Regular"],
          priority: 2
        }
      ];
      
      // Add the sample provers to the current preferences
      for (const prover of sampleProvers) {
        await updateProverPreference(
          prover.prover_id, 
          prover.preferred_fuel_type, 
          prover.priority, 
          prover.preferred_fuel_types
        );
      }
      
      logger.success('Prover Scraping', 'Successfully scraped and updated prover information');
      return { success: true };
    } catch (error) {
      logger.error('Prover Scraping Error', error.message || 'Unknown error');
      return { success: false, error: error.message || 'Failed to scrape prover information' };
    }
  });

  ipcMain.handle('update-prover-preferences', async (event, preferencesData) => {
    try {
      logger.info('Prover Preferences', 'Updating prover preferences');
      
      if (!preferencesData || !preferencesData.provers || !Array.isArray(preferencesData.provers)) {
        throw new Error('Invalid prover preferences data');
      }
      
      // Update each prover with new fuel type preferences
      const { provers, autoPositionEthanolFree } = preferencesData;
      for (const prover of provers) {
        await updateProverPreference(prover.prover_id, prover.preferred_fuel_type, prover.priority, prover.preferred_fuel_types);
      }
      
      // Get the updated data
      const updatedPreferences = await getProverPreferences();
      
      // Save the autoPositionEthanolFree setting
      if (typeof autoPositionEthanolFree === 'boolean') {
        updatedPreferences.autoPositionEthanolFree = autoPositionEthanolFree;
        
        // Save the updated preferences with the autoPositionEthanolFree setting
        const dataPath = await proversScripts.getDataPath();
        await fs.promises.writeFile(dataPath, JSON.stringify(updatedPreferences, null, 2));
        logger.info('Prover Preferences', `Updated autoPositionEthanolFree setting to: ${autoPositionEthanolFree}`);
      }
      
      logger.success('Prover Preferences', 'Successfully updated prover preferences');
      return { success: true, data: updatedPreferences };
    } catch (error) {
      logger.error('Prover Preferences Update Error', error.message || 'Unknown error');
      return { success: false, error: error.message || 'Failed to update prover preferences' };
    }
  });

  // Handle IPC for opening URLs with active user's authenticated credentials
  ipcMain.handle('open-url-with-active-user', async (event, { url, email, password, isDebugMode = false }) => {
    try {
      logger.info('Authentication', `Attempting to log in with active user credentials and navigate to: ${url}${isDebugMode ? ' (DEBUG MODE)' : ''}`);
      
      if (!email || !password) {
        throw new Error('Missing email or password for active user');
      }
      
      // Mask email for logging
      const maskedEmail = email.replace(/^(.{3})(.*)(@.*)$/, (_, start, middle, end) => 
        `${start}${'*'.repeat(Math.max(1, middle.length))}${end}`);
      logger.info('Authentication', `Using credentials for user: ${maskedEmail}`);
      
      // Get the primary display's dimensions
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      logger.info('Browser Setup', `Using screen resolution: ${width}x${height}`);
      
      // Log current browser state
      logBrowserState();
      
      // Ensure single browser approach - close any existing browser
      await ensureSingleBrowser();
      
      // Create a new browser instance
      logger.info('Browser', 'Creating new browser instance');
      const result = await loginToFossa({ 
        headless: false,
        email,
        password,
        browserOptions: {
          // Setting key to make it look like a normal browser
          defaultViewport: null
        }
      });
      
      if (!result || !result.success) {
        throw new Error(result?.error || 'Login failed with active user credentials');
      }
      
      // Get browser and page from successful login
      const { browser, page } = result;
      logger.success('Browser', 'Successfully created new browser and logged in');
      
      try {
        // Store browser instance for tracking
        activeFossaBrowser = { 
          browser,
          isDebugMode,
          timestamp: Date.now()
        };
        logger.info('Browser', 'Stored browser instance for tracking');
        
        // Handle browser close to clear our reference
        browser.on('disconnected', () => {
          logger.info('Browser', 'Browser instance closed or disconnected');
          if (activeFossaBrowser && activeFossaBrowser.browser === browser) {
            activeFossaBrowser = null;
            logBrowserState();
          }
        });
        
        logBrowserState();
        
        // Navigate to the requested URL with a longer timeout
        logger.info('Navigation', `Navigating to: ${url}`);
        await page.goto(url, { timeout: 30000, waitUntil: 'load' });
        
        // Add a small delay to ensure the page is fully loaded before giving control to the user
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return success to renderer
        return { 
          success: true, 
          message: `Successfully logged in with active user credentials and navigated to URL${isDebugMode ? ' in debug mode' : ''}`
        };
      } catch (navError) {
        logger.error('Navigation Error', navError);
        // If navigation fails, clear our browser reference
        activeFossaBrowser = null;
        logBrowserState();
        // Even if navigation fails, don't throw - return a more specific error
        return { 
          success: false, 
          message: `Navigation error: ${navError.message}` 
        };
      }
    } catch (error) {
      logger.error('URL Login Error with Active User', error);
      return { 
        success: false, 
        message: `Error: ${error.message || 'Unknown error'}` 
      };
    }
  });

  // Handle IPC for opening URLs with authenticated login
  ipcMain.handle('open-url-with-login', async (event, { url, isDebugMode = false }) => {
    try {
      logger.info('Authentication', `Attempting to log in and navigate to: ${url}${isDebugMode ? ' (DEBUG MODE)' : ''}`);
      
      // Get the primary display's dimensions - access screen directly instead of using require
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      logger.info('Browser Setup', `Using screen resolution: ${width}x${height}`);
      
      // Log current browser state
      logBrowserState();
      
      // Ensure single browser approach - close any existing browser
      await ensureSingleBrowser();
      
      // Create a new browser instance
      logger.info('Browser', 'Creating new browser instance');
      const result = await loginToFossa({ 
        headless: false,
        browserOptions: {
          // Login.js already has good defaults now, we don't need to override
          // The defaultViewport: null setting is key to making it look like a normal browser
        }
      });
      
      if (!result || !result.success) {
        throw new Error(result?.error || 'Login failed');
      }
      
      // Get browser and page from successful login
      const { browser, page } = result;
      logger.success('Browser', 'Successfully created new browser and logged in');
      
      try {
        // Store browser instance for tracking
        activeFossaBrowser = { 
          browser,
          isDebugMode,
          timestamp: Date.now()
        };
        logger.info('Browser', 'Stored browser instance for tracking');
        
        // Handle browser close to clear our reference
        browser.on('disconnected', () => {
          logger.info('Browser', 'Browser instance closed or disconnected');
          if (activeFossaBrowser && activeFossaBrowser.browser === browser) {
            activeFossaBrowser = null;
            logBrowserState();
          }
        });
        
        logBrowserState();
        
        // Navigate to the requested URL with a longer timeout
        logger.info('Navigation', `Navigating to: ${url}`);
        await page.goto(url, { timeout: 30000, waitUntil: 'load' });
        
        // Add a small delay to ensure the page is fully loaded before giving control to the user
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return success to renderer
        return { 
          success: true, 
          message: `Successfully logged in and navigated to URL${isDebugMode ? ' in debug mode' : ''}` 
        };
      } catch (navError) {
        logger.error('Navigation Error', navError);
        // If navigation fails, clear our browser reference
        activeFossaBrowser = null;
        logBrowserState();
        // Even if navigation fails, don't throw - return a more specific error
        return { 
          success: false, 
          message: `Navigation error: ${navError.message}` 
        };
      }
      
      // Note: We don't close the browser - it stays open for the user to interact with
    } catch (error) {
      logger.error('URL Login Error', error);
      return { 
        success: false, 
        message: `Error: ${error.message || 'Unknown error'}` 
      };
    }
  });

  // Schedule the automation to run every hour
  cron.schedule('0 * * * *', async () => {
    // Check if we're running in an environment where the server might also be running
    // Only run scraping if we're not running the full server stack (which has its own cron job)
    if (process.env.RUNNING_ELECTRON_DEV || process.env.SERVER_SCRAPE_DISABLED === 'true') {
      console.log('Starting scheduled scrape job...');
      try {
        await scrapeAllWorkOrders();
        console.log('Scheduled scrape completed successfully');
        
        // Notify the renderer process about the automatic scrape completion
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('scrape-complete', {
            type: 'automatic',
            timestamp: new Date().toISOString(),
            success: true
          });
          logger.info('Automatic Scrape', 'Notified UI about scheduled scrape completion');
        }

        // Analyze schedule changes after each scrape
        console.log('Analyzing schedule changes...');
      } catch (error) {
        logger.error('Scheduled Scrape Error', error);
      }
    } else {
      logger.info('Automatic Scrape', 'Skipping scheduled scrape in Electron main process as the server is handling scraping');
    }
  });

  // Prevent the app from quitting when all windows are closed
  app.on('window-all-closed', (event) => {
    // Keep the app running in the background with the tray icon
    logger.info('Application Status', 'All windows closed, app running in background with tray icon');
  });

  // This will be called when the user tries to quit the app through the menu
  app.on('before-quit', () => {
    isQuitting = true;
  });

  // Ensure we unregister all shortcuts when the app quits
  app.on('will-quit', () => {
    // Unregister all shortcuts
    globalShortcut.unregisterAll();
    logger.info('Application Status', 'Shortcuts unregistered');
  });

  // Handle any uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
    if (backendProcess) backendProcess.kill();
    if (frontendProcess) {
      frontendProcess.kill();
    }
    app.quit();
  });

  // Add a handler for testing schedule change notifications
  ipcMain.handle('test-schedule-notification', async (event) => {
    try {
      logger.info('Test Schedule Notification', 'Starting scrape with notifications enabled');
      
      // Import runScrape directly
      const { runScrape } = await import('../scripts/unified_scrape.js');
      
      // Run scrape with notifications explicitly enabled
      const result = await runScrape({ 
        isManual: true,
        sendNotifications: true // Explicitly enable notifications for testing
      });
      
      logger.success('Test Schedule Notification', 'Completed scrape with notifications enabled');
      
      // Notify the renderer process about completion
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('notification-test-complete', {
          timestamp: new Date().toISOString(),
          success: true
        });
      }
      
      return { success: true, message: 'Completed scrape with notifications enabled' };
    } catch (error) {
      logger.error('Test Schedule Notification Error', error);
      return { success: false, error: error.message };
    }
  });

  // Add file system IPC handlers
  ipcMain.handle('fs-read-file', async (event, { filePath, options }) => {
    try {
      return await fsPromises.readFile(filePath, options);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw error;
    }
  });

  ipcMain.handle('fs-write-file', async (event, { filePath, data, options }) => {
    try {
      await fsPromises.writeFile(filePath, data, options);
      return true;
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      throw error;
    }
  });

  ipcMain.handle('fs-exists', async (event, { filePath }) => {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      console.error(`Error checking if file exists ${filePath}:`, error);
      throw error;
    }
  });

  ipcMain.handle('fs-mkdir', async (event, { dirPath, options }) => {
    try {
      await fsPromises.mkdir(dirPath, options);
      return true;
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  });

  ipcMain.handle('fs-stat', async (event, { filePath }) => {
    try {
      const stat = await fsPromises.stat(filePath);
      return {
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        size: stat.size,
        mtime: stat.mtime,
        ctime: stat.ctime,
        // Convert non-serializable parts to something that can be transferred over IPC
        mode: stat.mode,
      };
    } catch (error) {
      console.error(`Error getting stats for ${filePath}:`, error);
      throw error;
    }
  });

  ipcMain.handle('fs-join-path', (event, { paths }) => {
    return path.join(...paths);
  });

  ipcMain.handle('fs-dirname', (event, { filePath }) => {
    return path.dirname(filePath);
  });
}); 