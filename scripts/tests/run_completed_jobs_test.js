#!/usr/bin/env node

// Import the test module
import { testCompletedJobsLogic } from './testCompletedJobsLogic.js';

// Parse command line arguments
const args = process.argv.slice(2);
const userId = args[0]; // Optional user ID

// Display test information
console.log('===== COMPLETED JOBS LOGIC TEST =====');
console.log('This test will verify that:');
console.log('1. Completed jobs are not reported as removed');
console.log('2. Truly removed jobs are still reported');
console.log('3. Other schedule changes (date changes, new jobs) are detected');
console.log('=======================================\n');

// Run the test
testCompletedJobsLogic(userId)
  .then(() => {
    console.log('\nTest completed!');
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  }); 