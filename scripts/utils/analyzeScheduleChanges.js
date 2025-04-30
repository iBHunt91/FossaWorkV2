// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { compareSchedules } from './scheduleComparator.js';
import { getUsersWithNotificationsEnabled } from '../user/userService.js';
import { info, error } from './logger.js';
import { sendScheduleChangeNotifications } from '../notifications/notificationService.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Analyzes changes between current and previous schedules
 * @param {Object} currentSchedule - The current schedule data
 * @param {Object} previousSchedule - The previous schedule data
 * @param {string} username - The username for archive paths
 * @returns {Promise<Object>} - The report of changes
 */
export async function analyzeScheduleChanges(currentSchedule, previousSchedule, username) {
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
                critical: [], 
                high: [], 
                medium: [], 
                low: [], 
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
            
            const userPreferences = users.find(user => user.username === username)?.preferences || null;
            
            // Compare the schedules
            const changes = compareSchedules(currentSchedule, previousSchedule, userPreferences);
            
            // Archive the changes report if there are any significant changes
            if (changes.summary.removed > 0 || 
                changes.summary.added > 0 || 
                changes.summary.modified > 0 || 
                changes.summary.swapped > 0) {
                
                await archiveChangesReport(changes, username);
                
                // Log the summary of changes
                info(`Changes detected for ${username}:`, {
                    removed: changes.summary.removed,
                    added: changes.summary.added,
                    modified: changes.summary.modified,
                    swapped: changes.summary.swapped
                });

                // Send notifications for the changes
                const notificationResult = await sendScheduleChangeNotifications(changes, users.find(user => user.username === username));
                if (notificationResult.success) {
                    info('Notifications sent successfully');
                } else {
                    error('Failed to send notifications:', notificationResult.error);
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