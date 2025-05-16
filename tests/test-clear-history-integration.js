import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test-user-integration';
const TIMEOUT = 30000;

// Helper to check if server is running
async function checkServerRunning() {
  try {
    await fetch('http://localhost:3001/api/health');
    return true;
  } catch (error) {
    return false;
  }
}

// Helper to setup test data
async function setupTestData() {
  const userDir = join(__dirname, '..', 'data', 'users', TEST_USER_ID);
  
  // Create user directory
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  
  // Create mock job history
  const jobHistory = {
    single: [
      { jobId: 'test-single-1', status: 'completed', workOrderNumber: '12345' },
      { jobId: 'test-single-2', status: 'completed', workOrderNumber: '12346' }
    ],
    batch: [
      { jobId: 'test-batch-1', status: 'completed', items: ['12347', '12348'] }
    ]
  };
  
  fs.writeFileSync(
    join(userDir, 'job_history.json'),
    JSON.stringify(jobHistory, null, 2)
  );
  
  console.log('Test data setup complete');
}

// Test single visit automation clear history
async function testSingleVisitClearHistory(page) {
  console.log('\n=== Testing Single Visit Clear History ===');
  
  try {
    // Navigate to FormPrep page
    await page.goto(`${TEST_URL}/form-prep`, { waitUntil: 'networkidle2' });
    console.log('✓ Navigated to FormPrep page');
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="single-visit-automation"]', { timeout: 10000 });
    console.log('✓ Single visit automation section loaded');
    
    // Check if there are jobs in history
    const jobCount = await page.$$eval(
      '[data-testid="single-job-item"]',
      items => items.length
    );
    console.log(`✓ Found ${jobCount} jobs in history`);
    
    // Click clear history button
    await page.click('[data-testid="clear-single-history"]');
    console.log('✓ Clicked clear history button');
    
    // Handle confirmation dialog
    page.on('dialog', async dialog => {
      console.log(`✓ Confirmation dialog: ${dialog.message()}`);
      await dialog.accept();
    });
    
    // Wait for the jobs to be cleared
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="single-job-item"]').length === 0,
      { timeout: 5000 }
    );
    console.log('✓ Jobs cleared from UI');
    
    // Verify success toast
    await page.waitForSelector('.toast-success', { timeout: 5000 });
    console.log('✓ Success toast displayed');
    
    return true;
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return false;
  }
}

// Test batch visit automation clear history
async function testBatchVisitClearHistory(page) {
  console.log('\n=== Testing Batch Visit Clear History ===');
  
  try {
    // Switch to batch tab
    await page.click('[data-testid="batch-tab"]');
    console.log('✓ Switched to batch tab');
    
    // Wait for batch section to load
    await page.waitForSelector('[data-testid="batch-visit-automation"]', { timeout: 10000 });
    console.log('✓ Batch visit automation section loaded');
    
    // Check if there are jobs in history
    const jobCount = await page.$$eval(
      '[data-testid="batch-job-item"]',
      items => items.length
    );
    console.log(`✓ Found ${jobCount} batch jobs in history`);
    
    // Click clear history button
    await page.click('[data-testid="clear-batch-history"]');
    console.log('✓ Clicked clear batch history button');
    
    // Handle confirmation dialog
    page.on('dialog', async dialog => {
      console.log(`✓ Confirmation dialog: ${dialog.message()}`);
      await dialog.accept();
    });
    
    // Wait for the jobs to be cleared
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="batch-job-item"]').length === 0,
      { timeout: 5000 }
    );
    console.log('✓ Batch jobs cleared from UI');
    
    // Verify success toast
    await page.waitForSelector('.toast-success', { timeout: 5000 });
    console.log('✓ Success toast displayed');
    
    return true;
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('=== Clear History Integration Tests ===\n');
  
  // Check if servers are running
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    console.error('⚠️  Backend server is not running. Please start it with: npm run server');
    process.exit(1);
  }
  
  // Setup test data
  await setupTestData();
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  let passed = 0;
  let failed = 0;
  
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Test single visit clear history
    if (await testSingleVisitClearHistory(page)) {
      passed++;
    } else {
      failed++;
    }
    
    // Test batch visit clear history
    if (await testBatchVisitClearHistory(page)) {
      passed++;
    } else {
      failed++;
    }
    
  } catch (error) {
    console.error('Test runner error:', error);
    failed = 2;
  } finally {
    await browser.close();
    
    console.log('\n=== Test Summary ===');
    console.log(`Total tests: 2`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success rate: ${((passed / 2) * 100).toFixed(1)}%`);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});