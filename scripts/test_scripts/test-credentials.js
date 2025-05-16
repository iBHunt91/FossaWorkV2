import { loginToFossa } from './utils/login.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import * as logger from './utils/logger.js';

// Configure logger
logger.configure({
  useColors: process.platform !== 'win32',
  useSimpleFormat: process.platform === 'win32'
});

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up the environment variables path
const envPath = path.resolve(__dirname, '..', '.env');
console.log('Loading environment from:', envPath);
dotenv.config({ path: envPath });

// Test credentials can be passed as arguments or using env vars
const email = process.argv[2] || process.env.FOSSA_EMAIL;
const password = process.argv[3] || process.env.FOSSA_PASSWORD;

// Verify the credentials are set
if (!email || !password) {
  console.error('Error: Email and password are required');
  console.log('Usage: node test-credentials.js [email] [password]');
  process.exit(1);
}

console.log(`Testing credentials for email: ${email}`);
console.log('Password provided:', password ? 'Yes' : 'No');

// Store original env vars
const originalEmail = process.env.FOSSA_EMAIL;
const originalPassword = process.env.FOSSA_PASSWORD;

// Set test credentials
process.env.FOSSA_EMAIL = email;
process.env.FOSSA_PASSWORD = password;

// Test the login
async function testLogin() {
  console.log('Starting login test...');
  try {
    const loginResult = await loginToFossa({ headless: false });
    console.log('Login successful!', loginResult);
    
    if (loginResult.browser) {
      console.log('Closing browser...');
      await loginResult.browser.close();
    }
    
    console.log('TEST PASSED: Credentials are valid');
    return true;
  } catch (error) {
    console.error('Login failed:', error.message);
    console.log('TEST FAILED: Invalid credentials');
    return false;
  } finally {
    // Restore original env vars
    process.env.FOSSA_EMAIL = originalEmail;
    process.env.FOSSA_PASSWORD = originalPassword;
  }
}

testLogin()
  .then(success => {
    // Keep the process alive for 10 seconds to view logs
    console.log('Waiting 10 seconds before exiting...');
    setTimeout(() => {
      process.exit(success ? 0 : 1);
    }, 10000);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  }); 