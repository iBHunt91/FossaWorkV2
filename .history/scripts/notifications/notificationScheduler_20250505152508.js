import { sendScheduleChangeEmail } from './emailService.js';
import { 
    getUserPreferences, 
    getUserNotificationSettings,
    loadUsers,
    DEFAULT_NOTIFICATION_SETTINGS
} from '../user/userService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define path to store accumulated changes
const DIGEST_STORAGE_DIR = path.join(__dirname, '..', '..', 'data', 'notification-digests');

// Ensure the digest storage directory exists
if (!fs.existsSync(DIGEST_STORAGE_DIR)) {
    fs.mkdirSync(DIGEST_STORAGE_DIR, { recursive: true });
}

/**
 * Store changes for a user's daily digest
 * @param {Object} changes - Schedule changes to store
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function storeChangesForDailyDigest(changes, userId) {
    try {
        console.log(`Storing changes for daily digest for user ${userId}`);
        
        // Get the user's digest file path
        const digestFilePath = path.join(DIGEST_STORAGE_DIR, `${userId}-digest.json`);
        
        // Load existing changes or create new array
        let existingChanges = [];
        if (fs.existsSync(digestFilePath)) {
            const digestContent = fs.readFileSync(digestFilePath, 'utf8');
            existingChanges = JSON.parse(digestContent);
        }
        
        // Add timestamp to changes
        const changesWithTimestamp = {
            ...changes,
            timestamp: new Date().toISOString()
        };
        
        // Add new changes to existing array
        existingChanges.push(changesWithTimestamp);
        
        // Write updated changes back to file
        fs.writeFileSync(digestFilePath, JSON.stringify(existingChanges, null, 2));
        
        console.log(`Successfully stored changes for daily digest for user ${userId}`);
        return true;
    } catch (error) {
        console.error(`Error storing changes for daily digest for user ${userId}:`, error);
        return false;
    }
}

/**
 * Process notification based on user's frequency preference
 * @param {Object} changes - Schedule changes to notify about
 * @param {Object} user - User object
 * @returns {Promise<Object>} Processing result
 */
export async function processNotificationByFrequency(changes, user) {
    try {
        console.log(`Processing notification for user ${user.id} with settings:`, JSON.stringify({
            hasNotificationSettings: !!user.notificationSettings,
            hasEmailSettings: !!user.notificationSettings?.email,
            frequency: user.notificationSettings?.email?.frequency || 'unknown'
        }, null, 2));
        
        // Get user's notification settings
        const notificationSettings = user.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
        const emailSettings = notificationSettings.email || {};
        
        // If email is disabled, skip processing
        if (!emailSettings.enabled) {
            console.log(`Email notifications disabled for user ${user.id}, skipping`);
            return { success: true, processed: false, reason: 'email_disabled' };
        }
        
        // Check frequency setting with better logging
        const frequency = emailSettings.frequency || 'immediate';
        console.log(`User ${user.id} notification frequency resolved to: ${frequency}`);
        
        if (frequency === 'immediate') {
            // Send notification immediately
            console.log(`Sending immediate notification to user ${user.id}`);
            const emailResult = await sendScheduleChangeEmail(changes, user);
            return { 
                success: emailResult.success, 
                processed: true, 
                type: 'immediate',
                emailResult 
            };
        } else if (frequency === 'daily') {
            // Store for daily digest
            console.log(`Storing changes for daily digest for user ${user.id}`);
            const storeResult = await storeChangesForDailyDigest(changes, user.id);
            return { 
                success: storeResult, 
                processed: true, 
                type: 'daily_digest_stored'
            };
        } else {
            console.warn(`Unknown frequency setting "${frequency}" for user ${user.id}`);
            // Default to immediate if unknown setting
            const emailResult = await sendScheduleChangeEmail(changes, user);
            return { 
                success: emailResult.success, 
                processed: true, 
                type: 'immediate_fallback',
                emailResult 
            };
        }
    } catch (error) {
        console.error(`Error processing notification by frequency for user ${user.id}:`, error);
        return { success: false, error: error.message || error };
    }
}

/**
 * Send daily digest for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result of sending digest
 */
export async function sendDailyDigestForUser(userId) {
    try {
        console.log(`Preparing to send daily digest for user ${userId}`);
        
        // Get the user's digest file path
        const digestFilePath = path.join(DIGEST_STORAGE_DIR, `${userId}-digest.json`);
        
        // Check if digest file exists
        if (!fs.existsSync(digestFilePath)) {
            console.log(`No digest file found for user ${userId}, skipping`);
            return { success: true, sent: false, reason: 'no_digest_file' };
        }
        
        // Load stored changes
        const digestContent = fs.readFileSync(digestFilePath, 'utf8');
        const storedChanges = JSON.parse(digestContent);
        
        // If no changes, skip sending
        if (!storedChanges || storedChanges.length === 0) {
            console.log(`No changes found in digest for user ${userId}, skipping`);
            return { success: true, sent: false, reason: 'no_changes' };
        }
        
        // Load user data
        const users = await loadUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            console.warn(`User ${userId} not found, cannot send digest`);
            return { success: false, error: 'user_not_found' };
        }
        
        // Combine all stored changes into a single report
        const combinedChanges = combineChanges(storedChanges);
        
        // Send combined digest email
        console.log(`Sending daily digest with ${combinedChanges.allChanges.length} changes to user ${userId}`);
        const emailResult = await sendScheduleChangeEmail(combinedChanges, user, true);
        
        // If email was sent successfully, delete the digest file
        if (emailResult.success) {
            fs.unlinkSync(digestFilePath);
            console.log(`Daily digest sent and file deleted for user ${userId}`);
        }
        
        return { 
            success: emailResult.success, 
            sent: emailResult.success,
            changesCount: combinedChanges.allChanges.length,
            emailResult
        };
        
    } catch (error) {
        console.error(`Error sending daily digest for user ${userId}:`, error);
        return { success: false, error: error.message || error };
    }
}

/**
 * Combine multiple change objects into a single digest
 * @param {Array} changesArray - Array of change objects
 * @returns {Object} Combined changes
 */
function combineChanges(changesArray) {
    // Initialize combined changes
    const combined = {
        allChanges: [],
        summary: {
            removed: 0,
            added: 0,
            modified: 0,
            swapped: 0,
            replaced: 0
        }
    };
    
    // Process each change set
    for (const changes of changesArray) {
        // Add all individual changes
        if (changes.allChanges && changes.allChanges.length > 0) {
            combined.allChanges.push(...changes.allChanges);
        }
        
        // Update summary counts
        if (changes.summary) {
            combined.summary.removed += changes.summary.removed || 0;
            combined.summary.added += changes.summary.added || 0;
            combined.summary.modified += changes.summary.modified || 0;
            combined.summary.swapped += changes.summary.swapped || 0;
            combined.summary.replaced += changes.summary.replaced || 0;
        }
    }
    
    return combined;
}

/**
 * Check and send daily digests for all users who have scheduled them
 * @returns {Promise<Object>} Results of sending digests
 */
export async function processDailyDigests() {
    try {
        console.log('Starting scheduled daily digest processing');
        
        // Load all users
        const users = await loadUsers();
        const results = {
            success: true,
            processed: 0,
            skipped: 0,
            failed: 0,
            userResults: {}
        };
        
        // Check each user
        for (const user of users) {
            try {
                // Get notification settings
                const notificationSettings = user.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
                const emailSettings = notificationSettings.email || {};
                
                // Skip if email notifications disabled
                if (!emailSettings.enabled) {
                    console.log(`Email notifications disabled for user ${user.id}, skipping digest check`);
                    results.skipped++;
                    results.userResults[user.id] = { success: true, processed: false, reason: 'email_disabled' };
                    continue;
                }
                
                // Skip if not using daily frequency
                if (emailSettings.frequency !== 'daily') {
                    console.log(`User ${user.id} not using daily digest frequency, skipping`);
                    results.skipped++;
                    results.userResults[user.id] = { success: true, processed: false, reason: 'not_daily_frequency' };
                    continue;
                }
                
                // Get delivery time
                const deliveryTime = emailSettings.deliveryTime || '18:00';
                
                // Check if current time matches the delivery time
                const now = new Date();
                const [deliveryHours, deliveryMinutes] = deliveryTime.split(':').map(n => parseInt(n, 10));
                
                // Check if it's time to send (within a 5-minute window)
                const isTimeToSend = (
                    now.getHours() === deliveryHours && 
                    Math.abs(now.getMinutes() - deliveryMinutes) <= 5
                );
                
                if (!isTimeToSend) {
                    console.log(`Not time to send digest for user ${user.id} (scheduled for ${deliveryTime})`);
                    results.skipped++;
                    results.userResults[user.id] = { success: true, processed: false, reason: 'not_delivery_time' };
                    continue;
                }
                
                // Send digest
                console.log(`Sending daily digest for user ${user.id}`);
                const sendResult = await sendDailyDigestForUser(user.id);
                
                if (sendResult.success) {
                    results.processed++;
                    results.userResults[user.id] = sendResult;
                } else {
                    results.failed++;
                    results.userResults[user.id] = sendResult;
                    // Don't fail the entire operation if one user fails
                }
                
            } catch (userError) {
                console.error(`Error processing digest for user ${user.id}:`, userError);
                results.failed++;
                results.userResults[user.id] = { success: false, error: userError.message || userError };
            }
        }
        
        console.log(`Daily digest processing complete: ${results.processed} processed, ${results.skipped} skipped, ${results.failed} failed`);
        return results;
        
    } catch (error) {
        console.error('Error processing daily digests:', error);
        return { success: false, error: error.message || error };
    }
}

/**
 * Manual check for all pending digests that are due to be sent
 * This can be called from cron job or API endpoint
 */
export async function checkAndSendScheduledDigests() {
    return processDailyDigests();
} 