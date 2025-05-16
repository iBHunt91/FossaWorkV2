#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { platform, tmpdir, homedir } from 'os';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve paths
const rootDir = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(rootDir, 'node_modules');
const cacheDir = path.join(rootDir, 'node_modules', '.vite');

// Define all possible cache locations
const cacheDirs = [
  cacheDir,
  path.join(rootDir, '.vite'),
  path.join(rootDir, 'node_modules', '.cache'),
  path.join(rootDir, 'node_modules', '.vite-cache'),
  path.join(rootDir, '.cache'),
  path.join(rootDir, 'dist'),
  path.join(rootDir, '.tmp'),
];

// Define the temp dirs to search for port lock files
const tempDirsToCheck = [
  ...cacheDirs,
  path.join(tmpdir(), '.vite'),
  path.join(homedir(), '.vite'),
];

// Create cleanup function
function cleanDirectory(dir, label) {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✅ ${label} directory removed successfully.`);
      return true;
    } catch (error) {
      console.error(`❌ Error removing ${label} directory:`, error.message);
      // Try with a more aggressive approach if available
      try {
        if (platform() === 'win32') {
          execSync(`rmdir /S /Q "${dir}"`, { stdio: 'ignore' });
          console.log(`✅ ${label} directory removed using rmdir command.`);
          return true;
        } else {
          execSync(`rm -rf "${dir}"`, { stdio: 'ignore' });
          console.log(`✅ ${label} directory removed using rm command.`);
          return true;
        }
      } catch (cmdError) {
        // Ignore errors from command line attempt
      }
      return false;
    }
  }
  return false;
}

// Track if anything was cleaned
let cleanedAny = false;

// Clean all cache directories
for (const dir of cacheDirs) {
  if (cleanDirectory(dir, path.basename(dir))) {
    cleanedAny = true;
  }
}

// Also try to get any temporary port locks that might be lingering
try {
  console.log('Looking for Vite port lock files...');
  for (const baseDir of tempDirsToCheck) {
    if (fs.existsSync(baseDir)) {
      // Check main directory first
      const files = fs.readdirSync(baseDir);
      for (const file of files) {
        const fullPath = path.join(baseDir, file);
        if (file.includes('vite-port-')) {
          fs.unlinkSync(fullPath);
          console.log(`✅ Removed port lock file: ${fullPath}`);
          cleanedAny = true;
        }
      }
      
      // Check for a temp subdirectory
      const tempDir = path.join(baseDir, 'temp');
      if (fs.existsSync(tempDir)) {
        const tempFiles = fs.readdirSync(tempDir);
        for (const file of tempFiles) {
          const fullPath = path.join(tempDir, file);
          if (file.includes('vite-port-')) {
            fs.unlinkSync(fullPath);
            console.log(`✅ Removed port lock file: ${fullPath}`);
            cleanedAny = true;
          }
        }
      }
    }
  }
} catch (error) {
  console.error('❌ Error checking for port lock files:', error.message);
}

// Try to force rebuild node-sass if it exists (common source of Vite issues)
const nodeSassDir = path.join(nodeModulesDir, 'node-sass');
if (fs.existsSync(nodeSassDir)) {
  try {
    console.log('Attempting to rebuild node-sass...');
    execSync('npm rebuild node-sass', { cwd: rootDir, stdio: 'inherit' });
    console.log('✅ node-sass rebuilt successfully.');
    cleanedAny = true;
  } catch (error) {
    console.error('❌ Error rebuilding node-sass:', error.message);
  }
}

// Additional steps to try if any Tailwind-related packages exist
const tailwindDir = path.join(nodeModulesDir, 'tailwindcss');
if (fs.existsSync(tailwindDir)) {
  // Clean postcss cache if it exists
  const postcssCache = path.join(rootDir, '.postcss-cache');
  cleanDirectory(postcssCache, 'PostCSS cache');
}

// Check if we need to kill processes on ports
try {
  console.log('Checking for processes on common Vite ports...');
  const ports = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];
  
  if (platform() === 'win32') {
    // Windows approach
    for (const port of ports) {
      try {
        const { stdout } = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
        if (stdout.trim()) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              console.log(`Found process ${pid} on port ${port}, attempting to kill...`);
              execSync(`taskkill /PID ${pid} /F /T`).catch(() => {});
              cleanedAny = true;
            }
          }
        }
      } catch (e) {
        // Ignore errors - likely no process found
      }
    }
  } else {
    // Mac/Linux approach
    for (const port of ports) {
      try {
        const { stdout } = execSync(`lsof -i :${port} -t`, { encoding: 'utf8' });
        if (stdout.trim()) {
          console.log(`Found process ${stdout.trim()} on port ${port}, attempting to kill...`);
          execSync(`kill -9 ${stdout.trim()}`).catch(() => {});
          cleanedAny = true;
        }
      } catch (e) {
        // Ignore errors - likely no process found
      }
    }
  }
} catch (error) {
  // Ignore any errors from process checks
}

if (cleanedAny) {
  console.log('✨ Vite cache cleaning complete. All potential cache locations checked.');
} else {
  console.log('✨ No Vite cache found to clean. Your environment should be clean already.');
} 