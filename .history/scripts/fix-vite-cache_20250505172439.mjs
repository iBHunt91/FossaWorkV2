#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve paths
const rootDir = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(rootDir, 'node_modules');
const cacheDir = path.join(rootDir, 'node_modules', '.vite');

console.log('🧹 Cleaning Vite cache to fix module loading issues...');

// Clear node_modules/.vite cache directory
if (fs.existsSync(cacheDir)) {
  console.log(`Found Vite cache at: ${cacheDir}`);
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log('✅ Vite cache directory removed successfully.');
  } catch (error) {
    console.error('❌ Error removing Vite cache directory:', error);
  }
} else {
  console.log('No Vite cache directory found at:', cacheDir);
}

// If there's a .vite-cache in the root folder
const rootViteCache = path.join(rootDir, '.vite');
if (fs.existsSync(rootViteCache)) {
  console.log(`Found Vite cache at: ${rootViteCache}`);
  try {
    fs.rmSync(rootViteCache, { recursive: true, force: true });
    console.log('✅ Root .vite cache directory removed successfully.');
  } catch (error) {
    console.error('❌ Error removing root .vite cache directory:', error);
  }
}

console.log('✨ Vite cache cleaning complete.');
console.log('👉 Next steps:');
console.log('   1. Run "npm install" to ensure dependencies are properly installed');
console.log('   2. Start the application with "npm run electron:dev:start"'); 