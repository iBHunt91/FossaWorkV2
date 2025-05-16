/**
 * Diagnostic tool for batch processing
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getActiveUser } from '../utils/userManager.js';
import * as logger from '../utils/logger.js';

/**
 * Diagnose the batch processing functionality
 */
async function diagnose() {
  try {
    logger.info('================== BATCH PROCESSING DIAGNOSTICS ==================');
    
    // Check for active user
    const activeUser = getActiveUser();
    logger.info(`Active user: ${activeUser || 'None'}`);
    
    // If no active user, this would cause issues
    if (!activeUser) {
      logger.error('No active user found - this will cause batch processing to fail');
      return { success: false, error: 'No active user found' };
    }
    
    // Check form-automation file structure
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    logger.info(`Current directory: ${currentDir}`);
    
    // Check for required files
    const automateFormPath = path.join(currentDir, 'AutomateForm.js');
    const automateFormExists = fs.existsSync(automateFormPath);
    logger.info(`AutomateForm.js exists: ${automateFormExists}`);
    
    // Check for preview.js
    const previewPath = path.join(currentDir, 'preview.js');
    const previewExists = fs.existsSync(previewPath);
    logger.info(`preview.js exists: ${previewExists}`);
    
    // Check user data paths
    const projectRoot = path.resolve(currentDir, '../..');
    const userDir = path.join(projectRoot, 'data', 'users', activeUser);
    const userDirExists = fs.existsSync(userDir);
    logger.info(`User directory exists: ${userDirExists}`);
    
    if (!userDirExists) {
      logger.error(`User directory does not exist: ${userDir}`);
      return { success: false, error: 'User directory does not exist' };
    }
    
    // Check batch file access
    try {
      const batchFilePath = path.join(userDir, 'scraped_content.json');
      const batchFileExists = fs.existsSync(batchFilePath);
      logger.info(`Default batch file exists: ${batchFileExists}`);
      
      if (batchFileExists) {
        // Check if file is readable
        try {
          const batchFileStats = fs.statSync(batchFilePath);
          logger.info(`Batch file size: ${batchFileStats.size} bytes`);
          
          // Try to read a small portion of the file
          const fd = fs.openSync(batchFilePath, 'r');
          const buffer = Buffer.alloc(100);
          fs.readSync(fd, buffer, 0, 100, 0);
          fs.closeSync(fd);
          
          logger.info('Successfully read batch file sample');
        } catch (fileReadError) {
          logger.error(`Error reading batch file: ${fileReadError.message}`);
          return { success: false, error: `Error reading batch file: ${fileReadError.message}` };
        }
      } else {
        logger.warn('Default batch file does not exist - this may be normal if using a custom path');
      }
    } catch (batchFileError) {
      logger.error(`Error checking batch file: ${batchFileError.message}`);
    }
    
    // Check for active jobs
    logger.info('Checking for active jobs...');
    
    // Try to import the AutomateForm.js to check exports
    try {
      const formAutomation = await import('./AutomateForm.js');
      
      // Check for processBatch export
      const hasProcessBatch = typeof formAutomation.processBatch === 'function';
      logger.info(`processBatch is exported: ${hasProcessBatch}`);
      
      // Check for getBatchStatus export
      const hasGetBatchStatus = typeof formAutomation.getBatchStatus === 'function';
      logger.info(`getBatchStatus is exported: ${hasGetBatchStatus}`);
      
      // Check current batch status
      if (hasGetBatchStatus) {
        const batchStatus = formAutomation.getBatchStatus();
        logger.info(`Current batch status: ${JSON.stringify(batchStatus)}`);
      }
      
      // Check if browser dependencies are available
      try {
        const puppeteer = await import('puppeteer');
        logger.info('Puppeteer is available');
      } catch (puppeteerError) {
        logger.error(`Error importing Puppeteer: ${puppeteerError.message}`);
      }
      
    } catch (importError) {
      logger.error(`Error importing AutomateForm.js: ${importError.message}`);
      return { success: false, error: `Error importing AutomateForm.js: ${importError.message}` };
    }
    
    logger.info('================ BATCH PROCESSING DIAGNOSTICS END ================');
    return { success: true };
  } catch (error) {
    logger.error(`Diagnostics failed with error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Export diagnostic function
export { diagnose };
