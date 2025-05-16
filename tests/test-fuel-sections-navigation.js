import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_URL = 'http://localhost:3001';
const TEST_USER_ID = 'test-fuel-sections';
const TEST_VISIT_URL = '/work/12345/visits/6';

// Mock dispenser data
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
            'Grade': '87 Octane Regular, 89 Plus, 93 Premium'
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

// Test the fuel sections navigation
async function testFuelSectionsNavigation() {
  console.log('=== Testing Fuel Sections Navigation ===\n');
  
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
        headless: false // Run in visible mode to see what's happening
      })
    });
    
    const startData = await startResponse.json();
    console.log('Start response:', startData);
    
    if (!startData.jobId) {
      throw new Error('Failed to start automation - no job ID returned');
    }
    
    const jobId = startData.jobId;
    console.log(`Job started with ID: ${jobId}\n`);
    
    // 2. Monitor the progress
    console.log('2. Monitoring progress...\n');
    
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max
    let foundFuelSections = false;
    let logs = [];
    
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
        
        // Track important messages
        if (status.message) {
          logs.push(`[${new Date().toLocaleTimeString()}] ${status.message}`);
          
          // Check for fuel section processing
          if (status.message.includes('fuel sections') || 
              status.message.includes('fuel type') ||
              status.message.includes('Processing fuel')) {
            foundFuelSections = true;
            console.log('\n✅ FUEL SECTIONS PROCESSING DETECTED!');
          }
          
          // Check for navigation issues
          if (status.message.includes('Next button not found') ||
              status.message.includes('Failed to navigate to fuel sections')) {
            console.log('\n⚠️  WARNING: Navigation issue detected!');
          }
        }
        
        // Check for completion or error
        if (status.status === 'completed' || status.status === 'error') {
          clearInterval(pollInterval);
          
          console.log(`\n\nFinal status: ${status.status}`);
          console.log('Found fuel sections processing:', foundFuelSections);
          
          // Print all collected logs
          console.log('\n=== Process Log ===');
          logs.forEach(log => console.log(log));
          console.log('==================\n');
          
          if (foundFuelSections) {
            console.log('✅ Test PASSED - Fuel sections were processed');
          } else {
            console.log('❌ Test FAILED - Fuel sections were NOT processed');
            console.log('\nPossible issues:');
            console.log('- Save button not completing properly');
            console.log('- Next button not becoming enabled');
            console.log('- Navigation to /sections/536 failed');
          }
          
          process.exit(foundFuelSections ? 0 : 1);
        }
        
      } catch (error) {
        console.error('Error polling status:', error.message);
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.log('\n❌ Test FAILED - Timeout after 2 minutes');
        console.log('Collected logs:');
        logs.forEach(log => console.log(log));
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
  await testFuelSectionsNavigation();
}

main().catch(console.error);