import fetch from 'node-fetch';

// Test configuration
const API_URL = 'http://localhost:3001';
const TEST_USER_ID = 'test-user-manual';

async function testClearHistory() {
  console.log('=== Manual Clear History Test ===\n');
  
  const tests = [
    { jobType: 'single', expectedStatus: 200 },
    { jobType: 'batch', expectedStatus: 200 },
    { jobType: 'all', expectedStatus: 200 }
  ];
  
  for (const test of tests) {
    console.log(`Testing clear ${test.jobType} job history...`);
    
    try {
      const response = await fetch(`${API_URL}/api/form-automation/clear-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: TEST_USER_ID,
          jobType: test.jobType
        })
      });
      
      const data = await response.json();
      
      if (response.status === test.expectedStatus && data.success) {
        console.log(`✅ Success: ${data.message}`);
      } else {
        console.log(`❌ Failed: Status ${response.status}, Response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Test error cases
  console.log('Testing error cases...\n');
  
  const errorTests = [
    { 
      name: 'Missing user ID',
      data: { jobType: 'single' },
      expectedError: 'User ID is required'
    },
    {
      name: 'Invalid job type',
      data: { userId: TEST_USER_ID, jobType: 'invalid' },
      expectedError: 'Valid job type is required'
    }
  ];
  
  for (const test of errorTests) {
    console.log(`Testing: ${test.name}`);
    
    try {
      const response = await fetch(`${API_URL}/api/form-automation/clear-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.data)
      });
      
      const data = await response.json();
      
      if (response.status === 400 && data.error.includes(test.expectedError)) {
        console.log(`✅ Success: Got expected error - ${data.error}`);
      } else {
        console.log(`❌ Failed: Status ${response.status}, Response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
}

// Run the test
testClearHistory().catch(console.error);