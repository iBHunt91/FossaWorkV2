import { loginToFossa } from './login.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add debugging at the very start
console.log('==== Dispenser Scraper Starting =====');
console.log('Current directory:', process.cwd());
console.log('Script directory:', __dirname);

// Create a dedicated logger
function logMessage(message, isError = false) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  
  // Log to console
  if (isError) {
    console.error(formattedMessage);
  } else {
    console.log(formattedMessage);
  }
  
  // If we have a log file, write to it
  if (global.logStream) {
    global.logStream.write(formattedMessage + '\n');
  }
}

// Set up logging
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log file
const logFilePath = path.join(logsDir, `dispenser-scrape-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
global.logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
logMessage(`Logging to: ${logFilePath}`);

// Helper to log progress 
function logProgress(message) {
  logMessage(message);
}

// Main scraping function
async function scrapeDispenserInfo(progressCallback = null, forceRescrape = false, storeId = null) {
  let browser;
  let successCount = 0;
  let failureCount = 0;
  let startTime = new Date();
  
  try {
    logProgress('Starting dispenser information scrape');
    if (progressCallback) progressCallback(5, 'Starting login process...');

    // Login to Fossa
    logProgress('Attempting to login to Fossa...');
    let page; // Declare page variable at this scope
    
    try {
      const result = await loginToFossa({ headless: true });
      logProgress('Login result received');
      
      browser = result.browser;
      page = result.page; // Store page correctly
      logProgress('Successfully logged in to Fossa');
      if (progressCallback) progressCallback(15, 'Successfully logged in to Fossa');
    } catch (err) {
      logProgress(`ERROR IN LOGIN: ${err.message}`);
      throw err;
    }

    // Load scraped content
    const scrapedContentPath = path.join(__dirname, '..', '..', 'data', 'scraped_content.json');
    logProgress('Loading scraped content from: ' + scrapedContentPath);
    let scrapedContent;
    
    try {
      logProgress('Attempting to read the file');
      const fileContent = fs.readFileSync(scrapedContentPath, 'utf8');
      logProgress(`File read successfully, content length: ${fileContent.length} bytes`);
      scrapedContent = JSON.parse(fileContent);
      logProgress('JSON parsed successfully');
    } catch (error) {
      logProgress(`Failed to load or parse scraped_content.json: ${error.message}`);
      throw new Error(`Failed to load or parse scraped_content.json: ${error.message}`);
    }

    // Verify we have the required data
    logProgress('Verifying required data');
    if (!scrapedContent.workOrders || scrapedContent.workOrders.length === 0) {
      throw new Error('No work orders found in scraped_content.json');
    }
    
    // Filter to only the target store if specified
    let workOrdersToProcess = scrapedContent.workOrders;
    if (storeId) {
      logProgress(`Filtering for store ID: ${storeId}`);
      workOrdersToProcess = scrapedContent.workOrders.filter(order => order.id === storeId);
      
      if (workOrdersToProcess.length === 0) {
        throw new Error(`Store with ID ${storeId} not found`);
      }
      
      const store = workOrdersToProcess[0];
      logProgress(`Found matching store: ${store.customer ? store.customer.name : 'Unknown'}`);
    }
    
    logProgress(`Found ${workOrdersToProcess.length} work orders to process`);
    
    // Process work orders
    let processedOneWorkOrder = false;
    
    for (let i = 0; i < workOrdersToProcess.length; i++) {
      const workOrder = workOrdersToProcess[i];
      const workOrderId = workOrder.id || `Order ${i+1}`;
      
      logProgress(`[${i+1}/${workOrdersToProcess.length}] Processing work order: ${workOrderId}`);
      
      // Check if this work order already has dispenser data
      if (!forceRescrape && workOrder.dispensers && workOrder.dispensers.length > 0) {
        logProgress(`✓ Skipping ${workOrderId}: Already has dispenser data (${workOrder.dispensers.length} dispensers found)`);
        continue;
      }
      
      // Skip if no customer data or store URL
      if (!workOrder.customer || !workOrder.customer.storeUrl) {
        logProgress(`⚠️ Skipping ${workOrderId}: No store URL found`);
        failureCount++;
        continue;
      }

      // If forceRescrape is true, log that we're forcing a rescrape
      if (forceRescrape && workOrder.dispensers && workOrder.dispensers.length > 0) {
        logProgress(`ℹ️ Force rescraping ${workOrderId}: Overwriting existing dispenser data (${workOrder.dispensers.length} dispensers)`);
      }
      
      const storeUrl = workOrder.customer.storeUrl;
      const storeName = workOrder.customer.name || 'unknown';
      const storeNumber = workOrder.customer.storeNumber || 'unknown';
      logProgress(`🔍 Processing ${workOrderId} - ${storeName} ${storeNumber} - Navigating to store URL: ${storeUrl}`);

      try {
        // Navigate to the store URL with longer timeout
        logProgress(`  → Navigating to ${storeUrl}`);
        await page.goto(storeUrl, { timeout: 120000 });
        await page.waitForLoadState('networkidle', { timeout: 60000 });
        await page.waitForTimeout(5000);
        logProgress(`  ✓ Page loaded for ${workOrderId}, waiting for content to be visible`);
        
        // Try to find the Equipment tab and click it if necessary
        try {
          logProgress(`  → Looking for Equipment tab for ${workOrderId}...`);
          // Target the specific Equipment tab in the top navigation
          const equipmentTabSelector = 'a[href="#equipment"], a.equipment-tab, li.equipment-tab a, a:has-text("Equipment")';
          
          // Check if we're already on the equipment tab
          const isEquipmentTabActive = await page.evaluate(() => {
            const activeTab = document.querySelector('.active[href="#equipment"], a.equipment-tab.active, li.equipment-tab.active');
            return !!activeTab;
          });
          
          if (!isEquipmentTabActive) {
            logProgress('  → Equipment tab not active, clicking it');
            const equipmentTab = await page.$(equipmentTabSelector);
            
            if (equipmentTab) {
              logProgress('  → Found Equipment tab, clicking it');
              await equipmentTab.click();
              await page.waitForTimeout(5000);
              logProgress('  ✓ Equipment tab clicked');
            } else {
              logProgress('  ⚠️ Equipment tab not found using selector');
              
              // Try using tab text matching as a fallback
              const tabs = await page.$$('a, .tab, li a');
              let foundTab = false;
              for (const tab of tabs) {
                const tabText = await tab.textContent();
                if (tabText && tabText.trim().toLowerCase() === 'equipment') {
                  logProgress('  → Found Equipment tab by text content, clicking it');
                  await tab.click();
                  await page.waitForTimeout(5000);
                  logProgress('  ✓ Equipment tab clicked by text content');
                  foundTab = true;
                  break;
                }
              }
              if (!foundTab) {
                logProgress('  ❌ Could not find Equipment tab by any method');
              }
            }
          } else {
            logProgress('  ✓ Already on Equipment tab');
          }
        } catch (error) {
          logProgress(`  ❌ Error handling equipment tab for ${workOrderId}: ${error.message}`);
        }

        // Now specifically look for the dispenser collapsible section
        logProgress(`  → Looking for dispenser collapsible section for ${workOrderId}...`);
        try {
          // Wait a moment for the equipment section to fully load
          await page.waitForTimeout(5000);
          
          // Use the working selector to find and click the dispenser element
          logProgress('  → Looking for dispenser with title="Show equipment" selector');
          const dispenserElement = page.locator('a[title="Show equipment"]').filter({ hasText: 'Dispenser' }).first();
          
          // Check if the element exists
          const dispenserCount = await dispenserElement.count();
          
          if (dispenserCount > 0) {
            logProgress('  → Found dispenser element, clicking it');
            await dispenserElement.click();
            logProgress('  ✓ Dispenser element clicked');
            await page.waitForTimeout(5000);
          } else {
            logProgress('  ⚠️ Dispenser element not found with primary selector, trying fallback');
            
            // Fallback to simpler text-based selector
            const dispenserText = page.getByText('Dispenser', { exact: false }).first();
            const textCount = await dispenserText.count();
            
            if (textCount > 0) {
              logProgress('  → Found dispenser with text selector, clicking it');
              await dispenserText.click();
              logProgress('  ✓ Dispenser clicked with text selector');
              await page.waitForTimeout(5000);
            } else {
              // Final approach - save the page HTML for debugging
              const pageHtml = await page.content();
              const logsDir = path.join(__dirname, '../logs');
              fs.writeFileSync(path.join(logsDir, `equipment-page-${workOrderId.replace(/[^a-z0-9]/gi, '-')}.html`), pageHtml);
              logProgress(`  → Saved equipment page HTML for debugging for ${workOrderId}`);
              
              logProgress(`  ❌ Could not find dispenser element for ${workOrderId} with any selector - skipping`);
              failureCount++;
              continue;
            }
          }
        } catch (error) {
          logProgress(`  ❌ Error clicking dispenser collapsible for ${workOrderId}: ${error.message}`);
          failureCount++;
          continue;
        }

        // Wait for the dispenser details to load
        logProgress(`  → Waiting for dispenser details to load for ${workOrderId}...`);
        await page.waitForTimeout(10000);
        
        // Get the HTML content containing the dispenser details
        logProgress(`  → Extracting HTML content for ${workOrderId}`);
        const dispenserHtml = await page.evaluate(() => {
          // First, look for the expanded dispenser section
          const dispenserSection = document.querySelector('.group-heading a[title="Hide equipment"] span.bold');
          
          if (dispenserSection && dispenserSection.textContent.includes('Dispenser')) {
            // If we found the expanded dispenser section, get its parent container
            // and then get all of its siblings until the next section heading
            const groupHeading = dispenserSection.closest('.group-heading');
            const equipmentList = groupHeading.parentElement;
            
            // This should contain all the dispenser details
            return equipmentList.outerHTML;
          }
          
          // Fallback to check if we're looking at a different view of the dispensers
          const dispenserList = document.querySelector('.mt-4 div:has(div.py-1.5)');
          if (dispenserList) {
            return dispenserList.outerHTML;
          }
          
          // Final fallback - get the entire equipment tab content
          const equipmentTab = document.querySelector('.active-tab[dusk="equipment-tab"]');
          if (equipmentTab) {
            return equipmentTab.outerHTML;
          }
          
          // Ultimate fallback - just return the body
          return document.body.innerHTML;
        });
        
        if (!dispenserHtml) {
          logProgress(`  ❌ Failed to extract dispenser HTML content for ${workOrderId}`);
          failureCount++;
          continue;
        }
        
        logProgress(`  ✓ Dispenser HTML extracted for ${workOrderId}, length: ${dispenserHtml.length}`);
        
        // Save the HTML content to a debug file
        const logsDir = path.join(__dirname, '../logs');
        const htmlFilePath = path.join(logsDir, `dispenser-details-${workOrderId.replace(/[^a-z0-9]/gi, '-')}.html`);
        fs.writeFileSync(htmlFilePath, dispenserHtml);
        logProgress(`  ✓ Dispenser HTML saved to ${htmlFilePath}`);
        
        // Process the HTML to extract structured dispenser data
        logProgress(`  → Extracting structured dispenser data for ${workOrderId}`);
        const dispensers = await page.evaluate(() => {
          // Find all dispenser items - each is contained in a div.py-1.5 element
          const dispenserItems = [];
          
          // Note: CSS classes with dots need to be escaped properly in selectors
          // The class is actually "py-1.5" with a dot, so we use multiple selectors
          const dispenserElems = document.querySelectorAll('div[class*="py-1"]');
          
          if (dispenserElems.length === 0) {
            return [];
          }
          
          dispenserElems.forEach(dispenser => {
            // Check if this is a dispenser element by looking for specific content
            const titleEl = dispenser.querySelector('.flex.align-start > div');
            if (!titleEl) return; // Skip if no title element

            // Make detection more flexible - check for common dispenser-related terms
            const titleText = titleEl.textContent.trim().toLowerCase();
            if (!titleText.includes('regular') && 
                !titleText.includes('dispenser') && 
                !titleText.includes('premium') && 
                !titleText.includes('diesel') && 
                !titleText.includes('super') && 
                !titleText.includes('plus')) {
              return; // Skip this element
            }
            
            // Extract basic info
            const title = titleEl.textContent.trim().split('\n')[0];
            
            // Extract serial number
            const serialElem = dispenser.querySelector('.muted.text-tiny');
            const serial = serialElem ? serialElem.textContent.trim().replace('S/N:', '').trim() : '';
            
            // Extract make and model
            const makeElem = dispenser.querySelector('.text-tiny div:nth-child(1)');
            const make = makeElem ? makeElem.textContent.replace('MAKE:', '').trim() : '';
            
            const modelElem = dispenser.querySelector('.text-tiny div:nth-child(2)');
            const model = modelElem ? modelElem.textContent.replace('MODEL:', '').trim() : '';
            
            // Extract custom fields
            const fields = {};
            const customFields = dispenser.querySelectorAll('.custom-fields-view .mt-2');
            
            customFields.forEach(field => {
              const label = field.querySelector('.muted.uppercase.text-xs');
              const value = field.querySelector('.text-xs.mt-1');
              
              if (label && value) {
                fields[label.textContent.trim()] = value.textContent.trim();
              }
            });
            
            dispenserItems.push({
              title,
              serial,
              make,
              model,
              fields
            });
          });
          
          return dispenserItems;
        });
        
        // Add the structured dispenser data to the work order
        workOrder.dispensers = dispensers;
        workOrder.dispenserHtml = dispenserHtml;
        logProgress(`  ✅ SUCCESS: Dispenser information saved for ${workOrderId} - Found ${dispensers.length} dispensers`);
        successCount++;
        
        // Save progress after processing this work order
        logProgress(`Saving progress after processing work order ${workOrderId}...`);
        fs.writeFileSync(scrapedContentPath, JSON.stringify(scrapedContent, null, 2));
        logProgress(`Progress saved successfully`);
        
        // Mark that we processed at least one work order
        processedOneWorkOrder = true;
        
        // Continue to next work order instead of breaking
        // No break statement here - continue processing all work orders
        
      } catch (error) {
        logProgress(`❌ Error processing ${workOrderId}: ${error.message}`);
        if (error.stack) {
          logProgress(`Error stack: ${error.stack}`);
        }
        failureCount++;
        // Continue to the next work order
        continue;
      }
    }
    
    // Close the browser
    if (browser) {
      logProgress('Closing browser...');
      await browser.close();
    }
    
    if (!processedOneWorkOrder) {
      logProgress('No work orders were processed - all already have dispenser data');
    }
    
    // Log completion
    const totalTime = Math.round((new Date() - startTime) / 1000);
    logProgress(`
========== SCRAPING COMPLETE ==========
Successful: ${successCount}
Failed: ${failureCount}
Total time: ${totalTime} seconds
========================================
`);
    
    return true;
  } catch (error) {
    logMessage(`Error during scraping: ${error.message}`, true);
    if (error.stack) {
      logMessage(`Error stack: ${error.stack}`, true);
    }
    
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        logMessage(`Error closing browser: ${err.message}`, true);
      }
    }
    
    throw error;
  }
}

// MAIN SCRIPT EXECUTION
console.log('\n==== STARTING DISPENSER SCRAPE ====\n');

// Check for command line arguments
const args = process.argv.slice(2);
const forceRescrape = args.includes('--force') || args.includes('-f');
const storeIdIndex = args.indexOf('--storeId');
const storeId = storeIdIndex !== -1 ? args[storeIdIndex + 1] : null;

if (forceRescrape) {
  console.log('Force rescrape mode enabled - will rescrape all work orders regardless of existing data');
}

if (storeId) {
  console.log(`Target store ID specified: ${storeId}`);
}

// Run the function and handle errors
scrapeDispenserInfo(null, forceRescrape, storeId)
  .then(() => {
    console.log('\n==== DISPENSER SCRAPE COMPLETED SUCCESSFULLY ====\n');
    if (global.logStream) {
      global.logStream.end();
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('\n==== DISPENSER SCRAPE FAILED ====\n');
    console.error('Error:', error.message);
    if (global.logStream) {
      global.logStream.end();
    }
    process.exit(1);
  }); 