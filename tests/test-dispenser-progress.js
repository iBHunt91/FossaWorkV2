import fetch from 'node-fetch';
import WebSocket from 'ws';

// Configuration
const API_URL = 'http://localhost:3001';
const TEST_USER_ID = 'test-user-dispenser-progress';

// Test visit URL that should have dispenser data
const TEST_VISIT_URL = '/work/12345/visits/6';

async function testDispenserProgress() {
  console.log('=== Testing Enhanced Dispenser Progress Tracking ===\n');
  
  try {
    // 1. Start a single visit automation
    console.log('1. Starting single visit automation...');
    const startResponse = await fetch(`${API_URL}/api/form-automation/process-visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        visitUrl: TEST_VISIT_URL,
        userId: TEST_USER_ID,
        headless: true
      })
    });
    
    const startData = await startResponse.json();
    console.log('Start response:', startData);
    
    if (!startData.jobId) {
      throw new Error('Failed to start automation - no job ID returned');
    }
    
    const jobId = startData.jobId;
    console.log(`Job started with ID: ${jobId}\n`);
    
    // 2. Poll for status updates and check for dispenser progress
    console.log('2. Polling for status updates...\n');
    
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max
    let foundDispenserProgress = false;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const statusResponse = await fetch(`${API_URL}/api/form-automation/unified-status/${jobId}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const status = await statusResponse.json();
        
        console.log(`[${new Date().toLocaleTimeString()}] Status: ${status.status}`);
        console.log(`Message: ${status.message}`);
        
        // Check for dispenser progress
        if (status.dispenserProgress) {
          foundDispenserProgress = true;
          console.log('\n✅ DISPENSER PROGRESS FOUND!');
          console.log('Work Order ID:', status.dispenserProgress.workOrderId);
          console.log('Dispensers:', JSON.stringify(status.dispenserProgress.dispensers, null, 2));
          
          // Display each dispenser's progress
          status.dispenserProgress.dispensers.forEach((dispenser, idx) => {
            console.log(`\nDispenser ${idx + 1}:`);
            console.log(`  Title: ${dispenser.dispenserTitle}`);
            console.log(`  Form: ${dispenser.formNumber}/${dispenser.totalForms}`);
            console.log(`  Status: ${dispenser.status}`);
            console.log(`  Current Action: ${dispenser.currentAction}`);
            console.log(`  Fuel Grades:`);
            
            dispenser.fuelGrades.forEach(fg => {
              console.log(`    - ${fg.grade}: ${fg.status} ${fg.message ? `(${fg.message})` : ''}`);
              if (fg.prover) console.log(`      Prover: ${fg.prover}`);
              if (fg.meter) console.log(`      Meter: ${fg.meter}`);
            });
          });
        }
        
        // Check for completion or error
        if (status.status === 'completed' || status.status === 'error') {
          clearInterval(pollInterval);
          
          console.log(`\n\nFinal status: ${status.status}`);
          console.log('Dispenser progress found:', foundDispenserProgress);
          
          if (foundDispenserProgress) {
            console.log('✅ Test PASSED - Dispenser progress tracking is working');
          } else {
            console.log('❌ Test FAILED - No dispenser progress was tracked');
          }
          
          process.exit(foundDispenserProgress ? 0 : 1);
        }
        
      } catch (error) {
        console.error('Error polling status:', error.message);
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.log('\n❌ Test FAILED - Timeout after 60 seconds');
        process.exit(1);
      }
      
    }, 1000); // Poll every second
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

// Run the test
console.log('Make sure the server is running on port 3001');
console.log('Also ensure you have dispenser data available for the test work order\n');

testDispenserProgress();