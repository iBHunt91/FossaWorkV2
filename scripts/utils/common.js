import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root directory (2 levels up from utils folder)
const rootDir = path.resolve(__dirname, '../../');

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path to ensure exists
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Format date for display or file naming
 * @param {Date} date - Date to format
 * @param {boolean} forFileName - Whether to format for file name (no spaces/colons)
 * @returns {string} Formatted date string
 */
function formatDate(date, forFileName = false) {
  if (!date) date = new Date();
  
  if (forFileName) {
    return date.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  }
  
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Safely read JSON file
 * @param {string} filePath - Path to JSON file
 * @param {any} defaultValue - Default value if file doesn't exist
 * @returns {any} Parsed JSON data or default value
 */
function readJsonFile(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error);
  }
  return defaultValue;
}

/**
 * Safely write JSON file
 * @param {string} filePath - Path to JSON file
 * @param {any} data - Data to write
 * @returns {boolean} Success status
 */
function writeJsonFile(filePath, data) {
  try {
    const dirPath = path.dirname(filePath);
    ensureDirectoryExists(dirPath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing JSON file ${filePath}:`, error);
    return false;
  }
}

/**
 * Create backup of a file
 * @param {string} filePath - Path to file to backup
 * @returns {string|null} Path to backup file or null if failed
 */
function createBackup(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const backupDir = path.join(rootDir, 'backups');
      ensureDirectoryExists(backupDir);
      
      const fileName = path.basename(filePath);
      const timestamp = formatDate(new Date(), true);
      const backupPath = path.join(backupDir, `${fileName}.${timestamp}.bak`);
      
      fs.copyFileSync(filePath, backupPath);
      console.log(`Created backup: ${backupPath}`);
      return backupPath;
    }
  } catch (error) {
    console.error(`Error creating backup of ${filePath}:`, error);
  }
  return null;
}

export {
  rootDir,
  ensureDirectoryExists,
  formatDate,
  readJsonFile,
  writeJsonFile,
  createBackup
}; 