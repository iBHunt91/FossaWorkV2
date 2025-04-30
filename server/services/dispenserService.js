import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';
import { getDispenserStoreFile } from '../../scripts/utils/dataManager.js';
import { loginToFossa } from '../../scripts/utils/login.js';
import { runScrapeWithParams } from '../../scripts/utils/scrape_helpers.js';
import { addLogEntry } from '../routes/api.js';
import { resolveUserFilePath } from '../utils/userManager.js';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure paths
const projectRoot = path.join(__dirname, '..', '..');
const dataDir = path.join(projectRoot, 'data');

// Log runtime information
console.log(`Platform: ${process.platform}`);
console.log(`Project root: ${projectRoot}`);
console.log(`Data dir: ${dataDir}`);

// Create a variable to hold the function that will be set later
let routerAddLogEntry = null;

// Function to add a log entry that will use the router's function when available
const addLogEntryLocal = (type, message) => {
  // If the router's function is available, use it
  if (routerAddLogEntry) {
    console.log(`[dispenserService] Adding log entry (${type}): ${message}`);
    return routerAddLogEntry(type, message);
  }
  
  // Otherwise, just log to console
  console.log(`[${type} log] ${message}`);
  return { timestamp: new Date().toISOString(), message };
};

// Function to set the router's addLogEntry function
export function setAddLogEntryFunction(fn) {
  console.log('[dispenserService] Setting addLogEntry function');
  routerAddLogEntry = fn;
}

/**
 * Initialize the dispenser store if it doesn't exist
 */
function initializeDispenserStore() {
  try {
    const dispenserStorePath = getDispenserStoreFile();
    
    if (!fs.existsSync(dispenserStorePath)) {
      // Create parent directory if it doesn't exist
      const parentDir = path.dirname(dispenserStorePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
        
        // Create standard subdirectories
        fs.mkdirSync(path.join(parentDir, 'archive'), { recursive: true });
        fs.mkdirSync(path.join(parentDir, 'changes_archive'), { recursive: true });
        console.log(`Created user directory structure at ${parentDir}`);
      }
      
      // Create initial store structure
      const initialStore = {
        dispenserData: {},
        metadata: {
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
      };
      
      fs.writeFileSync(dispenserStorePath, JSON.stringify(initialStore, null, 2));
      console.log(`Created new dispenser store at ${dispenserStorePath}`);
    }
  } catch (error) {
    console.error('Error initializing dispenser store:', error);
  }
}

/**
 * Get the current dispenser store data
 * @returns {Object} The dispenser store data
 */
function getDispenserStore() {
  try {
    console.log("[getDispenserStore] Starting to get dispenser store data");
    initializeDispenserStore();
    
    const dispenserStorePath = getDispenserStoreFile();
    console.log(`[getDispenserStore] Store path: ${dispenserStorePath}`);
    console.log(`[getDispenserStore] File exists: ${fs.existsSync(dispenserStorePath)}`);
    
    const data = JSON.parse(fs.readFileSync(dispenserStorePath, 'utf8'));
    console.log(`[getDispenserStore] Loaded data with ${Object.keys(data.dispenserData || {}).length} entries`);
    return data;
  } catch (error) {
    console.error('[getDispenserStore] Error reading dispenser store:', error);
    return { dispenserData: {}, metadata: { created: new Date().toISOString(), lastUpdated: new Date().toISOString() } };
  }
}

/**
 * Save dispenser data for a specific store ID
 * @param {string} storeId - The store ID to save dispenser data for
 * @param {Array} dispensers - The dispenser data to save
 * @returns {boolean} Success status
 */
function saveDispenserData(storeId, dispensers) {
  try {
    if (!storeId || !dispensers || !Array.isArray(dispensers)) {
      console.error('Invalid parameters for saveDispenserData');
      return false;
    }

    const store = getDispenserStore();
    const dispenserStorePath = getDispenserStoreFile();
    
    // Update the dispenser data for this store
    store.dispenserData[storeId] = {
      dispensers,
      lastUpdated: new Date().toISOString()
    };
    
    // Update metadata
    store.metadata.lastUpdated = new Date().toISOString();
    store.metadata.totalStores = Object.keys(store.dispenserData).length;
    
    // Save the updated store
    fs.writeFileSync(dispenserStorePath, JSON.stringify(store, null, 2));
    console.log(`Saved dispenser data for store ${storeId} to persistent store`);
    
    return true;
  } catch (error) {
    console.error('Error saving dispenser data:', error);
    return false;
  }
}

/**
 * Get dispenser data for a specific store ID
 * @param {string} storeId - The store ID to get dispenser data for
 * @returns {Array|null} The dispenser data or null if not found
 */
function getDispenserDataForStore(storeId) {
  try {
    if (!storeId) {
      return null;
    }
    
    const store = getDispenserStore();
    const storeData = store.dispenserData[storeId];
    
    if (!storeData || !storeData.dispensers) {
      return null;
    }
    
    return storeData.dispensers;
  } catch (error) {
    console.error('Error getting dispenser data for store:', error);
    return null;
  }
}

/**
 * Delete dispenser data for a specific store ID
 * @param {string} storeId - The store ID to delete dispenser data for
 * @returns {boolean} Success status
 */
function deleteDispenserDataForStore(storeId) {
  try {
    console.log(`===== STARTING deleteDispenserDataForStore for ID: ${storeId} =====`);
    
    if (!storeId) {
      console.error('Invalid storeId for deleteDispenserDataForStore');
      return false;
    }

    console.log(`Step 1: Opening dispenser store file directly from ${getDispenserStoreFile()}`);
    
    // Ensure store file exists
    if (!fs.existsSync(getDispenserStoreFile())) {
      console.log(`Dispenser store file does not exist at ${getDispenserStoreFile()}, nothing to delete`);
      return true;
    }
    
    // Read the file directly
    const storeData = JSON.parse(fs.readFileSync(getDispenserStoreFile(), 'utf8'));
    console.log(`Step 2: Read store file with ${Object.keys(storeData.dispenserData || {}).length} entries`);
    
    if (!storeData.dispenserData || !storeData.dispenserData[storeId]) {
      console.log(`No dispenser data found for store ${storeId} - nothing to delete`);
      return true;
    }
    
    console.log(`Step 3: Found data for store ${storeId}, proceeding with deletion`);
    
    // Delete the store data
    delete storeData.dispenserData[storeId];
    
    console.log(`Step 4: After deletion, store has data for this ID? ${storeId in storeData.dispenserData}`);
    
    // Update metadata
    storeData.metadata.lastUpdated = new Date().toISOString();
    storeData.metadata.totalStores = Object.keys(storeData.dispenserData).length;
    
    console.log(`Step 5: About to save updated store with ${Object.keys(storeData.dispenserData).length} entries`);
    
    // Save the updated store - write directly to file
    fs.writeFileSync(getDispenserStoreFile(), JSON.stringify(storeData, null, 2));
    console.log(`Step 6: File written successfully`);
    
    console.log(`Successfully deleted dispenser data for store ${storeId} from dispenser store`);
    console.log(`===== COMPLETED deleteDispenserDataForStore for ID: ${storeId} =====`);
    
    return true;
  } catch (error) {
    console.error('Error deleting dispenser data for store:', error);
    console.error(`Stack trace: ${error.stack}`);
    return false;
  }
}

/**
 * Sync the dispenser store with the main scraped content file
 * This ensures all dispenser data is preserved when the main file is updated
 */
function syncDispenserStore() {
  try {
    console.log('Syncing dispenser store with main scraped content...');
    
    // Use the resolveUserFilePath function to get user-specific scraped_content.json
    const scrapedContentPath = resolveUserFilePath('scraped_content.json');
    
    if (!fs.existsSync(scrapedContentPath)) {
      console.log(`Main scraped content file not found at ${scrapedContentPath}, nothing to sync`);
      return false;
    }
    
    // First, ensure we have the latest dispenser store
    initializeDispenserStore();
    const dispenserStore = getDispenserStore();
    
    // Load the main scraped content
    const scrapedContent = JSON.parse(fs.readFileSync(scrapedContentPath, 'utf8'));
    let changes = 0;
    
    if (!scrapedContent.workOrders || !Array.isArray(scrapedContent.workOrders)) {
      console.log('No work orders found in scraped content');
      return false;
    }
    
    // First step: Save any dispenser data from scraped content to the store
    for (const workOrder of scrapedContent.workOrders) {
      if (workOrder.id && workOrder.dispensers && Array.isArray(workOrder.dispensers) && workOrder.dispensers.length > 0) {
        // Only update the store if we don't already have data for this store or data has changed
        const existingData = dispenserStore.dispenserData[workOrder.id]?.dispensers || [];
        
        // Simple change detection by comparing array lengths - could be enhanced
        if (existingData.length !== workOrder.dispensers.length) {
          saveDispenserData(workOrder.id, workOrder.dispensers);
          changes++;
        }
      }
    }
    
    // Second step: Update the scraped content with data from our store
    let contentUpdated = false;
    for (const workOrder of scrapedContent.workOrders) {
      if (workOrder.id) {
        const storedDispensers = getDispenserDataForStore(workOrder.id);
        
        // If we have stored dispenser data for this store and it's not already in the work order
        if (storedDispensers && (!workOrder.dispensers || workOrder.dispensers.length === 0)) {
          workOrder.dispensers = storedDispensers;
          contentUpdated = true;
          changes++;
        }
      }
    }
    
    // Save updated scraped content if needed
    if (contentUpdated) {
      fs.writeFileSync(scrapedContentPath, JSON.stringify(scrapedContent, null, 2));
      console.log('Updated scraped content with dispenser data from store');
    }
    
    console.log(`Sync complete. Made ${changes} changes.`);
    return true;
  } catch (error) {
    console.error('Error syncing dispenser store:', error);
    return false;
  }
}

// Initialize the store at startup
initializeDispenserStore();

/**
 * Run the dispenser scrape script
 * @param {Object} dispenserScrapeJob - The job object to update with progress
 * @param {string} [storeId] - Optional store ID to target a specific store
 * @param {boolean} [forceRescrape] - Whether to force rescrape even if data exists
 * @param {Function} [onComplete] - Optional callback to run when scraping completes successfully
 */
async function runDispenserScrape(dispenserScrapeJob, storeId = null, forceRescrape = false, onComplete = null) {
  try {
    // Make sure we record this in the logs
    addLogEntryLocal('dispenser', `Starting dispenser scrape${storeId ? ` for store ID ${storeId}` : ''}`);
    
    // Execute the dispenser scrape script with optional store ID
    const args = ['--experimental-modules', '--es-module-specifier-resolution=node', 'scripts/dispenserScrape.js'];
    if (storeId) {
      args.push('--storeId', storeId);
    }
    if (forceRescrape) {
      args.push('--force');
    }
    
    const process = spawn('node', args, {
      env: { 
        ...global.process.env, 
        NODE_ENV: 'production',
        NODE_OPTIONS: '--experimental-modules --es-module-specifier-resolution=node'
      }
    });
    
    // Update progress as the process runs
    process.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Dispenser scrape output: ${output}`);
      addLogEntryLocal('dispenser', output.trim());
      
      // Update progress based on output
      if (output.includes('Starting dispenser information scrape')) {
        dispenserScrapeJob.progress = 10;
        dispenserScrapeJob.message = storeId 
          ? `Preparing to collect equipment data for store #${storeId}` 
          : 'Preparing to collect equipment data';
      } else if (output.includes('Successfully logged in to Fossa')) {
        dispenserScrapeJob.progress = 20;
        dispenserScrapeJob.message = 'Connected to Fossa, preparing to gather equipment details';
      } else if (output.includes('Found work orders to process')) {
        const match = output.match(/Found (\d+) work orders/);
        if (match) {
          dispenserScrapeJob.progress = 30;
          dispenserScrapeJob.message = `Accessing ${match[1]} locations for equipment information`;
        }
      } else if (output.includes('Processing work order:')) {
        // Extract progress from work order processing
        const match = output.match(/\[(\d+)\/(\d+)\] Processing work order/);
        if (match) {
          const current = parseInt(match[1]);
          const total = parseInt(match[2]);
          const progress = Math.floor(30 + (current / total) * 60); // 30-90% progress range
          dispenserScrapeJob.progress = progress;
          dispenserScrapeJob.message = `Collecting equipment data from location ${current} of ${total}`;
        }
      } else if (output.includes('SCRAPING COMPLETE')) {
        dispenserScrapeJob.progress = 95;
        dispenserScrapeJob.message = 'Equipment data collection complete, finalizing...';
      }
    });
    
    // Handle errors
    process.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      console.error(`Dispenser scrape error: ${errorMsg}`);
      addLogEntryLocal('dispenser', `ERROR: ${errorMsg.trim()}`);
      if (dispenserScrapeJob.status === 'running') {
        let userFriendlyMessage = `Unable to retrieve equipment data`;
        
        // Provide more specific, user-friendly messages for common errors
        if (errorMsg.includes('dispenserSection')) {
          userFriendlyMessage = "Unable to find dispenser information in the store page. The store may not have dispensers or the page structure has changed.";
        } else if (errorMsg.includes('Equipment tab not found')) {
          userFriendlyMessage = "Unable to find the Equipment tab on the store page. The page structure may have changed.";
        } else if (errorMsg.includes('login') || errorMsg.includes('authentication')) {
          userFriendlyMessage = "Unable to login to the system. Please check your credentials or try again later.";
        } else if (errorMsg.includes('timeout')) {
          userFriendlyMessage = "The operation timed out. The server might be slow or unresponsive. Please try again later.";
        } else if (errorMsg.includes('navigation')) {
          userFriendlyMessage = "Navigation error while accessing store information. Please try again later.";
        } else if (errorMsg.includes('network')) { 
          userFriendlyMessage = "Network error while retrieving dispenser information. Please check your connection and try again.";
        } else if (errorMsg.length > 100) {
          // If it's a long error message, provide a shorter version
          userFriendlyMessage = "An error occurred while retrieving dispenser information. Please try again later.";
        } else {
          // For other errors, include the original message but with a user-friendly prefix
          userFriendlyMessage = `Unable to retrieve dispenser information: ${errorMsg.trim()}`;
        }
        
        dispenserScrapeJob.message = userFriendlyMessage;
        dispenserScrapeJob.error = errorMsg.trim();
      }
    });
    
    // Handle completion
    process.on('close', (code) => {
      if (code === 0) {
        dispenserScrapeJob.status = 'completed';
        dispenserScrapeJob.progress = 100;
        dispenserScrapeJob.message = 'Equipment data collection successfully completed!';
        addLogEntryLocal('dispenser', 'Dispenser scraping completed successfully!');
        
        // Sync dispenser store with the scraped content
        try {
          syncDispenserStore();
          addLogEntryLocal('dispenser', 'Dispenser data store synced successfully');
        } catch (syncError) {
          console.error('Error syncing dispenser store:', syncError);
          addLogEntryLocal('dispenser', `Warning: Error syncing dispenser store: ${syncError.message}`);
        }
        
        // Call the completion callback if provided
        if (typeof onComplete === 'function') {
          try {
            onComplete();
          } catch (error) {
            console.error('Error in completion callback:', error);
          }
        }
      } else {
        dispenserScrapeJob.status = 'error';
        dispenserScrapeJob.error = `Process exited with code ${code}`;
        
        // Provide a more user-friendly message based on the exit code
        let userFriendlyMessage = "";
        if (code === 1) {
          userFriendlyMessage = "The dispenser information collection failed. This might be due to login issues or problems accessing the store data.";
        } else if (code === 2) {
          userFriendlyMessage = "The dispenser information collection was interrupted or timed out. Please try again later.";
        } else if (code === 126 || code === 127) {
          userFriendlyMessage = "System error: Unable to execute the required scripts. Please contact support.";
        } else if (code === 137 || code === 143) {
          userFriendlyMessage = "The process was terminated due to memory constraints. Please try again later or contact support.";
        } else {
          userFriendlyMessage = `Dispenser information collection failed. Please try again later or contact support.`;
        }
        
        dispenserScrapeJob.message = userFriendlyMessage;
        addLogEntryLocal('dispenser', `ERROR: Process exited with code ${code}`);
      }
      logRuntime(dispenserScrapeJob);
    });
  } catch (error) {
    console.error('Error running dispenser scrape:', error);
    dispenserScrapeJob.status = 'error';
    dispenserScrapeJob.error = error.message;
    
    // Create a user-friendly error message
    let userFriendlyMessage = "";
    if (error.message.includes('store URL')) {
      userFriendlyMessage = "Unable to access the store URL. The store information may be missing or incorrect.";
    } else if (error.message.includes('not found')) {
      userFriendlyMessage = "The requested store information could not be found. Please verify the store ID and try again.";
    } else if (error.message.includes('spawn')) {
      userFriendlyMessage = "System error: Unable to start the dispenser scraping process. Please contact support.";
    } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('connection')) {
      userFriendlyMessage = "Network error while retrieving dispenser information. Please check your connection and try again.";
    } else {
      userFriendlyMessage = "An error occurred while collecting dispenser information. Please try again later.";
    }
    
    dispenserScrapeJob.message = userFriendlyMessage;
    addLogEntryLocal('dispenser', `ERROR: ${error.message}`);
    logRuntime(dispenserScrapeJob);
  }
}

/**
 * Log the runtime of a scrape job
 * @param {Object} job - The job object to log runtime for
 */
function logRuntime(job) {
  if (job.startTime) {
    const endTime = new Date();
    const runtime = Math.round((endTime - job.startTime) / 1000);
    console.log(`Job ${job.status} in ${runtime} seconds`);
    addLogEntryLocal('dispenser', `Job ${job.status} in ${runtime} seconds`);
  }
}

export { 
  runDispenserScrape,
  initializeDispenserStore,
  getDispenserStore,
  saveDispenserData,
  getDispenserDataForStore,
  syncDispenserStore,
  deleteDispenserDataForStore
}; 