import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_URL = 'http://localhost:3001';
const ENDPOINT = '/api/form-automation/clear-history';

// Mock user ID for testing
const TEST_USER_ID = 'test-user-123';

// Test cases
const testCases = [
  {
    name: 'Clear single job history',
    data: {
      userId: TEST_USER_ID,
      jobType: 'single'
    },
    expectedStatus: 200
  },
  {
    name: 'Clear batch job history',
    data: {
      userId: TEST_USER_ID,
      jobType: 'batch'
    },
    expectedStatus: 200
  },
  {
    name: 'Clear all job history',
    data: {
      userId: TEST_USER_ID,
      jobType: 'all'
    },
    expectedStatus: 200
  },
  {
    name: 'Missing user ID',
    data: {
      jobType: 'single'
    },
    expectedStatus: 400,
    expectedError: 'User ID is required'
  },
  {
    name: 'Invalid job type',
    data: {
      userId: TEST_USER_ID,
      jobType: 'invalid'
    },
    expectedStatus: 400,
    expectedError: 'Valid job type is required'
  },
  {
    name: 'Missing job type',
    data: {
      userId: TEST_USER_ID
    },
    expectedStatus: 400,
    expectedError: 'Valid job type is required'
  }
];

// Test runner
async function runTests() {
  console.log('Testing Clear History API Endpoint\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`Endpoint: ${ENDPOINT}\n`);

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`Data: ${JSON.stringify(testCase.data)}`);

    try {
      const response = await fetch(`${API_URL}${ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.data)
      });

      const status = response.status;
      const result = await response.json();

      console.log(`Status: ${status}`);
      console.log(`Response: ${JSON.stringify(result)}`);

      if (status === testCase.expectedStatus) {
        if (testCase.expectedError) {
          if (result.error && result.error.includes(testCase.expectedError)) {
            console.log('✅ PASSED - Error message matches expected\n');
            passed++;
          } else {
            console.log(`❌ FAILED - Expected error: "${testCase.expectedError}", Got: "${result.error || 'No error'}"\n`);
            failed++;
          }
        } else {
          if (result.success === true) {
            console.log('✅ PASSED\n');
            passed++;
          } else {
            console.log(`❌ FAILED - Expected success, got: ${JSON.stringify(result)}\n`);
            failed++;
          }
        }
      } else {
        console.log(`❌ FAILED - Expected status ${testCase.expectedStatus}, got ${status}\n`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ FAILED - Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

  // Check if the server is running
  if (failed === testCases.length) {
    console.log('\n⚠️  All tests failed. Make sure the server is running on port 3001.');
  }
}

// Helper function to create mock job data
async function createMockJobData() {
  const userDir = path.join(__dirname, '..', 'data', 'users', TEST_USER_ID);
  const jobHistoryFile = path.join(userDir, 'job_history.json');

  // Create user directory if it doesn't exist
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Create mock job history
  const mockJobHistory = {
    single: [
      {
        jobId: 'single-job-1',
        status: 'completed',
        timestamp: new Date().toISOString(),
        workOrderNumber: '12345'
      },
      {
        jobId: 'single-job-2',
        status: 'completed',
        timestamp: new Date().toISOString(),
        workOrderNumber: '12346'
      }
    ],
    batch: [
      {
        jobId: 'batch-job-1',
        status: 'completed',
        timestamp: new Date().toISOString(),
        items: ['12347', '12348', '12349']
      }
    ]
  };

  fs.writeFileSync(jobHistoryFile, JSON.stringify(mockJobHistory, null, 2));
  console.log(`Created mock job history at: ${jobHistoryFile}\n`);
}

// Run the tests
async function main() {
  console.log('=== Clear History API Test Suite ===\n');
  
  // Create mock data first
  await createMockJobData();
  
  // Run tests
  await runTests();
}

main().catch(console.error);