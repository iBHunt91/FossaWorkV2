import { spawn } from 'child_process';

/**
 * Run the form automation script for a single visit
 * @param {Object} formAutomationJob - The job object to update with progress
 * @param {string} visitUrl - URL of the visit to process
 * @param {Array} dispensers - Array of dispenser information
 * @param {boolean} headless - Whether to run in headless mode
 */
async function runFormAutomation(formAutomationJob, visitUrl, dispensers, headless = true) {
  try {
    // Prepare arguments for the script
    const args = [
      'scripts/formAutomation.js',
      visitUrl
    ];

    // Add debug flag if not headless
    if (!headless) {
      args.push('--debug');
      console.log('Debug mode enabled - browser should be visible');
    }

    // Write dispensers to a temporary file if provided as objects
    let dispenserDataFlag = '';
    if (dispensers && dispensers.length > 0) {
      try {
        const fs = await import('fs');
        const tempFile = './temp-dispensers.json';
        await fs.promises.writeFile(tempFile, JSON.stringify(dispensers));
        dispenserDataFlag = `--dispensers=${tempFile}`;
        args.push(dispenserDataFlag);
      } catch (err) {
        console.error('Error writing temporary dispenser data:', err);
      }
    }

    console.log(`Executing: node ${args.join(' ')}`);
    
    // Execute the form automation script with inherit stdio for debugging
    // This will show all output directly in the server console
    const process = spawn('node', args, {
      env: { ...global.process.env, NODE_ENV: 'production' },
      stdio: headless ? 'pipe' : 'inherit' // Use inherit in debug mode to see all output
    });
    
    // Only set up listeners if not using inherit stdio
    if (headless) {
      // Update progress as the process runs
      process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Form automation output: ${output}`);
        
        // Update progress based on output
        if (output.includes('Login successful')) {
          formAutomationJob.progress = 10;
          formAutomationJob.message = 'Logged in to Fossa...';
        } else if (output.includes('Navigating to visit URL')) {
          formAutomationJob.progress = 20;
          formAutomationJob.message = 'Navigating to visit page...';
        } else if (output.includes('Checking for existing AccuMeasure forms')) {
          formAutomationJob.progress = 30;
          formAutomationJob.message = 'Checking for existing forms...';
        } else if (output.includes('Need to add')) {
          formAutomationJob.progress = 40;
          formAutomationJob.message = 'Adding new forms...';
        } else if (output.includes('Filling out form')) {
          formAutomationJob.progress = 60;
          formAutomationJob.message = 'Filling out forms with dispenser info...';
        } else if (output.includes('Visit processing complete')) {
          formAutomationJob.progress = 90;
          formAutomationJob.message = 'Processing complete, finalizing...';
        }
      });
      
      // Handle errors
      process.stderr.on('data', (data) => {
        console.error(`Form automation error: ${data}`);
        if (formAutomationJob.status === 'running') {
          formAutomationJob.message = `Error: ${data.toString().trim()}`;
        }
      });
    }
    
    // Handle completion
    process.on('close', (code) => {
      if (code === 0) {
        formAutomationJob.status = 'completed';
        formAutomationJob.progress = 100;
        formAutomationJob.message = 'Form automation completed successfully!';
      } else {
        formAutomationJob.status = 'error';
        formAutomationJob.error = `Process exited with code ${code}`;
        formAutomationJob.message = `Failed to complete form automation (exit code ${code})`;
      }
      
      // Clean up temporary files if used
      if (dispenserDataFlag) {
        try {
          const fs = import('fs');
          fs.promises.unlink('./temp-dispensers.json').catch(() => {});
        } catch (err) {
          // Ignore cleanup errors
        }
      }
      
      // Log runtime
      const endTime = new Date();
      const runtime = Math.round((endTime - formAutomationJob.startTime) / 1000);
      console.log(`Form automation job ${formAutomationJob.status} in ${runtime} seconds`);
    });
  } catch (error) {
    console.error('Error running form automation:', error);
    formAutomationJob.status = 'error';
    formAutomationJob.error = error.message;
    formAutomationJob.message = 'Error running form automation: ' + error.message;
  }
}

export { runFormAutomation }; 