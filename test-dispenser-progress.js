// Test script to verify visual progress tracking for both single and batch automation
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const SERVER_URL = 'http://localhost:3001';

// Test single visit automation with progress tracking
async function testSingleVisitProgress() {
  console.log('\n=== Testing Single Visit Automation Progress ===');
  
  const visitUrl = 'https://workfossa.com/work-orders/144370/visits/358847';
  
  try {
    // Start the automation
    console.log('Starting single visit automation...');
    const startResponse = await fetch(`${SERVER_URL}/api/form-automation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitUrl: visitUrl,
        headless: false,
        workOrderId: '144370'
      })
    });

    if (!startResponse.ok) {
      throw new Error(`Failed to start: ${startResponse.statusText}`);
    }

    const { jobId } = await startResponse.json();
    console.log('Job started with ID:', jobId);

    // Poll for status updates  
    let complete = false;
    let attempts = 0;
    
    while (!complete && attempts < 60) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`${SERVER_URL}/api/form-automation/status`);
      const status = await statusResponse.json();
      
      console.log('\nStatus:', status.status);
      console.log('Message:', status.message);
      
      // Check for dispenser progress
      if (status.dispenserProgress) {
        console.log('\n📊 Dispenser Progress Found:');
        status.dispenserProgress.dispensers.forEach((dispenser, idx) => {
          console.log(`\n  Dispenser ${idx + 1}: ${dispenser.dispenserTitle} [${dispenser.status}]`);
          console.log(`    Form: ${dispenser.formNumber}/${dispenser.totalForms}`);
          console.log(`    Action: ${dispenser.currentAction || 'None'}`);
          
          if (dispenser.fuelGrades && dispenser.fuelGrades.length > 0) {
            console.log('    Fuel Grades:');
            dispenser.fuelGrades.forEach(grade => {
              console.log(`      - ${grade.grade}: ${grade.status}`);
              if (grade.prover) console.log(`        Prover: ${grade.prover}`);
              if (grade.meter) console.log(`        Meter: ${grade.meter}`);
              if (grade.message) console.log(`        Message: ${grade.message}`);
            });
          }
        });
      } else {
        console.log('❌ No dispenser progress data available');
      }
      
      if (status.status === 'completed' || status.status === 'error') {
        complete = true;
      }
    }
    
    console.log('\n✅ Single visit test completed');
    
  } catch (error) {
    console.error('❌ Single visit test error:', error.message);
  }
}

// Test batch automation with progress tracking
async function testBatchVisitProgress() {
  console.log('\n=== Testing Batch Automation Progress ===');
  
  // Create a test batch file with sample visits
  const batchData = [
    {
      id: '144370',
      url: '/work-orders/144370/visits/358847',
      dispensers: [
        {
          title: 'Dispenser 1',
          dispenserNumber: '1',
          fields: { Grade: 'Regular,Plus,Premium' }
        },
        {
          title: 'Dispenser 2', 
          dispenserNumber: '2',
          fields: { Grade: 'Regular,Diesel' }
        }
      ],
      formCount: 2,
      formType: 'AccuMeasure',
      isSpecificDispensers: false
    },
    {
      id: '144371',
      url: '/work-orders/144371/visits/358848',
      dispensers: [
        {
          title: 'Dispenser A',
          fields: { Grade: 'Regular,Premium' }
        }
      ],
      formCount: 1,
      formType: 'AccuMeasure',
      isSpecificDispensers: false
    }
  ];
  
  // Write test batch file
  const fs = await import('fs/promises');
  const batchPath = join(__dirname, 'test-batch.json');
  await fs.writeFile(batchPath, JSON.stringify(batchData, null, 2));
  
  try {
    // Start batch automation
    console.log('Starting batch automation...');
    const startResponse = await fetch(`${SERVER_URL}/api/form-automation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: batchPath,
        headless: false,
        selectedVisits: ['144370', '144371']
      })
    });

    if (!startResponse.ok) {
      throw new Error(`Failed to start batch: ${startResponse.statusText}`);
    }

    const { jobId } = await startResponse.json();
    console.log('Batch job started with ID:', jobId);

    // Poll for status updates
    let complete = false;
    let attempts = 0;
    
    while (!complete && attempts < 120) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`${SERVER_URL}/api/form-automation/batch/status`);
      const status = await statusResponse.json();
      
      console.log('\nBatch Status:', status.status);
      console.log('Message:', status.message);
      console.log('Progress:', status.completedVisits + '/' + status.totalVisits);
      
      // Check for dispenser progress
      if (status.dispenserProgress) {
        console.log('\n📊 Dispenser Progress Found for current visit:');
        status.dispenserProgress.dispensers.forEach((dispenser, idx) => {
          console.log(`\n  Dispenser ${idx + 1}: ${dispenser.dispenserTitle} [${dispenser.status}]`);
          console.log(`    Form: ${dispenser.formNumber}/${dispenser.totalForms}`);
          console.log(`    Action: ${dispenser.currentAction || 'None'}`);
          
          if (dispenser.fuelGrades && dispenser.fuelGrades.length > 0) {
            console.log('    Fuel Grades:');
            dispenser.fuelGrades.forEach(grade => {
              console.log(`      - ${grade.grade}: ${grade.status}`);
              if (grade.prover) console.log(`        Prover: ${grade.prover}`);
              if (grade.meter) console.log(`        Meter: ${grade.meter}`);
              if (grade.message) console.log(`        Message: ${grade.message}`);
            });
          }
        });
      } else {
        console.log('❌ No dispenser progress data available');
      }
      
      if (status.status === 'completed' || status.status === 'error') {
        complete = true;
      }
    }
    
    console.log('\n✅ Batch test completed');
    
  } catch (error) {
    console.error('❌ Batch test error:', error.message);
  } finally {
    // Clean up test file
    try {
      await fs.unlink(batchPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run both tests
async function runTests() {
  console.log('🧪 Testing Dispenser Progress Visual Feedback');
  console.log('============================================\n');
  
  // Test single visit first
  await testSingleVisitProgress();
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test batch automation
  await testBatchVisitProgress();
  
  console.log('\n🎉 All tests completed!');
}

// Run the tests
runTests().catch(console.error);