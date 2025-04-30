import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create backup directory with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(__dirname, `backup_${timestamp}`);

// Directories and files to backup
const itemsToBackup = [
    'src',
    'scripts',
    'data',
    'server.js',
    'package.json',
    'package-lock.json',
    'vite.config.ts',
    'index.html',
    'postcss.config.mjs',
    'tailwind.config.js',
    '.env',
    'README.md',
    'IMPROVEMENTS.md'
];

// Create backup directory
fs.mkdirSync(backupDir, { recursive: true });

// Copy each item to backup directory
itemsToBackup.forEach(item => {
    const sourcePath = path.join(__dirname, item);
    const targetPath = path.join(backupDir, item);
    
    if (fs.existsSync(sourcePath)) {
        if (fs.lstatSync(sourcePath).isDirectory()) {
            // Copy directory recursively
            execSync(`xcopy /E /I /Y "${sourcePath}" "${targetPath}"`);
        } else {
            // Copy file
            fs.copyFileSync(sourcePath, targetPath);
        }
        console.log(`Backed up: ${item}`);
    } else {
        console.log(`Warning: ${item} not found, skipping...`);
    }
});

// Create Windows restore script
const restoreScript = `@echo off
echo Restoring Fossa Monitor from backup...

:: Remove current files
rmdir /s /q src
rmdir /s /q scripts
rmdir /s /q data
del server.js
del package.json
del package-lock.json
del vite.config.ts
del index.html
del postcss.config.mjs
del tailwind.config.js
del .env
del README.md
del IMPROVEMENTS.md

:: Copy files from backup
xcopy /E /I /Y "${backupDir}\\*" .

:: Install dependencies
call npm install

echo Restore complete! You can now run the application using:
echo npm start
`;

// Save restore script
fs.writeFileSync(path.join(backupDir, 'restore.bat'), restoreScript);

console.log(`
Backup completed successfully!
Backup location: ${backupDir}

To restore from this backup:
1. Navigate to the backup directory
2. Double-click restore.bat
`); 