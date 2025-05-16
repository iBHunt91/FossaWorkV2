/**
 * Form Automation API Routes
 */
import express from 'express';
const router = express.Router();
import * as formAutomation from '../form-automation/AutomateForm.js';
import * as logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { resolveUserFilePath } from '../utils/userManager.js';

// Process a single visit
router.post('/', async (req, res) => {
  try {
    const { visitUrl, headless, workOrderId } = req.body;
    
    if (!visitUrl) {
      return res.status(400).json({ error: 'Visit URL is required' });
    }
    
    // Validate the URL
    if (!visitUrl.includes('workfossa.com') || !visitUrl.includes('/visits/')) {
      return res.status(400).json({ error: 'Invalid Fossa visit URL' });
    }
    
    // Create a job ID
    const jobId = Date.now().toString();
    
    // Start the visit processing in the background
    process.nextTick(async () => {
      try {
        await formAutomation.processVisit(visitUrl, headless !== false, workOrderId, jobId);
      } catch (error) {
        logger.error(`Error in background processing: ${error.message}`);
      }
    });
    
    // Ensure we're explicitly setting status code to 202 (Accepted)
    return res.status(202).json({
      message: 'Visit processing started',
      jobId: jobId // Explicitly name the property to ensure it's included
    });
  } catch (error) {
    logger.error(`Error processing visit: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get status of current automation job
router.get('/status', (req, res) => {
  try {
    const status = formAutomation.getStatus();
    res.json(status);
  } catch (error) {
    logger.error(`Error getting status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Preview batch file contents
router.post('/preview-batch', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    try {
      // Use resolveUserFilePath to get the user-specific path, but strip 'data/' prefix if present
      let resolvedPath;
      if (filePath === 'data/scraped_content.json' || filePath === 'scraped_content.json') {
        // Strip 'data/' prefix if present since resolveUserFilePath will handle that
        const fileName = path.basename(filePath);
        resolvedPath = resolveUserFilePath(fileName);
      } else {
        resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      }
      
      logger.info(`Using resolved file path for preview: ${resolvedPath}`);
      
      // Check if file exists
      await fs.access(resolvedPath);
      
      // Read and parse the file
      const fileContent = await fs.readFile(resolvedPath, 'utf8');
      const data = JSON.parse(fileContent);
      
      // Extract visit information
      let visits = [];
      
      if (data.workOrders) {
        // Standard work orders format
        visits = data.workOrders.map(order => ({
          id: order.id,
          visitId: extractVisitNumber(order.visits?.nextVisit?.url || ''),
          visitUrl: order.visits?.nextVisit?.url || '',
          storeName: order.customer?.name || 'Unknown Store',
          storeId: order.customer?.storeNumber || '',
          date: order.visits?.nextVisit?.date || new Date().toISOString(),
          dispenserCount: (order.dispensers?.length || 0) || 
                        (order.services?.find(s => 
                          s.type === "Meter Calibration" || 
                          (s.description || '').toLowerCase().includes('dispenser'))?.quantity || 0)
        }));
      } else if (Array.isArray(data)) {
        // Array format
        visits = data.map((item, index) => ({
          id: item.id || `visit-${index}`,
          visitId: extractVisitNumber(item.url || item.visitUrl || ''),
          visitUrl: item.url || item.visitUrl || '',
          storeName: item.storeName || item.store || 'Unknown Store',
          storeId: item.storeId || item.storeNumber || '',
          date: item.date || new Date().toISOString(),
          dispenserCount: item.dispenserCount || 0
        }));
      } else {
        throw new Error('Unsupported file format');
      }
      
      res.json({ visits });
    } catch (fileError) {
      logger.error(`File error in preview-batch: ${fileError.message}`);
      return res.status(404).json({ error: `Failed to process file: ${fileError.message}` });
    }
  } catch (error) {
    logger.error(`Error previewing batch: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to extract visit number from URL
function extractVisitNumber(url) {
  const match = url.match(/visits\/(\d+)/);
  return match ? match[1] : '';
}

// Modify the batch processing endpoint to handle selected visits
router.post('/batch', async (req, res) => {
  try {
    const { filePath, headless, selectedVisits, resumeFromBatchId } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Create a job ID
    const jobId = Date.now().toString();
    
    // Calculate total visits
    let totalVisits = 0;
    if (selectedVisits && Array.isArray(selectedVisits)) {
      totalVisits = selectedVisits.length;
    } else {
      // Try to get count from file
      try {
        // Use resolveUserFilePath for user-specific files, but strip 'data/' prefix if present
        let resolvedPath;
        if (filePath === 'data/scraped_content.json' || filePath === 'scraped_content.json') {
          // Strip 'data/' prefix if present
          const fileName = path.basename(filePath);
          resolvedPath = resolveUserFilePath(fileName);
        } else {
          resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        }
        
        const fileContent = await fs.readFile(resolvedPath, 'utf8');
        const data = JSON.parse(fileContent);
        
        if (data.workOrders) {
          totalVisits = data.workOrders.length;
        } else if (Array.isArray(data)) {
          totalVisits = data.length;
        }
      } catch (countError) {
        logger.warn(`Could not determine visit count from file: ${countError.message}`);
        totalVisits = 0;
      }
    }
    
    // Start the batch processing in the background
    process.nextTick(async () => {
      try {
        // Ensure we're passing a path that will be properly resolved in the AutomateForm.js
        // If it's scraped_content.json, pass just the filename to avoid double path issues
        const processPath = filePath === 'data/scraped_content.json' || filePath === 'scraped_content.json'
          ? 'scraped_content.json'
          : filePath;
        
        await formAutomation.processBatch(
          processPath, 
          headless !== false, 
          selectedVisits, 
          resumeFromBatchId
        );
      } catch (error) {
        logger.error(`Error in background batch processing: ${error.message}`);
      }
    });
    
    // Respond immediately
    res.status(202).json({
      message: 'Batch processing started',
      jobId,
      totalVisits
    });
  } catch (error) {
    logger.error(`Error processing batch: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get status of current batch job
router.get('/batch/status/:jobId?', async (req, res) => {
  try {
    const status = await formAutomation.getBatchStatus(req.params.jobId);
    res.json(status);
  } catch (error) {
    logger.error(`Error getting batch status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Cancel an ongoing form automation job
router.post('/cancel', (req, res) => {
  try {
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    // Call the cancel function
    formAutomation.cancelJob(jobId);
    
    // Respond with success
    res.json({
      success: true,
      message: 'Form automation job cancelled'
    });
  } catch (error) {
    logger.error(`Error cancelling job: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router; 