import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_URL = 'http://localhost:3001';
const TEST_USER_ID = 'test-visual-progress';
const TEST_VISIT_URL = '/work/12345/visits/6';

// Mock dispenser data with multiple fuel grades
const mockDispenserData = {
  dispenserData: {
    'W-12345': {
      dispensers: [
        {
          title: 'Dispenser #1/2',
          dispenserNumber: '1',
          fields: {
            'Grade': '87 Octane Regular, 89 Plus, 93 Premium'
          }
        },
        {
          title: 'Dispenser #3/4', 
          dispenserNumber: '3',
          fields: {
            'Grade': '87 Octane Regular, 89 Plus'
          }
        }
      ]
    }
  }
};

// Setup test data
async function setupTestData() {
  const userDir = path.join(__dirname, '..', 'data', 'users', TEST_USER_ID);
  
  // Create user directory
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  
  // Create mock dispenser store
  fs.writeFileSync(
    path.join(userDir, 'dispenser_store.json'),
    JSON.stringify(mockDispenserData, null, 2)
  );
  
  console.log('Test data setup complete');
}

// Test the visual progress
async function testVisualProgress() {
  console.log('=== Testing Visual Progress Display ===\n');
  
  try {
    // 1. Start single visit automation
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
    
    // 2. Monitor the progress with detailed logging
    console.log('2. Monitoring progress for visual elements...\n');
    
    let attempts = 0;
    const maxAttempts = 90; // 90 seconds max
    let lastStatus = {};
    let foundVisualProgress = false;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const statusResponse = await fetch(`${API_URL}/api/form-automation/unified-status/${jobId}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const status = await statusResponse.json();
        
        // Only log when status changes
        if (JSON.stringify(status) !== JSON.stringify(lastStatus)) {
          console.log(`[${new Date().toLocaleTimeString()}] Status Update:`);
          console.log(`  Status: ${status.status}`);
          console.log(`  Message: ${status.message}`);
          
          // Check for dispenser progress
          if (status.dispenserProgress) {
            foundVisualProgress = true;
            console.log(`  \n✅ VISUAL PROGRESS FOUND!`);
            console.log(`  Work Order: ${status.dispenserProgress.workOrderId}`);
            console.log(`  Dispensers: ${status.dispenserProgress.dispensers.length}\n`);
            
            // Display detailed progress for each dispenser
            status.dispenserProgress.dispensers.forEach((disp, idx) => {
              console.log(`  Dispenser ${idx + 1}: ${disp.dispenserTitle}`);
              console.log(`    Status: ${disp.status}`);
              console.log(`    Form: ${disp.formNumber}/${disp.totalForms}`);
              console.log(`    Action: ${disp.currentAction}`);
              console.log(`    Fuel Grades:`);
              
              disp.fuelGrades.forEach(fg => {
                console.log(`      - ${fg.grade}: ${fg.status} ${fg.message ? `(${fg.message})` : ''}`);
              });
              console.log('');
            });
          } else {
            console.log(`  No dispenser progress data`);
          }
          
          lastStatus = status;
        }
        
        // Check for completion
        if (status.status === 'completed' || status.status === 'error') {
          clearInterval(pollInterval);
          
          console.log(`\n\nFinal status: ${status.status}`);
          console.log('Visual progress found:', foundVisualProgress);
          
          if (foundVisualProgress) {
            console.log('✅ Test PASSED - Visual progress data was transmitted');
          } else {
            console.log('❌ Test FAILED - No visual progress data was found');
          }
          
          process.exit(foundVisualProgress ? 0 : 1);
        }
        
      } catch (error) {
        console.error('Error polling status:', error.message);
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.log('\n❌ Test FAILED - Timeout after 90 seconds');
        console.log('Visual progress found:', foundVisualProgress);
        process.exit(1);
      }
      
    }, 1000); // Poll every second
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

// Run the test
async function main() {
  console.log('Make sure the server is running on port 3001\n');
  
  await setupTestData();
  await testVisualProgress();
}

main().catch(console.error);