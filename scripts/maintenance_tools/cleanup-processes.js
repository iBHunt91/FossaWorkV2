import { exec } from 'child_process';
import { platform } from 'os';

const isWindows = platform() === 'win32';

function killNodeProcesses() {
  return new Promise((resolve, reject) => {
    const command = isWindows 
      ? 'taskkill /F /IM node.exe'
      : 'pkill -f node';

    exec(command, (error, stdout, stderr) => {
      // Ignore errors if no processes were found
      if (error && !error.message.includes('No running')) {
        console.error('Error killing processes:', error);
        reject(error);
        return;
      }
      console.log('Successfully cleaned up Node.js processes');
      resolve();
    });
  });
}

// Execute the cleanup
killNodeProcesses().catch(console.error); 