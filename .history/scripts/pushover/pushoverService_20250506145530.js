import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import axios from 'axios';
import { resolveUserFilePath, getActiveUser } from '../../server/utils/userManager.js';
import { getVisitId } from './formatService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file for backward compatibility
const envPath = path.join(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
        acc[key] = value;
    }
    return acc;
}, {});

// Ensure environment variables are also in process.env
Object.entries(envVars).forEach(([key, value]) => {
    if (!process.env[key]) {
        process.env[key] = value;
    }
});

/**
 * Get user pushover settings from user file
 * @returns {Object} The user's pushover settings
 */
export function getUserPushoverSettings() {
    const settingsPath = resolveUserFilePath('pushover_settings.json');
    if (!fs.existsSync(settingsPath)) {
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
}

/**
 * Get the app token from user settings or environment variables
 * @returns {string} The app token
 */
function getAppToken() {
    const settings = getUserPushoverSettings();
    return settings.appToken || process.env.PUSHOVER_APP_TOKEN || envVars.PUSHOVER_APP_TOKEN;
}

/**
 * Get the user key from user settings or environment variables
 * @returns {string} The user key
 */
function getUserKey() {
    const settings = getUserPushoverSettings();
    return settings.userKey || process.env.PUSHOVER_USER_KEY || envVars.PUSHOVER_USER_KEY;
}

/**
 * Check if a display preference is enabled
 * @param {string} preference - The preference name
 * @param {boolean} defaultValue - Default value to use if not defined
 * @returns {boolean} - Whether the preference is enabled
 */
function isDisplayEnabled(preference, defaultValue = true) {
    const settings = getUserPushoverSettings();
    
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
 * @returns {number} - The Pushover priority level
 */
function getConfiguredPriorityLevel() {
    const settings = getUserPushoverSettings();
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
 * @returns {string} - The Pushover sound name
 */
function getConfiguredSound() {
    const settings = getUserPushoverSettings();
    return settings.preferences.sound || 'pushover';
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
 * @returns {Promise<Object>} - Response from Pushover API
 */
export async function sendPushoverNotification(options) {
    // Ensure required parameters are present
    if (!options.message) {
        throw new Error('Message is required for Pushover notification');
    }

    // Get the app token and user key
    const appToken = getAppToken();
    const userKey = getUserKey();

    // Get user settings to check if notifications are enabled
    const settings = getUserPushoverSettings();
    
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
    
    // Get app token from environment
    const appToken = getAppToken();
    if (!appToken) {
        console.error('PUSHOVER_APP_TOKEN not found in environment variables');
        throw new Error('Pushover API token not configured');
    }
    
    console.log('Found Pushover app token:', appToken.substring(0, 4) + '...' + appToken.substring(appToken.length - 4));
    
    // Count changes by type
    const changesCount = {
        added: changes.allChanges.filter(c => c.type === 'added').length || 0,
        removed: changes.allChanges.filter(c => c.type === 'removed').length || 0,
        replacement: changes.allChanges.filter(c => c.type === 'replacement').length || 0,
        date: changes.allChanges.filter(c => c.type === 'date_changed').length || 0,
        swap: changes.allChanges.filter(c => c.type === 'swap').length || 0
    };
    
    // Organize changes by type for split notifications if needed
    const changesByType = {
        added: changes.allChanges.filter(c => c.type === 'added'),
        removed: changes.allChanges.filter(c => c.type === 'removed'),
        replacement: changes.allChanges.filter(c => c.type === 'replacement'),
        date_changed: changes.allChanges.filter(c => c.type === 'date_changed'),
        swap: changes.allChanges.filter(c => c.type === 'swap')
    };
    
    // Construct the title
    const totalChanges = changes.allChanges.length;
    const title = `📅 ${totalChanges} Schedule Change${totalChanges !== 1 ? 's' : ''} Detected`;
    
    // Set standard priority for all changes
    const priority = 0;
    
    // Track all promises for all notifications
    const allPromises = [];
    
    // Send notification to each user
    for (const user of userArray) {
        if (!user.pushoverKey) {
            console.warn(`User has no Pushover key`);
            allPromises.push(Promise.resolve({ success: false, error: 'No Pushover key for user' }));
            continue;
        }
        
        console.log(`Sending Pushover notification to user key: ${user.pushoverKey.substring(0, 4)}...`);
        
        try {
            // Check if we need to split the message due to Pushover's character limit (1024 chars)
            const fullMessage = formatScheduleChangeMessage(changes);
            
            // If the message is under the limit, send as a single notification
            if (fullMessage.length <= 1024) {
                const params = new URLSearchParams();
                params.append('token', appToken);
                params.append('user', user.pushoverKey);
                params.append('message', fullMessage);
                params.append('title', title);
                params.append('priority', priority);
                params.append('html', '1');
                
                // Use sound preference if available
                if (user.notificationSettings?.pushover?.sound) {
                    params.append('sound', user.notificationSettings.pushover.sound);
                } else {
                    params.append('sound', 'pushover'); // Default sound
                }
                
                const response = await fetch('https://api.pushover.net/1/messages.json', {
                    method: 'POST',
                    body: params
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    console.log(`Successfully sent Pushover notification to user key: ${user.pushoverKey.substring(0, 4)}...`);
                    allPromises.push(Promise.resolve({ success: true, data }));
                } else {
                    console.error(`Error sending Pushover notification to user:`, data);
                    allPromises.push(Promise.resolve({ success: false, error: data }));
                }
            } else {
                console.log(`Message exceeds Pushover's 1024 character limit (${fullMessage.length} chars). Splitting by individual changes.`);
                
                // Send multiple notifications, grouped by change type with precise message size control
                const promises = [];
                
                // Create an array of change type groups to process
                const changeTypes = [
                    { type: 'added', title: '➕ Added Visits', changeList: changesByType.added },
                    { type: 'removed', title: '🗑️ Removed Visits', changeList: changesByType.removed },
                    { type: 'replacement', title: '♻️ Replaced Visits', changeList: changesByType.replacement },
                    { type: 'date_changed', title: '📅 Date Changes', changeList: changesByType.date_changed },
                    { type: 'swap', title: '🔄 Swapped Visits', changeList: changesByType.swap }
                ];
                
                // Send a summary notification first
                const summaryParams = new URLSearchParams();
                summaryParams.append('token', appToken);
                summaryParams.append('user', user.pushoverKey);
                summaryParams.append('message', 
                    `<b>Schedule Changes Summary:</b>\n` +
                    `• ${changesCount.added} Added visits\n` +
                    `• ${changesCount.removed} Removed visits\n` +
                    `• ${changesCount.replacement} Replaced visits\n` +
                    `• ${changesCount.date} Date changes\n` +
                    `• ${changesCount.swap} Swapped visits\n\n` +
                    `<b>Detailed notifications will follow.</b>`
                );
                summaryParams.append('title', title);
                summaryParams.append('priority', priority);
                summaryParams.append('html', '1');
                
                // Use sound preference if available
                if (user.notificationSettings?.pushover?.sound) {
                    summaryParams.append('sound', user.notificationSettings.pushover.sound);
                } else {
                    summaryParams.append('sound', 'pushover'); // Default sound
                }
                
                // Send the summary notification
                const summaryResponse = await fetch('https://api.pushover.net/1/messages.json', {
                    method: 'POST',
                    body: summaryParams
                });
                
                const summaryData = await summaryResponse.json();
                
                if (summaryResponse.ok) {
                    console.log(`Successfully sent summary Pushover notification to user`);
                    promises.push({ success: true, data: summaryData });
                } else {
                    console.error(`Error sending summary Pushover notification:`, summaryData);
                    promises.push({ success: false, error: summaryData });
                }
                
                // Process each change type that has changes
                for (const changeType of changeTypes) {
                    if (changeType.changeList.length === 0) continue;
                    
                    // Format and send each message based on actual character count
                    // Instead of estimating characters, we'll create messages one change at a time
                    
                    // Maximum message size, leaving room for headers and footers
                    const MAX_MESSAGE_SIZE = 950; // Safety margin below 1024 limit
                    
                    // Pre-format each change to know its exact size
                    const formattedChanges = [];
                    
                    for (const change of changeType.changeList) {
                        // Create a temporary changes object with just this one change
                        const singleChangeObj = { 
                            allChanges: [change],
                            summary: changes.summary
                        };
                        
                        // Format this single change
                        const formattedChange = formatScheduleChangeMessage(singleChangeObj);
                        
                        formattedChanges.push({
                            change,
                            formatted: formattedChange,
                            length: formattedChange.length
                        });
                    }
                    
                    // Create batches of changes that fit within the character limit
                    const batches = [];
                    let currentBatch = [];
                    let currentBatchSize = 0;
                    
                    for (const item of formattedChanges) {
                        // If this change alone exceeds our max size, it needs its own message
                        if (item.length > MAX_MESSAGE_SIZE) {
                            // If we have accumulated changes, finalize that batch
                            if (currentBatch.length > 0) {
                                batches.push(currentBatch);
                                currentBatch = [];
                                currentBatchSize = 0;
                            }
                            
                            // Put this large change in its own batch
                            batches.push([item]);
                            continue;
                        }
                        
                        // If adding this change would exceed our limit, start a new batch
                        if (currentBatchSize + item.length > MAX_MESSAGE_SIZE) {
                            batches.push(currentBatch);
                            currentBatch = [item];
                            currentBatchSize = item.length;
                        } else {
                            // Add to current batch
                            currentBatch.push(item);
                            currentBatchSize += item.length;
                        }
                    }
                    
                    // Add any remaining changes to the final batch
                    if (currentBatch.length > 0) {
                        batches.push(currentBatch);
                    }
                    
                    console.log(`Split ${changeType.changeList.length} ${changeType.type} changes into ${batches.length} messages`);
                    
                    // Send each batch as a separate notification
                    for (let i = 0; i < batches.length; i++) {
                        const batch = batches[i];
                        
                        // Create combined message from pre-formatted changes
                        let batchMessage = '';
                        for (const item of batch) {
                            batchMessage += item.formatted;
                        }
                        
                        // Generate message title with batch info
                        let messageTitle = `${changeType.title} (${i+1}/${batches.length})`;
                        
                        const batchParams = new URLSearchParams();
                        batchParams.append('token', appToken);
                        batchParams.append('user', user.pushoverKey);
                        batchParams.append('message', batchMessage);
                        batchParams.append('title', messageTitle);
                        batchParams.append('priority', priority);
                        batchParams.append('html', '1');
                        
                        if (user.notificationSettings?.pushover?.sound) {
                            batchParams.append('sound', user.notificationSettings.pushover.sound);
                        } else {
                            batchParams.append('sound', 'pushover');
                        }
                        
                        try {
                            const batchResponse = await fetch('https://api.pushover.net/1/messages.json', {
                                method: 'POST',
                                body: batchParams
                            });
                            
                            const batchData = await batchResponse.json();
                            
                            if (batchResponse.ok) {
                                console.log(`Successfully sent ${changeType.type} batch ${i+1}/${batches.length} Pushover notification (${batchMessage.length} chars)`);
                                promises.push({ success: true, data: batchData });
                            } else {
                                console.error(`Error sending ${changeType.type} batch ${i+1}/${batches.length} notification:`, batchData);
                                promises.push({ success: false, error: batchData });
                            }
                            
                            // Add a small delay between notifications to avoid rate limiting
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } catch (error) {
                            console.error(`Error sending batch notification:`, error);
                            promises.push({ success: false, error });
                        }
                    }
                }
                
                allPromises.push(Promise.all(promises));
            }
        } catch (error) {
            console.error('Error sending Pushover notification:', error);
            allPromises.push(Promise.resolve({ success: false, error }));
        }
    }
    
    return Promise.all(allPromises);
}

/**
 * Format change details for display
 * @param {Object} change - Change object
 * @returns {string} - Formatted change details
 */
function formatChangeDetails(change) {
    if (!change) return 'No details available';
    
    try {
        switch (change.type) {
            case 'replacement':
                const replacementInfo = [];
                
                if (change.old_dispenser_id && change.new_dispenser_id) {
                    replacementInfo.push(`Dispenser ${change.old_dispenser_id} → ${change.new_dispenser_id}`);
                }
                
                if (change.store_location) {
                    replacementInfo.push(`at ${change.store_location}`);
                }
                
                if (change.reason) {
                    replacementInfo.push(`(Reason: ${change.reason})`);
                }
                
                return replacementInfo.join(' ');
                
            case 'removed':
                let removalDetails = `${change.dispenser_id || 'Dispenser'} removed`;
                
                if (change.store_location) {
                    removalDetails += ` from ${change.store_location}`;
                }
                
                if (change.reason) {
                    removalDetails += ` (Reason: ${change.reason})`;
                }
                
                if (change.return_date) {
                    removalDetails += ` - Expected return: ${new Date(change.return_date).toLocaleDateString()}`;
                }
                
                return removalDetails;
                
            case 'added':
                let addDetails = `${change.dispenser_id || 'Dispenser'} added`;
                
                if (change.store_location) {
                    addDetails += ` to ${change.store_location}`;
                }
                
                if (change.manufacturer) {
                    addDetails += ` (${change.manufacturer})`;
                }
                
                return addDetails;
                
            case 'date_changed':
                let dateDetails = 'Schedule date changed';
                
                if (change.old_date && change.new_date) {
                    const oldDate = new Date(change.old_date).toLocaleDateString();
                    const newDate = new Date(change.new_date).toLocaleDateString();
                    dateDetails = `Date changed: ${oldDate} → ${newDate}`;
                }
                
                if (change.dispenser_id) {
                    dateDetails += ` for dispenser ${change.dispenser_id}`;
                }
                
                if (change.store_location) {
                    dateDetails += ` at ${change.store_location}`;
                }
                
                return dateDetails;
                
            case 'status_changed':
                let statusDetails = 'Status changed';
                
                if (change.old_status && change.new_status) {
                    statusDetails = `Status: ${change.old_status} → ${change.new_status}`;
                }
                
                if (change.dispenser_id) {
                    statusDetails += ` for dispenser ${change.dispenser_id}`;
                }
                
                if (change.store_location) {
                    statusDetails += ` at ${change.store_location}`;
                }
                
                return statusDetails;
                
            default:
                // For unknown change types, return all available information
                const details = [];
                
                if (change.dispenser_id) {
                    details.push(`Dispenser: ${change.dispenser_id}`);
                }
                
                if (change.store_location) {
                    details.push(`Location: ${change.store_location}`);
                }
                
                if (change.manufacturer) {
                    details.push(`Manufacturer: ${change.manufacturer}`);
                }
                
                if (change.notes) {
                    details.push(`Notes: ${change.notes}`);
                }
                
                return details.length > 0 ? details.join(', ') : 'Change details not specified';
        }
    } catch (error) {
        console.error('Error formatting change details:', error);
        return 'Error formatting details';
    }
}

/**
 * Send a test notification via Pushover
 * @returns {Promise<Object>} - Response from Pushover API
 */
export async function sendTestPushoverNotification() {
    // Verify Pushover credentials exist before attempting to send
    const appToken = getAppToken();
    const userKey = getUserKey();
    
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
                <p style="margin: 8px 0;">• Sound: <span style="font-weight: bold;">${getConfiguredSound() || 'Default'}</span></p>
                <p style="margin: 8px 0;">• Priority: <span style="font-weight: bold;">${getConfiguredPriorityLevel() === 0 ? 'Normal' : (getConfiguredPriorityLevel() === 1 ? 'High' : 'Emergency')}</span></p>
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
            priority: getConfiguredPriorityLevel(),
            sound: getConfiguredSound(),
            html: 1 // Enable HTML formatting
        });
        return result;
    } catch (error) {
        console.error('Error sending test Pushover notification:', error);
        throw error;
    }
}

/**
 * Send a sample job notification via Pushover to test display preferences
 * @returns {Promise<Object>} - Response from Pushover API
 */
export async function sendSampleJobPushover() {
    // Verify Pushover credentials exist before attempting to send
    const appToken = getAppToken();
    const userKey = getUserKey();
    
    if (!appToken || !userKey) {
        console.error('Pushover credentials not properly configured');
        throw new Error('Pushover application token or user key missing. Please configure Pushover settings first.');
    }
    
    // Sample job data with all fields to test display preferences
    const sampleJob = {
        jobId: '112050',
        store: '#5140',
        storeName: 'Sample Store',
        dispensers: 6,
        location: 'Test Location, FL',
        date: '05/15/2025',
        description: 'This is a sample job to test display preferences'
    };
    
    // Create styled HTML message
    let message = `
    <div style="font-family: Arial, sans-serif; margin: 0; padding: 10px;">
        <div style="background-color: #ffffff; padding: 15px; border-radius: 8px;">
            <h2 style="color: #2c3e50; margin-bottom: 15px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                📋 Sample Job Information
            </h2>
            
            <p style="color: #34495e; font-size: 16px; margin-bottom: 10px;">
                This is a sample notification showing job details based on your display preferences.
            </p>
            
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #3498db;">
                <h3 style="color: #2c3e50; margin: 0 0 5px 0;">📄 Job Details</h3>
                ${isDisplayEnabled('JOB_ID') ? 
                    `<p style="margin: 5px 0;">• Job ID: <span style="font-weight: bold;">${sampleJob.jobId}</span></p>` : ''}
                ${isDisplayEnabled('STORE_NUMBER') ? 
                    `<p style="margin: 5px 0;">• Store: <span style="font-weight: bold;">${sampleJob.store}</span></p>` : ''}
                ${isDisplayEnabled('STORE_NAME') ? 
                    `<p style="margin: 5px 0;">• Store Name: <span style="font-weight: bold;">${sampleJob.storeName}</span></p>` : ''}
                ${isDisplayEnabled('DISPENSERS') ? 
                    `<p style="margin: 5px 0;">• Dispensers: <span style="font-weight: bold;">${sampleJob.dispensers}</span></p>` : ''}
                ${isDisplayEnabled('LOCATION') ? 
                    `<p style="margin: 5px 0;">• Location: <span style="font-weight: bold;">${sampleJob.location}</span></p>` : ''}
                ${isDisplayEnabled('DATE') ? 
                    `<p style="margin: 5px 0;">• Date: <span style="font-weight: bold;">${sampleJob.date}</span></p>` : ''}
            </div>
            
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #FF9500;">
                <h3 style="color: #2c3e50; margin: 0 0 5px 0;">ℹ️ Display Settings</h3>
                <p style="margin: 5px 0;">• Show Job ID: ${isDisplayEnabled('JOB_ID') ? 
                    '<span style="color: #2ecc71; font-weight: bold;">✓ Enabled</span>' : 
                    '<span style="color: #e74c3c; font-weight: bold;">✗ Disabled</span>'}</p>
                <p style="margin: 5px 0;">• Show Store Number: ${isDisplayEnabled('STORE_NUMBER') ? 
                    '<span style="color: #2ecc71; font-weight: bold;">✓ Enabled</span>' : 
                    '<span style="color: #e74c3c; font-weight: bold;">✗ Disabled</span>'}</p>
                <p style="margin: 5px 0;">• Show Store Name: ${isDisplayEnabled('STORE_NAME') ? 
                    '<span style="color: #2ecc71; font-weight: bold;">✓ Enabled</span>' : 
                    '<span style="color: #e74c3c; font-weight: bold;">✗ Disabled</span>'}</p>
                <p style="margin: 5px 0;">• Show Location: ${isDisplayEnabled('LOCATION') ? 
                    '<span style="color: #2ecc71; font-weight: bold;">✓ Enabled</span>' : 
                    '<span style="color: #e74c3c; font-weight: bold;">✗ Disabled</span>'}</p>
                <p style="margin: 5px 0;">• Show Date: ${isDisplayEnabled('DATE') ? 
                    '<span style="color: #2ecc71; font-weight: bold;">✓ Enabled</span>' : 
                    '<span style="color: #e74c3c; font-weight: bold;">✗ Disabled</span>'}</p>
                <p style="margin: 5px 0;">• Show Dispensers: ${isDisplayEnabled('DISPENSERS') ? 
                    '<span style="color: #2ecc71; font-weight: bold;">✓ Enabled</span>' : 
                    '<span style="color: #e74c3c; font-weight: bold;">✗ Disabled</span>'}</p>
            </div>
            
            <div style="padding-top: 10px; text-align: center; margin-top: 10px; border-top: 1px solid #dee2e6;">
                <p style="color: #7f8c8d; font-size: 12px; margin: 5px 0;">
                    Generated: ${new Date().toLocaleString()}
                </p>
            </div>
        </div>
    </div>`;
    
    // Get configured sound and priority
    const sound = getConfiguredSound();
    const priority = getConfiguredPriorityLevel();
    
    try {
        const result = await sendPushoverNotification({
            title: 'Fossa Monitor: Sample Job',
            message,
            priority,
            sound,
            html: 1 // Enable HTML formatting
        });
        return result;
    } catch (error) {
        console.error('Error sending sample job Pushover notification:', error);
        throw error;
    }
}

/**
 * Sends alert notifications via Pushover
 * @param {Array} alerts - Array of alert objects
 * @param {Array|Object} users - Array of user objects or a single user object
 * @returns {Promise<Array>} - Array of responses from Pushover API
 */
export async function sendAlertPushover(alerts, users) {
    // Ensure users is an array
    const userArray = Array.isArray(users) ? users : (users ? [users] : []);
    
    if (!alerts || alerts.length === 0 || userArray.length === 0) {
        return Promise.resolve([]);
    }

    // Group alerts by type for better organization
    const alertsByType = {
        battery: alerts.filter(alert => alert.type === 'battery'),
        connectivity: alerts.filter(alert => alert.type === 'connectivity'),
        error: alerts.filter(alert => alert.type === 'error'),
        other: alerts.filter(alert => !['battery', 'connectivity', 'error'].includes(alert.type))
    };

    // Group alerts by severity for priority determination
    const alertsBySeverity = {
        critical: alerts.filter(alert => alert.severity === 'critical'),
        high: alerts.filter(alert => alert.severity === 'high'),
        normal: alerts.filter(alert => !alert.severity || alert.severity === 'normal'),
    };

    // Determine notification priority and sound based on alert severity
    let priority = 0;
    let sound = 'pushover';
    
    if (alertsBySeverity.critical.length > 0) {
        priority = alertsBySeverity.critical.length >= 3 ? 2 : 1; // Emergency priority for many critical alerts
        sound = alertsBySeverity.critical.length >= 3 ? 'siren' : 'falling';
    } else if (alertsBySeverity.high.length > 0) {
        priority = alertsBySeverity.high.length >= 5 ? 1 : 0; // High priority for many high alerts
        sound = alertsBySeverity.high.length >= 5 ? 'bike' : 'magic';
    }

    // Get unique locations, customers, and devices for summary
    const locations = [...new Set(alerts.map(alert => alert.location).filter(Boolean))];
    const customers = [...new Set(alerts.map(alert => alert.customer).filter(Boolean))];
    const devices = [...new Set(alerts.map(alert => alert.deviceName).filter(Boolean))];
    
    // Get manufacturers if available
    const manufacturers = [...new Set(alerts.map(alert => alert.manufacturer).filter(Boolean))];
    
    // Get stores if available
    const stores = [...new Set(alerts.map(alert => alert.store).filter(Boolean))];
    const storeNames = [...new Set(alerts.map(alert => alert.storeName).filter(Boolean))];
    
    // Create formatted HTML message
    let message = `
    <div style="font-family: Arial, sans-serif; margin: 0; padding: 10px;">
        <div style="background-color: #ffffff; padding: 15px; border-radius: 8px;">
            <h2 style="color: #2c3e50; margin-bottom: 15px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                🚨 ALERT SUMMARY
            </h2>
            
            <p style="color: ${alertsBySeverity.critical.length > 0 ? '#FF3B30' : alertsBySeverity.high.length > 0 ? '#FF9500' : '#34C759'}; font-weight: bold;">
                ${alerts.length} alert${alerts.length > 1 ? 's' : ''} detected
            </p>
            
            <p style="color: #7f8c8d; font-size: 12px;">
                <i>Generated: ${new Date().toLocaleString()}</i>
            </p>
            
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0;">
                <h3 style="color: #2c3e50; margin: 0 0 5px 0;">📊 Severity Breakdown</h3>
                ${alertsBySeverity.critical.length > 0 ? `<p style="margin: 5px 0;"><span style="color: #FF3B30">• Critical: ${alertsBySeverity.critical.length}</span></p>` : ''}
                ${alertsBySeverity.high.length > 0 ? `<p style="margin: 5px 0;"><span style="color: #FF9500">• High: ${alertsBySeverity.high.length}</span></p>` : ''}
                ${alertsBySeverity.normal.length > 0 ? `<p style="margin: 5px 0;">• Normal: ${alertsBySeverity.normal.length}</p>` : ''}
            </div>`;
    
    // Add affected entities info
    if (locations.length > 0 || customers.length > 0 || stores.length > 0 || devices.length > 0) {
        message += `
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0;">
                <h3 style="color: #2c3e50; margin: 0 0 5px 0;">📍 Affected Entities</h3>
                ${locations.length > 0 ? `<p style="margin: 5px 0;">• Locations: ${locations.join(', ')}</p>` : ''}
                ${customers.length > 0 ? `<p style="margin: 5px 0;">• Customers: ${customers.join(', ')}</p>` : ''}
                ${stores.length > 0 ? `<p style="margin: 5px 0;">• Stores: ${stores.length > 3 ? `${stores.slice(0, 3).join(', ')} +${stores.length - 3} more` : stores.join(', ')}</p>` : ''}
                ${devices.length > 0 ? `<p style="margin: 5px 0;">• Devices: ${devices.length > 3 ? `${devices.slice(0, 3).join(', ')} +${devices.length - 3} more` : devices.join(', ')}</p>` : ''}
            </div>`;
    }
    
    // Battery issues section
    if (alertsByType.battery.length > 0) {
        // Group battery alerts by severity
        const criticalBattery = alertsByType.battery.filter(a => a.severity === 'critical');
        const highBattery = alertsByType.battery.filter(a => a.severity === 'high');
        const normalBattery = alertsByType.battery.filter(a => !a.severity || a.severity === 'normal');
        
        message += `
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #FF3B30;">
                <h3 style="color: #2c3e50; margin: 0 0 5px 0;">🔋 Battery Issues (${alertsByType.battery.length})</h3>`;
        
        if (criticalBattery.length > 0) {
            message += `<p style="margin: 5px 0; color: #FF3B30; font-weight: bold;">Critical Issues:</p>`;
            criticalBattery.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        if (highBattery.length > 0) {
            message += `<p style="margin: 5px 0; color: #FF9500; font-weight: bold;">High Priority Issues:</p>`;
            highBattery.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        if (normalBattery.length > 0) {
            message += `<p style="margin: 5px 0; font-weight: bold;">Normal Issues:</p>`;
            normalBattery.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        message += `</div>`;
    }
    
    // Connectivity issues section
    if (alertsByType.connectivity.length > 0) {
        // Group connectivity alerts by severity
        const criticalConn = alertsByType.connectivity.filter(a => a.severity === 'critical');
        const highConn = alertsByType.connectivity.filter(a => a.severity === 'high');
        const normalConn = alertsByType.connectivity.filter(a => !a.severity || a.severity === 'normal');
        
        message += `
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: ${criticalConn.length > 0 ? '4px solid #FF3B30' : highConn.length > 0 ? '4px solid #FF9500' : '4px solid #3498db'};">
                <h3 style="color: #2c3e50; margin: 0 0 5px 0;">📡 Connectivity Issues (${alertsByType.connectivity.length})</h3>`;
        
        if (criticalConn.length > 0) {
            message += `<p style="margin: 5px 0; color: #FF3B30; font-weight: bold;">Critical Issues:</p>`;
            criticalConn.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        if (highConn.length > 0) {
            message += `<p style="margin: 5px 0; color: #FF9500; font-weight: bold;">High Priority Issues:</p>`;
            highConn.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        if (normalConn.length > 0) {
            message += `<p style="margin: 5px 0; font-weight: bold;">Normal Issues:</p>`;
            normalConn.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        message += `</div>`;
    }
    
    // Error issues section
    if (alertsByType.error.length > 0) {
        // Group error alerts by severity
        const criticalErrors = alertsByType.error.filter(a => a.severity === 'critical');
        const highErrors = alertsByType.error.filter(a => a.severity === 'high');
        const normalErrors = alertsByType.error.filter(a => !a.severity || a.severity === 'normal');
        
        message += `
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: ${criticalErrors.length > 0 ? '4px solid #FF3B30' : highErrors.length > 0 ? '4px solid #FF9500' : '4px solid #3498db'};">
                <h3 style="color: #2c3e50; margin: 0 0 5px 0;">⚠️ Errors (${alertsByType.error.length})</h3>`;
        
        if (criticalErrors.length > 0) {
            message += `<p style="margin: 5px 0; color: #FF3B30; font-weight: bold;">Critical Errors:</p>`;
            criticalErrors.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        if (highErrors.length > 0) {
            message += `<p style="margin: 5px 0; color: #FF9500; font-weight: bold;">High Priority Errors:</p>`;
            highErrors.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        if (normalErrors.length > 0) {
            message += `<p style="margin: 5px 0; font-weight: bold;">Normal Errors:</p>`;
            normalErrors.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        message += `</div>`;
    }
    
    // Other issues section
    if (alertsByType.other.length > 0) {
        // Group other alerts by severity
        const criticalOther = alertsByType.other.filter(a => a.severity === 'critical');
        const highOther = alertsByType.other.filter(a => a.severity === 'high');
        const normalOther = alertsByType.other.filter(a => !a.severity || a.severity === 'normal');
        
        message += `
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: ${criticalOther.length > 0 ? '4px solid #FF3B30' : highOther.length > 0 ? '4px solid #FF9500' : '4px solid #3498db'};">
                <h3 style="color: #2c3e50; margin: 0 0 5px 0;">ℹ️ Other Issues (${alertsByType.other.length})</h3>`;
        
        if (criticalOther.length > 0) {
            message += `<p style="margin: 5px 0; color: #FF3B30; font-weight: bold;">Critical Issues:</p>`;
            criticalOther.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        if (highOther.length > 0) {
            message += `<p style="margin: 5px 0; color: #FF9500; font-weight: bold;">High Priority Issues:</p>`;
            highOther.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        if (normalOther.length > 0) {
            message += `<p style="margin: 5px 0; font-weight: bold;">Normal Issues:</p>`;
            normalOther.forEach(alert => {
                message += `<p style="margin: 5px 0;">• ${alert.deviceName || 'Unknown device'}${alert.store ? ` at ${alert.store}` : ''}${alert.storeName ? ` (${alert.storeName})` : ''}: ${alert.message}</p>`;
            });
        }
        
        message += `</div>`;
    }
    
    // Actions section
    message += `
        <div style="background-color: #e9ecef; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <h3 style="color: #2c3e50; margin: 0 0 5px 0;">🛠️ Actions Required</h3>`;
    
    if (alertsBySeverity.critical.length > 0) {
        message += `<p style="margin: 5px 0; color: #FF3B30;"><strong>• IMMEDIATE ACTION REQUIRED</strong></p>`;
    }
    
    if (alertsByType.battery.length > 0) {
        message += `<p style="margin: 5px 0;">• Replace or charge batteries in affected devices</p>`;
    }
    
    if (alertsByType.connectivity.length > 0) {
        message += `<p style="margin: 5px 0;">• Check network connectivity and device connections</p>`;
        message += `<p style="margin: 5px 0;">• Verify router and network equipment status</p>`;
    }
    
    if (alertsByType.error.length > 0) {
        message += `<p style="margin: 5px 0;">• Review system logs and perform troubleshooting</p>`;
        message += `<p style="margin: 5px 0;">• Contact support if issues persist</p>`;
    }
    
    message += `</div>`;
    
    // Footer section
    message += `
        <div style="padding-top: 10px; text-align: center; margin-top: 10px; border-top: 1px solid #dee2e6;">
            <p style="color: #7f8c8d; font-size: 12px; margin: 5px 0;">
                This is an automated notification from Fossa Monitor.
            </p>
        </div>
    </div>
</div>`;

    // Create a title based on the most severe alert type and severity
    let title = 'Fossa Monitor Alert';
    
    if (alertsBySeverity.critical.length > 0) {
        title = `🚨 CRITICAL ALERT: `;
        if (alertsByType.battery.length > 0 && alertsByType.battery.some(a => a.severity === 'critical')) {
            title += `Battery Issues`;
        } else if (alertsByType.connectivity.length > 0 && alertsByType.connectivity.some(a => a.severity === 'critical')) {
            title += `Connectivity Issues`;
        } else if (alertsByType.error.length > 0 && alertsByType.error.some(a => a.severity === 'critical')) {
            title += `System Errors`;
        } else {
            title += `Multiple Issues`;
        }
    } else if (alertsBySeverity.high.length > 0) {
        title = `⚠️ HIGH PRIORITY: `;
        if (alertsByType.battery.length > 0 && alertsByType.battery.some(a => a.severity === 'high')) {
            title += `Battery Issues`;
        } else if (alertsByType.connectivity.length > 0 && alertsByType.connectivity.some(a => a.severity === 'high')) {
            title += `Connectivity Issues`;
        } else if (alertsByType.error.length > 0 && alertsByType.error.some(a => a.severity === 'high')) {
            title += `System Errors`;
        } else {
            title += `Multiple Issues`;
        }
    } else {
        if (alertsByType.battery.length > 0) {
            title = `🔋 Battery Alert - ${alertsByType.battery.length} Device${alertsByType.battery.length > 1 ? 's' : ''}`;
        } else if (alertsByType.connectivity.length > 0) {
            title = `📡 Connectivity Alert - ${alertsByType.connectivity.length} Device${alertsByType.connectivity.length > 1 ? 's' : ''}`;
        } else if (alertsByType.error.length > 0) {
            title = `⚠️ Error Alert - ${alertsByType.error.length} Device${alertsByType.error.length > 1 ? 's' : ''}`;
        }
    }
    
    // Add customer name to title if only one customer is affected
    if (customers.length === 1) {
        title += ` - ${customers[0]}`;
    }

    // Generate a dashboard URL with relevant filters
    const dashboardURL = process.env.DASHBOARD_BASE_URL 
        ? `${process.env.DASHBOARD_BASE_URL}/alerts?timestamp=${Date.now()}&severity=${
            alertsBySeverity.critical.length > 0 ? 'critical' : 
            alertsBySeverity.high.length > 0 ? 'high' : 'normal'
          }` 
        : '';

    const promises = [];
    for (const user of userArray) {
        if (user.pushoverKey) {
            try {
                // Select sound based on user preferences if available
                let userSound = sound;
                if (user.preferences?.sounds) {
                    if (alertsBySeverity.critical.length > 0 && user.preferences.sounds.critical) {
                        userSound = user.preferences.sounds.critical;
                    } else if (alertsBySeverity.high.length > 0 && user.preferences.sounds.high) {
                        userSound = user.preferences.sounds.high;
                    } else if (user.preferences.sounds.default) {
                        userSound = user.preferences.sounds.default;
                    }
                }
                
                // Create enhanced notification parameters
                const params = createPushoverParams(
                    {
                        message,
                        title,
                        user: user.pushoverKey,
                        priority,
                        sound: userSound
                    },
                    {
                        url: dashboardURL,
                        url_title: 'View in Dashboard',
                        timestamp: Math.floor(Date.now() / 1000),
                        device: user.deviceId // Send to specific device if configured
                    }
                );
                
                const response = await axios.post('https://api.pushover.net/1/messages.json', params);
                console.log(`Successfully sent Pushover notification to user ${user.id || 'unknown'}`);
                promises.push(response);
            } catch (error) {
                console.error(`Failed to send Pushover notification to user ${user.id || 'unknown'}:`, error.message);
                promises.push(Promise.resolve({ error: error.message }));
            }
        }
    }

    return Promise.all(promises);
}

/**
 * Creates enhanced Pushover notification parameters with URL and timestamp
 * @param {Object} options - Basic notification options
 * @param {string} options.message - The notification message (can include HTML)
 * @param {string} options.title - The notification title
 * @param {string} options.user - The user's Pushover key
 * @param {number} [options.priority=0] - Priority level (-2 to 2)
 * @param {string} [options.sound='pushover'] - Sound to play
 * @param {Object} [enhancedOptions] - Additional enhanced options
 * @param {string} [enhancedOptions.url] - URL to open when tapping the notification
 * @param {string} [enhancedOptions.url_title] - Text for the URL button
 * @param {number} [enhancedOptions.timestamp] - Unix timestamp for the notification
 * @param {string} [enhancedOptions.device] - Target specific device
 * @returns {Object} - Complete notification parameters
 */
export function createPushoverParams(options, enhancedOptions = {}) {
    const params = {
        message: options.message,
        title: options.title,
        user: options.user,
        token: process.env.PUSHOVER_APP_TOKEN,
        priority: options.priority || 0,
        sound: options.sound || 'pushover',
        html: 1 // Enable HTML formatting
    };
    
    // Add URL parameters if provided
    if (enhancedOptions.url) {
        params.url = enhancedOptions.url;
        params.url_title = enhancedOptions.url_title || 'View Details';
    }
    
    // Add timestamp if provided, otherwise use current time
    params.timestamp = enhancedOptions.timestamp || Math.floor(Date.now() / 1000);
    
    // Add device target if specified
    if (enhancedOptions.device) {
        params.device = enhancedOptions.device;
    }
    
    // If it's an emergency priority (2), add retry and expire parameters
    if (params.priority === 2) {
        params.retry = enhancedOptions.retry || 300; // Retry every 5 minutes by default
        params.expire = enhancedOptions.expire || 10800; // Expire after 3 hours by default
    }
    
    return params;
}

// Format message for schedule changes
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
        
        // Add date changes with more compact format
        const dateChanges = changes.allChanges.filter(change => change.type === 'date_changed');
        if (dateChanges.length > 0) {
            for (const change of dateChanges) {
                message += `<b><font color="#FF9500">━━━</font></b>\n`;
                message += `<b>📅 Date Changed</b>\n`;
                
                // Combine visit ID and store on same line
                const visitId = getVisitId(change.jobId);
                message += `<b>#${visitId}</b> | ${change.store}\n`;
                
                // Create a compact location display
                let mapUrl;
                let displayAddress;
                
                if (change.address) {
                    // Just use city for display to save space
                    if (change.address.cityState) {
                        displayAddress = change.address.cityState.split(' ')[0]; // Just the city
                    } else if (change.location) {
                        displayAddress = change.location;
                    } else {
                        displayAddress = 'Unknown';
                    }
                    
                    // Create Google Maps URL
                    const fullAddress = [
                        change.address.street, 
                        change.address.cityState, 
                        change.address.county
                    ].filter(Boolean).join(', ');
                    
                    mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
                } else {
                    // Fall back to location field
                    mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(change.location || 'Unknown')}`;
                    displayAddress = change.location || 'Unknown';
                }
                
                // Combine location, dispensers, and date changes all on one line
                message += `<b>Location:</b> <a href="${mapUrl}">${displayAddress}</a> | <b>Dispensers:</b> ${change.dispensers || 0}\n`;
                message += `<b>Date:</b> ${change.oldDate} → ${change.newDate}\n`;
            }
        }
        
        // Add swapped jobs with more compact format
        const swappedJobs = changes.allChanges.filter(change => change.type === 'swap');
        if (swappedJobs.length > 0) {
            for (const swap of swappedJobs) {
                message += `<b><font color="#007AFF">━━━</font></b>\n`;
                message += `<b>🔄 Visits Swapped</b>\n`;
                
                // Job 1 - All on one line
                const visitId1 = getVisitId(swap.job1Id);
                const visitId2 = getVisitId(swap.job2Id);
                
                message += `<b>Job 1:</b> #${visitId1} | ${swap.job1Store} | ${swap.job1Location || ''}\n`;
                message += `<b>Date:</b> ${swap.oldDate1} → ${swap.newDate1}\n`;
                
                // Job 2 - All on one line
                message += `<b>Job 2:</b> #${visitId2} | ${swap.job2Store} | ${swap.job2Location || ''}\n`;
                message += `<b>Date:</b> ${swap.oldDate2} → ${swap.newDate2}\n`;
            }
        }
        
        // Add replacement jobs with more compact format
        const replacementJobs = changes.allChanges.filter(change => change.type === 'replacement');
        if (replacementJobs.length > 0) {
            for (const replace of replacementJobs) {
                message += `<b><font color="#AF52DE">━━━</font></b>\n`;
                message += `<b>♻️ Visit Replaced</b>\n`;
                
                // Removed job - All info on two lines
                const removedVisitId = getVisitId(replace.removedJobId);
                message += `<b>Removed:</b> #${removedVisitId} | ${replace.removedStore} | <b>Disp:</b> ${replace.removedDispensers || 0}\n`;
                if (replace.removedLocation) {
                    message += `<b>Location:</b> ${replace.removedLocation}\n`;
                }
                
                // Added job - All info on two lines
                const addedVisitId = getVisitId(replace.addedJobId);
                message += `<b>Added:</b> #${addedVisitId} | ${replace.addedStore} | <b>Disp:</b> ${replace.addedDispensers || 0}\n`;
                if (replace.addedLocation) {
                    message += `<b>Location:</b> ${replace.addedLocation} | <b>Date:</b> ${replace.date}\n`;
                } else {
                    message += `<b>Date:</b> ${replace.date}\n`;
                }
            }
        }
    }

    return message;
} 