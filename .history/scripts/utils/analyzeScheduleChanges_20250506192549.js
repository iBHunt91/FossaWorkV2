// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { compareSchedules } from './scheduleComparator.js';
import { getUsersWithNotificationsEnabled } from '../user/userService.js';
import { info, error } from './logger.js';
import { sendScheduleChangeNotifications } from '../notifications/notificationService.js';
import { saveScheduleChangesTextForUI } from './notificationFormatter.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Analyzes changes between current and previous schedules
 * @param {Object} currentSchedule - The current schedule data
 * @param {Object} previousSchedule - The previous schedule data
 * @param {string} username - The user ID (not username) whose schedule was analyzed
 * @param {boolean} sendNotifications - Whether to send notifications (default: true)
 * @param {boolean} isManual - Whether this is a manual scrape (default: false)
 * @returns {Promise<Object>} - The report of changes
 */
export async function analyzeScheduleChanges(currentSchedule, previousSchedule, username, sendNotifications = true, isManual = false) {
    try {
        info(`Analyzing schedule changes for ${username}...`);
        
        // Validate inputs
        if (!currentSchedule || !currentSchedule.workOrders) {
            error('Invalid current schedule data');
            return null;
        }
        
        // If no previous schedule exists, we can't compare
        if (!previousSchedule || !previousSchedule.workOrders || previousSchedule.workOrders.length === 0) {
            info('No previous schedule to compare against');
            return { 
                allChanges: [], 
                summary: { removed: 0, added: 0, modified: 0, swapped: 0 } 
            };
        }
        
        // Get the user's notification preferences if available
        try {
            const users = await getUsersWithNotificationsEnabled();
            if (!Array.isArray(users)) {
                error('getUsersWithNotificationsEnabled did not return an array');
                return null;
            }
            
            const userPreferences = users.find(user => user.id === username)?.preferences || null;
            
            // Compare the schedules
            const changes = compareSchedules(currentSchedule, previousSchedule, userPreferences, username);
            
            // Archive the changes report if there are any significant changes
            if (changes.summary.removed > 0 || 
                changes.summary.added > 0 || 
                changes.summary.modified > 0 || 
                changes.summary.swapped > 0) {
                
                await archiveChangesReport(changes, username);
                
                // Save notification text for UI display
                await saveScheduleChangesTextForUI(changes, username);
                
                // Log the summary of changes
                info(`Changes detected for ${username}:`, {
                    removed: changes.summary.removed,
                    added: changes.summary.added,
                    modified: changes.summary.modified,
                    swapped: changes.summary.swapped
                });

                // Determine if we should send notifications based on:
                // 1. If sendNotifications parameter is true
                // 2. The type of scrape (manual or automatic)
                
                // Create a flag to track recent notifications
                const notificationsFilePath = path.join(__dirname, '../../data/users', username, 'last_notification.json');
                // Dedicated file for Pushover notifications to prevent duplicates
                const pushoverNotificationsFilePath = path.join(__dirname, '../../data/users', username, 'last_pushover_notification.json');
                
                let shouldSendNotification = sendNotifications;
                let shouldSendPushover = sendNotifications;
                
                if (shouldSendNotification) {
                    // Check for recent notifications (especially for Pushover)
                    try {
                        // Special check for Pushover notifications
                        if (fs.existsSync(pushoverNotificationsFilePath)) {
                            try {
                                const lastPushoverData = JSON.parse(fs.readFileSync(pushoverNotificationsFilePath, 'utf8'));
                                const lastTime = new Date(lastPushoverData.timestamp);
                                const now = new Date();
                                const timeDiff = now - lastTime; // difference in milliseconds
                                
                                // If a Pushover notification was sent in the last 2 minutes, skip sending another one
                                if (timeDiff < 120 * 1000) {
                                    info(`Skipping Pushover notification - another Pushover notification was sent ${Math.round(timeDiff/1000)} seconds ago`);
                                    shouldSendPushover = false;
                                }
                            } catch (err) {
                                error(`Error checking Pushover notification history: ${err.message}`);
                                // Continue with sending as fallback
                            }
                        }
                        
                        // Check for other general notifications
                        if (fs.existsSync(notificationsFilePath)) {
                            const lastNotification = JSON.parse(fs.readFileSync(notificationsFilePath, 'utf8'));
                            const lastTime = new Date(lastNotification.timestamp);
                            const now = new Date();
                            const timeDiff = now - lastTime; // difference in milliseconds
                            
                            // If any notification was sent in the last 60 seconds, skip
                            if (timeDiff < 60 * 1000) {
                                info(`Skipping notification - another notification was sent ${Math.round(timeDiff/1000)} seconds ago`);
                                shouldSendNotification = false;
                                shouldSendPushover = false;
                            }
                        }
                    } catch (err) {
                        error(`Error checking notification history: ${err.message}`);
                        // Continue with sending notifications as a fallback
                    }
                    
                    // If this is a manual scrape and we're still considering sending notifications
                    if (isManual && shouldSendNotification) {
                        // Always send notifications for manual scrapes if requested
                        // And write a timestamp for when notifications were last sent
                        const notificationData = {
                            timestamp: new Date().toISOString(),
                            source: 'manual'
                        };
                        try {
                            fs.writeFileSync(notificationsFilePath, JSON.stringify(notificationData), 'utf8');
                            info(`Updated last notification timestamp for manual scrape`);
                            
                            // Also write the Pushover-specific timestamp
                            if (shouldSendPushover) {
                                try {
                                    fs.writeFileSync(pushoverNotificationsFilePath, JSON.stringify(notificationData), 'utf8');
                                    info(`Updated last Pushover notification timestamp for manual scrape`);
                                } catch (err) {
                                    error(`Failed to write Pushover notification timestamp: ${err.message}`);
                                }
                            }
                        } catch (err) {
                            error(`Failed to write notification timestamp: ${err.message}`);
                        }
                    } else if (!isManual && shouldSendNotification) {
                        // For automatic scrapes, check if a manual notification was sent recently
                        try {
                            if (fs.existsSync(notificationsFilePath)) {
                                const lastNotification = JSON.parse(fs.readFileSync(notificationsFilePath, 'utf8'));
                                const lastTime = new Date(lastNotification.timestamp);
                                const now = new Date();
                                const timeDiff = now - lastTime; // difference in milliseconds
                                
                                // If a manual notification was sent in the last 10 minutes, skip this automatic one
                                if (lastNotification.source === 'manual' && timeDiff < 10 * 60 * 1000) {
                                    info(`Skipping automatic notification - manual notification was sent ${Math.round(timeDiff/1000)} seconds ago`);
                                    shouldSendNotification = false;
                                    shouldSendPushover = false;
                                } else {
                                    // It's been more than 10 minutes, or it wasn't a manual notification
                                    // Update the timestamp for automatic notification
                                    const notificationData = {
                                        timestamp: now.toISOString(),
                                        source: 'automatic'
                                    };
                                    fs.writeFileSync(notificationsFilePath, JSON.stringify(notificationData), 'utf8');
                                    
                                    // Also update the Pushover-specific timestamp file
                                    if (shouldSendPushover) {
                                        try {
                                            fs.writeFileSync(pushoverNotificationsFilePath, JSON.stringify(notificationData), 'utf8');
                                            info(`Updated last Pushover notification timestamp for automatic scrape`);
                                        } catch (err) {
                                            error(`Failed to write Pushover notification timestamp: ${err.message}`);
                                        }
                                    }
                                }
                            } else {
                                // No previous notification, go ahead and send
                                const notificationData = {
                                    timestamp: new Date().toISOString(),
                                    source: 'automatic'
                                };
                                fs.writeFileSync(notificationsFilePath, JSON.stringify(notificationData), 'utf8');
                                
                                // Also create the Pushover-specific timestamp file
                                if (shouldSendPushover) {
                                    try {
                                        fs.writeFileSync(pushoverNotificationsFilePath, JSON.stringify(notificationData), 'utf8');
                                        info(`Created Pushover notification timestamp for automatic scrape`);
                                    } catch (err) {
                                        error(`Failed to create Pushover notification timestamp: ${err.message}`);
                                    }
                                }
                            }
                        } catch (err) {
                            error(`Error checking notification history: ${err.message}`);
                            // Continue with sending the notification as a fallback
                        }
                    }
                }
                
                if (shouldSendNotification) {
                    // Find only the specific user whose schedule changed, not all users with notifications enabled
                    const specificUserForNotification = users.find(user => user.id === username);
                    
                    if (!specificUserForNotification) {
                        info(`Cannot find user with ID ${username} for notifications`);
                        return changes;
                    }
                    
                    // Check if the user has a configuredEmail in the userManager
                    try {
                        const userManagerPath = path.resolve(process.cwd(), 'data', 'users', 'users.json');
                        if (fs.existsSync(userManagerPath)) {
                            const userManagerData = JSON.parse(fs.readFileSync(userManagerPath, 'utf8'));
                            if (Array.isArray(userManagerData)) {
                                const userFromManager = userManagerData.find(u => u.id === username);
                                if (userFromManager && userFromManager.configuredEmail) {
                                    info(`Found configuredEmail ${userFromManager.configuredEmail} for user ${username}`);
                                    // Update the email to use the configured one
                                    specificUserForNotification.email = userFromManager.configuredEmail;
                                } else if (userFromManager) {
                                    info(`No configuredEmail found in users.json for user ${username}, checking user-specific email settings`);
                                    
                                    // Try to check user-specific email-settings.json
                                    try {
                                        const userEmailSettingsPath = path.resolve(process.cwd(), 'data', 'users', username, 'email_settings.json');
                                        if (fs.existsSync(userEmailSettingsPath)) {
                                            const userEmailSettings = JSON.parse(fs.readFileSync(userEmailSettingsPath, 'utf8'));
                                            if (userEmailSettings && userEmailSettings.recipientEmail) {
                                                info(`Found recipientEmail ${userEmailSettings.recipientEmail} in email_settings.json for user ${username}`);
                                                specificUserForNotification.email = userEmailSettings.recipientEmail;
                                                
                                                // Update users.json for future consistency
                                                userFromManager.configuredEmail = userEmailSettings.recipientEmail;
                                                fs.writeFileSync(userManagerPath, JSON.stringify(userManagerData, null, 2), 'utf8');
                                                info(`Updated users.json with configuredEmail from email_settings.json`);
                                            }
                                        } else {
                                            // Try alternative filename (with hyphen instead of underscore)
                                            const altEmailSettingsPath = path.resolve(process.cwd(), 'data', 'users', username, 'email-settings.json');
                                            if (fs.existsSync(altEmailSettingsPath)) {
                                                const userEmailSettings = JSON.parse(fs.readFileSync(altEmailSettingsPath, 'utf8'));
                                                if (userEmailSettings && userEmailSettings.recipientEmail) {
                                                    info(`Found recipientEmail ${userEmailSettings.recipientEmail} in email-settings.json for user ${username}`);
                                                    specificUserForNotification.email = userEmailSettings.recipientEmail;
                                                    
                                                    // Update users.json for future consistency
                                                    userFromManager.configuredEmail = userEmailSettings.recipientEmail;
                                                    fs.writeFileSync(userManagerPath, JSON.stringify(userManagerData, null, 2), 'utf8');
                                                    info(`Updated users.json with configuredEmail from email-settings.json`);
                                                }
                                            } else {
                                                info(`No email settings file found for user ${username}, using default email`);
                                            }
                                        }
                                    } catch (emailSettingsError) {
                                        error(`Error checking user email settings: ${emailSettingsError.message}`);
                                    }
                                } else {
                                    error(`User with ID ${username} not found in users.json`);
                                }
                            } else {
                                error(`users.json does not contain a valid array of users`);
                            }
                        } else {
                            error(`User manager file not found at expected path: ${userManagerPath}`);
                            
                            // Try an alternative path as fallback
                            const altPath = path.join(process.cwd(), '..', 'data', 'users', 'users.json');
                            if (fs.existsSync(altPath)) {
                                info(`Found users.json at alternate path: ${altPath}`);
                                try {
                                    const userData = JSON.parse(fs.readFileSync(altPath, 'utf8'));
                                    if (Array.isArray(userData)) {
                                        const userFromAlt = userData.find(u => u.id === username);
                                        if (userFromAlt && userFromAlt.configuredEmail) {
                                            info(`Found configuredEmail ${userFromAlt.configuredEmail} at alternate path`);
                                            specificUserForNotification.email = userFromAlt.configuredEmail;
                                        }
                                    }
                                } catch (altError) {
                                    error(`Error reading alternate users file: ${altError.message}`);
                                }
                            }
                        }
                    } catch (err) {
                        error(`Error checking for configured email: ${err.message}`);
                        // Continue with the existing email
                    }
                    
                    // Pass the shouldSendPushover flag to control Pushover notifications specifically
                    const notificationResult = await sendScheduleChangeNotifications(changes, specificUserForNotification, shouldSendPushover);
                if (notificationResult.success) {
                        info(`Notifications sent successfully (${isManual ? 'manual' : 'automatic'} scrape)`);
                    } else {
                        error('Failed to send notifications:', notificationResult.error);
                    }
                } else {
                    info('Skipping notifications based on parameters or recent manual notification');
                }
            } else {
                info(`No significant changes detected for ${username}`);
            }
            
            return changes;
        } catch (err) {
            error(`Error getting user preferences: ${err.message}`, err);
            // Continue with comparison without user preferences
            const changes = compareSchedules(currentSchedule, previousSchedule, null);
            return changes;
        }
    } catch (err) {
        error(`Error analyzing schedule changes: ${err.message}`, err);
        throw err;
    }
}

/**
 * Archives the changes report to a file
 * @param {Object} changes - The changes report
 * @param {string} username - The username for the archive path
 * @returns {Promise<void>}
 */
async function archiveChangesReport(changes, username) {
    try {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const userDir = path.join(__dirname, '../../data/users', username);
        const archiveDir = path.join(userDir, 'archives');
        
        // Create the archive directory if it doesn't exist
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }
        
        const archivePath = path.join(archiveDir, `changes_${timestamp}.json`);
        
        // Add metadata to the changes
        const reportWithMetadata = {
            timestamp: new Date().toISOString(),
            changes: changes
        };
        
        // Write the report to the archive
        await fs.promises.writeFile(archivePath, JSON.stringify(reportWithMetadata, null, 2), 'utf8');
        info(`Archived changes report to ${archivePath}`);
        
        // Also append to the consolidated change_history.json file
        const historyFilePath = path.join(userDir, 'change_history.json');
        
        try {
            let historyData = [];
            
            // Load existing history if available
            if (fs.existsSync(historyFilePath)) {
                try {
                    const historyContent = await fs.promises.readFile(historyFilePath, 'utf8');
                    historyData = JSON.parse(historyContent);
                    
                    // Ensure it's an array
                    if (!Array.isArray(historyData)) {
                        info(`Converting change_history.json to array format for ${username}`);
                        historyData = [historyData];
                    }
                } catch (readError) {
                    error(`Error reading change_history.json for ${username}: ${readError.message}`);
                    // Continue with an empty array
                    historyData = [];
                }
            }
            
            // Check for duplicates by timestamp
            const existingTimestamps = new Set(historyData.map(entry => entry.timestamp));
            if (!existingTimestamps.has(reportWithMetadata.timestamp)) {
                // Add the new report
                historyData.push(reportWithMetadata);
                
                // Sort by timestamp (newest first)
                historyData.sort((a, b) => {
                    const dateA = new Date(a.timestamp);
                    const dateB = new Date(b.timestamp);
                    return dateB - dateA;
                });
                
                // Write the updated history
                await fs.promises.writeFile(historyFilePath, JSON.stringify(historyData, null, 2), 'utf8');
                info(`Updated consolidated change_history.json for ${username}`);
            } else {
                info(`Entry with timestamp ${reportWithMetadata.timestamp} already exists in change_history.json`);
            }
        } catch (historyError) {
            error(`Error updating change_history.json for ${username}: ${historyError.message}`);
            // Non-critical, continue execution
        }
    } catch (err) {
        error(`Error archiving changes report: ${err.message}`, err);
        // Don't throw the error, as this is a non-critical operation
    }
} 