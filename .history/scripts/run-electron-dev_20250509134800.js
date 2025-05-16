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

// Find an available port starting from basePort
async function findAvailablePort(basePort, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = basePort + i;
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return port;
    }
  }
  return null; // No available port found
}

// Check if the server is responding
function checkServerReachable(port = 3001, retries = 5) {
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
        timeout: 1000, // Increased timeout
      }, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Server is up and running!');
          resolve(true);
        } else {
          console.log(`Server responded with status: ${res.statusCode}`);
          if (attempt < retries) {
            setTimeout(tryConnect, 1000); // Increased delay
          } else {
            console.log('❌ Server is not responding correctly.');
            resolve(false);
          }
        }
      });
      
      req.on('error', (err) => {
        if (err.message) {
          console.log(`Server connection failed: ${err.message}`);
        } else {
          console.log(`Server connection failed`);
        }
        if (attempt < retries) {
          setTimeout(tryConnect, 1000); // Increased delay
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

// Get process ID by port
async function getProcessIdByPort(port) {
  try {
    if (platform() === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          return pid;
        }
      }
    } else {
      const { stdout } = await execAsync(`lsof -i :${port} -t`);
      if (stdout.trim()) {
        return stdout.trim();
      }
    }
  } catch (error) {
    // Command might fail if no process found
    return null;
  }
  return null;
}

// Kill process by PID
async function killProcessById(pid) {
  if (!pid) return false;
  
  try {
    if (platform() === 'win32') {
      await execAsync(`taskkill /PID ${pid} /F /T`);
    } else {
      await execAsync(`kill -9 ${pid}`);
    }
    return true;
  } catch (error) {
    console.log(`Error killing process ${pid}: ${error.message}`);
    return false;
  }
}

// Comprehensive cleanup function
async function cleanup() {
  console.log('Cleaning up previous instances...');
  const portsToClean = [3001, 5173, 5174, 5175, 5176, 5177];
  let cleanedAny = false;
  
  // First try to kill processes by port
  for (const port of portsToClean) {
    const pid = await getProcessIdByPort(port);
    if (pid) {
      console.log(`Killing process ${pid} on port ${port}`);
      if (await killProcessById(pid)) {
        cleanedAny = true;
      }
    }
  }
  
  // Kill Electron processes regardless of platform
  try {
    if (platform() === 'win32') {
      console.log('Attempting to kill Electron processes by image name...');
      await execAsync('taskkill /F /IM electron.exe /T').catch(() => {});
      // Also try to kill node processes that might be running Vite or the server
      await execAsync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq *vite*"').catch(() => {});
    } else {
      console.log('Attempting to kill Electron processes...');
      await execAsync("ps aux | grep '[e]lectron' | awk '{print $2}' | xargs kill -9").catch(() => {});
      await execAsync("ps aux | grep '[v]ite' | awk '{print $2}' | xargs kill -9").catch(() => {});
    }
    cleanedAny = true;
  } catch (error) {
    // Ignore errors here as processes might not exist
  }
  
  // Run the original free-port script as a fallback, if it exists
  const freePortScriptPath = path.join(projectRoot, 'scripts', 'free-port.js');
  if (fs.existsSync(freePortScriptPath)) {
    console.log('Running free-port.js script as a fallback...');
    await execAsync(`node "${freePortScriptPath}"`).catch(() => {});
  }

  console.log('Cleanup attempt finished.');
  
  if (cleanedAny) {
    // Wait a bit longer to ensure all processes are cleaned up
    console.log('Waiting for processes to fully terminate...');
    await new Promise(resolve => setTimeout(resolve, 2000));
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
      const pid = await getProcessIdByPort(3001);
      if (pid) {
        await killProcessById(pid);
        // Wait for the process to fully terminate
        await new Promise(resolve => setTimeout(resolve, 1000));
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
  const maxAttempts = 10; // Increased max attempts
  const retryInterval = 1000; // Increased retry interval
  
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
    
    const serverStarted = await startServer();
    
    if (!serverStarted) {
      console.error('❌ Failed to start the server! Please run it manually with "npm run server"');
      process.exit(1);
    }
    
    console.log('Starting Vite and Electron...');

    const vitePort = await startViteAndGetPort();
    if (!vitePort) {
      console.error('❌ Failed to start Vite or determine its port. Exiting.');
      process.exit(1);
    }
    console.log(`✅ Vite is running on port ${vitePort}, proceeding to start Electron.`);

    const electronCmd = 'electron';
    const electronArgs = ['.']; // Start Electron in the current project root

    const electronProcess = spawn(electronCmd, electronArgs, {
      env: {
        ...process.env,
        VITE_PORT: vitePort.toString(), // Ensure VITE_PORT is a string
        NODE_ENV: 'development',
        RUNNING_ELECTRON_DEV: 'true',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        ELECTRON_NO_DEPRECATION_WARNING: 'true'
      },
      stdio: 'inherit',
      shell: platform() === 'win32',
      cwd: projectRoot,
    });

    electronProcess.on('error', (error) => {
      console.error('❌ Failed to start Electron process:', error);
    });

    electronProcess.on('close', (code) => {
      console.log(`Electron process exited with code ${code}`);
      handleExit();
    });

    const handleExit = () => {
      console.log('Shutting down Electron development environment...');
      if (viteProcess && !viteProcess.killed) {
        console.log('Killing Vite process...');
        viteProcess.kill();
      }
      
      if (electronProcess && !electronProcess.killed) {
        console.log('Killing Electron process...');
        electronProcess.kill();
      }
      
      // Kill any leftover processes
      cleanup().then(() => {
        process.exit(0);
      }).catch(() => {
        process.exit(1);
      });
    };

    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => process.on(signal, handleExit));

  } catch (error) {
    console.error('❌ An error occurred in startApp:', error);
    process.exit(1);
  }
}

// Keep a reference to viteProcess for cleanup
let viteProcess; 

async function startViteAndGetPort() {
  return new Promise((resolve, reject) => {
    const isWindows = platform() === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';
    
    // Find an available port first for Vite
    findAvailablePort(5173, 20).then(availablePort => {
      if (!availablePort) {
        console.error('❌ Could not find an available port for Vite.');
        reject(new Error('No available ports'));
        return;
      }
      
      console.log(`🚀 Starting Vite dev server on port ${availablePort}...`);
      
      // Set a environment variable to force Vite to use this port
      process.env.VITE_PORT = availablePort.toString();
      
      viteProcess = spawn(npmCmd, ['run', 'dev', '--', '--port', availablePort.toString(), '--force'], { 
        env: { 
          ...process.env, 
          NODE_ENV: 'development',
          // Force Vite to use the specific port
          VITE_PORT: availablePort.toString()
        },
        shell: true, 
        cwd: projectRoot 
      });

      let resolved = false; 
      let stdoutBuffer = ''; 
      let timeoutId = null;
      const timeoutDuration = 120000; // Increased timeout to 120s

      const settlePromise = (action, value) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          if (action === 'resolve') {
            resolve(value);
          } else {
            if (viteProcess && !viteProcess.killed) {
              try { viteProcess.kill(); } catch (e) { console.error('[Vite Cleanup Error] Failed to kill Vite process during rejection:', e); }
            }
            reject(value);
          }
        }
      };

      timeoutId = setTimeout(() => {
        settlePromise('reject', new Error(`Timeout: Vite port not reported after ${timeoutDuration / 1000}s.`));
      }, timeoutDuration);

      viteProcess.stdout.on('data', (data) => {
        if (resolved) return;
        const outputChunk = data.toString();
        stdoutBuffer += outputChunk;
        console.log(`[Vite] ${outputChunk.trim()}`);
        
        // Multiple detection patterns to be more reliable
        // 1. Check for the "VITE vX.X.X ready in XXX ms" message 
        if (stdoutBuffer.includes('VITE') && stdoutBuffer.includes('ready in')) {
          console.log('✅ Vite ready message detected!');
          
          // Check if we can find the port from the output
          const portMatch = stdoutBuffer.match(/Local:\s+http:\/\/localhost:(\d+)/);
          if (portMatch && portMatch[1]) {
            const reportedPort = parseInt(portMatch[1], 10);
            console.log(`✅ Vite reported URL: http://localhost:${reportedPort}`);
            settlePromise('resolve', reportedPort);
          } else {
            // If we see the ready message but can't get the port, use the one we specified
            console.log(`✅ Using pre-configured port: ${availablePort}`);
            settlePromise('resolve', availablePort);
          }
          return;
        }
        
        // 2. Standard port matching pattern as fallback
        const portMatch = stdoutBuffer.match(/Local:\s+http:\/\/localhost:(\d+)/);
        if (portMatch && portMatch[1]) {
          const reportedPort = parseInt(portMatch[1], 10);
          console.log(`✅ Vite reported URL: http://localhost:${reportedPort}`);
          settlePromise('resolve', reportedPort);
          return;
        }
        
        // Trim buffer if it gets too large
        if (stdoutBuffer.length > 1024 * 10) { 
          stdoutBuffer = stdoutBuffer.slice(-1024 * 5); 
        }
      });

      viteProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString().trim();
        console.error(`[Vite Error] ${errorOutput}`);
        
        // Check for port-in-use errors and handle them
        if (errorOutput.includes('EADDRINUSE') || errorOutput.includes('Port') && errorOutput.includes('is in use')) {
          console.error('❌ Vite port conflict detected. Will try another port.');
          // The port conflict should be handled by Vite automatically - just log and wait
        }
      });

      viteProcess.on('error', (err) => {
        console.error('❌ Vite process spawn error.', err);
        settlePromise('reject', err);
      });

      viteProcess.on('close', (code) => {
        console.log(`Vite process exited (code ${code}).`);
        if (!resolved) {
          if (code !== 0) {
            settlePromise('reject', new Error(`Vite exited (code ${code}) before reporting port.`));
          } else if (availablePort) {
            // If Vite exited with code 0 but we never got the port, use the pre-configured port
            console.log(`⚠️ Vite exited cleanly but port wasn't detected. Using port ${availablePort}.`);
            settlePromise('resolve', availablePort);
          }
        }
      });
    }).catch(err => {
      console.error('Error finding available port:', err);
      reject(err);
    });
  });
}

startApp().catch(err => {
  console.error('❌ An critical error occurred in run-electron-dev.js:', err.message);
  process.exit(1);
}); 