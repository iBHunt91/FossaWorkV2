#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { loginToFossa } from './utils/login.js';
import { resolveUserFilePath, getActiveUser } from '../server/utils/userManager.js';

// Find script directory regardless of how the script is run
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Parse command line arguments
const args = process.argv.slice(2);
let targetStoreId = null;
let forceRescrape = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--storeId' && i + 1 < args.length) {
    targetStoreId = args[i + 1];
    console.log(`Target store ID specified: ${targetStoreId}`);
  } else if (args[i] === '--force') {
    forceRescrape = true;
    console.log('Force rescrape enabled - will rescrape even if dispenser data exists');
  }
}

// Main function
async function main() {
  try {
    await scrapeDispenserInfo();
    console.log("SCRAPING COMPLETE");
    process.exit(0);
  } catch (error) {
    console.error("Error in main function:", error);
    process.exit(1);
  }
}

// Execute the main function
main();

// Main dispenser scrape function
async function scrapeDispenserInfo(progressCallback = null) {
  let browser, page;
  try {
    console.log('Starting dispenser information scrape');
    
    // Get active user
    const activeUser = getActiveUser();
    console.log(`Active user: ${activeUser || 'none'}`);
    
    // Load existing work orders from user-specific file
    const dataPath = resolveUserFilePath('scraped_content.json');
    console.log(`Reading data from: ${dataPath}`);
    
    if (!fs.existsSync(dataPath)) {
      console.error(`Data file not found at: ${dataPath}`);
      return;
    }
    
    const scrapedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log(`Loaded data file with ${scrapedData.workOrders.length} work orders`);
    
    // Optional: Filter to only the target store if specified
    const workOrdersToProcess = targetStoreId
      ? scrapedData.workOrders.filter(order => order.id === targetStoreId)
      : scrapedData.workOrders.filter(order => {
          // Check if we should force rescrape all or filter for only those without dispenser data
          return forceRescrape || !order.dispensers || order.dispensers.length === 0;
        });
    
    if (targetStoreId) {
      console.log(`Filtering for store ID: ${targetStoreId}`);
      if (workOrdersToProcess.length === 0) {
        console.error(`Error: Store with ID ${targetStoreId} not found`);
        return;
      }
      console.log(`Found matching store: ${workOrdersToProcess[0].customer.name}`);
    } else {
      console.log(`Found ${workOrdersToProcess.length} work orders ${forceRescrape ? 'to process' : 'without dispenser data'}`);
    }
    
    console.log(`Will process ${workOrdersToProcess.length} work order(s)`);
    
    // Login to Fossa using user-specific credentials
    console.log('Logging in to WorkFossa...');
    // Get user credentials from user management system instead of .env
    const { getUserCredentials } = await import('../server/utils/userManager.js');
    const credentials = getUserCredentials(activeUser);
    
    if (!credentials || !credentials.email || !credentials.password) {
      console.error('No valid credentials found for the active user');
      return;
    }
    
    console.log(`Using credentials for ${credentials.email}`);
    const { browser: loginBrowser, page: loginPage } = await loginToFossa({ 
      headless: true,
      email: credentials.email,
      password: credentials.password
    });
    
    browser = loginBrowser;
    page = loginPage;
    
    // Process each work order
    let processedCount = 0;
    let successCount = 0;
    
    for (let i = 0; i < workOrdersToProcess.length; i++) {
      const workOrder = workOrdersToProcess[i];
      console.log(`[${i+1}/${workOrdersToProcess.length}] Processing work order: ${workOrder.id}`);
      
      // Navigate to the store URL
      if (workOrder.customer && workOrder.customer.storeUrl) {
        console.log(`Navigating to: ${workOrder.customer.storeUrl}`);
        await page.goto(workOrder.customer.storeUrl, { waitUntil: 'networkidle' });
        
        try {
          // Wait for the page to load and scrape dispenser data
          const { dispensers, dispenserHtml } = await scrapeDispenserData(page);
          
          // Update this specific work order with the scraped dispenser data
          if (dispensers && dispensers.length > 0) {
            console.log(`Found ${dispensers.length} dispensers for work order ${workOrder.id}`);
            
            // Update the data file after each successful scrape
            const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            const targetWorkOrder = currentData.workOrders.find(wo => wo.id === workOrder.id);
            if (targetWorkOrder) {
              targetWorkOrder.dispensers = dispensers;
              targetWorkOrder.dispenserHtml = dispenserHtml;
              fs.writeFileSync(dataPath, JSON.stringify(currentData, null, 2));
              console.log(`Updated dispensers for work order ${workOrder.id} in scraped_content.json`);
              processedCount++;
            }
            
            // Add the structured dispenser data to the work order
            workOrder.dispensers = dispensers;
            workOrder.dispenserHtml = dispenserHtml;
            console.log(`SUCCESS: Dispenser information saved for ${workOrder.id} - Found ${dispensers.length} dispensers`);
            successCount++;
            
            // Also update the dispenser store directly as a backup
            await updateDispenserStore(workOrder.id, dispensers);
          } else {
            // Still save the HTML even if no structured dispensers found
            workOrder.dispenserHtml = dispenserHtml;
            const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            const targetWorkOrder = currentData.workOrders.find(wo => wo.id === workOrder.id);
            if (targetWorkOrder) {
              targetWorkOrder.dispenserHtml = dispenserHtml;
              fs.writeFileSync(dataPath, JSON.stringify(currentData, null, 2));
              console.log(`Updated dispenser HTML for work order ${workOrder.id} in scraped_content.json`);
            }
          }
        } catch (error) {
          console.error(`Error processing work order ${workOrder.id}:`, error.message);
          // Continue to the next work order even if this one failed
        }
        
        // Add a small delay to ensure everything is saved
        await page.waitForTimeout(1000);
      } else {
        console.log(`Skipping work order ${workOrder.id} - no valid store URL`);
      }
    }

    console.log(`Successfully processed ${processedCount} out of ${workOrdersToProcess.length} work orders`);
    
    // Close browser when done
    await browser.close();
    console.log('Browser closed');

  } catch (error) {
    console.error('Error during scraping:', error);
    if (browser) await browser.close();
  }
}

const scrapeDispenserData = async (page) => {
  try {
    // First click the Equipment tab
    console.log('Looking for Equipment tab...');
    const equipmentTab = await page.getByText('Equipment').first();
    if (!equipmentTab) {
      throw new Error('Equipment tab not found');
    }
    await equipmentTab.click();
    console.log('Clicked Equipment tab');

    // Wait for the equipment content to load
    console.log('Waiting for equipment content...');
    await page.waitForSelector('[dusk="equipment-tab"]');
    
    // Wait for and click the Dispenser section
    console.log('Looking for Dispenser section...');
    // Wait for the specific dispenser heading structure
    await page.waitForSelector('.group-heading .text-normal .bold', { timeout: 10000 });
    
    // Find and click the dispenser section using a more specific selector
    const dispenserSection = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('.group-heading .text-normal .bold'));
      const dispenserHeading = headings.find(el => el.textContent.includes('Dispenser'));
      if (dispenserHeading) {
        dispenserHeading.closest('a').click();
        return true;
      }
      return false;
    });

    if (!dispenserSection) {
      throw new Error('Dispenser section not found');
    }
    console.log('Clicked Dispenser section');

    // Wait for dispenser content to load
    await page.waitForTimeout(2000); // Give more time for animation and content load

    // Get the HTML content containing the dispenser details
    console.log('Capturing dispenser HTML content...');
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
      console.log('No dispenser HTML content found');
      return { dispensers: [], dispenserHtml: '' };
    }
    
    console.log(`Captured dispenser HTML content, length: ${dispenserHtml.length} characters`);

    // Scrape all dispenser information
    console.log('Scraping dispenser information...');
    const dispensers = await page.evaluate(() => {
      // Find the dispenser section
      const dispenserSection = Array.from(document.querySelectorAll('.mt-4')).find(el => 
        el.querySelector('.bold')?.textContent.trim().startsWith('Dispenser')
      );

      if (!dispenserSection) {
        console.log('No dispenser section found');
        return [];
      }

      // Get all dispenser divs that have actual content
      const dispenserDivs = Array.from(dispenserSection.querySelectorAll('.px-2'))
        .filter(div => {
          // Only include divs that have both a title and fields
          const hasTitle = div.querySelector('.flex.align-start > div')?.textContent.trim();
          const hasFields = div.querySelector('.custom-fields-view');
          return hasTitle && hasFields;
        });

      console.log(`Found ${dispenserDivs.length} valid dispenser entries`);

      return dispenserDivs.map(div => {
        // Get the main title/description text (first text node)
        const titleEl = div.querySelector('.flex.align-start > div');
        const title = titleEl ? titleEl.childNodes[0].textContent.trim() : '';
        
        // Get serial number (S/N: format)
        const serialEl = div.querySelector('.muted.text-tiny');
        const serial = serialEl ? serialEl.textContent.replace('S/N:', '').trim() : '';
        
        // Get make and model from the text-tiny divs
        const makeEl = div.querySelector('.text-tiny div:nth-child(1)');
        const modelEl = div.querySelector('.text-tiny div:nth-child(2)');
        const make = makeEl ? makeEl.textContent.trim() : '';
        const model = modelEl ? modelEl.textContent.trim() : '';

        // Get all fields from the custom-fields-view
        const fields = {};
        const fieldRows = div.querySelectorAll('.custom-fields-view .row > div');
        fieldRows.forEach(row => {
          const label = row.querySelector('.muted.uppercase.text-xs');
          const value = row.querySelector('.text-xs.mt-1');
          if (label && value) {
            fields[label.textContent.trim()] = value.textContent.trim();
          }
        });

        // Only return if we have valid data
        if (title && Object.keys(fields).length > 0) {
          return {
            title,
            serial,
            make,
            model,
            fields
          };
        }
        return null;
      }).filter(Boolean); // Remove any null entries
    });

    console.log(`Found ${dispensers.length} valid dispensers`);
    if (dispensers.length === 0) {
      console.log('No valid dispensers found - this may indicate a scraping issue');
    } else {
      console.log('Dispenser titles found:', dispensers.map(d => d.title).join(', '));
    }

    // Return both the dispensers array and the HTML content
    return { dispensers, dispenserHtml };

  } catch (error) {
    console.error('Error in scrapeDispenserData:', error);
    throw error;
  }
};

// Function to update the dispenser store directly
async function updateDispenserStore(storeId, dispensers) {
  try {
    // Use resolveUserFilePath to get the user-specific path
    const storeFilePath = resolveUserFilePath('dispenser_store.json');
    console.log(`Updating dispenser store at: ${storeFilePath}`);
    let store;

    // Create or load the store
    if (!fs.existsSync(storeFilePath)) {
      store = {
        dispenserData: {},
        metadata: {
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
      };
    } else {
      const fileContent = fs.readFileSync(storeFilePath, 'utf8');
      store = JSON.parse(fileContent);
    }

    // Get visit ID from scraped_content.json
    const scrapedContentPath = resolveUserFilePath('scraped_content.json');
    console.log(`Looking for visit ID in: ${scrapedContentPath}`);
    
    if (fs.existsSync(scrapedContentPath)) {
      try {
        const scrapedContent = JSON.parse(fs.readFileSync(scrapedContentPath, 'utf8'));
        console.log(`Loaded scraped_content.json with ${scrapedContent.workOrders.length} work orders`);
        
        const workOrder = scrapedContent.workOrders.find(wo => wo.id === storeId);
        if (workOrder) {
          console.log(`Found matching work order: ${workOrder.id}`);
          
          if (workOrder.visits && workOrder.visits.nextVisit && workOrder.visits.nextVisit.visitId) {
            const visitId = workOrder.visits.nextVisit.visitId;
            const formattedVisitId = `VISIT-${visitId}`;
            console.log(`Found visit ID: ${visitId}, formatting as: ${formattedVisitId}`);
            
            // Update the store with the new dispensers and visit ID
            store.dispenserData[storeId] = {
              visitId: formattedVisitId,
              dispensers,
              lastUpdated: new Date().toISOString()
            };
            
            // Update metadata
            store.metadata.lastUpdated = new Date().toISOString();
            store.metadata.totalStores = Object.keys(store.dispenserData).length;
            
            // Save the updated store
            fs.writeFileSync(storeFilePath, JSON.stringify(store, null, 2));
            console.log(`Updated dispenser store with data for ${storeId} (Visit ID: ${formattedVisitId})`);
            return true;
          } else {
            console.warn(`No visits or nextVisit data found for work order ${storeId}`);
            console.log('Visits data:', JSON.stringify(workOrder.visits || {}));
          }
        } else {
          console.warn(`Work order with ID ${storeId} not found in scraped_content.json`);
        }
      } catch (parseError) {
        console.error(`Error parsing scraped_content.json: ${parseError.message}`);
      }
    } else {
      console.warn(`Scraped content file not found: ${scrapedContentPath}`);
    }
    
    // If we reached here, we didn't find a valid visit ID or there was an error
    // Store the data without a visit ID
    console.warn(`Storing dispensers for ${storeId} without a visit ID`);
    store.dispenserData[storeId] = {
      dispensers,
      lastUpdated: new Date().toISOString()
    };
    
    // Update metadata
    store.metadata.lastUpdated = new Date().toISOString();
    store.metadata.totalStores = Object.keys(store.dispenserData).length;
    
    // Save the updated store
    fs.writeFileSync(storeFilePath, JSON.stringify(store, null, 2));
    console.log(`Updated dispenser store with data for ${storeId} (without Visit ID)`);
    return true;
  } catch (error) {
    console.error(`Error updating dispenser store: ${error.message}`);
    return false;
  }
} 