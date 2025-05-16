#!/usr/bin/env node

import { platform } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Define the ports used by the application
const PORTS_TO_FREE = [3000, 3001, 3002, 3003, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 5181, 5182, 5183, 5184, 5185];

// Use platform-specific commands for process cleanup
const isWindows = platform() === 'win32';

async function killProcessesByPort() {
  console.log('Shutting down app processes on ports:', PORTS_TO_FREE.join(', '));
  
  for (const port of PORTS_TO_FREE) {
    try {
      if (isWindows) {
        // Windows: Find process on port and kill it
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        if (stdout.trim()) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              console.log(`Killing process ${pid} on port ${port}`);
              await execAsync(`taskkill /PID ${pid} /F /T`).catch(() => {});
            }
          }
        }
      } else {
        // Mac/Linux: Find process on port and kill it
        const { stdout } = await execAsync(`lsof -i :${port} -t`);
        if (stdout.trim()) {
          console.log(`Killing process ${stdout.trim()} on port ${port}`);
          await execAsync(`kill -9 ${stdout.trim()}`).catch(() => {});
        }
      }
    } catch (error) {
      // Ignore any errors - the process might not exist
    }
  }
}

async function killProcessesByName() {
  console.log('Shutting down app processes by name');
  
  try {
    if (isWindows) {
      // Windows: Kill typical processes by image name
      await execAsync('taskkill /F /IM electron.exe /T').catch(() => {});
      await execAsync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq *vite*"').catch(() => {});
      await execAsync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq *server*"').catch(() => {});
      
      // More aggressive approach - terminate all node processes that might be related to our app
      console.log('Attempting more aggressive cleanup...');
      
      try {
        const { stdout } = await execAsync('wmic process where "name=\'node.exe\'" get commandline,processid');
        const lines = stdout.trim().split('\n');
        
        for (const line of lines) {
          if (line.includes('vite') || line.includes('electron') || 
              line.includes('server.js') || line.includes('dev') || 
              line.includes('FM WORKING')) {
            
            const pidMatch = /(\d+)\s*$/.exec(line);
            if (pidMatch && pidMatch[1]) {
              const pid = pidMatch[1].trim();
              console.log(`Killing node process ${pid}: ${line.substring(0, 50)}...`);
              await execAsync(`taskkill /PID ${pid} /F /T`).catch(() => {});
            }
          }
        }
      } catch (e) {
        // Ignore errors from wmic command
      }
    } else {
      // Mac/Linux: Kill typical processes by pattern
      await execAsync("ps aux | grep '[e]lectron' | awk '{print $2}' | xargs kill -9").catch(() => {});
      await execAsync("ps aux | grep '[v]ite' | awk '{print $2}' | xargs kill -9").catch(() => {});
      await execAsync("ps aux | grep '[s]erver.js' | awk '{print $2}' | xargs kill -9").catch(() => {});
      
      // More aggressive approach for Unix-like systems
      await execAsync("ps aux | grep -E 'node.*vite|node.*electron|node.*server.js|node.*FM WORKING' | grep -v grep | awk '{print $2}' | xargs kill -9").catch(() => {});
    }
  } catch (error) {
    // Ignore errors
  }
}

async function clearViteLocks() {
  console.log('Clearing Vite port locks and cache files...');
  
  try {
    // Check several possible .vite cache locations
    const viteCacheDirs = [
      path.join(projectRoot, 'node_modules', '.vite'),
      path.join(projectRoot, '.vite'),
      path.join(projectRoot, 'node_modules', '.vite-cache'),
    ];
    
    for (const cacheDir of viteCacheDirs) {
      if (fs.existsSync(cacheDir)) {
        try {
          const tempDir = path.join(cacheDir, 'temp');
          if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
              if (file.includes('vite-port-')) {
                fs.unlinkSync(path.join(tempDir, file));
                console.log(`✅ Removed port lock file: ${file}`);
              }
            }
          }
        } catch (e) {
          // Ignore errors deleting individual files
        }
      }
    }
  } catch (error) {
    console.error('Error clearing Vite locks:', error.message);
  }
}

async function main() {
  console.log('==== FORCEFULLY SHUTTING DOWN ALL APP PROCESSES ====');
  
  try {
    // First try port-specific process cleanup
    await killProcessesByPort();
    
    // Then try process name based cleanup
    await killProcessesByName();
    
    // Finally clear any Vite port locks
    await clearViteLocks();
    
    // Wait a moment for all processes to fully terminate
    console.log('Waiting for processes to terminate...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Cleanup complete. All app processes should be terminated.');
  } catch (error) {
    console.error('Error during shutdown:', error.message);
  }
}

main(); 