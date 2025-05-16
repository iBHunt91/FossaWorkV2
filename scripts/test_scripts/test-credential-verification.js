import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { verifyCredentials, updateUserCredentials } from '../../src/services/userService.js';
import { loginToFossa } from '../utils/login.js';
import dotenv from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env') });

// Test verification process
async function testVerificationProcess() {
  console.log('=== Testing Credential Verification Process ===\n');
  
  // Get valid credentials from environment
  const validEmail = process.env.FOSSA_EMAIL;
  const validPassword = process.env.FOSSA_PASSWORD;
  
  if (!validEmail || !validPassword) {
    console.error('❌ No valid Fossa credentials found in environment');
    console.log('Please set FOSSA_EMAIL and FOSSA_PASSWORD in your .env file');
    process.exit(1);
  }
  
  console.log(`Using credentials from environment: ${validEmail.substring(0, 3)}***\n`);
  
  // Test 1: Direct login verification
  console.log('1. Testing direct login verification...');
  try {
    const loginResult = await loginToFossa({
      headless: true,
      email: validEmail,
      password: validPassword
    });
    
    console.log('Login result:', loginResult.success ? '✅ SUCCESS' : '❌ FAILED');
    
    if (loginResult.browser) {
      await loginResult.browser.close();
    }
  } catch (error) {
    console.error('❌ Direct login failed:', error.message);
  }
  
  // Test 2: API verification endpoint
  console.log('\n2. Testing API verification endpoint...');
  try {
    const isValid = await verifyCredentials(validEmail, validPassword);
    console.log('API verification result:', isValid ? '✅ SUCCESS' : '❌ FAILED');
  } catch (error) {
    console.error('❌ API verification failed:', error.message);
  }
  
  // Test 3: Invalid credentials
  console.log('\n3. Testing with invalid credentials...');
  try {
    const isValid = await verifyCredentials('invalid@example.com', 'wrongpassword');
    console.log('Invalid credential test:', isValid ? '❌ UNEXPECTED SUCCESS' : '✅ PROPERLY REJECTED');
  } catch (error) {
    console.error('❌ Error during invalid credential test:', error.message);
  }
  
  // Test 4: Login timeout handling
  console.log('\n4. Testing login timeout handling...');
  try {
    // Use a very short timeout to test timeout behavior
    const shortTimeoutResult = await Promise.race([
      loginToFossa({
        headless: true,
        email: validEmail,
        password: validPassword
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout test')), 100))
    ]);
    
    if (shortTimeoutResult.browser) {
      await shortTimeoutResult.browser.close();
    }
  } catch (error) {
    console.log('Timeout test result:', error.message === 'Timeout test' ? '✅ Timeout handled properly' : '❌ Unexpected error');
  }
  
  console.log('\n✅ Verification process test completed!');
}

// Run the test
async function main() {
  try {
    await testVerificationProcess();
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();