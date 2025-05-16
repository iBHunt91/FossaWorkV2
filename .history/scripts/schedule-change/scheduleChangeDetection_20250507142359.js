import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { sendScheduleChangeNotifications } from '../notifications/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get all user directories from the data/users folder
 * @returns {Array<string>} Array of user directory names
 */
function getUserDirectories() {
    try {
        const usersDir = path.join(__dirname, '../../data/users');
        if (!fs.existsSync(usersDir)) {
            console.error('Error: users directory does not exist');
            return [];
        }
        
        return fs.readdirSync(usersDir)
            .filter(item => {
                const fullPath = path.join(usersDir, item);
                return fs.statSync(fullPath).isDirectory() && item !== 'shared';
            });
    } catch (error) {
        console.error('Error getting user directories:', error);
        return [];
    }
}

/**
 * Read scraped content for a specific user
 * @param {string} userId User ID or directory name
 * @returns {Object|null} The scraped content or null if not found
 */
function readScrapedContent(userId) {
    try {
        const usersDir = path.join(__dirname, '../../data/users');
        const filePath = path.join(usersDir, userId, 'scraped_content.json');
        
        if (!fs.existsSync(filePath)) {
            console.warn(`No scraped content found for user ${userId}`);
            return null;
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading scraped content for user ${userId}:`, error);
        return null;
    }
}

/**
 * Read the previous scraped content for a user
 * @param {string} userId User ID or directory name
 * @returns {Object|null} The previous scraped content or null if not found
 */
function readPreviousScrapedContent(userId) {
    try {
        const usersDir = path.join(__dirname, '../../data/users');
        const filePath = path.join(usersDir, userId, 'previous_scraped_content.json');
        
        if (!fs.existsSync(filePath)) {
            console.warn(`No previous scraped content found for user ${userId}`);
            return null;
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading previous scraped content for user ${userId}:`, error);
        return null;
    }
}

/**
 * Save the current scraped content as previous for a user
 * @param {string} userId User ID or directory name
 * @param {Object} content The scraped content to save
 */
function savePreviousScrapedContent(userId, content) {
    try {
        const usersDir = path.join(__dirname, '../../data/users');
        const userDir = path.join(usersDir, userId);
        const filePath = path.join(userDir, 'previous_scraped_content.json');
        
        // Ensure the user directory exists
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
        console.log(`Previous scraped content saved for user ${userId}`);
    } catch (error) {
        console.error(`Error saving previous scraped content for user ${userId}:`, error);
    }
}

/**
 * Read the user metadata
 * @param {string} userId User ID or directory name
 * @returns {Object|null} The user metadata or null if not found
 */
function readUserMetadata(userId) {
    try {
        const usersDir = path.join(__dirname, '../../data/users');
        const filePath = path.join(usersDir, userId, 'metadata.json');
        
        if (!fs.existsSync(filePath)) {
            console.warn(`No metadata found for user ${userId}, using ID as metadata`);
            return { id: userId, name: userId };
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading metadata for user ${userId}:`, error);
        return { id: userId, name: userId };
    }
}

/**
 * Read users configuration from users.json
 * @returns {Array} Array of user objects
 */
function readUsers() {
    try {
        const filePath = path.join(__dirname, '../../data/users/users.json');
        
        if (!fs.existsSync(filePath)) {
            console.warn('No users.json file found, will use directory names as user IDs');
            return getUserDirectories().map(dir => {
                const metadata = readUserMetadata(dir);
                return {
                    id: dir,
                    name: metadata.name || dir,
                    ...metadata
                };
            });
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data).users;
    } catch (error) {
        console.error('Error reading users configuration:', error);
        return [];
    }
}

/**
 * Detect schedule changes for all users
 */
export async function detectScheduleChangesForAllUsers() {
    try {
        console.log('Starting schedule change detection for all users...');
        
        const userDirs = getUserDirectories();
        console.log(`Found ${userDirs.length} user directories: ${userDirs.join(', ')}`);
        
        // Get users configuration
        const users = readUsers();
        console.log(`Found ${users.length} users in configuration`);
        
        for (const userDir of userDirs) {
            // Find the user in the configuration
            const user = users.find(u => u.id === userDir) || { id: userDir, name: userDir };
            console.log(`Detecting schedule changes for user: ${user.name} (${user.id})`);
            
            await detectScheduleChangesForUser(user);
        }
    } catch (error) {
        console.error('Error detecting schedule changes for all users:', error);
    }
}

/**
 * Detect schedule changes for a specific user
 * @param {Object} user The user object
 */
export async function detectScheduleChangesForUser(user) {
    try {
        console.log(`Detecting schedule changes for user ${user.name} (${user.id})`);
        
        // Read current and previous scraped content
        const currentContent = readScrapedContent(user.id);
        if (!currentContent) {
            console.log(`No current content found for user ${user.id}, skipping`);
            return;
        }
        
        const previousContent = readPreviousScrapedContent(user.id);
        if (!previousContent) {
            console.log(`No previous content found for user ${user.id}, saving current content as previous and skipping`);
            savePreviousScrapedContent(user.id, currentContent);
            return;
        }
        
        // Detect changes between current and previous content
        const changes = compareWorkOrders(previousContent, currentContent);
        
        // If there are changes, save current content as previous
        if (changes && (changes.added.length > 0 || changes.removed.length > 0 || changes.modified.length > 0 || changes.swapped.length > 0)) {
            console.log(`Detected ${changes.allChanges.length} changes for user ${user.id}`);
            console.log(`Changes: ${changes.summary.added} added, ${changes.summary.removed} removed, ${changes.summary.modified} modified, ${changes.summary.swapped} swapped`);
            
            // Save current content as previous for next comparison
            savePreviousScrapedContent(user.id, currentContent);
            
            // Send notifications for changes
            await sendScheduleChangeNotifications(changes, user);
        } else {
            console.log(`No changes detected for user ${user.id}`);
        }
    } catch (error) {
        console.error(`Error detecting schedule changes for user ${user.id}:`, error);
    }
}

// ... existing code for compareWorkOrders and other helper functions 