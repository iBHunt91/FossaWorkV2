import WebSocket from 'ws';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getUserPushoverSettings, saveUserPushoverSettings } from './pushoverService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In-memory message storage
let receivedMessages = [];
const MAX_STORED_MESSAGES = 50;

// WebSocket connection
let ws = null;
let reconnectTimer = null;
const MAX_RECONNECT_DELAY = 30000; // Maximum reconnect delay (30 seconds)
let reconnectDelay = 5000; // Initial reconnect delay (5 seconds)
let isClientRunning = false;

/**
 * Set up the Pushover Open Client
 * @param {string} email - Pushover account email
 * @param {string} password - Pushover account password
 * @returns {Promise<Object>} - Result of the setup
 */
export async function setupPushoverOpenClient(email, password) {
  try {
    console.log('Setting up Pushover Open Client...');
    
    // Step 1: Login to get user secret
    const loginResponse = await fetch('https://api.pushover.net/1/users/login.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'email': email,
        'password': password
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok || loginData.status !== 1) {
      if (loginResponse.status === 412 && loginData.errors?.includes('two-factor')) {
        throw new Error('Two-factor authentication required. Please handle 2FA in the UI.');
      }
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    
    const userSecret = loginData.secret;
    
    // Step 2: Register a new device
    const deviceName = `FM1_AutoClient_${Date.now().toString(36)}`;
    
    const deviceResponse = await fetch('https://api.pushover.net/1/devices.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'secret': userSecret,
        'name': deviceName,
        'os': 'O' // 'O' for Open Client
      })
    });
    
    const deviceData = await deviceResponse.json();
    
    if (!deviceResponse.ok || deviceData.status !== 1) {
      throw new Error(`Device registration failed: ${JSON.stringify(deviceData)}`);
    }
    
    const deviceId = deviceData.id;
    
    // Step 3: Save the credentials with existing settings
    const currentSettings = getUserPushoverSettings();
    const updatedSettings = {
      ...currentSettings,
      // Keep existing appToken and userKey
      userSecret: userSecret,
      deviceId: deviceId,
      openClientEnabled: true
    };
    
    // Save to settings file
    saveUserPushoverSettings(updatedSettings);
    
    console.log('Pushover Open Client set up successfully!');
    console.log(`Device name: ${deviceName}, Device ID: ${deviceId.substring(0, 4)}...`);
    
    // Start the client
    startOpenClient();
    
    return {
      success: true,
      message: 'Pushover Open Client set up successfully!',
      deviceName,
      deviceId
    };
  } catch (error) {
    console.error('Error setting up Pushover Open Client:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Start the Pushover Open Client
 * @returns {Promise<Object>} - Result of starting the client
 */
export async function startOpenClient() {
  try {
    const settings = getUserPushoverSettings();
    
    if (!settings.userSecret || !settings.deviceId) {
      return {
        success: false,
        message: 'Pushover Open Client not set up yet'
      };
    }
    
    if (isClientRunning) {
      return {
        success: true,
        message: 'Pushover Open Client is already running'
      };
    }
    
    // Download existing messages first
    await downloadMessages(settings.userSecret, settings.deviceId);
    
    // Connect to WebSocket server
    connectWebSocket(settings.userSecret, settings.deviceId);
    
    return {
      success: true,
      message: 'Pushover Open Client started successfully'
    };
  } catch (error) {
    console.error('Error starting Pushover Open Client:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Stop the Pushover Open Client
 * @returns {Object} - Result of stopping the client
 */
export function stopOpenClient() {
  try {
    if (!isClientRunning) {
      return {
        success: true,
        message: 'Pushover Open Client is not running'
      };
    }
    
    // Close WebSocket connection
    if (ws) {
      ws.terminate();
      ws = null;
    }
    
    // Clear reconnect timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    isClientRunning = false;
    console.log('Pushover Open Client stopped');
    
    return {
      success: true,
      message: 'Pushover Open Client stopped successfully'
    };
  } catch (error) {
    console.error('Error stopping Pushover Open Client:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get the status of the Pushover Open Client
 * @returns {Object} - Status of the client
 */
export function getOpenClientStatus() {
  const settings = getUserPushoverSettings();
  const isSetup = !!(settings.userSecret && settings.deviceId);
  
  return {
    success: true,
    enabled: isClientRunning,
    isSetup,
    messages: receivedMessages
  };
}

/**
 * Connect to Pushover WebSocket server
 * @param {string} userSecret - User secret
 * @param {string} deviceId - Device ID
 */
function connectWebSocket(userSecret, deviceId) {
  console.log('Connecting to Pushover WebSocket server...');
  
  try {
    ws = new WebSocket('wss://client.pushover.net/push');
    
    ws.on('open', () => {
      console.log('Connected to Pushover WebSocket server');
      // Login with device ID and user secret
      ws.send(`login:${deviceId}:${userSecret}\n`);
      isClientRunning = true;
      reconnectDelay = 5000; // Reset reconnect delay on successful connection
    });
    
    ws.on('message', (data) => {
      const message = data.toString();
      console.log('Received message from Pushover:', message);
      
      // Handle different message types
      if (message === '#') {
        // Keep-alive packet, no action needed
      } else if (message === '!') {
        // New message available, download it
        downloadMessages(userSecret, deviceId);
      } else if (message === 'R') {
        // Reload request - reconnect in 1 second rather than immediately
        setTimeout(() => {
          reconnect(userSecret, deviceId);
        }, 1000);
      } else if (message === 'E') {
        // Error - try to reconnect after a delay
        console.error('Pushover connection error, will attempt to reconnect...');
        isClientRunning = false;
        setTimeout(() => {
          reconnect(userSecret, deviceId);
        }, 5000);
      } else if (message === 'A') {
        // Logged in elsewhere - this is an important one to handle
        console.error('Pushover logged in elsewhere - user must reconnect manually');
        isClientRunning = false;
        // Update settings to reflect that reconnection is needed
        const settings = getUserPushoverSettings();
        saveUserPushoverSettings({
          ...settings,
          openClientEnabled: false,
          openClientNeedsReconnect: true
        });
      }
    });
    
    ws.on('close', () => {
      console.log('Disconnected from Pushover WebSocket server');
      isClientRunning = false;
      
      // Schedule reconnect
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!ws || ws.readyState === WebSocket.CLOSED) {
            connectWebSocket(userSecret, deviceId);
          }
        }, reconnectDelay);
        
        // Increase reconnect delay for next attempt (exponential backoff)
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      }
      
      // Clear interval on connection close
      clearInterval(pingInterval);
    });
    
    ws.on('error', (error) => {
      console.error('Pushover WebSocket error:', error);
    });
    
    // Setup a ping interval to keep the connection alive
    const pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('Sending ping to keep connection alive');
        ws.send('#');
      } else if (!isClientRunning) {
        clearInterval(pingInterval);
      }
    }, 45000); // Every 45 seconds
  } catch (error) {
    console.error('Error connecting to Pushover WebSocket server:', error);
    isClientRunning = false;
    
    // Schedule reconnect
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket(userSecret, deviceId);
      }, reconnectDelay);
      
      // Increase reconnect delay for next attempt (exponential backoff)
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }
  }
}

/**
 * Force reconnection to Pushover WebSocket server
 * @param {string} userSecret - User secret
 * @param {string} deviceId - Device ID
 */
function reconnect(userSecret, deviceId) {
  if (ws) {
    ws.terminate();
    ws = null;
  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  connectWebSocket(userSecret, deviceId);
}

/**
 * Download new messages from Pushover server
 * @param {string} userSecret - User secret
 * @param {string} deviceId - Device ID
 */
async function downloadMessages(userSecret, deviceId) {
  try {
    console.log('Downloading messages from Pushover server...');
    
    const response = await fetch(
      `https://api.pushover.net/1/messages.json?secret=${encodeURIComponent(userSecret)}&device_id=${encodeURIComponent(deviceId)}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.messages && data.messages.length > 0) {
      console.log(`Received ${data.messages.length} new messages`);
      
      // Process messages
      for (const message of data.messages) {
        processMessage(message);
      }
      
      // Delete messages from Pushover server
      if (data.messages.length > 0) {
        const highestId = data.messages[data.messages.length - 1].id;
        await deleteMessages(userSecret, deviceId, highestId);
      }
    } else {
      console.log('No new messages');
    }
  } catch (error) {
    console.error('Error downloading messages:', error);
  }
}

/**
 * Delete messages from Pushover server
 * @param {string} userSecret - User secret
 * @param {string} deviceId - Device ID
 * @param {string} highestId - Highest message ID
 */
async function deleteMessages(userSecret, deviceId, highestId) {
  try {
    console.log(`Deleting messages up to ID ${highestId} from Pushover server...`);
    
    const response = await fetch(`https://api.pushover.net/1/devices/${encodeURIComponent(deviceId)}/update_highest_message.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: userSecret,
        message: highestId.toString(),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    console.log('Messages deleted from Pushover server');
  } catch (error) {
    console.error('Error deleting messages:', error);
  }
}

/**
 * Process a message and extract job number
 * @param {Object} message - Pushover message object
 */
function processMessage(message) {
  try {
    console.log('Processing message:', message);
    
    // Store message for UI display
    const msgContent = message.message || '';
    const timestamp = message.date * 1000; // Convert to milliseconds
    
    // Look for job visit number pattern (e.g., "JOB:12345")
    const jobPattern = /JOB:(\d+)/i;
    const match = msgContent.match(jobPattern);
    
    let jobNumber = null;
    if (match && match[1]) {
      jobNumber = match[1];
      console.log(`Found job visit number: ${jobNumber}`);
      
      // Process the job visit number (implement this based on your app's needs)
      processJobNumber(jobNumber);
    }
    
    // Add message to the list
    const newMessage = {
      message: msgContent,
      timestamp,
      jobNumber
    };
    
    receivedMessages.unshift(newMessage); // Add to the beginning
    
    // Limit the number of stored messages
    if (receivedMessages.length > MAX_STORED_MESSAGES) {
      receivedMessages = receivedMessages.slice(0, MAX_STORED_MESSAGES);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

/**
 * Process a job number (implement this to trigger your app's automation)
 * @param {string} jobNumber - The job number to process
 */
function processJobNumber(jobNumber) {
  // This is where you would implement the automation logic for your app
  // For example, you might look up a job in your database, 
  // navigate to a specific screen, or fill out a form
  
  console.log(`Processing job number: ${jobNumber}`);
  
  // Example: Trigger an event that the main app can listen for
  // You'll need to implement this integration with your app
  if (global.mainWindow) {
    global.mainWindow.webContents.send('pushover:job-number', jobNumber);
  }
  
  // You could also save the job number for later processing
  // or call a function in your main app
}

// Auto-start the client when the module is imported
const settings = getUserPushoverSettings();
if (settings.userSecret && settings.deviceId && settings.openClientEnabled !== false) {
  console.log('Auto-starting Pushover Open Client...');
  // Use a slight delay to ensure the app is fully loaded
  setTimeout(() => {
    startOpenClient();
  }, 2000);
} 