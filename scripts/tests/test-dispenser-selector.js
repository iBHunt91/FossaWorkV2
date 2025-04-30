import { loginToFossa } from '../utils/login.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDispenserSelector() {
    let browser;
    try {
        console.log('Starting selector test...');
        
        // Login to Fossa
        console.log('Attempting to login to Fossa...');
        const result = await loginToFossa({ headless: false, slowMo: 100 });
        
        browser = result.browser;
        const { page } = result;
        console.log('Successfully logged in to Fossa');

        // Load scraped content to get the store URL
        const scrapedContentPath = path.join(path.resolve(__dirname, '../../'), 'data/scraped_content.json');
        console.log('Loading scraped content from:', scrapedContentPath);
        
        const fileContent = fs.readFileSync(scrapedContentPath, 'utf8');
        const scrapedContent = JSON.parse(fileContent);
        
        if (!scrapedContent.workOrders || !scrapedContent.workOrders[0] || !scrapedContent.workOrders[0].customer || !scrapedContent.workOrders[0].customer.storeUrl) {
            throw new Error('Store URL not found in scraped_content.json');
        }
        
        const storeUrl = scrapedContent.workOrders[0].customer.storeUrl;
        console.log('Navigating to store URL:', storeUrl);

        // Navigate to the store URL
        await page.goto(storeUrl, { timeout: 60000 });
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        console.log('Page loaded');
        
        // Create logs directory if it doesn't exist
        const logsDir = path.join(path.resolve(__dirname, '../../'), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        // Take a screenshot before clicking anything
        await page.screenshot({ path: path.join(logsDir, 'before-equipment-tab.png'), fullPage: true });
        
        // Try to find the Equipment tab
        const equipmentTab = await page.$('a[href="#equipment"], a:has-text("Equipment")');
        if (equipmentTab) {
            console.log('Found Equipment tab, clicking it');
            await equipmentTab.click();
            await page.waitForTimeout(2000);
            
            // Take screenshot after clicking equipment tab
            await page.screenshot({ path: path.join(logsDir, 'after-equipment-tab.png'), fullPage: true });
        } else {
            console.log('Equipment tab not found - may already be on that tab');
        }
        
        // Method 1: Try using the precise Dispenser selector
        console.log('Trying to locate dispenser with a[title="Show equipment"] that contains Dispenser');
        const dispenserExists = await page.locator('a[title="Show equipment"]').filter({ hasText: 'Dispenser' }).count() > 0;
        console.log('Method 1 found dispenser:', dispenserExists);
        
        if (dispenserExists) {
            await page.locator('a[title="Show equipment"]').filter({ hasText: 'Dispenser' }).first().click();
            console.log('Clicked dispenser using Method 1');
            await page.waitForTimeout(2000);
            
            // Take screenshot after clicking dispenser
            await page.screenshot({ path: path.join(logsDir, 'after-dispenser-click-method1.png'), fullPage: true });
        }
        
        // Method 2: Try getByText with a more specific approach
        console.log('Trying to locate dispenser with getByText');
        const dispenserTextExists = await page.getByText('Dispenser', { exact: false }).count() > 0;
        console.log('Method 2 found dispenser:', dispenserTextExists);
        
        // Save the HTML for debugging
        const pageHtml = await page.content();
        fs.writeFileSync(path.join(logsDir, 'equipment-page.html'), pageHtml);
        console.log('Page HTML saved for analysis');
        
        // Close the browser
        await browser.close();
        console.log('Test completed');
        
        return {
            method1: dispenserExists,
            method2: dispenserTextExists
        };
    } catch (error) {
        console.error('Error during testing:', error);
        console.error('Error stack:', error.stack);
        
        if (browser) {
            await browser.close().catch(err => console.error('Error closing browser:', err));
        }
        throw error;
    }
}

// Run the function directly
console.log('Starting selector test script');
testDispenserSelector()
    .then(result => {
        console.log('Test results:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    }); 