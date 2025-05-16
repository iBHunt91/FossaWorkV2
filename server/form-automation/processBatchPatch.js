/**
 * Patched processBatch function for form automation
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getActiveUser } from '../utils/userManager.js';
import * as logger from '../utils/logger.js';

// Sample batch status object (to be replaced with actual implementation)
let batchStatus = {
  status: 'idle',
  message: '',
  progress: 0,
  totalItems: 0,
  currentItem: 0,
  startTime: null,
  error: null,
  dispenserProgress: null
};

/**
 * Update the batch status
 * @param {string} status - New status
 * @param {string} message - Status message
 * @param {object} additionalData - Additional status data
 */
function updateBatchStatus(status, message, additionalData = {}) {
  // Update existing batch status
  batchStatus = {
    ...batchStatus,
    status,
    message,
    ...additionalData,
    lastUpdated: new Date().toISOString()
  };
  
  logger.info(`Batch status updated: ${status} - ${message}`);
}

/**
 * Process a batch of visits
 * @param {string} filePath - Path to the batch data file
 * @param {boolean} headless - Whether to run browser in headless mode
 * @param {Object} options - Additional options
 * @param {string[]} options.selectedVisits - Array of visit IDs to process
 * @param {string} options.resumeFromBatchId - Batch ID to resume from
 * @returns {Promise<object>} - Result of the operation
 */
async function processBatchPatched(filePath, headless = true, options = {}) {
  let browser = null;
  let page = null;

  try {
    logger.info(`Processing batch from: ${filePath}`);
    logger.info(`Options: headless=${headless}, selectedVisits=${options.selectedVisits ? options.selectedVisits.length : 0}, resumeFromBatchId=${options.resumeFromBatchId || 'none'}`);
    
    // Initialize batch status
    updateBatchStatus('running', `Starting batch processing from: ${filePath}`, {
      totalVisits: 0,
      completedVisits: 0,
      currentVisit: null,
      currentVisitStatus: null,
      startTime: new Date().toISOString()
    });
    
    // Log active user info
    const activeUser = getActiveUser();
    logger.info(`Active user: ${activeUser || 'None'}`);
    
    if (!activeUser) {
      throw new Error('No active user found');
    }
    
    // Resolve the file path using the active user
    let dataPath;
    if (path.isAbsolute(filePath)) {
      dataPath = filePath;
    } else {
      // In ES modules, we need to use fileURLToPath with import.meta.url instead of __dirname
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const projectRoot = path.resolve(currentDir, '../..');
      const userDir = path.join(projectRoot, 'data', 'users', activeUser);
      
      // Remove 'data/' prefix if it exists to avoid path duplication
      const cleanedFilePath = filePath.replace(/^data\//, '');
      dataPath = path.join(userDir, cleanedFilePath);
      
      logger.info(`User-specific batch file path: ${dataPath}`);
    }
    
    // Check if file exists
    if (!fs.existsSync(dataPath)) {
      logger.error(`Data file not found: ${dataPath}`);
      throw new Error(`Data file not found: ${filePath} for active user`);
    }
    
    // Read and parse the data file
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Extract visit data from work orders
    const visits = [];
    
    for (const workOrder of data.workOrders || []) {
      if (
        workOrder.visits &&
        workOrder.visits.nextVisit &&
        workOrder.visits.nextVisit.url
      ) {
        // Get basic visit information
        const serviceCode = workOrder.serviceType && workOrder.serviceType.code;
        const serviceType = getServiceTypeLabel(serviceCode);
        
        visits.push({
          id: workOrder.id,
          storeName: workOrder.customer ? workOrder.customer.name : 'Unknown Store',
          storeNumber: workOrder.customer ? workOrder.customer.storeNumber : 'N/A',
          visitId: workOrder.visits.nextVisit.visitId || extractVisitId(workOrder.visits.nextVisit.url),
          date: workOrder.visits.nextVisit.date,
          url: workOrder.visits.nextVisit.url,
          serviceType,
          serviceCode
        });
      }
    }
    
    // Filter visits based on selectedVisits option
    let visitsToProcess = visits;
    if (options.selectedVisits && options.selectedVisits.length > 0) {
      visitsToProcess = visits.filter(visit => options.selectedVisits.includes(visit.id));
      logger.info(`Filtered visits based on selection: ${visitsToProcess.length} out of ${visits.length}`);
    }
    
    // Update batch status with total visits
    updateBatchStatus('running', `Preparing to process ${visitsToProcess.length} visits`, {
      totalItems: visitsToProcess.length,
      totalVisits: visitsToProcess.length
    });
    
    // If there are no visits to process, throw an error
    if (visitsToProcess.length === 0) {
      throw new Error('No visits found to process');
    }
    
    // Simulate processing each visit for testing
    for (let i = 0; i < visitsToProcess.length; i++) {
      const visit = visitsToProcess[i];
      
      // Update batch status
      updateBatchStatus('running', `Processing visit ${i+1} of ${visitsToProcess.length}: ${visit.storeName}`, {
        currentItem: i + 1,
        currentVisit: visit.visitId,
        currentVisitStatus: `Starting visit ${visit.visitId}`,
        progress: Math.floor((i / visitsToProcess.length) * 100)
      });
      
      logger.info(`Processing visit ${i+1} of ${visitsToProcess.length}: ${visit.storeName} (${visit.visitId})`);
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update status with completion
      updateBatchStatus('running', `Completed visit ${i+1} of ${visitsToProcess.length}`, {
        currentItem: i + 1,
        completedVisits: i + 1,
        progress: Math.floor(((i + 1) / visitsToProcess.length) * 100)
      });
    }
    
    // Update status with completion
    updateBatchStatus('completed', `Batch processing completed successfully`, {
      progress: 100,
      currentItem: visitsToProcess.length,
      completedVisits: visitsToProcess.length
    });
    
    logger.info('Batch processing completed successfully');
    
    return {
      success: true,
      message: `Processed ${visitsToProcess.length} visits successfully`,
      processedVisits: visitsToProcess.length
    };
  } catch (error) {
    // Update status with error
    updateBatchStatus('error', `Error processing batch: ${error.message}`, {
      error: error.message
    });
    
    logger.error(`Error processing batch: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Clean up browser if it was created
    if (browser) {
      try {
        await browser.close();
        logger.info('Browser closed successfully');
      } catch (closeError) {
        logger.error(`Error closing browser: ${closeError.message}`);
      }
    }
  }
}

/**
 * Get the current status of batch automation
 * @returns {object} - Current batch status
 */
function getBatchStatusPatched() {
  // Ensure the batch status object always has the required properties and backward compatibility
  return {
    ...batchStatus,
    totalVisits: batchStatus.totalItems,
    completedVisits: batchStatus.currentItem,
    currentVisit: batchStatus.currentItem > 0 ? `Visit ${batchStatus.currentItem}` : null,
    currentVisitStatus: batchStatus.message,
    startTime: batchStatus.startTime || new Date().toISOString(),
    lastStatusUpdate: new Date().toISOString(),
    // Include dispenserProgress if it exists
    ...(batchStatus.dispenserProgress && { dispenserProgress: batchStatus.dispenserProgress })
  };
}

/**
 * Extract visit ID from a URL
 * @param {string} url - Visit URL
 * @returns {string} - Extracted visit ID or null
 */
function extractVisitId(url) {
  if (!url) return null;
  
  // Extract the visit ID from URL format like https://workfossa.com/visits/12345
  const match = url.match(/\/visits\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Get a human-readable service type label
 * @param {string} serviceCode - The service code
 * @returns {string} - Human-readable service type
 */
function getServiceTypeLabel(serviceCode) {
  const codeLabels = {
    '3146': 'Open Neck Prover',
    '2862': 'Specific Dispensers',
    // Add more mappings as needed
  };
  
  return codeLabels[serviceCode] || 'AccuMeasure';
}

export { processBatchPatched, getBatchStatusPatched };
