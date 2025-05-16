/**
 * Preview batch file functionality
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getActiveUser } from '../utils/userManager.js';
import * as logger from '../utils/logger.js';

/**
 * Preview batch file contents
 * @param {string} filePath - Path to the batch data file
 * @returns {object} - Visit data from the batch file
 */
async function preview(filePath) {
  try {
    logger.info(`Previewing batch file: ${filePath}`);
    
    // Check if there's an active user
    const activeUser = getActiveUser();
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
    
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Data file not found: ${filePath} for active user`);
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    logger.info(`Successfully loaded batch file data`);
    const visits = [];
    
    for (const workOrder of data.workOrders) {
      if (
        workOrder.visits &&
        workOrder.visits.nextVisit &&
        workOrder.visits.nextVisit.url
      ) {
        // Get basic visit information
        const serviceCode = workOrder.serviceType && workOrder.serviceType.code;
        const serviceType = getServiceTypeLabel(serviceCode);
        const dispensers = workOrder.dispensers || [];
        
        // Calculate dispenser count more accurately - check both dispensers array and services
        let dispenserCount = 0;
        
        // First check if dispensers array is available and has content
        if (Array.isArray(dispensers) && dispensers.length > 0) {
          dispenserCount = dispensers.length;
        }
        // Fallback to services if dispensers array is empty/missing
        else if (workOrder.services && Array.isArray(workOrder.services)) {
          // Look for meter calibration services as fallback
          const meterCalibrationService = workOrder.services.find(
            service => service.type === "Meter Calibration" ||
            (service.description && service.description.toLowerCase().includes("dispenser")) ||
            (service.description && service.description.toLowerCase().includes("meter"))
          );
          
          if (meterCalibrationService && meterCalibrationService.quantity) {
            dispenserCount = meterCalibrationService.quantity;
          }
        }
        
        visits.push({
          id: workOrder.id,
          storeName: workOrder.customer ? workOrder.customer.name : 'Unknown Store',
          storeNumber: workOrder.customer ? workOrder.customer.storeNumber : 'N/A',
          visitId: workOrder.visits.nextVisit.visitId || extractVisitId(workOrder.visits.nextVisit.url),
          date: workOrder.visits.nextVisit.date,
          url: workOrder.visits.nextVisit.url,
          serviceType,
          serviceCode,
          dispenserCount: dispenserCount
        });
      }
    }
    
    logger.info(`Found ${visits.length} visits in batch file`);
    
    return {
      visits,
      totalVisits: visits.length
    };
  } catch (error) {
    logger.error(`Error previewing batch file: ${error.message}`);
    throw error;
  }
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

export { preview };
