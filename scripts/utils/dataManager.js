import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { resolveUserFilePath, getActiveUser } from '../../server/utils/userManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '../..');
const dataDir = path.join(rootDir, 'data');
const usersDir = path.join(dataDir, 'users');
const archiveDir = path.join(dataDir, 'archive');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
    dataDir: dataDir,
    usersDir: usersDir,
    archiveDir: archiveDir,
    retentionDays: 7, // Keep last 7 days of data
    maxRawFiles: 10, // Maximum number of raw files to keep
    compressAfterDays: 3 // Compress files older than 3 days
};

// Ensure directories exist
function ensureDirectories() {
    if (!fs.existsSync(CONFIG.dataDir)) {
        fs.mkdirSync(CONFIG.dataDir, { recursive: true });
    }
    if (!fs.existsSync(CONFIG.usersDir)) {
        fs.mkdirSync(CONFIG.usersDir, { recursive: true });
    }
    if (!fs.existsSync(CONFIG.archiveDir)) {
        fs.mkdirSync(CONFIG.archiveDir, { recursive: true });
    }
}

/**
 * Get the real user ID from a symlink or friendly name
 * @param {string} userId - User ID or friendly name
 * @returns {string} - Real user ID
 */
function getRealUserId(userId) {
    const userPath = path.join(CONFIG.usersDir, userId);
    
    // If the path exists and is a symlink, get the real path
    if (fs.existsSync(userPath) && fs.lstatSync(userPath).isSymbolicLink()) {
        const realPath = fs.realpathSync(userPath);
        return path.basename(realPath);
    }
    
    return userId;
}

// Get all scraped data files
function getScrapedFiles() {
    // First try to get the regular scraped content files
    let files = fs.readdirSync(CONFIG.dataDir)
        .filter(file => file.startsWith('scraped_content_') && file.endsWith('.json'))
        .map(file => ({
            name: file,
            path: path.join(CONFIG.dataDir, file),
            timestamp: new Date(file.replace('scraped_content_', '').replace('.json', ''))
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
    
    // If no regular scraped files are found, include backup files
    if (files.length === 0) {
        files = fs.readdirSync(CONFIG.dataDir)
            .filter(file => file.startsWith('scraped_content.backup-') && file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: path.join(CONFIG.dataDir, file),
                timestamp: new Date(parseInt(file.replace('scraped_content.backup-', '').replace('.json', '')))
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
    }
    
    return files;
}

// Archive old files
async function archiveOldFiles() {
    const files = getScrapedFiles();
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (CONFIG.retentionDays * 24 * 60 * 60 * 1000));

    // Archive files older than retention period
    for (const file of files) {
        if (file.timestamp < cutoffDate) {
            const archivePath = path.join(CONFIG.archiveDir, file.name);
            await fs.promises.rename(file.path, archivePath);
            console.log(`Archived file: ${file.name}`);
        }
    }

    // Compress archived files older than compressAfterDays
    const compressCutoff = new Date(now.getTime() - (CONFIG.compressAfterDays * 24 * 60 * 60 * 1000));
    const archivedFiles = fs.readdirSync(CONFIG.archiveDir)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
            name: file,
            path: path.join(CONFIG.archiveDir, file),
            timestamp: new Date(file.replace('scraped_content_', '').replace('.json', ''))
        }));

    for (const file of archivedFiles) {
        if (file.timestamp < compressCutoff && !file.name.endsWith('.gz')) {
            try {
                await execAsync(`gzip ${file.path}`);
                console.log(`Compressed file: ${file.name}`);
            } catch (error) {
                console.error(`Error compressing file ${file.name}:`, error);
            }
        }
    }
}

// Clean up old files
async function cleanupOldFiles() {
    const files = getScrapedFiles();
    
    // Keep only the latest N files
    if (files.length > CONFIG.maxRawFiles) {
        for (let i = CONFIG.maxRawFiles; i < files.length; i++) {
            try {
                await fs.promises.unlink(files[i].path);
                console.log(`Deleted old file: ${files[i].name}`);
            } catch (error) {
                console.error(`Error deleting file ${files[i].name}:`, error);
            }
        }
    }
}

// Initialize data management
export async function initializeDataManagement() {
    ensureDirectories();
    await archiveOldFiles();
    await cleanupOldFiles();
}

/**
 * Get the latest scrape file for a user
 * @param {string} userId - User ID or friendly name
 * @returns {string|null} - Path to the latest scrape file
 */
export function getLatestScrapeFile(userId = null) {
    // If no userId provided, use the active user
    if (!userId) {
        userId = getActiveUser();
        
        // If still no user ID, log the issue and use a fallback
        if (!userId) {
            console.error('No active user found, cannot resolve scrape file path');
            return null;
        }
    }
    
    const realUserId = getRealUserId(userId);
    const userDir = path.join(CONFIG.usersDir, realUserId);
    const mainFile = path.join(userDir, 'scraped_content.json');
    
    if (fs.existsSync(mainFile)) {
        return mainFile;
    }
    
    return null;
}

/**
 * Get the previous scrape file for a user
 * @param {string} userId - User ID or friendly name
 * @returns {string|null} - Path to the previous scrape file
 */
export function getPreviousScrapeFile(userId = null) {
    // If no userId provided, use the active user
    if (!userId) {
        userId = getActiveUser();
        
        // If still no user ID, log the issue and return null
        if (!userId) {
            console.error('No active user found, cannot resolve previous scrape file path');
            return null;
        }
    }
    
    const realUserId = getRealUserId(userId);
    const userDir = path.join(CONFIG.usersDir, realUserId);
    const mainFile = path.join(userDir, 'scraped_content.json');
    const previousFile = path.join(userDir, 'scraped_content.previous.json');
    
    // If previous file exists, return it
    if (fs.existsSync(previousFile)) {
        return previousFile;
    }
    
    // If main file exists but no previous file, copy main to previous
    if (fs.existsSync(mainFile)) {
        try {
            fs.copyFileSync(mainFile, previousFile);
            return previousFile;
        } catch (error) {
            console.error('Error copying main file to previous:', error);
            return null;
        }
    }
    
    return null;
}

/**
 * Save scraped content for a user
 * @param {Object} content - Scraped content to save
 * @param {string} userId - User ID or friendly name
 * @returns {boolean} - Success status
 */
export function saveScrapedContent(content, userId = null) {
    try {
        // If no userId provided, use the active user
        if (!userId) {
            userId = getActiveUser();
            
            // If still no user ID, log the issue and return false
            if (!userId) {
                console.error('No active user found, cannot save scraped content');
                return false;
            }
        }
        
        const realUserId = getRealUserId(userId);
        const userDir = path.join(CONFIG.usersDir, realUserId);
        
        // Ensure user directory exists
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        const mainFile = path.join(userDir, 'scraped_content.json');
        const previousFile = path.join(userDir, 'scraped_content.previous.json');
        
        // If main file exists, move it to previous
        if (fs.existsSync(mainFile)) {
            console.log(`Moving current file to previous for user ${realUserId}`);
            fs.copyFileSync(mainFile, previousFile);
        }
        
        // Write new content to main file
        console.log(`Writing new content to main file for user ${realUserId}`);
        fs.writeFileSync(mainFile, JSON.stringify(content, null, 2));
        
        // Verify files exist and have content
        if (!fs.existsSync(mainFile)) {
            console.error(`File verification failed for user ${realUserId}: Main file does not exist`);
            return false;
        }
        
        const mainContent = fs.readFileSync(mainFile, 'utf8');
        
        if (!mainContent) {
            console.error(`File content verification failed for user ${realUserId}: Main file is empty`);
            return false;
        }
        
        console.log(`Successfully saved scraped content for user ${realUserId}`);
        return true;
    } catch (error) {
        console.error(`Error saving scraped content for user ${userId}:`, error);
        return false;
    }
}

/**
 * Get the path to the schedule changes file for a user
 * @param {string} userId - User ID or friendly name
 * @returns {string} - Path to the schedule changes file
 */
export function getScheduleChangesPath(userId = null) {
    // If no userId provided, use the active user
    if (!userId) {
        userId = getActiveUser();
        
        // If still no user ID, log the issue and use a fallback
        if (!userId) {
            console.error('No active user found, cannot resolve schedule changes path');
            return null;
        }
    }
    
    const realUserId = getRealUserId(userId);
    const userDir = path.join(CONFIG.usersDir, realUserId);
    return path.join(userDir, 'schedule_changes.txt');
}

/**
 * Get the path to the changes archive directory for a user
 * @param {string} userId - User ID or friendly name
 * @returns {string} - Path to the changes archive directory
 */
export function getChangesArchivePath(userId = null) {
    // If no userId provided, use the active user
    if (!userId) {
        userId = getActiveUser();
        
        // If still no user ID, log the issue and use a fallback
        if (!userId) {
            console.error('No active user found, cannot resolve changes archive path');
            return null;
        }
    }
    
    const realUserId = getRealUserId(userId);
    const userDir = path.join(CONFIG.usersDir, realUserId);
    return path.join(userDir, 'changes_archive');
}

/**
 * Get all users with their real IDs
 * @returns {Array<{id: string, realId: string}>} - Array of user objects
 */
export function getAllUsers() {
    const users = [];
    
    // Read the users directory
    const entries = fs.readdirSync(CONFIG.usersDir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory() || entry.isSymbolicLink()) {
            const userPath = path.join(CONFIG.usersDir, entry.name);
            const realPath = fs.realpathSync(userPath);
            const realId = path.basename(realPath);
            
            users.push({
                id: entry.name,
                realId: realId
            });
        }
    }
    
    return users;
}

// Get the completed jobs file path (user-specific)
function getCompletedJobsFile(userId = null) {
    return resolveUserFilePath('completed_jobs.json', userId);
}

// Get the dispenser store file path (user-specific)
function getDispenserStoreFile(userId = null) {
    return resolveUserFilePath('dispenser_store.json', userId);
}

// Update main data files with new content
function updateMainFiles(data, userId = null) {
    const outputPath = getLatestScrapeFile(userId);
    const previousPath = getPreviousScrapeFile(userId);
    
    // Create parent directory if it doesn't exist
    const parentDir = path.dirname(outputPath);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
        console.log(`Created directory: ${parentDir}`);
    }

    // If there's an existing file, make it the previous file
    if (fs.existsSync(outputPath)) {
        try {
            // Make a backup of the current file as previous
            fs.copyFileSync(outputPath, previousPath);
            console.log(`Backed up current file to ${previousPath}`);
        } catch (error) {
            console.error('Error backing up current file:', error);
        }
    }

    // Create metadata
    const metadata = {
        timestamp: new Date().toISOString(),
        user: userId || getActiveUser()
    };

    // Add metadata to the data
    const dataWithMetadata = {
        ...data,
        metadata
    };

    // Write the new data to the output file
    fs.writeFileSync(outputPath, JSON.stringify(dataWithMetadata, null, 2));
    console.log(`Wrote updated data to ${outputPath}`);

    // Also update the metadata file
    const metadataPath = resolveUserFilePath('metadata.json', userId);
    fs.writeFileSync(metadataPath, JSON.stringify({ metadata }, null, 2));
    console.log(`Updated metadata at ${metadataPath}`);

    return { outputPath, previousPath };
}

// Archive a file with timestamp
function archiveFile(sourcePath, fileName, userId = null) {
    if (!fs.existsSync(sourcePath)) {
        console.log(`Source file doesn't exist: ${sourcePath}`);
        return null;
    }

    // Create archive directory if it doesn't exist
    const archiveDir = resolveUserFilePath('archive', userId);
    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Generate archive filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const archiveFileName = `${fileName}_${timestamp}.json`;
    const archivePath = path.join(archiveDir, archiveFileName);

    // Copy the file to archive
    fs.copyFileSync(sourcePath, archivePath);
    console.log(`Archived file to ${archivePath}`);

    return archivePath;
}

// Archive latest scraped content
function archiveLatestScrape(userId = null) {
    const sourcePath = getLatestScrapeFile(userId);
    return archiveFile(sourcePath, 'scraped_content', userId);
}

// Read completed jobs
function readCompletedJobs() {
    const completedJobsPath = getCompletedJobsFile();
    if (!fs.existsSync(completedJobsPath)) {
        return { completedJobs: [] };
    }

    try {
        const data = fs.readFileSync(completedJobsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading completed jobs:', error);
        return { completedJobs: [] };
    }
}

// Save completed jobs
function saveCompletedJobs(completedJobs) {
    const completedJobsPath = getCompletedJobsFile();
    const data = { completedJobs, lastUpdated: new Date().toISOString() };
    fs.writeFileSync(completedJobsPath, JSON.stringify(data, null, 2));
    console.log(`Updated completed jobs at ${completedJobsPath}`);
}

// Read dispenser store data
function readDispenserStore() {
    const dispenserStorePath = getDispenserStoreFile();
    if (!fs.existsSync(dispenserStorePath)) {
        return { stores: [] };
    }

    try {
        const data = fs.readFileSync(dispenserStorePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading dispenser store:', error);
        return { stores: [] };
    }
}

// Save dispenser store data
function saveDispenserStore(storeData) {
    const dispenserStorePath = getDispenserStoreFile();
    fs.writeFileSync(dispenserStorePath, JSON.stringify(storeData, null, 2));
    console.log(`Updated dispenser store at ${dispenserStorePath}`);
}

// Archive changes
function archiveChanges(changes) {
    const changesDir = resolveUserFilePath('changes_archive');
    if (!fs.existsSync(changesDir)) {
        fs.mkdirSync(changesDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const changesPath = path.join(changesDir, `changes_${timestamp}.json`);
    fs.writeFileSync(changesPath, JSON.stringify(changes, null, 2));
    console.log(`Archived changes to ${changesPath}`);

    return changesPath;
}

// Export functions for use in other modules
export {
    archiveOldFiles,
    cleanupOldFiles,
    getScrapedFiles,
    getCompletedJobsFile,
    getDispenserStoreFile,
    updateMainFiles,
    archiveFile,
    archiveLatestScrape,
    readCompletedJobs,
    saveCompletedJobs,
    readDispenserStore,
    saveDispenserStore,
    archiveChanges
}; 