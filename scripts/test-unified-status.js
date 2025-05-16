#!/usr/bin/env node

/**
 * Test the unified status endpoint to verify dispenserProgress is included
 */

import axios from 'axios';

const API_URL = 'http://localhost:3001/api/form-automation';

async function testUnifiedStatus() {
  try {
    console.log('Testing unified status endpoint...\n');
    
    // Test with a single job ID
    console.log('1. Testing single job status:');
    try {
      const singleResponse = await axios.get(`${API_URL}/unified-status/123456`);
      console.log('Single job status:', singleResponse.data);
      console.log('Has dispenserProgress?', 'dispenserProgress' in singleResponse.data);
      console.log('Value:', singleResponse.data.dispenserProgress);
    } catch (error) {
      console.log('Single job error:', error.response?.data || error.message);
    }
    
    console.log('\n2. Testing batch job status:');
    try {
      const batchResponse = await axios.get(`${API_URL}/unified-status/batch_123456`);
      console.log('Batch job status:', batchResponse.data);
      console.log('Has dispenserProgress?', 'dispenserProgress' in batchResponse.data);
      console.log('Value:', batchResponse.data.dispenserProgress);
    } catch (error) {
      console.log('Batch job error:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

// Run the test if called directly
if (process.argv[1].endsWith('test-unified-status.js')) {
  console.log('Starting unified status test...');
  testUnifiedStatus().then(() => {
    console.log('\nTest completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testUnifiedStatus };