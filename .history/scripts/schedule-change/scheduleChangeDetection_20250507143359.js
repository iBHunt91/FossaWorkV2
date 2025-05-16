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
        console.log(`Reading scraped content for user ${user.id}...`);
        const currentContent = readScrapedContent(user.id);
        if (!currentContent) {
            console.log(`No current content found for user ${user.id}, skipping`);
            return;
        }
        console.log(`Found current content for user ${user.id} with ${currentContent.workOrders?.length || 0} work orders`);
        
        console.log(`Reading previous scraped content for user ${user.id}...`);
        const previousContent = readPreviousScrapedContent(user.id);
        if (!previousContent) {
            console.log(`No previous content found for user ${user.id}, saving current content as previous and skipping`);
            savePreviousScrapedContent(user.id, currentContent);
            return;
        }
        console.log(`Found previous content for user ${user.id} with ${previousContent.workOrders?.length || 0} work orders`);
        
        // Detect changes between current and previous content
        console.log(`Comparing work orders for user ${user.id}...`);
        const changes = compareWorkOrders(previousContent, currentContent);
        
        // If there are changes, save current content as previous
        if (changes && (changes.added.length > 0 || changes.removed.length > 0 || changes.modified.length > 0 || changes.swapped.length > 0)) {
            console.log(`Detected ${changes.allChanges.length} changes for user ${user.id}`);
            console.log(`Changes: ${changes.summary.added} added, ${changes.summary.removed} removed, ${changes.summary.modified} modified, ${changes.summary.swapped} swapped`);
            
            // Save current content as previous for next comparison
            savePreviousScrapedContent(user.id, currentContent);
            
            // Send notifications for changes
            console.log(`Sending notifications for user ${user.id}...`);
            await sendScheduleChangeNotifications(changes, user);
        } else {
            console.log(`No changes detected for user ${user.id}`);
        }
    } catch (error) {
        console.error(`Error detecting schedule changes for user ${user.id}:`, error);
    }
}

/**
 * Compare two work order lists and detect changes
 * @param {Object} previous The previous scraped content
 * @param {Object} current The current scraped content
 * @returns {Object} Object containing the changes
 */
function compareWorkOrders(previous, current) {
    if (!previous || !current) {
        console.error('Invalid input for comparison');
        return null;
    }

    const prevWorkOrders = previous.workOrders || [];
    const currWorkOrders = current.workOrders || [];

    if (!Array.isArray(prevWorkOrders) || !Array.isArray(currWorkOrders)) {
        console.error('Work orders not in expected format');
        return null;
    }

    console.log(`Comparing ${prevWorkOrders.length} previous work orders with ${currWorkOrders.length} current work orders`);

    // Create maps for faster lookup
    const prevMap = new Map();
    const currMap = new Map();

    prevWorkOrders.forEach(job => {
        prevMap.set(job.jobId, job);
    });

    currWorkOrders.forEach(job => {
        currMap.set(job.jobId, job);
    });

    // Detect removed jobs
    const removed = prevWorkOrders.filter(job => !currMap.has(job.jobId)).map(job => {
        return {
            ...job,
            type: 'removed'
        };
    });

    // Detect added jobs
    const added = currWorkOrders.filter(job => !prevMap.has(job.jobId)).map(job => {
        return {
            ...job,
            type: 'added'
        };
    });

    // Detect modified jobs (same jobId but different date)
    const modified = [];
    prevWorkOrders.forEach(prevJob => {
        const currJob = currMap.get(prevJob.jobId);
        if (currJob && prevJob.date !== currJob.date) {
            modified.push({
                ...currJob,
                type: 'date_changed',
                oldDate: prevJob.date,
                newDate: currJob.date
            });
        }
    });

    // Detect swapped jobs (two jobs that have swapped dates)
    const swapped = [];
    const alreadyProcessedSwaps = new Set();

    prevWorkOrders.forEach(prevJob1 => {
        const currJob1 = currMap.get(prevJob1.jobId);
        
        // Skip if the job no longer exists or already processed
        if (!currJob1 || alreadyProcessedSwaps.has(prevJob1.jobId)) return;
        
        // Find another job that has the date that this job used to have
        prevWorkOrders.forEach(prevJob2 => {
            // Skip self-comparison or already processed jobs
            if (prevJob1.jobId === prevJob2.jobId || alreadyProcessedSwaps.has(prevJob2.jobId)) return;
            
            const currJob2 = currMap.get(prevJob2.jobId);
            
            // Skip if the second job no longer exists
            if (!currJob2) return;
            
            // Check if the dates have been swapped
            if (prevJob1.date === currJob2.date && prevJob2.date === currJob1.date) {
                swapped.push({
                    type: 'swap',
                    job1Id: prevJob1.jobId,
                    job1Store: prevJob1.store || prevJob1.storeName || 'Unknown',
                    job1Location: prevJob1.location || 'Unknown',
                    job1Address: prevJob1.address,
                    oldDate1: prevJob1.date,
                    newDate1: currJob1.date,
                    
                    job2Id: prevJob2.jobId,
                    job2Store: prevJob2.store || prevJob2.storeName || 'Unknown',
                    job2Location: prevJob2.location || 'Unknown',
                    job2Address: prevJob2.address,
                    oldDate2: prevJob2.date,
                    newDate2: currJob2.date
                });
                
                // Mark both jobs as processed to avoid duplicates
                alreadyProcessedSwaps.add(prevJob1.jobId);
                alreadyProcessedSwaps.add(prevJob2.jobId);
            }
        });
    });

    // Create the complete changes object
    const allChanges = [...removed, ...added, ...modified, ...swapped];
    
    return {
        added,
        removed,
        modified,
        swapped,
        allChanges,
        summary: {
            added: added.length,
            removed: removed.length,
            modified: modified.length,
            swapped: swapped.length,
            total: allChanges.length
        }
    };
}

/**
 * Create a test file for running the script directly
 */
// Check if this file is being run directly
// In ES modules, we can't use require.main === module, so we use import.meta.url
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
    // This section runs when the script is executed directly (not imported)
    console.log('Project root directory:', path.resolve(__dirname, '../..'));
    
    // If command line arguments are provided, use them to test detection for a specific user
    const userId = process.argv[2];
    if (userId) {
        console.log(`Running schedule change detection for user ${userId}`);
        detectScheduleChangesForUser({ id: userId, name: userId }).catch(console.error);
    } else {
        console.log('Running schedule change detection for all users');
        detectScheduleChangesForAllUsers().catch(console.error);
    }
} 