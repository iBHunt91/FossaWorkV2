import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE_URL = 'http://localhost:3001';

// Test data for single visit
const singleVisitData = {
  isManualEntry: false,
  storeId: null,
  storeNumber: '300',
  brand: '300 Wayne',
  street: '123 Test St',
  city: 'Test City',
  state: 'CA',
  zip: '12345',
  visitDate: new Date().toISOString().split('T')[0],
  visitPeriod: 'AM',
  provers: [{
    id: '1',
    proverNumber: '12345',
    proverType: 'PROVER',
    make: 'SERAPHIN',
    model: 'SPX-300'
  }],
  dispensers: [{
    id: '1',
    dispenserNumber: '1',
    totalPositions: 8,
    productPositions: { 
      1: '87', 
      2: '87', 
      3: '89', 
      4: '89', 
      5: '91', 
      6: '91', 
      7: 'DSL', 
      8: 'DSL' 
    },
    positionStatus: { 
      1: 'active', 
      2: 'active', 
      3: 'active', 
      4: 'active', 
      5: 'active', 
      6: 'active', 
      7: 'active', 
      8: 'active' 
    }
  }],
  groupedForms: [{
    formNumber: '3201',
    displayTitle: 'Wayne 3/4 Grade Dispenser',
    provers: [{ id: '1', proverNumber: '12345', dispensers: ['1'] }]
  }]
};

// Test data for batch job
const batchJobData = {
  selectedJobs: [{
    Job: '12345',
    'Circuit K Work Order #': 'WO-001',
    'Store #': '300',
    'Address, State ZIP': '123 Test St, Test City, CA 12345',
    Date: new Date().toDateString(),
    'AM/PM': 'AM',
    Brand: '300 Wayne',
    prover: '12345'
  }]
};

async function runSingleVisitAutomation() {
  console.log('Starting single visit automation...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/form-automation/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(singleVisitData)
    });
    
    const result = await response.json();
    console.log('Single visit submitted:', result);
    return result.sessionId;
  } catch (error) {
    console.error('Error starting single visit:', error);
    throw error;
  }
}

async function runBatchAutomation() {
  console.log('\nStarting batch automation for comparison...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/form-automation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchJobData)
    });
    
    const result = await response.json();
    console.log('Batch job submitted:', result);
    return result.sessionId;
  } catch (error) {
    console.error('Error starting batch job:', error);
    throw error;
  }
}

async function pollStatus(sessionId, type = 'single') {
  console.log(`\nPolling status for ${type} session ${sessionId}...`);
  
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/form-automation/status/${sessionId}`);
      const status = await response.json();
      
      console.log(`\n--- Status Update ${attempts + 1} (${type}) ---`);
      console.log('Status:', status.status);
      console.log('Progress:', JSON.stringify(status.progress || {}, null, 2));
      
      // Check for dispenserProgress
      if (status.dispenserProgress) {
        console.log('Dispenser Progress Found:', JSON.stringify(status.dispenserProgress, null, 2));
      } else {
        console.log('WARNING: No dispenserProgress in response');
      }
      
      // Check for groupedForms progress
      if (status.groupedForms) {
        console.log('Grouped Forms Progress:', JSON.stringify(status.groupedForms, null, 2));
      }
      
      // Check for job-specific fields
      if (status.jobs || status.currentJob) {
        console.log('Job Info:', {
          jobs: status.jobs,
          currentJob: status.currentJob
        });
      }
      
      // Show full status object
      console.log('Full Status Object:', JSON.stringify(status, null, 2));
      
      if (status.status === 'completed' || status.status === 'error') {
        return status;
      }
      
      // Wait 2 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
    } catch (error) {
      console.error(`Error polling status (${type}):`, error);
      attempts++;
    }
  }
  
  console.log(`Max polling attempts reached for ${type}`);
  return null;
}

async function compareProgressStructures() {
  console.log('\n=== COMPARING SINGLE VISIT VS BATCH PROGRESS ===\n');
  
  try {
    // Run single visit
    const singleSessionId = await runSingleVisitAutomation();
    const singleStatus = await pollStatus(singleSessionId, 'single');
    
    console.log('\n--- Single Visit Final Status ---');
    console.log(JSON.stringify(singleStatus, null, 2));
    
    // Wait a bit between tests
    console.log('\nWaiting 5 seconds before batch test...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run batch job
    const batchSessionId = await runBatchAutomation();
    const batchStatus = await pollStatus(batchSessionId, 'batch');
    
    console.log('\n--- Batch Job Final Status ---');
    console.log(JSON.stringify(batchStatus, null, 2));
    
    // Compare structures
    console.log('\n=== STRUCTURE COMPARISON ===');
    console.log('Single Visit Keys:', Object.keys(singleStatus || {}));
    console.log('Batch Job Keys:', Object.keys(batchStatus || {}));
    
    // Specific comparisons
    console.log('\n--- Progress Comparison ---');
    console.log('Single dispenserProgress:', singleStatus?.dispenserProgress ? 'Present' : 'Missing');
    console.log('Batch dispenserProgress:', batchStatus?.dispenserProgress ? 'Present' : 'Missing');
    
    // Check for any dispenser-related fields
    console.log('\n--- Dispenser-related Fields ---');
    for (const key of Object.keys(singleStatus || {})) {
      if (key.toLowerCase().includes('dispenser')) {
        console.log(`Single Visit - ${key}:`, singleStatus[key]);
      }
    }
    for (const key of Object.keys(batchStatus || {})) {
      if (key.toLowerCase().includes('dispenser')) {
        console.log(`Batch Job - ${key}:`, batchStatus[key]);
      }
    }
    
  } catch (error) {
    console.error('Error in comparison:', error);
  }
}

// Main execution
(async () => {
  console.log('Starting single visit progress test...');
  console.log('Make sure the server is running on port 3001');
  console.log('='.repeat(50));
  
  await compareProgressStructures();
  
  console.log('\n=== TEST COMPLETE ===');
  process.exit(0);
})();