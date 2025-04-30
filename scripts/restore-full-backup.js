import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';
import readline from 'readline';
import crypto from 'crypto';
import cliProgress from 'cli-progress';
import colors from 'ansi-colors';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const backupDir = path.join(rootDir, 'backups');
const tempDir = path.join(rootDir, 'temp-restore');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: colors.cyan('{bar}') + ' | {percentage}% | {value}/{total} files | {file}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

// List all full backups
function listFullBackups() {
  try {
    // Find both encrypted and regular backups
    const files = fs.readdirSync(backupDir)
      .filter(file => (
        (file.includes('FULL-backup') && file.endsWith('.zip')) || 
        (file.includes('FULL-backup') && file.endsWith('.enc'))
      ))
      .map(file => {
        const isEncrypted = file.endsWith('.enc');
        return {
          name: file,
          path: path.join(backupDir, file),
          time: fs.statSync(path.join(backupDir, file)).mtime.getTime(),
          isEncrypted
        };
      })
      .sort((a, b) => b.time - a.time); // Sort by time (newest first)
    
    if (files.length === 0) {
      console.log(colors.yellow('No full backups found.'));
      rl.close();
      return [];
    }
    
    console.log(colors.green('\nAvailable Full Backups:'));
    files.forEach((file, index) => {
      const date = new Date(file.time);
      const size = (fs.statSync(file.path).size / 1024 / 1024).toFixed(2) + ' MB';
      const encryptionStatus = file.isEncrypted ? colors.yellow('[ENCRYPTED]') : '';
      console.log(`${index + 1}. ${file.name} (${date.toLocaleString()}) ${size} ${encryptionStatus}`);
    });
    
    return files;
  } catch (err) {
    console.error(colors.red(`Error listing backups: ${err.message}`));
    rl.close();
    return [];
  }
}

// Decrypt an encrypted backup
function decryptBackup(backupFile) {
  return new Promise((resolve, reject) => {
    rl.question(colors.yellow('Enter password for decryption: '), async (password) => {
      try {
        console.log(colors.blue('Decrypting backup file...'));
        
        // Read the file
        const data = fs.readFileSync(backupFile.path);
        
        // Extract the IV (first 16 bytes)
        const iv = data.slice(0, 16);
        const encryptedData = data.slice(16);
        
        // Create decipher
        const key = crypto.scryptSync(password, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        
        // Decrypt the data
        const decryptedPath = backupFile.path.replace('.enc', '.zip');
        
        try {
          // Decrypt in memory first to verify password before writing file
          const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
          ]);
          
          // Write to file
          fs.writeFileSync(decryptedPath, decrypted);
          console.log(colors.green('Decryption successful!'));
          
          // Return the path to the decrypted file
          resolve({
            path: decryptedPath,
            name: path.basename(decryptedPath)
          });
        } catch (err) {
          console.error(colors.red('Decryption failed: Invalid password or corrupted backup.'));
          reject(new Error('Decryption failed'));
        }
      } catch (err) {
        console.error(colors.red(`Error during decryption: ${err.message}`));
        reject(err);
      }
    });
  });
}

// Restore from backup
async function restoreBackup(backupFile) {
  try {
    let fileToRestore = backupFile;
    
    // If encrypted, decrypt first
    if (backupFile.isEncrypted) {
      try {
        fileToRestore = await decryptBackup(backupFile);
      } catch (err) {
        console.log(colors.red('Restoration cancelled due to decryption failure.'));
        rl.close();
        return;
      }
    }
    
    console.log(colors.yellow(`\nRestoring from: ${fileToRestore.name}`));
    console.log(colors.red('WARNING: This will overwrite existing files!'));
    
    rl.question('Are you sure you want to continue? (y/n): ', (answer) => {
      if (answer.toLowerCase() !== 'y') {
        console.log(colors.yellow('Restore cancelled.'));
        // Clean up decrypted file if needed
        if (backupFile.isEncrypted && fs.existsSync(fileToRestore.path)) {
          fs.unlinkSync(fileToRestore.path);
        }
        rl.close();
        return;
      }
      
      // Create temp dir for extraction
      if (fs.existsSync(tempDir)) {
        fs.removeSync(tempDir);
      }
      fs.mkdirSync(tempDir);
      
      console.log(colors.blue('Extracting backup...'));
      const zip = new AdmZip(fileToRestore.path);
      zip.extractAllTo(tempDir, true);
      
      // Clean up decrypted file if it was created during this process
      if (backupFile.isEncrypted && fs.existsSync(fileToRestore.path)) {
        fs.unlinkSync(fileToRestore.path);
      }
      
      // Check if metadata exists
      const metadataPath = path.join(tempDir, 'backup-metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath));
        console.log(colors.green('\nBackup Metadata:'));
        console.log(colors.blue(`Timestamp: ${metadata.timestamp}`));
        console.log(colors.blue(`App Version: ${metadata.appVersion}`));
        console.log(colors.blue(`Backup Type: ${metadata.backupType}`));
        
        if (metadata.excludedDirs) {
          console.log(colors.blue(`Excluded Directories: ${metadata.excludedDirs.join(', ')}`));
        }
        
        if (metadata.includedDirs && metadata.includedDirs.length > 0) {
          console.log(colors.blue(`Included Directories: ${metadata.includedDirs.join(', ')}`));
        }
        
        rl.question('\nContinue with restore? (y/n): ', (answer) => {
          if (answer.toLowerCase() !== 'y') {
            console.log(colors.yellow('Restore cancelled.'));
            fs.removeSync(tempDir);
            rl.close();
            return;
          }
          
          performRestore(tempDir, metadata);
        });
      } else {
        rl.question('\nNo metadata found. Continue with restore? (y/n): ', (answer) => {
          if (answer.toLowerCase() !== 'y') {
            console.log(colors.yellow('Restore cancelled.'));
            fs.removeSync(tempDir);
            rl.close();
            return;
          }
          
          performRestore(tempDir);
        });
      }
    });
  } catch (err) {
    console.error(colors.red(`Error restoring backup: ${err.message}`));
    rl.close();
  }
}

// Perform the actual restore
function performRestore(tempDir, metadata = null) {
  try {
    // Create a backup of current state first
    console.log(colors.blue('Creating backup of current state...'));
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const preRestoreBackupDir = path.join(backupDir, `pre-restore-backup-${timestamp}`);
    fs.mkdirSync(preRestoreBackupDir);
    
    // Copy critical files to pre-restore backup
    const criticalFiles = [
      'package.json',
      '.env',
      'vite.config.ts'
    ];
    
    for (const file of criticalFiles) {
      const sourcePath = path.join(rootDir, file);
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, path.join(preRestoreBackupDir, file));
        console.log(colors.blue(`Backed up ${file}`));
      }
    }
    
    // Get list of files to copy (exclude node_modules and some directories)
    console.log(colors.blue('Restoring files...'));
    const excludeDirs = ['node_modules', '.git', 'dist', 'temp-restore', 'backups'];
    
    // Copy files from temp to root
    const items = fs.readdirSync(tempDir);
    const totalItems = items.filter(item => !excludeDirs.includes(item)).length;
    let processedItems = 0;
    
    progressBar.start(totalItems, 0, { file: '' });
    
    for (const item of items) {
      if (excludeDirs.includes(item)) continue;
      
      const sourcePath = path.join(tempDir, item);
      const destPath = path.join(rootDir, item);
      
      try {
        if (fs.existsSync(destPath)) {
          fs.removeSync(destPath);
        }
        
        fs.copySync(sourcePath, destPath);
        processedItems++;
        progressBar.update(processedItems, { file: item });
      } catch (err) {
        console.error(colors.red(`\nError restoring ${item}: ${err.message}`));
      }
    }
    
    progressBar.stop();
    
    // Clean up
    fs.removeSync(tempDir);
    console.log(colors.green('\nRestore completed successfully!'));
    console.log(colors.yellow('Note: You may need to run "npm install" to ensure dependencies are correct.'));
    
    // Add installation prompt
    rl.question('\nWould you like to run npm install now? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        console.log(colors.blue('Running npm install...'));
        
        const { execSync } = require('child_process');
        
        try {
          execSync('npm install', { 
            cwd: rootDir,
            stdio: 'inherit'
          });
          console.log(colors.green('Dependencies installed successfully.'));
        } catch (err) {
          console.error(colors.red('Error installing dependencies. You may need to run npm install manually.'));
        }
      }
      
      console.log(colors.green('\nRestore process complete!'));
      rl.close();
    });
  } catch (err) {
    console.error(colors.red(`Error during restore: ${err.message}`));
    rl.close();
  }
}

// Main execution
console.log(colors.green('FOSSA Monitor - Full Backup Restore'));
console.log(colors.green('==================================='));

const backups = listFullBackups();

if (backups.length > 0) {
  rl.question('\nEnter the number of the backup to restore (or 0 to exit): ', (answer) => {
    const selected = parseInt(answer);
    
    if (isNaN(selected) || selected === 0 || selected > backups.length) {
      console.log(colors.yellow('Restore cancelled.'));
      rl.close();
      return;
    }
    
    restoreBackup(backups[selected - 1]);
  });
} else {
  rl.close();
} 