/**
 * Test script to verify FormPrep automation connection between frontend and backend
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { logger } from '../scripts/utils/logger.js';

// Load environment variables
dotenv.config();

const API_BASE = 'http://localhost:3001';

async function testSingleVisitAutomation() {
  try {
    console.log('\n=== Testing Single Visit Automation ===');
    
    const testUrl = 'https://workfossa.com/test/visit/123';
    
    const response = await fetch(`${API_BASE}/api/form-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visitUrl: testUrl,
        headless: true,
        workOrderId: 'test-work-order-001'
      }),
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok && data.jobId) {
      console.log('✓ Single visit automation endpoint is working');
      console.log('Job ID:', data.jobId);
      
      // Test getting status
      const statusResponse = await fetch(`${API_BASE}/api/form-automation/unified-status/${data.jobId}`);
      const statusData = await statusResponse.json();
      console.log('Job status:', statusData);
      
      return true;
    } else {
      console.error('✗ Single visit automation failed:', data.error || data.message);
      return false;
    }
  } catch (error) {
    console.error('✗ Error testing single visit automation:', error.message);
    return false;
  }
}

async function testBatchAutomation() {
  try {
    console.log('\n=== Testing Batch Automation ===');
    
    const response = await fetch(`${API_BASE}/api/form-automation/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath: '/data/scraped_content.json',
        headless: true,
        selectedVisits: ['visit1', 'visit2', 'visit3']
      }),
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok && data.jobId) {
      console.log('✓ Batch automation endpoint is working');
      console.log('Job ID:', data.jobId);
      
      // Test getting status
      const statusResponse = await fetch(`${API_BASE}/api/form-automation/batch/${data.jobId}/status`);
      const statusData = await statusResponse.json();
      console.log('Job status:', statusData);
      
      return true;
    } else {
      console.error('✗ Batch automation failed:', data.error || data.message);
      return false;
    }
  } catch (error) {
    console.error('✗ Error testing batch automation:', error.message);
    return false;
  }
}

async function testJobOperations() {
  try {
    console.log('\n=== Testing Job Operations ===');
    
    // Test getting active jobs
    const activeJobsResponse = await fetch(`${API_BASE}/api/form-automation/active-jobs`);
    const activeJobs = await activeJobsResponse.json();
    console.log('Active jobs:', activeJobs);
    
    // Test pause/resume/cancel (using a dummy job ID)
    const dummyJobId = 'test-job-123';
    
    console.log('Testing pause job...');
    const pauseResponse = await fetch(`${API_BASE}/api/form-automation/pause/${dummyJobId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Testing pause functionality' }),
    });
    console.log('Pause response:', await pauseResponse.json());
    
    console.log('Testing resume job...');
    const resumeResponse = await fetch(`${API_BASE}/api/form-automation/resume/${dummyJobId}`, {
      method: 'POST',
    });
    console.log('Resume response:', await resumeResponse.json());
    
    console.log('Testing cancel job...');
    const cancelResponse = await fetch(`${API_BASE}/api/form-automation/cancel/${dummyJobId}`, {
      method: 'POST',
    });
    console.log('Cancel response:', await cancelResponse.json());
    
    return true;
  } catch (error) {
    console.error('✗ Error testing job operations:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('Starting FormPrep automation connection tests...');
  
  const results = {
    singleVisit: await testSingleVisitAutomation(),
    batch: await testBatchAutomation(),
    jobOperations: await testJobOperations(),
  };
  
  console.log('\n=== Test Results ===');
  console.log('Single Visit:', results.singleVisit ? '✓ PASSED' : '✗ FAILED');
  console.log('Batch:', results.batch ? '✓ PASSED' : '✗ FAILED');
  console.log('Job Operations:', results.jobOperations ? '✓ PASSED' : '✗ FAILED');
  
  const allPassed = Object.values(results).every(result => result);
  console.log('\nOverall:', allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');
  
  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runTests();