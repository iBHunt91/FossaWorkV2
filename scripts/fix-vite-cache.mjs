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

// Skip verbose logging for faster execution
if (fs.existsSync(cacheDir)) {
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log('✅ Vite cache directory removed successfully.');
  } catch (error) {
    console.error('❌ Error removing Vite cache directory:', error);
  }
}

// If there's a .vite-cache in the root folder
const rootViteCache = path.join(rootDir, '.vite');
if (fs.existsSync(rootViteCache)) {
  try {
    fs.rmSync(rootViteCache, { recursive: true, force: true });
    console.log('✅ Root .vite cache directory removed successfully.');
  } catch (error) {
    console.error('❌ Error removing root .vite cache directory:', error);
  }
}

// Skip next steps suggestions for faster execution
console.log('✨ Vite cache cleaning complete.'); 