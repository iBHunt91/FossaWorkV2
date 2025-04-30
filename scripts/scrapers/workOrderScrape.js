import { loginToFossa } from '../utils/login.js';
import * as logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { enhanceScrapeLogs } from '../enhance-scrape-logs.js';

// Configure logger for this environment (if not already done in login.js)
logger.configure({
  useColors: process.platform !== 'win32',
  useSimpleFormat: process.platform === 'win32'
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to extract store number from HTML
function extractStoreNumber(html) {
  // Method 1: Standard regexes to find location links with store numbers
  const locationLinkPattern = /<a href="\/app\/customers\/locations\/\d+\/"[^>]*>([\s\S]*?)<\/a>/;
  const match = html.match(locationLinkPattern);
  
  if (match && match[1]) {
    return match[1].trim();
  }

  // Method 2: Direct pattern match for store number format
  const storeNumberPattern = /#\d+/;
  const storeMatch = html.match(storeNumberPattern);
  
  if (storeMatch) {
    return storeMatch[0];
  }
  
  return null;
}

// Function to extract location ID from HTML for creating the correct store URL
function extractLocationId(html) {
  const locationUrlPattern = /\/app\/customers\/locations\/(\d+)\//;
  const match = html.match(locationUrlPattern);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

async function waitForNetworkIdle(page, timeout = 5000) {
    try {
        await page.waitForLoadState('networkidle', { timeout });
    } catch (error) {
        logger.warn('Network Warning', 'Network idle timeout reached');
    }
}

// Helper to import from server/services without direct imports
async function getDispenserService() {
    try {
        // Correct path resolution for ES modules
        const servicePath = path.join(dirname(dirname(__dirname)), 'server', 'services', 'dispenserService.js');
        if (fs.existsSync(servicePath)) {
            // Use dynamic import with URL format
            return await import('file://' + servicePath.replace(/\\/g, '/'));
        }
        return null;
    } catch (error) {
        logger.error('Import Error', `Failed to import dispenser service: ${error.message}`);
        return null;
    }
}

async function runAutomation(progressCallback = null) {
    let browser;
    try {
        logger.section('AUTOMATION PROCESS');
        console.log('Starting automation...');
        if (progressCallback) progressCallback(5, 'Preparing to collect work order data...');
        
        // Login to Fossa
        const result = await loginToFossa();
        browser = result.browser;
        const { page } = result;
        logger.info('Authentication', 'Successfully logged in to Fossa');
        if (progressCallback) progressCallback(15, 'Connected to Fossa system successfully');
        
        // Navigate to work list page
        const targetUrl = 'https://app.workfossa.com/app/work/list?visit_scheduled=scheduled%7C%7C%7C%7CWith%20Scheduled%20Visits&work_visit_completion=none%7C%7CNo%20visits%20completed%7C%7CWork%20Visits%20Completed&order_direction=asc';
        logger.info('Navigation', 'Navigating to work list page');
        if (progressCallback) progressCallback(20, 'Accessing upcoming service schedule...');
        
        // Wait for navigation and network requests to complete
        await Promise.all([
            page.goto(targetUrl),
            page.waitForLoadState('networkidle')
        ]);
        
        // Wait for the page to be fully loaded
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('.work-list-item');
        await waitForNetworkIdle(page);
        
        logger.success('Page Status', 'Initial page load complete');
        if (progressCallback) progressCallback(30, 'Service schedule loaded');
        
        // Change page size to 100
        logger.info('Page Configuration', 'Changing page size to 100...');
        if (progressCallback) progressCallback(35, 'Collecting all available service appointments...');
        
        // Find the dropdown that contains "Show 25"
        const dropdown = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('.ks-select-selection'));
            const targetElement = elements.find(el => el.textContent.trim().includes('Show 25'));
            if (targetElement) {
                const rect = targetElement.getBoundingClientRect();
                return {
                    found: true,
                    x: rect.x + rect.width / 2,
                    y: rect.y + rect.height / 2
                };
            }
            return { found: false };
        });

        if (!dropdown.found) {
            throw new Error('Could not find Show 25 dropdown');
        }

        // Click the center of the dropdown element
        await page.mouse.click(dropdown.x, dropdown.y);
        logger.info('UI Action', 'Clicked dropdown');
        
        // Wait a moment for the dropdown to open
        await page.waitForTimeout(1000);
        
        // Click the "Show 100" option
        const show100Exists = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('li'));
            const targetElement = elements.find(el => el.textContent.trim() === 'Show 100');
            if (targetElement) {
                targetElement.click();
                return true;
            }
            return false;
        });

        if (!show100Exists) {
            throw new Error('Could not find Show 100 option');
        }
        
        logger.success('UI Action', 'Selected Show 100');
        if (progressCallback) progressCallback(40, 'Selected 100 items per page');
        
        // Wait for the loading indicator and page update
        logger.info('Page Status', 'Waiting for page to update...');
        try {
            // Wait for loader to appear
            await page.waitForSelector('.loader-line', { state: 'visible', timeout: 5000 });
            logger.info('Page Status', 'Loading indicator appeared');
            
            // Wait for loader to disappear
            await page.waitForSelector('.loader-line', { state: 'hidden', timeout: 30000 });
            logger.success('Page Status', 'Loading indicator disappeared');
        } catch (error) {
            logger.warn('Page Status', 'Note: Loading indicator not seen');
        }
        
        // Wait for network requests to complete and page to settle
        await waitForNetworkIdle(page);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
        
        // Verify page size was changed
        const currentPageSize = await page.evaluate(() => {
            const selector = document.querySelector('.ks-select-selection');
            return selector ? selector.textContent.trim() : null;
        });
        logger.info('Page Status', `Current page size setting: ${currentPageSize}`);
        if (progressCallback) progressCallback(50, 'Page loaded with 100 items');
        
        // Get total number of matches
        const totalMatches = await page.evaluate(() => {
            const matchesElement = document.querySelector('.text-right.muted.text-sm.ks-padding-fix.sm-hide.tab-hide.med-show-up');
            if (matchesElement) {
                const text = matchesElement.textContent.trim();
                const matches = text.match(/(\d+)\s+matches/);
                return matches ? parseInt(matches[1]) : null;
            }
            return null;
        });
        
        if (totalMatches !== null) {
            logger.info('Data Status', `Total matches found: ${totalMatches}`);
            if (progressCallback) progressCallback(55, `Found ${totalMatches} upcoming service appointments`);
        } else {
            logger.warn('Data Status', 'Could not determine total number of matches');
            if (progressCallback) progressCallback(55, 'Processing upcoming service appointments');
        }
        
        // Wait for all job elements to be visible
        await page.waitForSelector('.work-list-item');
        await waitForNetworkIdle(page);
        if (progressCallback) progressCallback(60, 'Analyzing service appointment details...');
        
        // Get all jobs from the page
        logger.info('Data Processing', 'Extracting jobs...');
        const initialJobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.work-list-item');
            const jobCount = jobElements.length;
            
            const results = {
                jobs: [],
                logs: [],
                errors: []
            };
            
            results.jobs = Array.from(jobElements).map(job => {
                const result = {
                    id: null,
                    customer: {
                        name: null,
                        storeNumber: null,
                        address: null
                    },
                    services: [],
                    visits: {
                        nextVisit: null
                    },
                    instructions: null,
                    rawHtml: job.outerHTML // Store raw HTML for debugging
                };

                try {
                    // Get work order ID
                    const workOrderLink = job.querySelector('a[href^="/app/work/"]');
                    if (workOrderLink) {
                        result.id = workOrderLink.textContent.trim();
                    } else {
                        results.logs.push('Warning: Could not find work order link');
                    }
                    
                    // Get customer information
                    const customerNameElement = job.querySelector('.address a');
                    
                    if (customerNameElement) {
                        result.customer.name = customerNameElement.textContent.trim();
                    }

                    // Get address information
                    const addressInfoDiv = job.querySelector('.address-info');
                    if (addressInfoDiv) {
                        const addressLines = Array.from(addressInfoDiv.querySelectorAll('div > div')).map(div => div.textContent.trim());
                        result.customer.address = {
                            street: addressLines[0] || null,
                            intersection: addressLines[1] || null,
                            cityState: addressLines[2] || null,
                            county: addressLines[3] || null
                        };
                    }
                    
                    // Get services
                    const serviceElements = job.querySelectorAll('.text-xs.mb-2');
                    serviceElements.forEach(service => {
                        try {
                            const serviceData = {
                                type: null,
                                quantity: null,
                                description: null,
                                code: null
                            };

                            const typeElement = service.querySelector('div:first-child');
                            const quantityElement = service.querySelector('.flex.align-center div:first-child');
                            const descriptionElement = service.querySelector('.ml-2 div');
                            const codeElement = service.querySelector('.muted');

                            if (typeElement) serviceData.type = typeElement.textContent.trim();
                            if (quantityElement) {
                                const quantityText = quantityElement.textContent.trim();
                                const quantityMatch = quantityText.match(/(\d+)/);
                                serviceData.quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;
                            }
                            if (descriptionElement) {
                                const descText = descriptionElement.textContent.trim();
                                serviceData.description = descText.split(' (')[0];
                            }
                            if (codeElement) {
                                serviceData.code = codeElement.textContent.trim().replace(/[()]/g, '');
                            }

                            // Skip CAL-SERV services
                            if (serviceData.code !== 'CAL-SERV') {
                                result.services.push(serviceData);
                            }
                        } catch (error) {
                            results.errors.push(`Error parsing service: ${error.message}`);
                            result.services.push({ error: 'Failed to parse service' });
                        }
                    });

                    // Get next visit information
                    const nextVisitElement = job.querySelector('a[href^="/app/work/"][title="Next Visit"]');
                    if (nextVisitElement) {
                        const url = nextVisitElement.getAttribute('href');
                        const visitIdMatch = url.match(/\/visits\/(\d+)/);
                        
                        result.visits.nextVisit = {
                            date: null,
                            time: null,
                            url: url,
                            visitId: visitIdMatch ? visitIdMatch[1] : null
                        };

                        const dateElement = nextVisitElement.querySelector('div:nth-child(2)');
                        const timeElement = nextVisitElement.querySelector('div:nth-child(3)');

                        if (dateElement) result.visits.nextVisit.date = dateElement.textContent.trim();
                        if (timeElement) result.visits.nextVisit.time = timeElement.textContent.trim().replace(/[()]/g, '');
                    }

                    // Get instructions
                    const instructionsElement = job.querySelector('.pre-wrap');
                    if (instructionsElement) {
                        result.instructions = instructionsElement.textContent.trim();
                    }

                } catch (error) {
                    results.errors.push(`Error processing job: ${error.message}`);
                    result.error = error.message;
                }

                return result;
            });
            
            return { 
                jobs: results.jobs, 
                jobCount,
                logs: results.logs,
                errors: results.errors
            };
        });
        
        // Log the messages that were collected in the browser context
        if (initialJobs.logs && initialJobs.logs.length > 0) {
            initialJobs.logs.forEach(msg => logger.log(msg));
        }
        
        if (initialJobs.errors && initialJobs.errors.length > 0) {
            initialJobs.errors.forEach(err => logger.warn('Browser Error', err));
        }
        
        logger.info('Data Status', `Found ${initialJobs.jobCount} job elements`);
        
        // Apply store number extraction to all jobs
        logger.info('Data Processing', 'Extracting store numbers from HTML data...');
        if (progressCallback) progressCallback(80, 'Identifying store locations and IDs...');

        let storeNumbersFound = 0;
        let storeNumbersFailed = 0;
        
        // Create new array with updated jobs
        const updatedJobs = initialJobs.jobs.map(job => {
            if (!job.rawHtml) {
                logger.warn('Data Issue', `Job ${job.id || 'unknown'}: No HTML data available`);
                return job;
            }
            
            // Extract store number
            const storeNumber = extractStoreNumber(job.rawHtml);
            
            // Extract location ID for store URL
            const locationId = extractLocationId(job.rawHtml);
            let storeUrl = null;
            
            if (locationId) {
                storeUrl = `https://app.workfossa.com/app/customers/locations/${locationId}/`;
                logger.log(`Job ${job.id || 'unknown'}: Created store URL with location ID: ${locationId}`);
            }
            
            if (storeNumber) {
                logger.log(`Job ${job.id || 'unknown'}: Extracted store number: ${storeNumber}`);
                storeNumbersFound++;
                
                return {
                    ...job,
                    customer: {
                        ...job.customer,
                        storeNumber: storeNumber,
                        storeUrl: storeUrl
                    }
                };
            } else {
                logger.warn('Data Issue', `Job ${job.id || 'unknown'}: Failed to extract store number`);
                storeNumbersFailed++;
                return {
                    ...job,
                    customer: {
                        ...job.customer,
                        storeUrl: storeUrl
                    }
                };
            }
        });
        
        logger.info('Data Status', `Store number extraction results: ${storeNumbersFound} found, ${storeNumbersFailed} failed`);
        if (progressCallback) progressCallback(85, `Identified ${storeNumbersFound} store locations`);

        // Verify we got all matches
        if (totalMatches !== null && updatedJobs.length !== totalMatches) {
            logger.warn('Data Mismatch', `Expected ${totalMatches} jobs but found ${updatedJobs.length}`);
        }

        if (progressCallback) progressCallback(90, `Organizing data for ${updatedJobs.length} service appointments...`);

        // Save scraped data to JSON file
        const outputPath = path.join(__dirname, '..', '..', 'data', 'scraped_content.json');
        
        // Check if we have an existing scraped_content.json file with dispenser data
        let existingWorkOrders = {};
        try {
            if (fs.existsSync(outputPath)) {
                const existingData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
                if (existingData.workOrders && Array.isArray(existingData.workOrders)) {
                    // Create a map of existing work orders by ID for quick lookup
                    existingData.workOrders.forEach(workOrder => {
                        if (workOrder.id && workOrder.dispensers) {
                            existingWorkOrders[workOrder.id] = workOrder.dispensers;
                        }
                    });
                    logger.info('Data Status', `Found ${Object.keys(existingWorkOrders).length} existing work orders with dispenser data`);
                }
            }
        } catch (error) {
            logger.error('File Error', error);
        }
        
        // Enhanced dispenser data preservation with better logging
        const preservedJobs = updatedJobs.map(job => {
            // If this job has an ID and we have dispenser data for it, preserve the dispenser data
            if (job.id && existingWorkOrders[job.id]) {
                const dispenserData = existingWorkOrders[job.id];
                logger.info('Dispenser Data', `Preserving dispenser data for job ${job.id}: ${dispenserData.length} dispensers`);
                // Log sample of first dispenser when available
                if (dispenserData.length > 0 && dispenserData[0].title) {
                    logger.info('Dispenser Data', `Sample: ${dispenserData[0].title} (${dispenserData[0].make || 'Unknown Make'})`);
                }
                return {
                    ...job,
                    dispensers: dispenserData
                };
            }
            return job;
        });
        
        // Ensure we have detailed logging about preserved dispenser data
        const jobsWithDispensers = preservedJobs.filter(job => job.dispensers && job.dispensers.length > 0);
        logger.success('Dispenser Data', `Successfully preserved dispenser data for ${jobsWithDispensers.length} of ${preservedJobs.length} jobs`);
        
        // Ensure we use the current date by creating a new Date object
        const now = new Date();
        const timestamp = now.toISOString();
        logger.info('File Status', `Saving data with current timestamp: ${timestamp}`);
        const outputData = {
            workOrders: preservedJobs,
            metadata: {
                timestamp: timestamp,
                totalJobs: preservedJobs.length,
                storeNumbersFound,
                storeNumbersFailed
            }
        };
        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
        logger.success('Data Saved', `Successfully saved ${preservedJobs.length} jobs to ${outputPath}`);
        logger.info('Metadata', outputData.metadata);
        
        // Sync with the dispenser store
        try {
            logger.info('Dispenser Store', 'Syncing with dispenser data store...');
            const dispenserService = await getDispenserService();
            if (dispenserService && dispenserService.syncDispenserStore) {
                const syncResult = dispenserService.syncDispenserStore();
                logger.info('Dispenser Store', `Sync result: ${syncResult ? 'success' : 'no changes needed'}`);
            } else {
                logger.warn('Dispenser Store', 'Dispenser service not available for sync');
            }
        } catch (syncError) {
            logger.error('Dispenser Store Error', syncError);
        }
        
        // Enhance the scraped logs with additional metadata and formatting
        logger.info('Enhancement', 'Enhancing scrape logs with additional metadata...');
        try {
            enhanceScrapeLogs();
            logger.success('Enhancement', 'Scrape logs enhancement complete');
        } catch (error) {
            logger.error('Enhancement Error', error);
        }
        
        if (progressCallback) progressCallback(95, `Saved information for ${preservedJobs.length} service appointments`);
        
        // Clean up and exit
        await browser.close();
        logger.success('Automation', 'Automation completed successfully');
        if (progressCallback) progressCallback(100, 'Service appointment data update complete!');
        
        return { success: true, count: preservedJobs.length, storeNumbersFound };
    } catch (error) {
        logger.error('Automation Error', error);
        if (progressCallback) progressCallback(0, `Unable to complete data collection: ${error.message}`);
        
        if (browser) {
            await browser.close().catch(e => logger.error('Browser Close Error', e));
        }
        throw error;
    }
}

// Run the automation if this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    logger.info('Execution', 'Running automation directly from command line');
    runAutomation().catch(error => {
        logger.error('Unhandled Error', error);
        process.exit(1);
    });
}

export { runAutomation }; 