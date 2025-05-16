#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { platform } from 'os';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';

const execAsync = promisify(exec);

// Get the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Set the environment variables
process.env.RUNNING_ELECTRON_DEV = 'true';
process.env.NODE_ENV = 'development';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_NO_DEPRECATION_WARNING = 'true';

console.log('Starting Electron development environment...');

// Utility function to check if a port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Check if the server is responding
function checkServerReachable(port = 3001, retries = 3) {
  return new Promise((resolve) => {
    let attempt = 0;
    
    function tryConnect() {
      attempt++;
      console.log(`Checking if server is up (attempt ${attempt}/${retries})...`);
      
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/health',
        method: 'GET',
        timeout: 500,
      }, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Server is up and running!');
          resolve(true);
        } else {
          console.log(`Server responded with status: ${res.statusCode}`);
          if (attempt < retries) {
            setTimeout(tryConnect, 500);
          } else {
            console.log('❌ Server is not responding correctly.');
            resolve(false);
          }
        }
      });
      
      req.on('error', (err) => {
        console.log(`Server connection failed: ${err.message}`);
        if (attempt < retries) {
          setTimeout(tryConnect, 500);
        } else {
          console.log('❌ Could not connect to server after multiple attempts.');
          resolve(false);
        }
      });
      
      req.on('timeout', () => {
        console.log('Server request timed out');
        req.destroy();
      });
      
      req.end();
    }
    
    tryConnect();
  });
}

async function cleanup() {
  console.log('Cleaning up previous instances...');
  try {
    if (platform() === 'win32') {
      // Kill process on port 3001 (Vite)
      try {
        const { stdout: portOutput } = await execAsync('netstat -ano | findstr :3001');
        const lines = portOutput.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            console.log(`Killing process ${pid} on port 3001`);
            await execAsync(`taskkill /PID ${pid} /F`);
          }
        }
      } catch (error) {
        // findstr returns exit code 1 if no match, so we ignore that error specifically
        if (!error.message.includes('findstr')) {
            console.log('Error killing process on port 3001:', error.message);
        }
      }

      // Kill Electron processes
      try {
        // Attempt to kill by image name first (more reliable for main Electron process)
        console.log('Attempting to kill Electron processes by image name...');
        await execAsync('taskkill /F /IM electron.exe /T');
      } catch (error) {
        // This might fail if no electron.exe is running, which is fine.
        // console.log('Note: Could not kill electron.exe by name (may not be running).');
      }
      
      // As a fallback, or to catch helper processes, try finding tasks that include "electron" in their command line
      // This is a bit more aggressive and might catch unrelated processes if not careful.
      // For now, we'll rely on the image name kill and the free-port script for Vite.

    } else { // macOS / Linux
      // Kill process on port 3001 (Vite)
      try {
        const { stdout: pid } = await execAsync('lsof -i :3001 -t');
        if (pid) {
          console.log(`Killing process ${pid.trim()} on port 3001`);
          await execAsync(`kill -9 ${pid.trim()}`);
        }
      } catch (error) {
        // lsof returns exit code 1 if no process found, ignore.
        // console.log('No process found on port 3001 or error killing it:', error.message);
      }

      // Kill Electron processes
      try {
        console.log('Attempting to kill Electron processes...');
        // This command finds PIDs of processes whose command contains "electron" and are not grep itself, then kills them.
        // It's a bit aggressive and might need refinement based on your exact process names.
        await execAsync("ps aux | grep '[e]lectron' | awk '{print $2}' | xargs kill -9");
      } catch (error) {
        // console.log('Error killing Electron processes (they may not be running):', error.message);
      }
    }
    
    // Run the original free-port script as a fallback for Vite, if it exists
    const freePortScriptPath = path.join(projectRoot, 'scripts', 'free-port.js');
    if (fs.existsSync(freePortScriptPath)) {
        console.log('Running free-port.js script as a fallback...');
        await execAsync(`node "${freePortScriptPath}"`);
    }

    console.log('Cleanup attempt finished.');
    // Wait a bit to ensure all processes are cleaned up
    await new Promise(resolve => setTimeout(resolve, 1000)); 

  } catch (error) {
    console.error('Error during cleanup:', error.message);
  }
}

async function startServer() {
  // Check if the server is already running
  console.log('Checking if server is already running...');
  const serverRunning = await isPortInUse(3001);
  
  if (serverRunning) {
    console.log('Server seems to be already running on port 3001.');
    const isReachable = await checkServerReachable();
    
    if (isReachable) {
      console.log('Existing server is responsive. Continuing...');
      return true;
    } else {
      console.log('Existing server is not responding correctly. Will restart it.');
      // Kill the existing server process
      try {
        await execAsync('taskkill /F /IM node.exe');
        // Wait for the process to fully terminate
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log('Error killing existing server:', error.message);
      }
    }
  }
  
  // Start the server
  console.log('Starting server...');
  const isWindows = platform() === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  
  const serverProcess = spawn(npmCmd, ['run', 'server'], {
    env: process.env,
    stdio: 'inherit',
    shell: true,
    detached: true
  });
  
  serverProcess.unref();
  
  // Wait for the server to be available with optimized timeout
  console.log('Waiting for server to be available...');
  let serverReachable = false;
  const maxAttempts = 8;
  const retryInterval = 500;
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, retryInterval));
    serverReachable = await checkServerReachable();
    if (serverReachable) {
      console.log('✅ Server is now fully running!');
      break;
    }
    console.log(`Waiting for server to start (attempt ${i + 1}/${maxAttempts})...`);
  }
  
  if (!serverReachable) {
    console.error('❌ Failed to start the server after multiple attempts!');
    console.error('Please check the server logs for any errors.');
    console.error('You can try running "npm run server" manually to see the error output.');
    return false;
  }
  
  return true;
}

async function startApp() {
  try {
    await cleanup();
    
    // First, make sure the server is running
    const serverStarted = await startServer();
    
    if (!serverStarted) {
      console.error('❌ Failed to start the server! Please run it manually with "npm run server"');
      process.exit(1);
    }
    
    console.log('Starting Vite and Electron...');
    
    const isWindows = platform() === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';
    
    // Start Vite and Electron concurrently with optimized settings
    const concurrentCmd = `concurrently --kill-others "vite --force" "electron ."`;
    
    const electronProcess = spawn(npmCmd, ['exec', '--', concurrentCmd], {
      env: process.env,
      stdio: 'inherit',
      shell: true
    });
    
    electronProcess.on('error', (error) => {
      console.error('Failed to start process:', error);
    });
    
    // Handle graceful shutdown
    const handleExit = () => {
      console.log('Shutting down all processes...');
      if (electronProcess) {
        electronProcess.kill();
      }
      process.exit(0);
    };
    
    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);
  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
}

// Start the application
startApp(); 