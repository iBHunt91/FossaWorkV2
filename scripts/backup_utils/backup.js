import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import moment from 'moment';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create timestamp for the backup
const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
const backupDir = path.join(__dirname, '..', 'backups');
const backupName = `fossa-monitor-backup-${timestamp}`;
const backupPath = path.join(backupDir, backupName);
const zipPath = `${backupPath}.zip`;

// Directories and files to exclude from backup
const excludes = [
  'node_modules',
  'dist',
  '.git',
  'backups'
];

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log(`Starting backup to ${backupPath}...`);

// Create zip archive
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  console.log(`Backup completed successfully: ${zipPath}`);
  console.log(`Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add files to the archive
const sourceDir = path.join(__dirname, '..');
const sourceContents = fs.readdirSync(sourceDir);

sourceContents.forEach(item => {
  const fullPath = path.join(sourceDir, item);
  
  // Skip excluded directories and files
  if (excludes.includes(item)) {
    return;
  }
  
  const stats = fs.statSync(fullPath);
  
  if (stats.isDirectory()) {
    archive.directory(fullPath, item);
  } else {
    archive.file(fullPath, { name: item });
  }
});

archive.finalize();

console.log('Backup process initiated. Please wait for completion message...'); 