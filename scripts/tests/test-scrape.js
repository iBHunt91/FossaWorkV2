import { loginToFossa } from './login.js';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Ensure environment variables are loaded
dotenv.config();

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

console.log('Script starting...');

async function scrapeLocationPage(page) {
    try {
        console.log('Finding Equipment tab...');
        // Click on the Equipment tab
        await page.click('a[href*="equipment"]');
        
        // Wait for the equipment page to load
        await page.waitForSelector('.equipment-list');
        console.log('Equipment tab loaded');
        
        // Take a screenshot
        await page.screenshot({ path: 'before-js-click.png' });
        
        // Find the dispenser section
        const dispenserSection = await page.$('.component-section[data-component-type="dispensers"]');
        if (!dispenserSection) {
            console.log('Dispenser section not found');
            return;
        }
        console.log('Found dispenser section');
        
        // Check if it's collapsed and expand it if needed
        const isCollapsed = await page.evaluate(section => {
            return section.classList.contains('collapsed');
        }, dispenserSection);
        
        console.log('Dispenser section is collapsed:', isCollapsed);
        
        await page.screenshot({ path: 'before-expand-dispenser.png' });
        
        if (isCollapsed) {
            // Click to expand the section
            await page.click('.component-section[data-component-type="dispensers"] .section-toggle');
            console.log('Clicked to expand dispenser section');
            // Wait for it to expand
            await page.waitForTimeout(1000);
        }
        
        await page.screenshot({ path: 'after-expand-dispenser.png' });
        
        // Now extract the dispenser details
        const dispenserItems = await page.$$('.component-section[data-component-type="dispensers"] .component-items > div');
        console.log(`Found ${dispenserItems.length} dispenser items`);
        
        // Extract the HTML content
        const dispenserDetailsHtml = await page.evaluate(() => {
            const section = document.querySelector('.component-section[data-component-type="dispensers"] .component-items');
            return section ? section.innerHTML : '';
        });
        
        // Save the HTML to a file
        const dispenserDetailsHtmlPath = path.join(__dirname, '..', 'data', 'dispenser_details.html');
        fs.writeFileSync(dispenserDetailsHtmlPath, dispenserDetailsHtml);
        console.log(`Saved dispenser details HTML to ${dispenserDetailsHtmlPath}`);
        
        // Extract structured data
        const dispenserData = await page.evaluate(() => {
            const dispensers = [];
            const dispenserItems = document.querySelectorAll('.component-section[data-component-type="dispensers"] .component-items > div');
            
            dispenserItems.forEach(item => {
                // Extract the header text which contains position and other details
                const headerText = item.querySelector('.flex.align-start div')?.textContent?.trim() || '';
                
                // Extract position from the header (typically formatted as "1/2 - ...")
                const positionMatch = headerText.match(/^(\d+\/\d+)/);
                const position = positionMatch ? positionMatch[1] : '';
                
                // Extract serial number
                const serialElement = item.querySelector('.muted.text-tiny');
                const serial = serialElement ? serialElement.textContent.replace('S/N:', '').trim() : '';
                
                // Extract make and model
                const makeElement = item.querySelector('.text-tiny div:nth-child(1)');
                const make = makeElement ? makeElement.textContent.replace('MAKE:', '').trim() : '';
                
                const modelElement = item.querySelector('.text-tiny div:nth-child(2)');
                const model = modelElement ? modelElement.textContent.replace('MODEL:', '').trim() : '';
                
                // Extract other details from custom fields
                const extractField = (label) => {
                    const labelElement = Array.from(item.querySelectorAll('.muted.uppercase.text-xs')).find(el => 
                        el.textContent.trim().toUpperCase() === label.toUpperCase()
                    );
                    if (!labelElement) return '';
                    
                    // Get the next sibling which contains the value
                    const valueElement = labelElement.parentElement.querySelector('.text-xs.mt-1');
                    return valueElement ? valueElement.textContent.trim() : '';
                };
                
                const grade = extractField('Grade');
                const standAloneCode = extractField('Stand Alone Code');
                const nozzles = extractField('Number of Nozzles (per side)');
                const meterType = extractField('Meter Type');
                
                dispensers.push({
                    position,
                    make,
                    model,
                    serial,
                    grade,
                    standAloneCode,
                    nozzles,
                    meterType
                });
            });
            
            return dispensers;
        });
        
        // Save the data to a JSON file
        const data = {
            timestamp: new Date().toISOString(),
            locationId: '32826',
            dispensers: dispenserData
        };
        
        const dispenserDataPath = path.join(__dirname, '..', 'data', 'dispenser_details.json');
        fs.writeFileSync(dispenserDataPath, JSON.stringify(data, null, 2));
        console.log(`Saved dispenser details to ${dispenserDataPath}`);
        
        await page.screenshot({ path: 'after-dispenser-scraping.png' });
        console.log('Finished scraping dispenser information');
        
    } catch (error) {
        console.error('Error while scraping location page:', error);
    }
}

async function main() {
  let browser;
  try {
    // Check if environment variables are set
    if (!process.env.FOSSA_EMAIL || !process.env.FOSSA_PASSWORD) {
      throw new Error('Missing FOSSA_EMAIL or FOSSA_PASSWORD environment variables');
    }

    console.log('Environment variables loaded successfully');
    console.log('Starting login process...');
    
    // Login to Fossa
    console.log('Calling loginToFossa()...');
    const result = await loginToFossa();
    browser = result.browser;
    const { page } = result;
    
    console.log('Login successful, navigating to location page...');
    // Navigate to the specific location page
    await page.goto('https://app.workfossa.com/app/customers/locations/32826', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('Waiting for page to load...');
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Call the scrapeLocationPage function with the page object
    await scrapeLocationPage(page);
    
    console.log('Closing browser...');
    // Close the browser
    await browser.close();
    
  } catch (error) {
    console.error('Error during scraping:', error);
    console.error('Error stack:', error.stack);
    // Ensure browser is closed even if there's an error
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

// Run the scraping function
console.log('Running main()...');
main()
    .then(() => {
        console.log('Scraping completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Scraping failed:', error);
        process.exit(1);
    });

export { scrapeLocationPage }; 