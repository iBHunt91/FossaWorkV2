import { loginToFossa } from './login.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('==== Test Scraper Starting =====');

// Create a test function that mirrors the main functionality but simplified
async function testScrape() {
  console.log('Starting test scrape');
  
  try {
    // Test login
    console.log('Testing login...');
    const loginResult = await loginToFossa({ headless: true });
    console.log('Login successful!');
    
    // Close browser
    await loginResult.browser.close();
    console.log('Browser closed');
    
    // Test reading scraped_content.json
    console.log('Testing JSON read...');
    const scrapedContentPath = path.join(__dirname, '../data/scraped_content.json');
    console.log('Content path:', scrapedContentPath);
    
    // Check if file exists
    if (fs.existsSync(scrapedContentPath)) {
      console.log('File exists!');
      
      // Read file
      const content = fs.readFileSync(scrapedContentPath, 'utf8');
      console.log(`Read ${content.length} bytes from file`);
      
      // Parse JSON
      const data = JSON.parse(content);
      console.log('JSON parsed successfully');
      
      // Check for workOrders
      if (data.workOrders && Array.isArray(data.workOrders)) {
        console.log(`Found ${data.workOrders.length} work orders`);
        
        // Log first work order ID
        if (data.workOrders.length > 0) {
          console.log('First work order ID:', data.workOrders[0].id || 'unknown');
        }
      } else {
        console.log('No work orders array found in data');
      }
    } else {
      console.log('File does not exist:', scrapedContentPath);
    }
    
    console.log('Test completed successfully');
    return true;
  } catch (error) {
    console.error('Test failed with error:', error);
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }
    return false;
  }
}

// Directly run the test function without checking import.meta.url
console.log('Calling test function directly...');
testScrape()
  .then(success => {
    console.log(`Test ${success ? 'succeeded' : 'failed'}`);
    console.log('Exiting process');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

console.log('Test script initialized, waiting for async operations to complete...'); 