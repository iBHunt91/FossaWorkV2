#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';

const execAsync = promisify(exec);

async function restartServer() {
  try {
    console.log('Checking for running server processes...');
    
    // Different commands based on OS
    const isWindows = platform() === 'win32';
    
    if (isWindows) {
      // Find and kill Node.js processes on port 3000 in Windows
      const { stdout: netstatOutput } = await execAsync('netstat -ano | findstr :3000');
      console.log('Found processes:', netstatOutput);
      
      if (netstatOutput) {
        const lines = netstatOutput.split('\n').filter(line => line.includes('LISTENING'));
        
        for (const line of lines) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid) {
            console.log(`Killing process with PID ${pid}...`);
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`Successfully killed process ${pid}`);
            } catch (err) {
              console.error(`Failed to kill process ${pid}:`, err.message);
            }
          }
        }
      }
    } else {
      // For Unix-like systems
      try {
        await execAsync('lsof -ti:3000 | xargs kill -9');
        console.log('Killed any processes using port 3000');
      } catch (err) {
        // If no process is found, lsof will exit with non-zero code
        console.log('No process was using port 3000');
      }
    }
    
    // Start the server
    console.log('Starting server...');
    const serverProcess = exec('node server/server.js');
    
    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(`Server error: ${data}`);
    });
    
    console.log('Server started successfully');
    
  } catch (error) {
    console.error('Error restarting server:', error);
  }
}

restartServer(); 