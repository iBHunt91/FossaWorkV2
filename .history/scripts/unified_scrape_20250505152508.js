import { loginToFossa } from './utils/login.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { updateMainFiles, getLatestScrapeFile, getPreviousScrapeFile } from './utils/dataManager.js';
import { getActiveUser, getUserCredentials } from '../server/utils/userManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');

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
        console.log('Network idle timeout reached');
    }
}

/**
 * Run a scrape operation
 * @param {Object} options - Options for the scrape
 * @param {boolean} options.isManual - Whether this is a manual scrape
 * @param {Function} options.progressCallback - Callback for progress updates
 * @param {Object} options.manualOptions - Options for manual scrape (if applicable)
 * @param {string} options.userId - User ID to scrape for (overrides active user)
 * @returns {Object} The result of the scrape operation
 */
async function runScrape(options = {}) {
    const { 
        isManual = false, 
        progressCallback = null, 
        manualOptions = {},
        userId = null
    } = options;
    
    let browser;
    try {
        console.log(`Starting ${isManual ? 'manual' : 'automated'} scrape...`);
        if (progressCallback) progressCallback(10, 'Logging in to Fossa...');
        
        // Get user credentials - either from userId parameter or active user
        let activeUserId = userId;
        if (!activeUserId) {
            activeUserId = getActiveUser();
        }
        
        let loginOptions = {};
        
        if (activeUserId) {
            const credentials = getUserCredentials(activeUserId);
            if (credentials) {
                loginOptions = {
                    email: credentials.email,
                    password: credentials.password
                };
                console.log(`Using credentials for user: ${credentials.email} (${activeUserId})`);
            } else {
                console.log(`No credentials found for user ID: ${activeUserId}, falling back to .env`);
            }
        } else {
            console.log('No user ID provided and no active user set, falling back to .env');
        }
        
        // Login to Fossa
        const result = await loginToFossa({ ...loginOptions });
        browser = result.browser;
        const { page } = result;
        console.log('Successfully logged in to Fossa');
        if (progressCallback) progressCallback(30, 'Logged in, navigating to work list...');
        
        // Navigate to work list page
        const targetUrl = 'https://app.workfossa.com/app/work/list?visit_scheduled=scheduled%7C%7C%7C%7CWith%20Scheduled%20Visits&work_visit_completion=none%7C%7CNo%20visits%20completed%7C%7CWork%20Visits%20Completed&order_direction=asc';
        console.log('Navigating to:', targetUrl);
        
        // Wait for navigation and network requests to complete
        await Promise.all([
            page.goto(targetUrl),
            page.waitForLoadState('networkidle')
        ]);
        
        // Wait for the page to be fully loaded
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('.work-list-item');
        await waitForNetworkIdle(page);
        
        console.log('Initial page load complete');
        if (progressCallback) progressCallback(40, 'Changing page size to view more work orders...');
        
        // Change page size to 100
        console.log('Changing page size to 100...');
        
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
        console.log('Clicked dropdown');
        
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
        
        console.log('Selected Show 100');
        
        // Wait for the loading indicator and page update
        console.log('Waiting for page to update...');
        try {
            // Wait for loader to appear
            await page.waitForSelector('.loader-line', { state: 'visible', timeout: 5000 });
            console.log('Loading indicator appeared');
            
            // Wait for loader to disappear
            await page.waitForSelector('.loader-line', { state: 'hidden', timeout: 30000 });
            console.log('Loading indicator disappeared');
        } catch (error) {
            console.log('Note: Loading indicator not seen');
        }
        
        // Wait for network requests to complete and page to settle
        await waitForNetworkIdle(page);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
        
        // Get all jobs from the page
        console.log('Extracting jobs...');
        if (progressCallback) progressCallback(60, 'Extracting work order data...');
        
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.work-list-item');
            console.log(`Found ${jobElements.length} job elements`);
            
            return Array.from(jobElements).map(job => {
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
                    rawHtml: job.outerHTML
                };

                try {
                    // Get work order ID
                    const workOrderLink = job.querySelector('a[href^="/app/work/"]');
                    if (workOrderLink) {
                        result.id = workOrderLink.textContent.trim();
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

                            result.services.push(serviceData);
                        } catch (error) {
                            console.log('Error parsing service:', error);
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
                    console.log('Error processing job:', error);
                }

                return result;
            });
        });

        // Apply store number extraction to all jobs
        console.log('Extracting store numbers from HTML data...');
        if (progressCallback) progressCallback(80, 'Extracting store numbers...');
        
        let storeNumbersFound = 0;
        let storeNumbersFailed = 0;
        
        // Create new array with updated jobs
        const updatedJobs = jobs.map(job => {
            if (!job.rawHtml) {
                console.log(`Job ${job.id || 'unknown'}: No HTML data available`);
                return job;
            }
            
            // Extract store number
            const storeNumber = extractStoreNumber(job.rawHtml);
            
            // Extract location ID for store URL
            const locationId = extractLocationId(job.rawHtml);
            let storeUrl = null;
            
            if (locationId) {
                storeUrl = `https://app.workfossa.com/app/customers/locations/${locationId}/`;
                console.log(`Job ${job.id || 'unknown'}: Created store URL with location ID: ${locationId}`);
            }
            
            if (storeNumber) {
                console.log(`Job ${job.id || 'unknown'}: Extracted store number: ${storeNumber}`);
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
                console.log(`Job ${job.id || 'unknown'}: Failed to extract store number`);
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
        
        console.log(`Store number extraction results: ${storeNumbersFound} found, ${storeNumbersFailed} failed`);

        // Handle manual scrape modifications if needed
        let finalJobs = updatedJobs;
        if (isManual && manualOptions.modifications) {
            console.log('Applying manual modifications...');
            
            // Handle job removals
            if (manualOptions.modifications.removeJobs) {
                const jobIdsToRemove = manualOptions.modifications.removeJobs;
                finalJobs = finalJobs.filter(job => !jobIdsToRemove.includes(job.id));
                console.log(`Manually removed ${jobIdsToRemove.length} jobs`);
            }
            
            // Handle job additions
            if (manualOptions.modifications.addJobs) {
                finalJobs = [...finalJobs, ...manualOptions.modifications.addJobs];
                console.log(`Manually added ${manualOptions.modifications.addJobs.length} jobs`);
            }
        }

        // Process the jobs and update main files
        const data = {
            workOrders: finalJobs,
            metadata: {
                extractedAt: new Date().toISOString(),
                count: finalJobs.length,
                userId: activeUserId
            }
        };

        // Update the main data files
        updateMainFiles(data, activeUserId);

        // After successful scrape, save the data
        console.log('Scrape completed successfully');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let outputPath;
        
        // Save archive copy to user-specific location if active user exists
        if (activeUserId) {
            const userDir = path.join(dataDir, 'users', activeUserId);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
                console.log(`Created user directory: ${userDir}`);
            }
            
            const archiveDir = path.join(userDir, 'archive');
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
                console.log(`Created user archive directory: ${archiveDir}`);
            }
            
            const outputFilename = `scraped_content_${timestamp}.json`;
            outputPath = path.join(archiveDir, outputFilename);
            fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
            console.log(`Saved user-specific archived data to ${outputPath}`);
            
            // Run schedule analysis after successful scrape
            try {
                console.log('Analyzing schedule changes...');
                // Import and use the correct analyzeScheduleChanges function
                const { analyzeScheduleChanges } = await import('./utils/analyzeScheduleChanges.js');
                
                // Load current and previous schedules for analysis
                const currentSchedule = data;
                const previousFilePath = path.join(userDir, 'scraped_content.previous.json');
                
                if (fs.existsSync(previousFilePath)) {
                    const previousSchedule = JSON.parse(fs.readFileSync(previousFilePath, 'utf8'));
                    
                    // Run the analysis
                    const changes = analyzeScheduleChanges(currentSchedule, previousSchedule, activeUserId);
                    
                    // Log the changes summary
                    if (changes && changes.summary) {
                        console.log('Schedule change analysis results:');
                        console.log(`- Added jobs: ${changes.summary.added}`);
                        console.log(`- Removed jobs: ${changes.summary.removed}`);
                        console.log(`- Modified jobs: ${changes.summary.modified}`);
                        console.log(`- Swapped jobs: ${changes.summary.swapped}`);
                    } else {
                        console.log('No significant changes detected or analysis failed');
                    }
                } else {
                    console.log('No previous schedule file found for comparison');
                }
            } catch (error) {
                console.error('Error analyzing schedule changes:', error);
                // Don't fail the scrape if analysis fails
            }
        } else {
            // If no active user, save to the root data directory
            const outputFilename = `scraped_content_${timestamp}.json`;
            outputPath = path.join(dataDir, outputFilename);
            fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
            console.log(`Saved scraped data to ${outputFilename}`);
        }
        
        if (progressCallback) progressCallback(100, 'Scrape completed successfully');
        return { success: true, path: outputPath, count: finalJobs.length };
    } catch (error) {
        console.error('Error running scrape:', error);
        if (progressCallback) progressCallback(-1, `Error: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            await browser.close();
            console.log('Browser closed');
        }
    }
}

// Function to manually compare the current and previous files
function compareCurrentAndPrevious() {
    try {
        const file1 = getLatestScrapeFile();
        const file2 = getPreviousScrapeFile();
        
        console.log(`Comparing files directly:\n${file1}\n${file2}`);
        
        // Load the files
        const data1 = JSON.parse(fs.readFileSync(file1, 'utf8'));
        const data2 = JSON.parse(fs.readFileSync(file2, 'utf8'));
        
        console.log(`\nFile 1 job count: ${data1.workOrders.length}`);
        console.log(`File 2 job count: ${data2.workOrders.length}`);
        
        // Create maps for easy lookup
        const jobs1 = new Map(data1.workOrders.map(job => [job.id, job]));
        const jobs2 = new Map(data2.workOrders.map(job => [job.id, job]));
        
        // Check for jobs in file 2 that aren't in file 1 (removed jobs)
        const removedJobs = [];
        for (const [jobId, job] of jobs2) {
            if (!jobs1.has(jobId)) {
                removedJobs.push(job);
            }
        }
        
        // Check for jobs in file 1 that aren't in file 2 (added jobs)
        const addedJobs = [];
        for (const [jobId, job] of jobs1) {
            if (!jobs2.has(jobId)) {
                addedJobs.push(job);
            }
        }
        
        // Output results
        console.log(`\nJobs removed (in file 2 but not in file 1): ${removedJobs.length}`);
        if (removedJobs.length > 0) {
            console.log('Removed jobs:');
            removedJobs.forEach(job => {
                console.log(`- ${job.id}: ${job.customer?.name || 'Unknown'}`);
            });
        }
        
        console.log(`\nJobs added (in file 1 but not in file 2): ${addedJobs.length}`);
        if (addedJobs.length > 0) {
            console.log('Added jobs:');
            addedJobs.forEach(job => {
                console.log(`- ${job.id}: ${job.customer?.name || 'Unknown'}`);
            });
        }
        
        return {
            success: true,
            comparison: {
                added: addedJobs,
                removed: removedJobs
            }
        };
    } catch (error) {
        console.error('Error comparing files:', error);
        return { success: false, error: error.message };
    }
}

// Command line handling
async function main() {
    try {
        console.log('Starting unified_scrape.js...');
        const args = process.argv.slice(2);
        const command = args[0];
        console.log(`Command: ${command || 'none'}`);
        
        switch (command) {
            case 'scrape':
                // Regular automated scrape
                console.log('Starting automated scrape...');
                await runScrape({ isManual: false });
                break;
                
            case 'manual':
                // Manual scrape with optional modifications from a JSON file
                console.log('Starting manual scrape...');
                const modFile = args[1];
                let modifications = {};
                
                if (modFile && fs.existsSync(modFile)) {
                    modifications = JSON.parse(fs.readFileSync(modFile, 'utf8'));
                    console.log(`Loaded modifications from ${modFile}`);
                }
                
                await runScrape({ 
                    isManual: true,
                    manualOptions: { modifications }
                });
                break;
                
            case 'compare':
                // Compare current and previous files
                console.log('Starting comparison...');
                compareCurrentAndPrevious();
                break;
                
            default:
                console.log('Usage:');
                console.log('  node unified_scrape.js scrape     - Run automated scrape');
                console.log('  node unified_scrape.js manual     - Run manual scrape');
                console.log('  node unified_scrape.js manual [modifications.json] - Run manual scrape with modifications');
                console.log('  node unified_scrape.js compare    - Compare current and previous data files');
                break;
        }
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Always run the main function
console.log('About to run main function...');
main().catch(error => console.error('Caught in main wrapper:', error));

// Export for use in other modules
export { runScrape, compareCurrentAndPrevious }; 