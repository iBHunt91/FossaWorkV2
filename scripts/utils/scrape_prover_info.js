import { loginToFossa } from './login.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as logger from './logger.js';
import { resolveUserFilePath, getActiveUser } from '../../server/utils/userManager.js';

// Configure paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = resolveUserFilePath('prover_preferences.json');
const logPath = path.resolve(__dirname, '../../data/prover_scraper.log');

/**
 * Simple function to write logs to a file
 */
async function writeLog(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    try {
        // Create the log file if it doesn't exist
        const fileExists = await fs.access(logPath).then(() => true).catch(() => false);
        if (!fileExists) {
            await fs.writeFile(logPath, '');
        }
        
        // Append to the log file
        await fs.appendFile(logPath, logMessage);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

/**
 * Creates necessary directories if they don't exist
 */
async function ensureDirectoriesExist() {
    // Extract directory path from the dataPath
    const dataDir = path.dirname(dataPath);
    
    try {
        // Check if directory exists, create it if it doesn't
        await fs.mkdir(dataDir, { recursive: true });
        return true;
    } catch (error) {
        console.error('Failed to create directories:', error);
        return false;
    }
}

/**
 * Scrape prover information from the fleet inventory page
 */
async function scrapeProverInfo(options = { headless: true }) {
    // Clear previous log and start a new one
    try {
        await fs.writeFile(logPath, `Starting prover information scrape at ${new Date().toISOString()}\n`);
    } catch (error) {
        console.error('Failed to initialize log file:', error);
    }
    
    // Ensure data directory exists
    await ensureDirectoriesExist();
    
    await writeLog('Prover scraper started');
    logger.info('Prover Scraper', 'Starting prover information collection');
    
    let browser;
    
    try {
        // Login to FOSSA
        await writeLog('Attempting to login to FOSSA');
        const result = await loginToFossa(options);
        
        if (!result || !result.success) {
            throw new Error('Login failed or returned unexpected response');
        }
        
        browser = result.browser;
        const page = result.page;
        
        await writeLog('Successfully logged in to FOSSA');
        logger.info('Authentication', 'Successfully logged in to FOSSA');
        
        // Navigate to the fleet inventory page
        await writeLog('Navigating to fleet inventory page');
        logger.info('Navigation', 'Going to fleet inventory page');
        
        await page.goto('https://app.workfossa.com/app/fleet-inventory', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        await writeLog('Page loaded, waiting for content');
        await page.waitForTimeout(5000);
        
        // Create screenshots directory if it doesn't exist
        const screenshotsDir = path.resolve(__dirname, '../../data/screenshots');
        await fs.mkdir(screenshotsDir, { recursive: true });
        
        // Take a screenshot to see what we're looking at
        const screenshotPath = path.resolve(screenshotsDir, 'fleet_page.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await writeLog(`Screenshot saved to ${screenshotPath}`);
        logger.info('Debug', `Screenshot saved to ${screenshotPath}`);
        
        // Check page title to confirm we're on the right page
        const title = await page.title();
        await writeLog(`Current page title: ${title}`);
        
        // Extract any prover information we can find
        await writeLog('Attempting to extract prover information');
        
        // Take inventory of all elements to help with debugging
        const pageStructure = await page.evaluate(() => {
            // Get all headers on the page
            const headers = Array.from(document.querySelectorAll('h1, h2, h3, li.header-row'))
                .map(el => ({ type: el.tagName, text: el.textContent.trim() }));
                
            // Get tab titles
            const tabs = Array.from(document.querySelectorAll('ul.tabs-title-bar li a'))
                .map(a => a.textContent.trim());
                
            // Create a simple JSON of the page structure
            return {
                title: document.title,
                url: window.location.href,
                headers,
                tabs,
                hasEquipmentTab: tabs.includes('Equipment')
            };
        });
        
        await writeLog(`Page structure: ${JSON.stringify(pageStructure, null, 2)}`);
        
        // Check if the Equipment tab exists
        if (!pageStructure.hasEquipmentTab) {
            throw new Error('Equipment tab not found on the page');
        }
        
        // Click on the Equipment tab
        await writeLog('Clicking Equipment tab');
        logger.info('Navigation', 'Clicking Equipment tab');
        await page.click('ul.tabs-title-bar li a[href="#Equipment"]');
        await page.waitForTimeout(5000);
        
        // Take another screenshot after clicking
        const equipmentScreenshotPath = path.resolve(screenshotsDir, 'equipment_tab.png');
        await page.screenshot({ path: equipmentScreenshotPath, fullPage: true });
        await writeLog(`Equipment tab screenshot saved to ${equipmentScreenshotPath}`);
        
        // Extract the prover information
        const provers = [];
        
        // Use a simpler, more direct approach to extract information
        await writeLog('Extracting prover information');
        
        // Check if we can find provers by searching the page text
        const pageText = await page.textContent('body');
        const hasProversText = pageText.includes('Seraphin Prover');
        await writeLog(`Page contains "Seraphin Prover" text: ${hasProversText}`);
        
        // Try to extract prover information using page.$$eval
        const extractedProvers = await page.$$eval('li:not(.header-row)', (items) => {
            return items
                .filter(item => {
                    // Look for prover-related items
                    const text = item.textContent.toLowerCase();
                    return text.includes('seraphin prover') || text.includes('prover');
                })
                .map(item => {
                    // Try to extract information from this item
                    const fullText = item.textContent.trim();
                    const idMatch = fullText.match(/(\d+-\d+-\d+)/); // Match pattern like xx-xxxxx-xx
                    const serialMatch = fullText.match(/S\/N: ([^\s]+)/);
                    const makeMatch = fullText.match(/MAKE: ([^\n]+)/);
                    
                    return {
                        full_text: fullText,
                        prover_id: idMatch ? idMatch[1] : 'unknown',
                        serial: serialMatch ? serialMatch[1] : 'unknown',
                        make: makeMatch ? makeMatch[1].trim() : 'Seraphin Prover'
                    };
                });
        });
        
        await writeLog(`Found ${extractedProvers.length} possible provers`);
        
        // Add any found provers to our list
        provers.push(...extractedProvers);
        
        // Create the prover preferences data
        const proverPreferences = {
            provers,
            last_updated: new Date().toISOString()
        };
        
        // Save the data to a JSON file
        await fs.writeFile(dataPath, JSON.stringify(proverPreferences, null, 2));
        await writeLog(`Saved prover data to ${dataPath}`);
        logger.success('Data Saved', `Prover information saved to ${dataPath}`);
        
        // Display the found provers
        console.log('Provers found:');
        console.log(JSON.stringify(provers, null, 2));
        
        return { success: true, data: proverPreferences };
    } catch (error) {
        await writeLog(`ERROR: ${error.message}`);
        logger.error('Scraping Failed', error.message);
        console.error(error);
        throw error;
    } finally {
        // Close the browser if it was opened
        if (browser) {
            await browser.close();
            await writeLog('Browser closed');
        }
        await writeLog('Prover scraper finished');
    }
}

// If the script is run directly
if (import.meta.url === `file://${fileURLToPath(import.meta.url)}`) {
    scrapeProverInfo({ headless: false }) // Use visible browser when run directly for debugging
        .then(({ data }) => {
            logger.success('Script Complete', 'Prover information collection completed successfully');
        })
        .catch(error => {
            logger.error('Script Error', error.message || 'Unknown error');
            process.exit(1);
        });
}

// Export the function for use in other scripts
export { scrapeProverInfo }; 