#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';

const execAsync = promisify(exec);

const PORTS = [3001, 5173, 5174, 5175, 5176, 5177];

async function killProcessOnPort(port) {
  const isWindows = platform() === 'win32';
  
  try {
    if (isWindows) {
      // On Windows, use a more direct command to find and kill processes
      const findCmd = `for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}" ^| find "LISTENING"') do taskkill /F /PID %a`;
      await execAsync(findCmd, { shell: true });
    } else {
      // For Unix-like systems
      const { stdout } = await execAsync(`lsof -i :${port} -t`);
      const pids = stdout.split('\n').filter(pid => pid.trim());
      
      for (const pid of pids) {
        if (pid) {
          console.log(`Killing process ${pid} using port ${port}`);
          await execAsync(`kill -9 ${pid}`);
        }
      }
    }
  } catch (error) {
    // Ignore errors if no process is found
    if (!error.message.includes('no process found') && !error.message.includes('SYSTEM')) {
      console.error(`Error cleaning up port ${port}:`, error.message);
    }
  }
}

async function cleanupPorts() {
  console.log('Starting port cleanup...');
  
  // Kill all Node.js and Electron processes first
  if (platform() === 'win32') {
    try {
      await execAsync('taskkill /F /IM node.exe', { shell: true });
      console.log('Killed all Node.js processes');
    } catch (error) {
      console.log('No Node.js processes to kill');
    }
    
    try {
      await execAsync('taskkill /F /IM electron.exe', { shell: true });
      console.log('Killed all Electron processes');
    } catch (error) {
      console.log('No Electron processes to kill');
    }

    // Additional cleanup for Windows
    try {
      await execAsync('net stop http', { shell: true });
    } catch (error) {
      // Ignore error if service is not running
    }
  }

  // Then clean up specific ports
  console.log('Cleaning up specific ports...');
  for (const port of PORTS) {
    await killProcessOnPort(port);
  }
  
  // Double-check the ports after cleanup
  if (platform() === 'win32') {
    for (const port of PORTS) {
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
        if (stdout.trim()) {
          console.log(`Port ${port} is still in use, attempting force cleanup...`);
          await execAsync(`for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}" ^| find "LISTENING"') do taskkill /F /PID %a`, { shell: true });
        }
      } catch (error) {
        // Port is likely free if we get here
      }
    }
  }
  
  console.log('Port cleanup complete');
}

// Run the cleanup and wait for it to complete
cleanupPorts()
  .then(() => {
    console.log('Cleanup finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }); 