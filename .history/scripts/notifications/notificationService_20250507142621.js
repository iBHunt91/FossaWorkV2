import { sendScheduleChangeEmail, sendTestEmail } from './emailService.js';
import { sendScheduleChangePushover } from '../pushover/pushoverService.js';
import { sendTestPushoverNotification, getUserPushoverSettings } from '../pushover/pushoverService.js';
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
export async function sendScheduleChangeNotifications(changes, user) {
    console.log(`Sending schedule change notifications for user ${user.name} (${user.id})`);
    
    // Check if we have any changes to notify about
    if (!changes || !changes.allChanges || changes.allChanges.length === 0) {
        console.log('No changes to notify about');
        return { success: false, skipped: true, reason: 'no_changes' };
    }
    
    const results = {
        email: null,
        pushover: null
    };
    
    const notificationSettings = user.notificationSettings || { email: { enabled: true }, pushover: { enabled: true } };
    
    // Get user preferences
    const userPreferences = user.preferences || DEFAULT_PREFERENCES;
    
    // Record notification history to avoid duplicates
    const recentNotifications = new Map();
    
    // Helper function to check if we've already sent this notification recently
    function wasRecentlySent(method, changes, userId) {
        const key = `${method}-${userId}-${JSON.stringify(getChangeSignature(changes))}`;
        const lastSent = recentNotifications.get(key);
        if (lastSent && (Date.now() - lastSent) < 3600000) { // 1 hour
            return true;
        }
        return false;
    }
    
    // Helper function to record that we sent a notification
    function recordNotificationSent(method, changes, userId) {
        const key = `${method}-${userId}-${JSON.stringify(getChangeSignature(changes))}`;
        recentNotifications.set(key, Date.now());
    }
    
    // Helper function to get a simple signature of the changes for deduplication
    function getChangeSignature(changes) {
        return {
            addedCount: changes.summary.added,
            removedCount: changes.summary.removed,
            modifiedCount: changes.summary.modified,
            swappedCount: changes.summary.swapped
        };
    }
    
    // Helper function to filter changes based on user preferences
    function filterChangesForUser(changes, preferences) {
        if (!changes || !changes.allChanges) return changes;
        
        const filteredChanges = {
            ...changes,
            allChanges: changes.allChanges.filter(change => {
                if (change.type === 'added' && !preferences.showAdded) return false;
                if (change.type === 'removed' && !preferences.showRemoved) return false;
                if (change.type === 'date_changed' && !preferences.showModified) return false;
                if (change.type === 'swap' && !preferences.showSwapped) return false;
                return true;
            })
        };
        
        // Update summary counts
        filteredChanges.summary = {
            added: filteredChanges.allChanges.filter(c => c.type === 'added').length,
            removed: filteredChanges.allChanges.filter(c => c.type === 'removed').length,
            modified: filteredChanges.allChanges.filter(c => c.type === 'date_changed').length,
            swapped: filteredChanges.allChanges.filter(c => c.type === 'swap').length,
            total: filteredChanges.allChanges.length
        };
        
        return filteredChanges;
    }
    
    try {
        // Filter changes based on user preferences
        const filteredChanges = filterChangesForUser(changes, userPreferences);
        
        // Skip if no relevant changes for this user after filtering
        if (!filteredChanges.allChanges || filteredChanges.allChanges.length === 0) {
            console.log(`No relevant changes for user ${user.id} after filtering`);
            return { success: true, skipped: true, reason: 'no_relevant_changes' };
        }
        
        // Send email notification if enabled
        const shouldSendEmail = notificationSettings.email?.enabled;
        if (shouldSendEmail) {
            try {
                // Skip if we already sent this notification recently
                if (wasRecentlySent('email', filteredChanges, user.id)) {
                    console.log(`Skipping duplicate email notification for user ${user.id}`);
                    results.email = { success: true, skipped: true, reason: 'duplicate' };
                } else {
                    console.log(`Sending email notification to user ${user.id}`);
                    const { sendScheduleChangeEmail } = await import('./emailService.js');
                    const emailResult = await sendScheduleChangeEmail(filteredChanges, user);
                    
                    if (emailResult.success) {
                        console.log(`Email notification sent successfully to user ${user.id}`);
                        // Record that we sent this notification
                        recordNotificationSent('email', filteredChanges, user.id);
                    } else {
                        console.error(`Error sending email notification:`, emailResult.error);
                    }
                    
                    results.email = emailResult;
                }
            } catch (err) {
                console.error('Error sending email notification:', err);
                results.email = { success: false, error: err.message || err };
            }
        }
        
        // Send Pushover notification if enabled (no frequency options for Pushover - always immediate)
        const shouldSendPushover = notificationSettings.pushover?.enabled;
        if (shouldSendPushover) {
            try {
                // Skip if we already sent this notification recently
                if (wasRecentlySent('pushover', filteredChanges, user.id)) {
                    console.log(`Skipping duplicate Pushover notification for user ${user.id}`);
                    results.pushover = { success: true, skipped: true, reason: 'duplicate' };
                    continue;
                }
                
                // Get user-specific Pushover settings by passing the user ID
                console.log(`Getting Pushover settings specifically for user ${user.id}`);
                const userPushoverSettings = getUserPushoverSettings(user.id);
                
                // If user has valid Pushover settings, proceed with sending notification
                if (userPushoverSettings && userPushoverSettings.appToken && userPushoverSettings.userKey) {
                    console.log(`Found valid Pushover settings for user ${user.id}`);
                    console.log(`Sending Pushover notification to user ${user.id}`);
                    
                    // Use the user's specific Pushover settings
                    const userWithPushoverSettings = {
                        ...user,
                        pushoverSettings: userPushoverSettings
                    };
                    
                    const pushoverResult = await sendScheduleChangePushover(filteredChanges, userWithPushoverSettings);
                    
                    if (pushoverResult.success) {
                        console.log(`Pushover notification sent successfully to user ${user.id}`);
                        // Record that we sent this notification
                        recordNotificationSent('pushover', filteredChanges, user.id);
                    } else {
                        console.error(`Error sending Pushover notification:`, pushoverResult.error);
                    }
                    
                    results.pushover = pushoverResult;
                } else {
                    console.log(`No valid Pushover settings found for user ${user.id}, skipping notification`);
                    results.pushover = { 
                        success: false, 
                        skipped: true, 
                        reason: 'no_valid_settings',
                        error: 'No valid Pushover app token or user key found'
                    };
                }
            } catch (err) {
                console.error('Error sending Pushover notification:', err);
                results.pushover = { success: false, error: err.message || err };
            }
        }
        
        return { success: true, results };
    } catch (error) {
        console.error('Error sending schedule change notifications:', error);
        return { success: false, error: error.message || error };
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