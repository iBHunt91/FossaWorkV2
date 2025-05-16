#!/usr/bin/env node

import { platform } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Define the ports used by the application
const PORTS_TO_FREE = [3001, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];

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
    } else {
      // Mac/Linux: Kill typical processes by pattern
      await execAsync("ps aux | grep '[e]lectron' | awk '{print $2}' | xargs kill -9").catch(() => {});
      await execAsync("ps aux | grep '[v]ite' | awk '{print $2}' | xargs kill -9").catch(() => {});
      await execAsync("ps aux | grep '[s]erver.js' | awk '{print $2}' | xargs kill -9").catch(() => {});
    }
  } catch (error) {
    // Ignore errors
  }
}

async function main() {
  console.log('==== FORCEFULLY SHUTTING DOWN ALL APP PROCESSES ====');
  
  try {
    // Try both methods for maximum effectiveness
    await killProcessesByPort();
    await killProcessesByName();
    
    console.log('✅ Cleanup complete. All app processes should be terminated.');
  } catch (error) {
    console.error('Error during shutdown:', error.message);
  }
}

main(); 