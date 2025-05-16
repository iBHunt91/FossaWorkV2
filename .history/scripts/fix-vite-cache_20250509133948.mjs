#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

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
  const tempDir = path.join(rootDir, 'node_modules', '.vite', 'temp');
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      if (file.includes('vite-port-')) {
        fs.unlinkSync(path.join(tempDir, file));
        console.log(`✅ Removed port lock file: ${file}`);
        cleanedAny = true;
      }
    }
  }
} catch (error) {
  // Ignore errors here as this is just an extra precaution
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

if (cleanedAny) {
  console.log('✨ Vite cache cleaning complete. All potential cache locations checked.');
} else {
  console.log('✨ No Vite cache found to clean. Your environment should be clean already.');
} 