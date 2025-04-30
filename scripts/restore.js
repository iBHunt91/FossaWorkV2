import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDir = path.join(__dirname, '..', 'backups');
const projectRoot = path.join(__dirname, '..');

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// List available backups
function listBackups() {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.zip'))
      .sort((a, b) => {
        // Sort by modification time (newest first)
        return fs.statSync(path.join(backupDir, b)).mtime.getTime() - 
               fs.statSync(path.join(backupDir, a)).mtime.getTime();
      });

    if (files.length === 0) {
      console.log('No backups found in the backups directory.');
      rl.close();
      return;
    }

    console.log('Available backups:');
    files.forEach((file, index) => {
      const stats = fs.statSync(path.join(backupDir, file));
      const date = stats.mtime.toLocaleString();
      const size = (stats.size / 1024 / 1024).toFixed(2) + ' MB';
      console.log(`${index + 1}. ${file} (${date}, ${size})`);
    });

    // Ask user to select a backup
    rl.question('Select a backup to restore (number) or 0 to cancel: ', (answer) => {
      const selection = parseInt(answer, 10);
      
      if (selection === 0 || isNaN(selection) || selection > files.length) {
        console.log('Restore cancelled.');
        rl.close();
        return;
      }

      const selectedBackup = files[selection - 1];
      confirmRestore(selectedBackup);
    });
  } catch (err) {
    console.error('Error listing backups:', err);
    rl.close();
  }
}

// Confirm restore action
function confirmRestore(backupFile) {
  rl.question(`Are you sure you want to restore from ${backupFile}? This will overwrite current files. (y/n): `, (answer) => {
    if (answer.toLowerCase() === 'y') {
      restoreBackup(backupFile);
    } else {
      console.log('Restore cancelled.');
      rl.close();
    }
  });
}

// Restore from backup
function restoreBackup(backupFile) {
  try {
    console.log(`Restoring from ${backupFile}...`);
    const backupPath = path.join(backupDir, backupFile);
    
    // Create a temporary directory for extraction
    const tempDir = path.join(backupDir, 'temp_restore');
    if (fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
    fs.mkdirSync(tempDir);
    
    // Extract the zip file
    const zip = new AdmZip(backupPath);
    console.log('Extracting backup...');
    zip.extractAllTo(tempDir, true);
    
    // Copy files to project root
    console.log('Copying files to project directory...');
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      const sourcePath = path.join(tempDir, file);
      const destPath = path.join(projectRoot, file);
      
      // Skip node_modules
      if (file === 'node_modules') return;
      
      // Remove existing file/directory
      if (fs.existsSync(destPath)) {
        fs.removeSync(destPath);
      }
      
      // Copy file/directory
      fs.copySync(sourcePath, destPath);
    });
    
    // Clean up temp directory
    fs.removeSync(tempDir);
    
    console.log('Restore completed successfully!');
    console.log('Note: You may need to run "npm install" to reinstall dependencies.');
    rl.close();
  } catch (err) {
    console.error('Error during restore:', err);
    rl.close();
  }
}

// Start the process
console.log('Fossa Monitor Backup Restore Utility');
console.log('------------------------------------');
listBackups(); 