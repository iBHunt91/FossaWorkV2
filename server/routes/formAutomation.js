/**
 * Form Automation API Routes
 */
import express from 'express';
const router = express.Router();
import * as formAutomation from '../form-automation/automateForm.js';
import * as logger from '../utils/logger.js';

// Process a single visit
router.post('/form-automation', async (req, res) => {
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
        await formAutomation.processVisit(visitUrl, headless !== false, workOrderId);
      } catch (error) {
        logger.error(`Error in background processing: ${error.message}`);
      }
    });
    
    // Respond immediately
    res.status(202).json({
      message: 'Visit processing started',
      jobId
    });
  } catch (error) {
    logger.error(`Error processing visit: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get status of current automation job
router.get('/form-automation/status', (req, res) => {
  try {
    const status = formAutomation.getStatus();
    res.json(status);
  } catch (error) {
    logger.error(`Error getting status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Process a batch of visits
router.post('/form-automation/batch', async (req, res) => {
  try {
    const { filePath, headless } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Create a job ID
    const jobId = Date.now().toString();
    
    // Start the batch processing in the background
    process.nextTick(async () => {
      try {
        await formAutomation.processBatch(filePath, headless !== false);
      } catch (error) {
        logger.error(`Error in background batch processing: ${error.message}`);
      }
    });
    
    // Respond immediately
    res.status(202).json({
      message: 'Batch processing started',
      jobId
    });
  } catch (error) {
    logger.error(`Error processing batch: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get status of current batch job
router.get('/form-automation/batch/status', (req, res) => {
  try {
    const status = formAutomation.getBatchStatus();
    res.json(status);
  } catch (error) {
    logger.error(`Error getting batch status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Cancel an ongoing form automation job
router.post('/form-automation/cancel', (req, res) => {
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