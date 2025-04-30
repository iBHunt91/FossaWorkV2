import { loginToFossa } from '../utils/login.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testLogin() {
  console.log('Starting test login script');
  
  // Create logs directory if needed
  const logsDir = path.join(path.resolve(__dirname, '../../'), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Create a test log file
  const logFile = path.join(logsDir, 'login-test.log');
  fs.writeFileSync(logFile, `Login test started at ${new Date().toISOString()}\n`);
  
  try {
    console.log('About to call loginToFossa()');
    fs.appendFileSync(logFile, 'Calling loginToFossa()\n');
    
    const result = await loginToFossa({ headless: true });
    console.log('Login successful!');
    fs.appendFileSync(logFile, 'Login successful!\n');
    
    if (result.browser) {
      console.log('Browser instance created');
      fs.appendFileSync(logFile, 'Browser instance created\n');
      
      // Close browser
      await result.browser.close();
      console.log('Browser closed');
      fs.appendFileSync(logFile, 'Browser closed\n');
    } else {
      console.log('No browser instance returned');
      fs.appendFileSync(logFile, 'No browser instance returned\n');
    }
    
  } catch (error) {
    console.error('Error during login test:', error);
    fs.appendFileSync(logFile, `ERROR: ${error.message}\n`);
    if (error.stack) {
      fs.appendFileSync(logFile, `Stack: ${error.stack}\n`);
    }
  }
  
  console.log('Test completed');
  fs.appendFileSync(logFile, 'Test completed\n');
}

// Run the test function
testLogin()
  .then(() => {
    console.log('Test function resolved');
    process.exit(0);
  })
  .catch(err => {
    console.error('Unhandled rejection in test function:', err);
    process.exit(1);
  }); 