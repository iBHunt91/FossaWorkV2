import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import moment from 'moment';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path configurations
const backupDir = path.join(__dirname, '..', 'backups');
const backupLogPath = path.join(backupDir, 'backup-logs.txt');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Log function
function logMessage(message) {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  const logLine = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  fs.appendFileSync(backupLogPath, logLine);
}

// Execute backup function
function executeBackup() {
  logMessage('Starting scheduled backup...');
  
  const backupProcess = spawn('node', [path.join(__dirname, 'backup.js')], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe'
  });
  
  backupProcess.stdout.on('data', (data) => {
    logMessage(`Backup output: ${data.toString().trim()}`);
  });
  
  backupProcess.stderr.on('data', (data) => {
    logMessage(`Backup error: ${data.toString().trim()}`);
  });
  
  backupProcess.on('close', (code) => {
    if (code === 0) {
      logMessage('Scheduled backup completed successfully');
      
      // Clean up old backups (keep the last 5)
      cleanupOldBackups();
    } else {
      logMessage(`Scheduled backup failed with code ${code}`);
    }
  });
}

// Clean up old backups (keep the latest 5)
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.zip'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort by time (newest first)
    
    // Keep only the latest 5 backups
    if (files.length > 5) {
      logMessage(`Found ${files.length} backups, keeping the latest 5...`);
      const filesToDelete = files.slice(5);
      
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        logMessage(`Deleted old backup: ${file.name}`);
      });
    }
  } catch (err) {
    logMessage(`Error cleaning up old backups: ${err.message}`);
  }
}

// Schedule: Run daily at 3:00 AM
// Change the cron schedule as needed: '0 3 * * *' = 3:00 AM every day
cron.schedule('0 3 * * *', () => {
  executeBackup();
});

// Also run backup when this script starts
executeBackup();

logMessage('Scheduled backup service started. Backup will run daily at 3:00 AM.');
logMessage('Press Ctrl+C to stop the service.');

// Handle process termination
process.on('SIGINT', () => {
  logMessage('Scheduled backup service stopped.');
  process.exit(0);
}); 