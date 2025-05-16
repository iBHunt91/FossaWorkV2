import { sendTestPushoverNotification } from './pushover/pushoverService.js';
import { getUserEmailSettings } from './email/emailSettings.js';
import { sendTestEmail } from './notifications/emailService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get all user directories from the data/users folder
 * @returns {Array<string>} Array of user directory names
 */
function getUserDirectories() {
    try {
        const usersDir = path.join(__dirname, '../data/users');
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
 * Read the user metadata
 * @param {string} userId User ID or directory name
 * @returns {Object|null} The user metadata or null if not found
 */
function readUserMetadata(userId) {
    try {
        const usersDir = path.join(__dirname, '../data/users');
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
 * Send test notifications to a specific user
 * @param {string} userId The user ID to send notifications to
 */
async function sendTestNotificationsToUser(userId) {
    try {
        console.log(`Sending test notifications to user ${userId}`);
        
        // Get user metadata
        const metadata = readUserMetadata(userId);
        
        // Create a complete user object
        const user = {
            id: userId,
            name: metadata.name || userId,
            email: metadata.email,
            ...metadata
        };
        
        console.log(`User: ${user.name} (${user.id})`);
        
        // Send Pushover notification
        console.log('Sending Pushover notification...');
        const pushoverResult = await sendTestPushoverNotification(userId);
        console.log('Pushover notification result:', pushoverResult);
        
        // Send email notification
        console.log('Sending email notification...');
        const emailSettings = await getUserEmailSettings(userId);
        if (emailSettings && emailSettings.smtpServer && emailSettings.recipientEmail) {
            const emailResult = await sendTestEmail(user);
            console.log('Email notification result:', emailResult);
        } else {
            console.log('Email settings not configured for user, skipping email test');
        }
    } catch (error) {
        console.error('Error sending test notifications:', error);
    }
}

// Get command line arguments
const args = process.argv.slice(2);
const userId = args[0];

if (userId) {
    console.log(`Sending test notifications to user ${userId}`);
    sendTestNotificationsToUser(userId).catch(console.error);
} else {
    // List available users
    const userDirs = getUserDirectories();
    console.log(`Available users: ${userDirs.join(', ')}`);
    console.log('Usage: node test-notifications.js <userId>');
} 