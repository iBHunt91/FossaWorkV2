import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Setup path resolution for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '.env') });

async function debugAutomation() {
  console.log('Starting debug automation script...');
  let browser = null;
  
  try {
    // Get credentials from environment
    const email = process.env.FOSSA_EMAIL;
    const password = process.env.FOSSA_PASSWORD;
    
    if (!email || !password) {
      throw new Error('Missing FOSSA_EMAIL or FOSSA_PASSWORD in .env file');
    }
    
    console.log('Credentials loaded successfully');
    console.log('Launching browser with VISIBLE mode enabled...');
    
    // Launch browser with explicit options for visibility
    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-web-security',
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      slowMo: 100,
      timeout: 60000,
      devtools: true
    });
    
    console.log('Browser launched. Creating context and page...');
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    
    // Log steps explicitly
    console.log('Navigating to Fossa login page...');
    await page.goto('https://app.workfossa.com');
    
    console.log('Waiting for login form...');
    await page.waitForSelector('input[type="email"][name="email"]', { timeout: 10000 });
    
    console.log('Filling login credentials...');
    await page.fill('input[type="email"][name="email"]', email);
    await page.fill('input[type="password"][name="password"]', password);
    
    console.log('Clicking submit button...');
    await page.click('input[type="submit"]');
    
    console.log('Waiting for dashboard page...');
    await page.waitForURL('**/app/dashboard', { timeout: 30000 });
    
    console.log('Login successful! Navigating to visit URL...');
    
    // Use a sample work order URL - replace with actual URL if needed
    const visitUrl = process.argv[2] || 'https://app.workfossa.com/app/work/126745/visits/128734/';
    await page.goto(visitUrl);
    
    console.log('Page loaded. Browser will remain open for manual inspection.');
    console.log('SUCCESS: You should now see the Fossa visit page in a Chrome window.');
    console.log('Press Ctrl+C to exit when finished.');
    
    // Keep the script running indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'ERROR during automation:');
    console.error(error);
    
    // Try to get more details about the error
    if (error.stack) {
      console.error('\x1b[33m%s\x1b[0m', 'Error stack:');
      console.error(error.stack);
    }
    
    if (browser) {
      console.log('Keeping browser open for inspection despite error...');
      // Still try to keep the browser open even with an error
      await new Promise(() => {});
    }
  }
}

// Run the debug script
debugAutomation().catch(error => {
  console.error('Fatal error outside main function:', error);
}); 