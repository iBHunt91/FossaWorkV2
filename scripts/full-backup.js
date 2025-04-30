import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import moment from 'moment';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import readline from 'readline';
import cliProgress from 'cli-progress';
import colors from 'ansi-colors';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const encryptBackup = args.includes('--encrypt');
const customExcludes = [];
const customIncludes = [];

args.forEach((arg, index) => {
  if (arg === '--exclude' && args[index + 1] && !args[index + 1].startsWith('--')) {
    customExcludes.push(args[index + 1]);
  }
  if (arg === '--include' && args[index + 1] && !args[index + 1].startsWith('--')) {
    customIncludes.push(args[index + 1]);
  }
});

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Create timestamp for the backup
const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
const backupDir = path.join(__dirname, '..', 'backups');
const backupName = `fossa-monitor-FULL-backup-${timestamp}`;
const backupPath = path.join(backupDir, backupName);
const zipPath = `${backupPath}.zip`;
const encryptedPath = `${backupPath}.enc`;
const metadataPath = path.join(backupDir, `${backupName}-metadata.json`);

// Directories and files to exclude from backup
const defaultExcludes = [
  'node_modules',
  '.git',
  'dist',
  'temp-restore'
];

// Combine default exclusions with custom ones
const excludes = [...new Set([...defaultExcludes, ...customExcludes])];

// Filter excludes if includes are specified
const effectiveExcludes = customIncludes.length > 0 
  ? excludes.filter(item => !customIncludes.includes(item))
  : excludes;

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: colors.cyan('{bar}') + ' | {percentage}% | {value}/{total} files | {file}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log(colors.green(`Starting FULL backup to ${zipPath}...`));
console.log(colors.yellow(`Excluded directories: ${effectiveExcludes.join(', ')}`));
if (customIncludes.length > 0) {
  console.log(colors.green(`Explicitly included: ${customIncludes.join(', ')}`));
}

// Create metadata
const metadata = {
  timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
  hostname: os.hostname(),
  platform: os.platform(),
  nodeVersion: process.version,
  backupType: 'FULL',
  excludedDirs: effectiveExcludes,
  includedDirs: customIncludes,
  encrypted: encryptBackup,
  appVersion: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))).version
};

// Save metadata
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
console.log(colors.blue(`Created backup metadata: ${metadataPath}`));

// Create zip archive
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  const fileSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
  console.log(colors.green(`\nBackup completed successfully: ${zipPath}`));
  console.log(colors.blue(`Total size: ${fileSize} MB`));
  
  if (encryptBackup) {
    encryptBackupFile();
  } else {
    console.log(colors.green('Backup process completed.'));
    process.exit(0);
  }
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn(colors.yellow(`Warning: ${err.message}`));
  } else {
    throw err;
  }
});

archive.on('error', (err) => {
  console.error(colors.red(`Error during backup: ${err.message}`));
  process.exit(1);
});

archive.pipe(output);

// Add metadata to the archive
archive.file(metadataPath, { name: 'backup-metadata.json' });

// Add files to the archive
const sourceDir = path.join(__dirname, '..');
const sourceContents = fs.readdirSync(sourceDir);

// Count files for progress reporting
let totalFiles = 0;
let processedFiles = 0;
let currentFile = '';

// Count files recursively (excluding specified directories)
function countFiles(dir) {
  try {
    const items = fs.readdirSync(dir);
    let count = 0;
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(rootDir, fullPath);
      
      // Skip if this path should be excluded
      if (effectiveExcludes.some(exclude => relativePath.startsWith(exclude))) {
        continue;
      }
      
      try {
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          count += countFiles(fullPath);
        } else {
          count++;
        }
      } catch (err) {
        console.warn(colors.yellow(`Error accessing ${fullPath}: ${err.message}`));
      }
    }
    
    return count;
  } catch (err) {
    console.warn(colors.yellow(`Error reading directory ${dir}: ${err.message}`));
    return 0;
  }
}

console.log(colors.blue('Counting files for backup (this may take a moment)...'));
sourceContents.forEach(item => {
  const fullPath = path.join(sourceDir, item);
  
  // Skip excluded directories and files
  if (effectiveExcludes.includes(item)) {
    return;
  }
  
  // If we have includes and this isn't in the list, skip it
  if (customIncludes.length > 0 && !customIncludes.includes(item)) {
    return;
  }
  
  try {
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      totalFiles += countFiles(fullPath);
    } else {
      totalFiles++;
    }
  } catch (err) {
    console.warn(colors.yellow(`Error accessing ${fullPath}: ${err.message}`));
  }
});

console.log(colors.blue(`Found ${totalFiles} files to backup.`));
progressBar.start(totalFiles, 0, { file: '' });

// Function to add files to archive with proper error handling
function addFilesToArchive(directory, basePath = '') {
  try {
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
      const fullPath = path.join(directory, item);
      const relativePath = path.relative(rootDir, fullPath);
      const archivePath = basePath ? path.join(basePath, item) : item;
      
      // Skip if this path should be excluded
      if (effectiveExcludes.some(exclude => relativePath.startsWith(exclude))) {
        continue;
      }
      
      try {
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          // For directories, recursively add content
          addFilesToArchive(fullPath, archivePath);
        } else {
          // For files, add to archive
          currentFile = relativePath;
          archive.file(fullPath, { name: archivePath });
          processedFiles++;
          progressBar.update(processedFiles, { file: truncateFilePath(currentFile, 50) });
        }
      } catch (err) {
        console.warn(colors.yellow(`\nError adding ${fullPath}: ${err.message}`));
      }
    }
  } catch (err) {
    console.warn(colors.yellow(`\nError reading directory ${directory}: ${err.message}`));
  }
}

// Function to truncate file path for display
function truncateFilePath(filePath, maxLength) {
  if (filePath.length <= maxLength) return filePath;
  
  const start = filePath.substring(0, Math.floor(maxLength/3));
  const end = filePath.substring(filePath.length - Math.floor(maxLength/3));
  return `${start}...${end}`;
}

// Add files to archive
sourceContents.forEach(item => {
  const fullPath = path.join(sourceDir, item);
  
  // Skip excluded directories and files
  if (effectiveExcludes.includes(item)) {
    return;
  }
  
  // If we have includes and this isn't in the list, skip it
  if (customIncludes.length > 0 && !customIncludes.includes(item)) {
    return;
  }
  
  try {
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      addFilesToArchive(fullPath, item);
    } else {
      currentFile = item;
      archive.file(fullPath, { name: item });
      processedFiles++;
      progressBar.update(processedFiles, { file: truncateFilePath(currentFile, 50) });
    }
  } catch (err) {
    console.warn(colors.yellow(`\nError accessing ${fullPath}: ${err.message}`));
  }
});

// Encrypt the backup if requested
function encryptBackupFile() {
  rl.question(colors.yellow('Enter password for encryption: '), (password) => {
    console.log(colors.blue('Encrypting backup file...'));
    
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create a cipher using AES-256-CBC
      const key = crypto.scryptSync(password, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Create read and write streams
      const input = fs.createReadStream(zipPath);
      const output = fs.createWriteStream(encryptedPath);
      
      // Write the IV to the beginning of the file
      output.write(iv);
      
      // Pipe the zip file through the cipher to the output file
      input.pipe(cipher).pipe(output);
      
      output.on('finish', () => {
        // Update metadata to indicate encryption
        metadata.encrypted = true;
        metadata.encryptionMethod = 'aes-256-cbc';
        metadata.hasIV = true;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        
        // Remove unencrypted zip file
        fs.unlinkSync(zipPath);
        
        console.log(colors.green(`Backup encrypted successfully: ${encryptedPath}`));
        console.log(colors.green('IMPORTANT: Keep the password safe. You will need it for restoration.'));
        rl.close();
      });
    } catch (err) {
      console.error(colors.red(`Error during encryption: ${err.message}`));
      console.log(colors.yellow(`Unencrypted backup is still available at: ${zipPath}`));
      rl.close();
    }
  });
}

archive.finalize();

console.log(colors.blue('Backup process initiated. Please wait for completion message...')); 