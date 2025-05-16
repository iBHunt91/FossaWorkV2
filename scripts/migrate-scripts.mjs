/**
 * Script Migration Automation
 * 
 * This script automates the copying of files to their new locations according to our
 * script migration plan. It preserves the original files to ensure backward compatibility
 * during the transition.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the migration mapping
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

// Function to copy files
function copyFiles() {
  const scriptsDir = path.join(dirname(__dirname), 'scripts');
  
  // Create directories if they don't exist
  Object.keys(migrationMap).forEach(dir => {
    const dirPath = path.join(scriptsDir, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
  
  // Copy files to their new locations
  let copied = 0;
  let skipped = 0;
  
  Object.entries(migrationMap).forEach(([dir, files]) => {
    files.forEach(file => {
      const sourcePath = path.join(scriptsDir, file);
      const destPath = path.join(scriptsDir, dir, file);
      
      if (fs.existsSync(sourcePath)) {
        try {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`Copied: ${file} -> ${dir}/${file}`);
          copied++;
        } catch (error) {
          console.error(`Error copying ${file} to ${dir}: ${error.message}`);
        }
      } else {
        console.log(`Skipped: ${file} (source file does not exist)`);
        skipped++;
      }
    });
  });
  
  console.log(`\nMigration Summary:`);
  console.log(`- ${copied} files copied`);
  console.log(`- ${skipped} files skipped (source not found)`);
  
  console.log(`\nNext steps:`);
  console.log(`1. Update package.json to reference the new file locations`);
  console.log(`2. Test that all scripts work from their new locations`);
  console.log(`3. Once everything is working, you can remove the original files`);
}

// Function to update package.json (optional)
async function updatePackageJson() {
  const packageJsonPath = path.join(dirname(__dirname), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error('package.json not found');
    return;
  }
  
  // Create backup
  const backupPath = path.join(dirname(__dirname), 'package.json.bak');
  fs.copyFileSync(packageJsonPath, backupPath);
  console.log('Created backup of package.json at package.json.bak');
  
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Define script path updates
  const scriptUpdates = {
    'server:restart': 'scripts/app_mgmt/restart-server.js',
    'cleanup': 'scripts/maintenance_tools/cleanup-processes.js',
    'setup': 'scripts/setup_init/setup.js',
    'bootstrap-templates': 'scripts/setup_init/bootstrap-templates.js',
    'electron:shutdown': 'scripts/app_mgmt/shutdown-app.js',
    'electron:help': 'scripts/app_mgmt/app-help.js',
    'start:hidden': 'scripts/app_mgmt/hide-cmd.vbs',
    'backup': 'scripts/backup_utils/backup.js',
    'full-backup': 'scripts/backup_utils/full-backup.js',
    'restore': 'scripts/backup_utils/restore.js',
    'restore-full': 'scripts/backup_utils/restore-full-backup.js',
    'scheduled-backup': 'scripts/backup_utils/scheduled-backup.js',
    'cleanup-ports': 'scripts/maintenance_tools/cleanup-ports.js',
    'free-port': 'scripts/dev_tools/free-port.js',
    'enhance-logs': 'scripts/maintenance_tools/enhance-existing-logs.js',
    'fix-vite-cache': 'scripts/dev_tools/fix-vite-cache.mjs',
    'fix-vite-issues': 'scripts/dev_tools/fix-vite-issues.mjs',
    'fix-tailwind': 'scripts/dev_tools/fix-tailwind.mjs'
  };
  
  // Update script paths
  let updated = 0;
  
  if (packageJson.scripts) {
    Object.entries(scriptUpdates).forEach(([scriptName, newPath]) => {
      if (packageJson.scripts[scriptName]) {
        const oldScript = packageJson.scripts[scriptName];
        // Only update paths that match our expected pattern
        if (oldScript.includes('node scripts/')) {
          const newScript = oldScript.replace(/node scripts\/[\w\-\.]+\.(?:js|mjs|cjs|vbs)/, `node ${newPath}`);
          packageJson.scripts[scriptName] = newScript;
          console.log(`Updated script: ${scriptName}`);
          updated++;
        }
      }
    });
  }
  
  // Write updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  
  console.log(`\nPackage.json Update Summary:`);
  console.log(`- ${updated} script paths updated`);
  console.log(`- Backup created at package.json.bak`);
}

// Execute the migration
console.log('Starting script migration process...');
copyFiles();

// Update package.json references
await updatePackageJson(); 