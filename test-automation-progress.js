// Test script to trigger form automation and check progress updates
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const SERVER_URL = 'http://localhost:3001';
const SAMPLE_VISIT_URL = 'https://workfossa.com/work-orders/144370/visits/358847';

async function testFormAutomation() {
  console.log('Starting form automation test...');
  
  try {
    // 1. Start a form automation job
    console.log('Starting form automation for visit:', SAMPLE_VISIT_URL);
    const startResponse = await fetch(`${SERVER_URL}/api/form-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        visitUrl: SAMPLE_VISIT_URL,
        headless: false,
        workOrderId: '144370'
      })
    });

    if (!startResponse.ok) {
      throw new Error(`Start failed: ${startResponse.statusText}`);
    }

    const { jobId } = await startResponse.json();
    console.log('Job started with ID:', jobId);

    // 2. Poll for status every 2 seconds
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    let lastStatus = null;

    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const statusResponse = await fetch(`${SERVER_URL}/api/form-automation/status`);
        
        if (!statusResponse.ok) {
          console.error('Status check failed:', statusResponse.statusText);
          return;
        }

        const status = await statusResponse.json();
        
        // Only log if status has changed
        if (JSON.stringify(status) !== JSON.stringify(lastStatus)) {
          console.log('\n--- Status Update ---');
          console.log('Status:', status.status);
          console.log('Message:', status.message);
          
          // Check for dispenser progress
          if (status.dispenserProgress) {
            console.log('\nDispenser Progress:');
            status.dispenserProgress.dispensers.forEach((dispenser, index) => {
              console.log(`\nDispenser ${index + 1}: ${dispenser.dispenserTitle}`);
              console.log(`  Status: ${dispenser.status}`);
              console.log(`  Current Action: ${dispenser.currentAction || 'None'}`);
              console.log(`  Form: ${dispenser.formNumber}/${dispenser.totalForms}`);
              
              if (dispenser.fuelGrades && dispenser.fuelGrades.length > 0) {
                console.log('  Fuel Grades:');
                dispenser.fuelGrades.forEach(grade => {
                  console.log(`    - ${grade.grade}: ${grade.status} ${grade.message || ''}`);
                });
              }
            });
          } else {
            console.log('\nNo dispenser progress data');
          }
          
          lastStatus = status;
        }

        // Stop polling if job is complete or error
        if (status.status === 'completed' || status.status === 'error' || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          console.log('\n--- Final Status ---');
          console.log('Job finished with status:', status.status);
          
          if (status.status === 'error') {
            console.error('Error message:', status.message);
          }
          
          process.exit(status.status === 'completed' ? 0 : 1);
        }
      } catch (error) {
        console.error('Error checking status:', error.message);
      }
    }, 2000);

  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testFormAutomation().catch(console.error);