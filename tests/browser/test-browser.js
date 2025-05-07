import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Setup path resolution for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '.env') });

async function testBrowser() {
  console.log('Starting browser test...');
  
  try {
    console.log('Launching browser in visible mode...');
    // Launch the browser with specific options to ensure visibility
    const browser = await chromium.launch({
      headless: false,
      devtools: true,
      slowMo: 100,
      timeout: 60000,
      args: ['--start-maximized', '--disable-web-security']
    });
    
    console.log('Browser launched successfully. Creating page...');
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('Navigating to google.com...');
    await page.goto('https://www.google.com');
    
    console.log('Page loaded. Browser will remain open until Ctrl+C is pressed.');
    console.log('SUCCESS: If you can see a Chrome window with Google, the browser launch works correctly.');
    
    // Keep the script running
    await new Promise(() => {});
    
  } catch (error) {
    console.error('ERROR launching browser:', error);
    process.exit(1);
  }
}

// Run the test
testBrowser().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 