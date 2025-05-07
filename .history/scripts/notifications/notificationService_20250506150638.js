import { sendScheduleChangeEmail, sendTestEmail } from './emailService.js';
import { sendScheduleChangePushover } from '../pushover/pushoverService.js';
import { sendTestPushoverNotification, getUserPushoverSettings } from './pushoverService.js.bak';
import { getUserEmailSettings } from '../email/emailSettings.js';
import { processNotificationByFrequency } from './notificationScheduler.js';
import { 
    getUserPreferences, 
    getUserNotificationSettings, 
    loadUsers, 
    DEFAULT_PREFERENCES,
    DEFAULT_NOTIFICATION_SETTINGS
} from '../user/userService.js';
import path from 'path';
import fs from 'fs';

// Add a simple notification cache to prevent duplicate notifications
// This cache will store a hash of the notification content and timestamp
const notificationCache = {
    pushover: {},
    email: {}
};

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Generate a simple hash for notification content
function generateNotificationHash(changes, userId) {
    const summary = changes.summary ? 
        `${changes.summary.added || 0}-${changes.summary.removed || 0}-${changes.summary.modified || 0}-${changes.summary.swapped || 0}` : 
        'unknown';
    
    // Include specific job IDs if available for more precise deduplication
    const jobIds = changes.allChanges ? 
        changes.allChanges.map(c => c.jobId || c.addedJobId || c.removedJobId || 'unknown').join('-') :
        'none';
    
    return `${userId}-${summary}-${jobIds}`;
}

// Check if a notification was recently sent
function wasRecentlySent(type, changes, userId) {
    const hash = generateNotificationHash(changes, userId);
    const cache = notificationCache[type];
    
    if (!cache[hash]) {
        return false;
    }
    
    const timestamp = cache[hash];
    const now = Date.now();
    
    // Check if the cached notification is still valid (not expired)
    if (now - timestamp < CACHE_EXPIRATION) {
        console.log(`Skipping duplicate ${type} notification: recently sent (${Math.round((now - timestamp)/1000)}s ago)`);
        return true;
    }
    
    // Cache entry expired, remove it
    delete cache[hash];
    return false;
}

// Record that a notification was sent
function recordNotificationSent(type, changes, userId) {
    const hash = generateNotificationHash(changes, userId);
    notificationCache[type][hash] = Date.now();
}

/**
 * Send notifications about schedule changes through all configured channels
 * @param {Object} changes - Object containing changes to notify about
 * @param {Object|null} specificUser - Optional specific user to send notification to
 * @param {boolean} shouldSendPushover - Whether to send Pushover notifications (default: true)
 * @returns {Promise<Object>} - Results from all notification methods
 */
export async function sendScheduleChangeNotifications(changes, specificUser = null, shouldSendPushover = true) {
    // Log the change data for debugging
    console.log('CHANGE DETAILS:', JSON.stringify(changes, null, 2));
    
    const results = {
        email: null,
        pushover: null
    };

    try {
        // Get users to notify
        let users = [];
        if (specificUser) {
            users = [specificUser];
        } else {
            users = await getUsersWithNotificationsEnabled();
        }

        console.log('Users to notify:', users.map(u => ({ id: u.id, email: u.email })));

        if (!users || users.length === 0) {
            console.log('No users to notify');
            return { success: true, results };
        }

        // Send notifications to each user
        for (const user of users) {
            const notificationSettings = user.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
            const userPreferences = user.preferences || DEFAULT_PREFERENCES;

            console.log(`Processing notifications for user ${user.id}:`, {
                emailEnabled: notificationSettings.email?.enabled,
                pushoverEnabled: notificationSettings.pushover?.enabled
            });

            // Filter changes based on user preferences
            const filteredChanges = filterChangesForUser(changes, userPreferences);

            // Skip if no relevant changes for this user
            if (!filteredChanges.allChanges || filteredChanges.allChanges.length === 0) {
                console.log(`No relevant changes for user ${user.id}`);
                continue;
            }

            // Send email if enabled - using frequency-based processing
            if (notificationSettings.email?.enabled) {
                try {
                    let userWithEmail = user;
                    // If user is undefined or missing email, load from user settings
                    if (!userWithEmail || !userWithEmail.email) {
                        const emailSettings = await getUserEmailSettings();
                        userWithEmail = {
                            ...(userWithEmail || {}),
                            email: emailSettings.recipientEmail,
                            id: userWithEmail?.id || 'unknown',
                            preferences: userWithEmail?.preferences || userPreferences,
                            notificationSettings: userWithEmail?.notificationSettings || notificationSettings
                        };
                    }
                    
                    // Skip if no email recipient configured
                    if (!userWithEmail.email) {
                        console.log(`No recipient email configured for user ${userWithEmail.id}, skipping email notification`);
                        results.email = { success: false, error: 'No recipient email configured' };
                        continue;
                    }
                    
                    // CRITICAL FIX: Explicitly load notification settings from database for this user
                    // This ensures we get the correct frequency setting
                    const userNotificationSettings = await getUserNotificationSettings(userWithEmail.id);
                    console.log(`Retrieved notification settings from database for user ${userWithEmail.id}:`, 
                      JSON.stringify(userNotificationSettings, null, 2));
                    
                    // Make sure user has all necessary information
                    // Important: make sure user has a label or name for display in email greeting
                    const completeUser = {
                        ...userWithEmail,
                        // Get user's label from user manager if possible
                        label: userWithEmail.label || userWithEmail.name || userWithEmail.email?.split('@')[0] || 'User',
                        // Use the explicitly loaded notification settings
                        notificationSettings: userNotificationSettings
                    };
                    
                    // Try to get a better user display name from userManager
                    try {
                        // Use relative path instead of __dirname to avoid the error
                        const userManagerPath = path.resolve(process.cwd(), 'data', 'users', 'users.json');
                        console.log(`Looking for user manager file at: ${userManagerPath}`);
                        
                        if (fs.existsSync(userManagerPath)) {
                            console.log(`Found user manager file at: ${userManagerPath}`);
                            const userManagerData = fs.readFileSync(userManagerPath, 'utf8');
                            const userManagerUsers = JSON.parse(userManagerData);
                            
                            console.log(`Loaded ${userManagerUsers.length} users from user manager`);
                            
                            if (Array.isArray(userManagerUsers)) {
                                // Find the user by ID or email
                                const foundUser = userManagerUsers.find(u => 
                                    u.id === completeUser.id || 
                                    u.email === completeUser.email
                                );
                                
                                console.log(`Looking for user with ID: ${completeUser.id} or email: ${completeUser.email}`);
                                
                                if (foundUser) {
                                    console.log(`Found user in user manager with ID: ${foundUser.id}, email: ${foundUser.email}`);
                                    
                                    if (foundUser.label) {
                                        completeUser.label = foundUser.label;
                                        console.log(`Found display name "${foundUser.label}" from user manager`);
                                    }
                                    
                                    // Check for configured email in user settings (highest priority)
                                    // This ensures we use the email from settings rather than hardcoded email
                                    if (foundUser.configuredEmail) {
                                        console.log(`Found configuredEmail: ${foundUser.configuredEmail} for user ${foundUser.id}`);
                                        console.log(`Using configured email address ${foundUser.configuredEmail} instead of default ${completeUser.email}`);
                                        completeUser.email = foundUser.configuredEmail;
                                    } else {
                                        console.log(`No configuredEmail found for user ${foundUser.id}`);
                                        
                                        // Try to check the user-specific email-settings.json as a fallback
                                        try {
                                            const userEmailSettingsPath = path.resolve(process.cwd(), 'data', 'users', foundUser.id, 'email-settings.json');
                                            
                                            if (fs.existsSync(userEmailSettingsPath)) {
                                                const userEmailSettings = JSON.parse(fs.readFileSync(userEmailSettingsPath, 'utf8'));
                                                
                                                if (userEmailSettings && userEmailSettings.recipientEmail) {
                                                    console.log(`Found recipientEmail in email-settings.json: ${userEmailSettings.recipientEmail}`);
                                                    completeUser.email = userEmailSettings.recipientEmail;
                                                    
                                                    // Also update the users.json file to ensure consistency
                                                    foundUser.configuredEmail = userEmailSettings.recipientEmail;
                                                    fs.writeFileSync(userManagerPath, JSON.stringify(userManagerUsers, null, 2), 'utf8');
                                                    console.log(`Updated users.json with configuredEmail from email-settings.json`);
                                                }
                                            }
                                        } catch (emailSettingsError) {
                                            console.warn(`Error checking user-specific email settings: ${emailSettingsError.message}`);
                                        }
                                    }
                                } else {
                                    console.log(`Could not find user with ID: ${completeUser.id} or email: ${completeUser.email} in user manager`);
                                }
                            }
                        } else {
                            console.warn(`User manager file not found at: ${userManagerPath}`);
                            
                            // Try alternate path resolution as a fallback
                            const altPath = path.join(process.cwd(), '..', 'data', 'users', 'users.json');
                            if (fs.existsSync(altPath)) {
                                console.log(`Found alternate users.json at: ${altPath}`);
                                try {
                                    const userData = JSON.parse(fs.readFileSync(altPath, 'utf8'));
                                    const foundUser = userData.find(u => u.id === completeUser.id || u.email === completeUser.email);
                                    
                                    if (foundUser && foundUser.configuredEmail) {
                                        console.log(`Found configuredEmail: ${foundUser.configuredEmail} at alternate path`);
                                        completeUser.email = foundUser.configuredEmail;
                                    }
                                } catch (altError) {
                                    console.warn(`Error reading alternate users file: ${altError.message}`);
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Error getting user display name from user manager:', err);
                    }
                    
                    // The notification settings are now explicitly included in the completeUser object above
                    // So we don't need to restore them here anymore
                    
                    // Make sure the frequency setting is explicitly set and properly logged
                    console.log('User notification settings before processing:');
                    console.log('- Email enabled:', completeUser.notificationSettings?.email?.enabled);
                    console.log('- Email frequency:', completeUser.notificationSettings?.email?.frequency);
                    
                    console.log(`Processing email notification for ${completeUser.email} with label: ${completeUser.label}`);
                    
                    // Debug log to check notification frequency
                    console.log(`User ${completeUser.id} notification frequency: ${completeUser.notificationSettings?.email?.frequency || 'unknown'}`);
                    
                    // Process notification based on frequency preference
                    const emailResult = await processNotificationByFrequency(filteredChanges, completeUser);
                    
                    // Debug log for the result type
                    console.log(`Email notification processing result for user ${completeUser.id}: ${emailResult.type || 'unknown'}`);
                    
                    results.email = emailResult;
                    
                    // Log the result
                    if (emailResult.success) {
                        if (emailResult.type === 'immediate' || emailResult.type === 'immediate_fallback') {
                            console.log(`Email notification sent successfully to ${completeUser.email}`);
                            // Record that the notification was sent to prevent duplicates
                            recordNotificationSent('email', filteredChanges, completeUser.id);
                        } else if (emailResult.type === 'daily_digest_stored') {
                            console.log(`Changes stored for daily digest for user ${completeUser.id}`);
                        }
                    } else {
                        console.error(`Error sending email notification to ${completeUser.email}:`, emailResult.error);
                    }
                    
                } catch (err) {
                    console.error('Error sending email notification:', err);
                    results.email = { success: false, error: err.message || err };
                }
            }

            // Send Pushover notification if enabled (no frequency options for Pushover - always immediate)
            if (shouldSendPushover && notificationSettings.pushover?.enabled) {
                try {
                    // Skip if we already sent this notification recently
                    if (wasRecentlySent('pushover', filteredChanges, user.id)) {
                        console.log(`Skipping duplicate Pushover notification for user ${user.id}`);
                        results.pushover = { success: true, skipped: true, reason: 'duplicate' };
                        continue;
                    }
                    
                    console.log(`Sending Pushover notification to user ${user.id}`);
                    const pushoverResult = await sendScheduleChangePushover(filteredChanges, user);
                    
                    if (pushoverResult.success) {
                        console.log(`Pushover notification sent successfully to user ${user.id}`);
                        // Record that we sent this notification
                        recordNotificationSent('pushover', filteredChanges, user.id);
                    } else {
                        console.error(`Error sending Pushover notification:`, pushoverResult.error);
                    }
                    
                    results.pushover = pushoverResult;
                } catch (err) {
                    console.error('Error sending Pushover notification:', err);
                    results.pushover = { success: false, error: err.message || err };
                }
            }
        }

        return { success: true, results };
    } catch (error) {
        console.error('Error sending notifications:', error);
        return { success: false, error: error.message || error, results };
    }
}

/**
 * Get users who have notifications enabled
 * @returns {Promise<Array>} - Array of users with notification preferences
 */
async function getUsersWithNotificationsEnabled() {
    try {
        // Load all users from the user store
        const users = await loadUsers();
        if (!users || users.length === 0) {
            console.log('No users found in the system');
            return [];
        }

        // Filter users who have notifications enabled
        const usersWithNotifications = [];
        
        for (const user of users) {
            // Get notification settings for the user
            const notificationSettings = user.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
            
            // Only include users with notifications enabled
            if (notificationSettings.enabled) {
                // Get Pushover settings
                const pushoverSettings = getUserPushoverSettings();
                
                // Enable Pushover by default if credentials exist
                const pushoverEnabled = !!pushoverSettings.appToken && !!pushoverSettings.userKey;
                
                // Attempt to get the user's name from various properties
                // This is essential for personalized email greetings
                const userLabel = user.label || user.name || user.friendlyName || user.email;
                
                // Create the complete user object with all required properties
                usersWithNotifications.push({
                    id: user.id,
                    email: user.email,
                    label: userLabel, // Include label for personalized greeting
                    pushoverKey: pushoverSettings.userKey,
                    preferences: user.preferences || DEFAULT_PREFERENCES,
                    notificationSettings: {
                        ...notificationSettings,
                        pushover: {
                            ...notificationSettings.pushover,
                            enabled: pushoverEnabled // Override with true if credentials exist
                        }
                    }
                });
            }
        }
        
        if (usersWithNotifications.length === 0) {
            console.log('No users have notifications enabled');
            return [];
        }
        
        return usersWithNotifications;
    } catch (error) {
        console.error('Error getting users with notifications enabled:', error);
        return [];
    }
}

/**
 * Filter changes based on user preferences
 * @param {Object} changes - Original changes object
 * @param {Object} userPreferences - User's notification preferences
 * @returns {Object} - Filtered changes object
 */
function filterChangesForUser(changes, userPreferences) {
    const filteredChanges = {
        allChanges: [],
        summary: { ...changes.summary }
    };

    // Get user notification preferences
    const notificationPrefs = userPreferences?.notifications || {};
    const filters = notificationPrefs.filters || {
        stores: [],
        locations: [],
        severity: ['critical', 'high']
    };

    // If user has disabled schedule change notifications, return empty changes
    if (notificationPrefs.scheduleChanges === false) {
        return filteredChanges;
    }

    // If there are no allChanges array, but there are critical/high arrays, combine them
    // for backward compatibility
    if (!changes.allChanges && (changes.critical || changes.high)) {
        const allChanges = [
            ...(changes.critical || []),
            ...(changes.high || []),
            ...(changes.medium || []),
            ...(changes.low || [])
        ];
        
        // Filter combined changes by store and location
        filteredChanges.allChanges = filterChangesByStoreAndLocation(allChanges, filters);
    } else {
        // Use the new allChanges array
        filteredChanges.allChanges = filterChangesByStoreAndLocation(changes.allChanges || [], filters);
    }

    // Update summary counts
    filteredChanges.summary.removed = filteredChanges.allChanges.filter(c => c.type === 'removed').length;
    filteredChanges.summary.added = filteredChanges.allChanges.filter(c => c.type === 'added').length;
    filteredChanges.summary.modified = filteredChanges.allChanges.filter(c => c.type === 'date_changed').length;
    filteredChanges.summary.swapped = filteredChanges.allChanges.filter(c => c.type === 'swap').length;
    filteredChanges.summary.replaced = filteredChanges.allChanges.filter(c => c.type === 'replacement').length;

    return filteredChanges;
}

/**
 * Filter a list of changes by store and location
 * @param {Array} changesList - List of changes to filter
 * @param {Object} filters - Filters to apply (stores, locations)
 * @returns {Array} - Filtered list of changes
 */
function filterChangesByStoreAndLocation(changesList, filters) {
    if (!changesList || changesList.length === 0) {
        return [];
    }

    // If no store or location filters, return all changes
    if ((!filters.stores || filters.stores.length === 0) && 
        (!filters.locations || filters.locations.length === 0)) {
        return changesList;
    }

    // Filter changes by store and location
    return changesList.filter(change => {
        // Get store number from change
        const storeNumber = change.store || 
                           change.job1Store || 
                           (change.customer?.storeNumber || '').toString();
        
        // Get location from change
        const location = change.location || 
                        change.job1Location || 
                        (change.customer?.city || '').toString();

        // Check if the change matches any of the store filters
        const matchesStore = !filters.stores || 
                            filters.stores.length === 0 || 
                            filters.stores.some(s => storeNumber.includes(s));

        // Check if the change matches any of the location filters
        const matchesLocation = !filters.locations || 
                               filters.locations.length === 0 || 
                               filters.locations.some(l => location.toLowerCase().includes(l.toLowerCase()));

        // Return true if either store or location matches
        return matchesStore || matchesLocation;
    });
}

/**
 * Send test notifications through all configured channels
 * @returns {Promise<Object>} - Results from all notification methods
 */
export async function sendTestNotifications() {
    const results = {
        email: null,
        pushover: null
    };

    try {
        // Create a test user with the necessary information from getUserEmailSettings
        const emailSettings = await getUserEmailSettings();
        const testUser = {
            id: 'test-user',
            email: emailSettings.recipientEmail || process.env.TEST_EMAIL || '',
            preferences: {},
            notificationSettings: {
                email: {
                    enabled: true,
                    cc: ''
                }
            }
        };

        // Send test email with more robust error handling
        const emailResult = await sendTestEmail();
        console.log('Test email result:', emailResult);
        results.email = emailResult;
    } catch (error) {
        console.error('Error sending test email:', error);
        results.email = { success: false, error: error.message || String(error) };
    }

    try {
        // Send test Pushover notification
        const pushoverResult = await sendTestPushoverNotification();
        results.pushover = pushoverResult;
    } catch (error) {
        console.error('Error sending test Pushover notification:', error);
        results.pushover = { success: false, error: error.message || String(error) };
    }

    // Determine overall success
    const success = results.email?.success || results.pushover?.success;
    
    return {
        success,
        results
    };
} 