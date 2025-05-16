/**
 * Script Migration Cleanup
 * 
 * This script removes the original files that were migrated to new directory locations.
 * Run this ONLY after verifying that all scripts work from their new locations.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the migration mapping (same as in migrate-scripts.mjs)
const migrationMap = {
  'app_mgmt': [
    'app-help.js',
    'restart-server.js',
    'hide-cmd.vbs',
    'shutdown-app.js'
  ],
  'backup_utils': [
    'backup.js',
    'full-backup.js',
    'restore.js',
    'restore-full-backup.js',
    'scheduled-backup.js'
  ],
  'dev_tools': [
    'fix-vite-cache.mjs',
    'fix-vite-issues.mjs',
    'fix-tailwind.mjs',
    'free-port.js'
  ],
  'test_scripts': [
    'test-notifications.js',
    'test-features.js',
    'test-manual-entry.js',
    'test-completed-jobs.js',
    'test-completed-jobs-removal.js',
    'test-credentials.js',
    'test-daily-digest.js',
    'test-digest-data.js',
    'test-notification-frequency.js',
    'test-simple.js'
  ],
  'setup_init': [
    'setup.js',
    'init-data.js',
    'bootstrap-templates.js'
  ],
  'maintenance_tools': [
    'cleanup-processes.js',
    'cleanup-ports.js',
    'enhance-existing-logs.js',
    'enhance-scrape-logs.js'
  ]
};

// Get a flat list of all files to be removed
const filesToRemove = Object.values(migrationMap).flat();

// Function to remove files
async function removeFiles() {
  console.log('WARNING: This script will remove original script files that have been migrated.');
  console.log('Make sure you have verified that all scripts work from their new locations.');
  
  // Add a small delay to allow user to read the warning
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\nProceeding with cleanup...');
  
  const scriptsDir = path.join(dirname(__dirname), 'scripts');
  let removed = 0;
  let notFound = 0;
  
  for (const file of filesToRemove) {
    const filePath = path.join(scriptsDir, file);
    
    if (fs.existsSync(filePath)) {
      try {
        // Check if the file exists in its new location before removing
        const dir = Object.entries(migrationMap).find(([_, files]) => files.includes(file))[0];
        const newLocation = path.join(scriptsDir, dir, file);
        
        if (fs.existsSync(newLocation)) {
          fs.unlinkSync(filePath);
          console.log(`Removed: ${file}`);
          removed++;
        } else {
          console.log(`Skipped: ${file} (not found in new location)`);
        }
      } catch (error) {
        console.error(`Error removing ${file}: ${error.message}`);
      }
    } else {
      console.log(`Skipped: ${file} (original file not found)`);
      notFound++;
    }
  }
  
  console.log(`\nCleanup Summary:`);
  console.log(`- ${removed} files removed`);
  console.log(`- ${notFound} files skipped (not found)`);
  
  console.log(`\nScript migration and cleanup is now complete!`);
}

// Ask for confirmation before proceeding
console.log('Script Migration Cleanup');
console.log('======================');
console.log(`This script will remove ${filesToRemove.length} original files that have been migrated to new directories.`);
console.log('Please verify that all scripts work from their new locations before running this script.');
console.log('\nPress any key to continue or CTRL+C to abort...');

// Wait for user input before proceeding
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.once('data', () => {
  process.stdin.setRawMode(false);
  removeFiles();
}); 