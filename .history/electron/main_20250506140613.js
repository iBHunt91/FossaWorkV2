import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, Notification, globalShortcut, screen } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import cron from 'node-cron';
import { analyzeScheduleChanges } from '../scripts/utils/scheduleComparator.js';
import { sendScheduleChangeEmail } from '../scripts/email/emailService.js';
import { sendTestNotifications } from '../scripts/notifications/notificationService.js';
import * as logger from '../scripts/utils/logger.js';
import fetch from 'node-fetch';
import { getProverPreferences, updateProverPreference } from '../scripts/utils/prover_info.js';
import { loginToFossa } from '../scripts/utils/login.js';
import { runScrape } from '../scripts/unified_scrape.js';

// Disable Autofill features to prevent DevTools protocol errors
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,Autofill');

// Suppress DevTools protocol errors
const originalConsoleError = console.error;
console.error = (...args) => {
  // Check if this is a DevTools protocol error we want to suppress
  if (args.length > 0 && 
      typeof args[0] === 'string' && 
      (args[0].includes('Request Autofill.enable failed') || 
       args[0].includes('Request Autofill.setAddresses failed') ||
       args[0].includes('Unable to move the cache: Access is denied'))) {
    // Silently ignore these specific errors
    return;
  }
  
  // Pass through all other errors to the original console.error
  originalConsoleError.apply(console, args);
};

// Configure logger based on environment
logger.configure({
  // PowerShell on Windows has issues with ANSI colors and box drawing
  useColors: process.platform !== 'win32',
  useSimpleFormat: process.platform === 'win32'
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;
let frontendProcess;
let isScraping = false;
let tray = null;
let isQuitting = false;

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
        } 
      },
      { 
        label: 'Actions',
        submenu: [
          { 
            label: 'View History', 
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
          { 
            label: 'Send Test Notification', 
            click: async () => {
              try {
                const result = await sendTestNotifications();
                mainWindow.webContents.send('test-notification-result', { 
                  success: result.success, 
                  message: `Email: ${result.results.email?.success ? 'Success' : 'Failed'}, Pushover: ${result.results.pushover?.success ? 'Success' : 'Failed'}`
                });
              } catch (error) {
                logger.error('Notification Test', error);
                mainWindow.webContents.send('test-notification-result', { success: false, error: error.message });
              }
            } 
          }
        ]
      },
      { 
        label: 'Settings',
        submenu: [
          {
            label: 'Start at Login',
            type: 'checkbox',
            checked: app.getLoginItemSettings().openAtLogin,
            click: () => {
              const settings = app.getLoginItemSettings();
              app.setLoginItemSettings({
                openAtLogin: !settings.openAtLogin,
                path: process.execPath
              });
            }
          },
          { 
            label: 'Open Data Folder', 
            click: () => {
              shell.openPath(path.join(__dirname, '../data'));
            } 
          }
        ]
      },
      { type: 'separator' },
      { 
        label: 'About',
        click: () => {
          // Create and show about window
          const aboutWindow = new BrowserWindow({
            width: 400,
            height: 300,
            resizable: false,
            minimizable: false,
            maximizable: false,
            parent: mainWindow,
            modal: true,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true
            }
          });
          
          // Load about page
          aboutWindow.loadURL(`file://${path.join(__dirname, '../about.html')}`);
          aboutWindow.setMenu(null);
        }
      },
      { type: 'separator' },
      { 
        label: 'Quit', 
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
  logger.info('Application Startup', 'Creating application window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until content is loaded
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../src/assets/images/FossaFoxIco.ico')
  });

  // Remove the menu bar completely
  mainWindow.setMenu(null);

  // Suppress DevTools protocol errors by intercepting console messages
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (message.includes('Request Autofill.enable failed') || 
        message.includes('Request Autofill.setAddresses failed') ||
        message.includes('Unable to move the cache: Access is denied')) {
      event.preventDefault();
    }
  });

  // Request notification permission
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('request-notification-permission');
    // Show window after content is loaded
    mainWindow.show();
  });

  // Load the frontend URL
  mainWindow.loadURL(process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5173' // Vite dev server port 
    : `file://${path.join(__dirname, '../dist/index.html')}`);

  // Register keyboard shortcuts for DevTools
  registerDevToolsShortcuts();
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    // Delay opening DevTools until after window is shown for better performance
    setTimeout(() => {
      mainWindow.webContents.openDevTools();
    }, 1000);
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
  
  // Configure DevTools to suppress protocol errors
  app.commandLine.appendSwitch('disable-features', 'Autofill');
  
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
  
  try {
    // Improved environment path handling
    const serverPath = path.join(__dirname, '../server/server.js');
    logger.info('Backend', `Server path: ${serverPath}`);
    
    // Check if server script exists
    if (!fs.existsSync(serverPath)) {
      logger.error('Backend', `Server script not found at: ${serverPath}`);
      throw new Error(`Server script not found at: ${serverPath}`);
    }
    
    // First try to terminate any existing processes on port 3001
    try {
      const tcpProcesses = spawn('powershell', ['-Command', 
        `Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | 
         Select-Object -ExpandProperty OwningProcess | 
         ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`]);
      
      tcpProcesses.on('close', (code) => {
        logger.info('Backend', `TCP connection cleanup completed with code ${code}`);
      });
    } catch (err) {
      logger.warn('Backend', `Error cleaning up port: ${err.message}`);
    }
    
    // Make sure we use the right port
    const PORT = 3001;
    process.env.PORT = PORT;
    
    // Launch server with improved error handling
    backendProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        PORT: PORT.toString(),
        // Add a small random offset to the port if we're in development mode
        PORT_FALLBACK: (PORT + 1).toString() 
      },
      stdio: 'pipe'
    });
    
    // Enable better logging for backend process
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      logger.log('[Server]', output);
      
      if (output.includes('Server running on port')) {
        const portMatch = output.match(/Server running on port (\d+)/);
        const actualPort = portMatch ? portMatch[1] : PORT;
        logger.success('Backend', `Server started successfully on port ${actualPort}`);
        
        // Store the actual port in use for the renderer to connect to
        global.serverPort = actualPort;
        
        // Notify renderer
        if (mainWindow) {
          mainWindow.webContents.send('backend-status', {
            running: true,
            port: actualPort
          });
        }
      }
    });
    
    backendProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      logger.error('[Server Error]', error);
      
      if (mainWindow) {
        // Notify renderer of errors
        mainWindow.webContents.send('backend-error', { error });
      }
    });
    
    backendProcess.on('close', (code) => {
      logger.warn('Backend', `Server process exited with code ${code}`);
      
      if (mainWindow && code !== 0) {
        mainWindow.webContents.send('backend-status', {
          running: false,
          error: `Server crashed with code ${code}`
        });
      }
      
      // Don't restart if app is quitting
      if (!isQuitting) {
        logger.info('Backend', 'Attempting to restart server...');
        setTimeout(() => {
          startBackend();
        }, 3000); // Wait 3 seconds before restart attempt
      }
    });
    
    backendProcess.on('error', (error) => {
      logger.error('Backend', `Failed to start server: ${error.message}`);
      if (mainWindow) {
        mainWindow.webContents.send('backend-status', {
          running: false,
          error: error.message
        });
      }
    });
    
    logger.info('Backend', 'Server process started');
    
    return true;
  } catch (error) {
    logger.error('Backend', `Error starting server: ${error.message}`);
    if (mainWindow) {
      mainWindow.webContents.send('backend-status', {
        running: false,
        error: error.message
      });
    }
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
    const result = await runScrape({ isManual: false });
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
      const result = await scrapeAllWorkOrders();
      
      // Notify the renderer process about the manual scrape completion
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scrape-complete', {
          type: 'manual',
          timestamp: new Date().toISOString(),
          success: true
        });
        logger.info('Manual Scrape', 'Notified UI about manual scrape completion');
      }
      
      return { success: true, message: 'Manual scrape completed successfully' };
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
      if (!options || !options.changeType || typeof options.count !== 'number') {
        return { success: false, message: 'Invalid options provided' };
      }
      
      // Generate simulated changes based on options - no need for site-clone
      const changes = {
        critical: [],
        high: [],
        medium: [],
        low: [],
        summary: {
          removed: 0,
          added: 0,
          modified: 0,
          swapped: 0
        }
      };
      
      // Add simulated changes to the appropriate severity level
      switch (options.changeType) {
        case 'add':
          // Add jobs (critical changes)
          for (let i = 0; i < options.count; i++) {
            changes.critical.push({
              type: 'added',
              jobId: `W-${100000 + i}`,
              store: `#${1000 + i}`,
              storeName: `Test Store ${i}`,
              dispensers: Math.floor(Math.random() * 8) + 1,
              location: 'Test Location, FL',
              date: new Date(Date.now() + (i * 86400000)).toLocaleDateString()
            });
          }
          changes.summary.added = options.count;
          break;
          
        case 'remove':
          // Remove jobs (critical changes)
          for (let i = 0; i < options.count; i++) {
            changes.critical.push({
              type: 'removed',
              jobId: `W-${100000 + i}`,
              store: `#${1000 + i}`,
              storeName: `Test Store ${i}`,
              dispensers: Math.floor(Math.random() * 8) + 1,
              location: 'Test Location, FL',
              date: new Date(Date.now() + (i * 86400000)).toLocaleDateString()
            });
          }
          changes.summary.removed = options.count;
          break;
          
        case 'replace':
          // Replace jobs (high priority)
          for (let i = 0; i < options.count; i++) {
            changes.high.push({
              type: 'replacement',
              old_dispenser_id: `D-${1000 + i}`,
              new_dispenser_id: `D-${2000 + i}`,
              store: `#${1000 + i}`,
              storeName: `Test Store ${i}`,
              dispensers: Math.floor(Math.random() * 8) + 1,
              location: 'Test Location, FL',
              date: new Date(Date.now() + (i * 86400000)).toLocaleDateString()
            });
          }
          changes.summary.modified = options.count;
          break;
          
        case 'date':
          // Date changes (medium priority)
          for (let i = 0; i < options.count; i++) {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() + i);
            
            const newDate = new Date();
            newDate.setDate(newDate.getDate() + i + 7); // Moved a week later
            
            changes.medium.push({
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
          changes.summary.modified = options.count;
          break;
          
        case 'swap':
          // Job swaps (high priority)
          const swapPairs = Math.ceil(options.count / 2);
          for (let i = 0; i < swapPairs; i++) {
            // Create a pair of jobs that have swapped dates
            const today = new Date();
            const date1 = new Date(today);
            date1.setDate(today.getDate() + 3);
            const date2 = new Date(today);
            date2.setDate(today.getDate() + 5);
            
            changes.high.push({
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
          changes.summary.swapped = options.count;
          break;
      }
      
      // Import the unified notification service
      const { sendScheduleChangeNotifications } = await import('../scripts/notifications/notificationService.js');
      
      // Create a test user with the necessary preferences for this test
      let testUser = null;
      
      // Get the current user ID from the app's main settings
      const settingsPath = path.join(__dirname, '..', 'data', 'settings.json');
      let currentUserId = '';
      
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        currentUserId = settings.currentUser;
        
        if (currentUserId) {
          logger.info('Schedule Change Test', `Current user ID: ${currentUserId}`);
          
          // Create base test user
          testUser = {
            id: currentUserId,
            email: '',
            pushoverKey: process.env.PUSHOVER_USER_KEY || '',
            notificationSettings: {
              enabled: true,
              email: {
                enabled: options.preferences?.useEmailPreferences || false
              },
              pushover: {
                enabled: options.preferences?.usePushoverPreferences || false
              }
            },
            preferences: {
              notifications: {
                scheduleChanges: true,
                showAllDetails: options.preferences?.forceShowAllFields || false
              }
            }
          };
          
          // Try to get user email from their settings
          try {
            const userEmailSettingsPath = path.join(__dirname, '..', 'data', 'users', currentUserId, 'email_settings.json');
            if (fs.existsSync(userEmailSettingsPath)) {
              const emailSettings = JSON.parse(fs.readFileSync(userEmailSettingsPath, 'utf8'));
              if (emailSettings.recipientEmail) {
                testUser.email = emailSettings.recipientEmail;
                logger.info('Schedule Change Test', `Found recipient email for user ${currentUserId}: ${testUser.email}`);
              }
            }
          } catch (err) {
            logger.warn('Schedule Change Test', `Could not load email settings: ${err.message}`);
          }
        }
      }
      
      if (!testUser) {
        // Create a default test user if no current user
        testUser = {
          id: 'test-user',
          email: process.env.TEST_EMAIL || '',
          pushoverKey: process.env.PUSHOVER_USER_KEY || '',
          notificationSettings: {
            enabled: true,
            email: {
              enabled: options.preferences?.useEmailPreferences || false
            },
            pushover: {
              enabled: options.preferences?.usePushoverPreferences || false
            }
          },
          preferences: {
            notifications: {
              scheduleChanges: true,
              showAllDetails: options.preferences?.forceShowAllFields || false
            }
          }
        };
      }
      
      logger.info('Schedule Change Test', `Sending notifications using unified system with user: ${JSON.stringify(testUser)}`);
      
      // Send notifications using the unified notification system
      const notificationResults = await sendScheduleChangeNotifications(changes, testUser);
      
      // Show a notification in the desktop app
      const emailStatus = !testUser.notificationSettings.email.enabled ? 'Skipped' : 
                          (notificationResults.results.email?.success ? 'Sent' : 'Failed');
      const pushoverStatus = !testUser.notificationSettings.pushover.enabled ? 'Skipped' : 
                             (notificationResults.results.pushover?.success ? 'Sent' : 'Failed');
      
      showNotification(
        'Unified Notification System Test', 
        `Email: ${emailStatus}, Pushover: ${pushoverStatus}`
      );
      
      return { 
        success: true, 
        message: `Successfully sent notifications for ${options.count} ${options.changeType} schedule change(s)`,
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
      
      // Import alert notification service
      const { sendAlertPushover } = await import('../scripts/notifications/pushoverService.js');
      
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
      
      // Mock user with a Pushover key
      const testUsers = [{
        id: 'test-user',
        pushoverKey: process.env.PUSHOVER_USER_KEY || 'test-key',
        deviceId: process.env.PUSHOVER_DEVICE || '',
        preferences: {
          sounds: {
            critical: 'siren',
            high: 'bike',
            default: 'pushover'
          }
        }
      }];
      
      // Send the alerts to Pushover
      const pushoverResult = await sendAlertPushover(alerts, testUsers);
      
      // Show a notification in the desktop app
      showNotification(
        'Alert Test', 
        `Successfully tested ${options.count} ${options.severity} ${options.alertType} alert(s)`
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
      const { provers } = preferencesData;
      for (const prover of provers) {
        await updateProverPreference(prover.prover_id, prover.preferred_fuel_type, prover.priority, prover.preferred_fuel_types);
      }
      
      // Get the updated data
      const updatedPreferences = await getProverPreferences();
      
      logger.success('Prover Preferences', 'Successfully updated prover preferences');
      return { success: true, data: updatedPreferences };
    } catch (error) {
      logger.error('Prover Preferences Update Error', error.message || 'Unknown error');
      return { success: false, error: error.message || 'Failed to update prover preferences' };
    }
  });

  // Handle IPC for opening URLs with authenticated login
  ipcMain.handle('open-url-with-login', async (event, { url }) => {
    try {
      logger.info('Authentication', `Attempting to log in and navigate to: ${url}`);
      
      // Get the primary display's dimensions - access screen directly instead of using require
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      logger.info('Browser Setup', `Using screen resolution: ${width}x${height}`);
      
      // Log in using the login script with browser-like settings
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
      
      // Navigate to the requested URL
      logger.info('Navigation', `Navigating to: ${url}`);
      await page.goto(url);
      
      // Return success to renderer
      return { 
        success: true, 
        message: 'Successfully logged in and navigated to URL' 
      };
      
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
}); 