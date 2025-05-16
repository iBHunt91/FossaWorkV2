import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginToFossa } from '../utils/login.js';
import { waitForNetworkIdle } from '../utils/puppeteer-utils.js';
import { getActiveUser, getUserCredentials, resolveUserFilePath } from '../../server/utils/userManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Scrapes completed jobs from WorkFossa
 * @param {Object} options - Configuration options
 * @param {boolean} options.isManual - Whether this is a manual scrape
 * @param {string} options.userId - The user ID to scrape for
 * @param {Function} options.progressCallback - Callback for reporting progress
 * @returns {Promise<{success: boolean, error: string|null, completedJobs: Array}>}
 */
export async function scrapeCompletedJobs(options = {}) {
    const {
        isManual = false,
        userId = null,
        progressCallback = null
    } = options;
    
    let browser;
    const completedJobIds = [];
    
    try {
        console.log(`Starting ${isManual ? 'manual' : 'automated'} completed jobs scrape...`);
        if (progressCallback) progressCallback(5, 'Preparing to collect completed jobs data...');
        
        // Get user credentials - either from userId parameter or active user
        let activeUserId = userId;
        if (!activeUserId) {
            activeUserId = getActiveUser();
        }
        
        // Check if we need to perform cleanup from previous run
        if (activeUserId) {
            try {
                const completedJobsFilePath = resolveUserFilePath('completed_jobs.json', activeUserId);
                
                if (fs.existsSync(completedJobsFilePath)) {
                    const completedJobsData = JSON.parse(fs.readFileSync(completedJobsFilePath, 'utf8'));
                    
                    // If scheduled for cleanup, perform it now
                    if (completedJobsData.metadata && completedJobsData.metadata.scheduledForCleanup) {
                        console.log(`Performing scheduled cleanup of ${completedJobsData.metadata.jobCount || 0} completed jobs`);
                        
                        // Create a fresh data structure
                        const cleanedData = {
                            completedJobs: [],
                            metadata: {
                                timestamp: new Date().toISOString(),
                                user: activeUserId,
                                lastCleanupTimestamp: new Date().toISOString(),
                                previousJobCount: completedJobsData.metadata.jobCount || 0
                            }
                        };
                        
                        fs.writeFileSync(completedJobsFilePath, JSON.stringify(cleanedData, null, 2));
                        console.log(`Completed jobs cleaned up for user ${activeUserId}`);
                    }
                }
            } catch (cleanupError) {
                console.error(`Error during completed jobs cleanup: ${cleanupError.message}`);
                // Continue with scrape even if cleanup fails
            }
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
        if (progressCallback) progressCallback(30, 'Logged in, navigating to completed work list...');
        
        // Navigate to completed work list page
        const targetUrl = 'https://app.workfossa.com/app/work/list?work_visit_completion=all%7C%7CAll%20visits%20completed%7C%7CWork%20Visits%20Completed';
        console.log('Navigating to:', targetUrl);
        
        // Wait for navigation and network requests to complete
        await Promise.all([
            page.goto(targetUrl),
            page.waitForLoadState('networkidle')
        ]);
        
        // Wait for the page to be fully loaded
        await page.waitForLoadState('domcontentloaded');
        
        // Wait for jobs list to load if it exists
        try {
            await page.waitForSelector('.work-list-item', { timeout: 5000 });
            await page.waitForLoadState('networkidle');
        } catch (error) {
            console.log('No completed jobs found or page structure different than expected');
            if (progressCallback) progressCallback(100, 'No completed jobs found');
            
            // Close browser
            if (browser) {
                await browser.close();
            }
            
            return {
                success: true,
                error: null,
                completedJobs: []
            };
        }
        
        if (progressCallback) progressCallback(60, 'Extracting completed jobs data...');
        
        // Extract job IDs from the page
        const completedJobsData = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.work-list-item');
            console.log(`Found ${jobElements.length} job elements on the completed jobs page`);
            
            const jobData = Array.from(jobElements).map(job => {
                // Extract work order ID
                const workOrderLink = job.querySelector('a[href^="/app/work/"]');
                let id = null;
                if (workOrderLink) {
                    id = workOrderLink.textContent.trim();
                    console.log(`Found completed job with ID: ${id}`);
                }
                
                // Extract customer name for verification
                const customerNameElement = job.querySelector('.address a');
                let customerName = "Unknown";
                if (customerNameElement) {
                    customerName = customerNameElement.textContent.trim();
                }
                
                return { id, customerName };
            }).filter(item => item.id !== null);
            
            return {
                jobIds: jobData.map(item => item.id),
                count: jobData.length,
                details: jobData // Include full details for debugging
            };
        });
        
        console.log(`Found ${completedJobsData.count} completed jobs`);
        console.log(`Completed job details:`, completedJobsData.details);
        
        // Store completed job IDs
        if (activeUserId) {
            // Use resolveUserFilePath to get user-specific file path
            const completedJobsFilePath = resolveUserFilePath('completed_jobs.json', activeUserId);
            
            // Check if file already exists and read existing data
            let existingData = { completedJobs: [] };
            if (fs.existsSync(completedJobsFilePath)) {
                try {
                    existingData = JSON.parse(fs.readFileSync(completedJobsFilePath, 'utf8'));
                    console.log(`Loaded ${existingData.completedJobs.length} existing completed jobs`);
                } catch (error) {
                    console.error(`Error reading existing completed jobs file: ${error.message}`);
                }
            }
            
            // Merge with new data, avoiding duplicates
            const allJobIds = [...new Set([...existingData.completedJobs, ...completedJobsData.jobIds])];
            
            fs.writeFileSync(completedJobsFilePath, JSON.stringify({
                completedJobs: allJobIds,
                metadata: {
                    timestamp: new Date().toISOString(),
                    user: activeUserId,
                    lastScrapeCount: completedJobsData.count
                }
            }, null, 2));
            
            console.log(`Saved ${allJobIds.length} completed job IDs to ${completedJobsFilePath}`);
        }
        
        if (progressCallback) progressCallback(100, `Found ${completedJobsData.count} completed jobs`);
        
        // Close browser
        if (browser) {
            await browser.close();
        }
        
        return {
            success: true,
            error: null,
            completedJobs: completedJobsData.jobIds
        };
    } catch (error) {
        console.error('Error scraping completed jobs:', error);
        
        if (progressCallback) progressCallback(-1, `Error: ${error.message}`);
        
        // Close browser if it exists
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }
        
        return {
            success: false,
            error: error.message,
            completedJobs: []
        };
    }
}

export default scrapeCompletedJobs; 