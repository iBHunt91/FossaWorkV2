/**
 * Script to free up port 3001 by killing any processes using it
 */
import { exec } from 'child_process';
import os from 'os';

const PORT = 3001;

// Function to get the command for finding the process using the port
function getPortCommand() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    // Windows command
    return `netstat -ano | findstr :${PORT}`;
  } else {
    // Unix/Mac command
    return `lsof -i :${PORT} -t`;
  }
}

// Function to get the command for killing a process
function getKillCommand(pid) {
  const platform = os.platform();
  
  if (platform === 'win32') {
    // Windows command (force kill)
    return `taskkill /F /PID ${pid}`;
  } else {
    // Unix/Mac command (force kill)
    return `kill -9 ${pid}`;
  }
}

// Execute the port finding command
exec(getPortCommand(), (error, stdout, stderr) => {
  if (error) {
    console.log(`No process found using port ${PORT}`);
    return;
  }
  
  console.log(`Found process(es) using port ${PORT}:`);
  
  // Get the process IDs
  let pids = [];
  
  if (os.platform() === 'win32') {
    // Windows output parsing
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 4) {
        const pid = parts[4];
        if (!pids.includes(pid)) {
          pids.push(pid);
        }
      }
    }
  } else {
    // Unix/Mac output parsing
    pids = stdout.trim().split('\n');
  }
  
  // Kill each process
  for (const pid of pids) {
    console.log(`Killing process ${pid}...`);
    exec(getKillCommand(pid), (killError, killStdout, killStderr) => {
      if (killError) {
        console.error(`Error killing process ${pid}: ${killError.message}`);
        return;
      }
      console.log(`Successfully killed process ${pid}`);
    });
  }
});

console.log(`Attempting to free port ${PORT}...`); 