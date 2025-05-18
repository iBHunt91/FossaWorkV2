/**
 * Form Automation API Routes
 */
import express from 'express';
const router = express.Router();
import * as formAutomation from '../form-automation/AutomateForm.js';
import { preview } from '../form-automation/preview.js';
import { diagnose } from '../form-automation/diagnostics.js';
// Remove patched imports - will use real batch functions
// import { processBatchPatched, getBatchStatusPatched } from '../form-automation/processBatchPatch.js';
import * as logger from '../utils/logger.js';

// Helper function to calculate estimated time remaining
function calculateEstimatedTime(status) {
  if (!status.startTime || status.completedVisits === 0 || status.totalVisits === 0) {
    return null;
  }
  
  const elapsedTime = Date.now() - new Date(status.startTime).getTime();
  const avgTimePerVisit = elapsedTime / status.completedVisits;
  const remainingVisits = status.totalVisits - status.completedVisits;
  const estimatedMs = remainingVisits * avgTimePerVisit;
  
  // Return in minutes
  return Math.round(estimatedMs / 60000);
}

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
    const { filePath, headless, selectedVisits, resumeFromBatchId } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    logger.info(`Batch process request received for file: ${filePath}, headless: ${headless}, selectedVisits: ${selectedVisits ? selectedVisits.length : 0}, resumeFromBatchId: ${resumeFromBatchId || 'none'}`);
    
    // Create a job ID
    const jobId = Date.now().toString();
    
    // Start the batch processing in the background
    process.nextTick(async () => {
      try {
        // Add options for selected visits and resume capability
        const options = {
          selectedVisits: selectedVisits || [],
          resumeFromBatchId: resumeFromBatchId
        };
        
        logger.info(`Starting batch processing with job ID: ${jobId}, options:`, options);
        
        // Use the real processBatch function with jobId
        await formAutomation.processBatch(filePath, headless !== false, { ...options, jobId });
        
        logger.info(`Batch processing completed for job ID: ${jobId}`);
      } catch (error) {
        logger.error(`Error in background batch processing for job ID ${jobId}: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
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
    logger.info('Batch status endpoint called');
    
    // Get batch status from real implementation
    const status = formAutomation.getBatchStatus();
    
    // Add calculated fields
    status.progress = status.progress || (status.totalVisits > 0 ? 
      Math.floor((status.completedVisits / status.totalVisits) * 100) : 0);
    
    // Add batch-specific metadata
    status.batchMetadata = {
      isResumable: status.completedVisits > 0 && status.completedVisits < status.totalVisits,
      estimatedTimeRemaining: calculateEstimatedTime(status),
      averageTimePerVisit: status.completedVisits > 0 ? 
        Math.round((Date.now() - new Date(status.startTime).getTime()) / status.completedVisits / 1000) : 0
    };
    
    // Log status info for debugging
    logger.info(`Returning batch status: ${JSON.stringify({
      status: status.status,
      progress: status.progress,
      totalVisits: status.totalVisits,
      completedVisits: status.completedVisits,
      currentVisit: status.currentVisit,
      hasDispenserProgress: !!status.dispenserProgress,
      hasBatchProgress: !!status.batchProgress
    })}`);
    
    res.json(status);
  } catch (error) {
    logger.error(`Error getting batch status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Cancel an ongoing form automation job
router.post('/form-automation/cancel/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    
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

// Preview batch file contents
router.post('/form-automation/preview-batch', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    logger.info(`Preview batch endpoint called for file: ${filePath}`);
    
    // Call the preview function
    const previewResult = await preview(filePath);
    
    // Return the preview data
    res.json(previewResult);
  } catch (error) {
    logger.error(`Error previewing batch file: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Diagnostics endpoint for batch processing
router.get('/form-automation/diagnostics', async (req, res) => {
  try {
    logger.info('Diagnostics endpoint called');
    
    // Run diagnostics
    const diagnosticResult = await diagnose();
    
    res.json({
      success: true,
      diagnostics: diagnosticResult
    });
  } catch (error) {
    logger.error(`Error running diagnostics: ${error.message}`);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get unified status for a specific job
router.get('/form-automation/unified-status/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    // Get status from either single or batch automation based on job ID
    let status;
    // Check if this is a batch job by looking at the actual status
    const testStatus = formAutomation.getBatchStatus(jobId);
    
    if (testStatus && testStatus.status !== 'idle') {
      // This is a batch job
      status = testStatus;
      status.isBatch = true;
      
      // Ensure batch-specific fields are properly formatted
      status.totalVisits = status.totalVisits || 0;
      status.completedVisits = status.completedVisits || 0;
      status.currentVisit = status.currentVisit || null;
      status.currentVisitName = status.currentVisitName || null;
      status.currentVisitStatus = status.currentVisitStatus || status.message;
      
      // Calculate progress if not present
      if (!status.progress && status.totalVisits > 0) {
        status.progress = Math.floor((status.completedVisits / status.totalVisits) * 100);
      }
      
      // Ensure batch-specific fields are properly formatted
      if (status.aggregatedDispenserProgress) {
        // Make aggregated progress available as main dispenserProgress for UI compatibility
        status.dispenserProgress = status.aggregatedDispenserProgress.currentVisitProgress;
        status.batchProgress = status.aggregatedDispenserProgress;
      }
      
      // Add batch-specific metadata
      status.batchMetadata = {
        isResumable: status.completedVisits > 0 && status.completedVisits < status.totalVisits,
        estimatedTimeRemaining: calculateEstimatedTime(status),
        averageTimePerVisit: status.completedVisits > 0 ? 
          Math.round((Date.now() - new Date(status.startTime).getTime()) / status.completedVisits / 1000) : 0
      };
    } else {
      status = formAutomation.getStatus();
      status.isBatch = false;
    }
    
    // Add job ID and user ID to the response
    status.jobId = jobId;
    status.userId = req.query.userId || null;
    
    // Add debugging for dispenser progress
    logger.info(`[DEBUG] Unified status for job ${jobId}:`, {
      jobId,
      status: status.status,
      message: status.message,
      hasDispenserProgress: !!status.dispenserProgress,
      dispenserProgressExists: status.dispenserProgress !== null && status.dispenserProgress !== undefined,
      dispenserCount: status.dispenserProgress?.dispensers?.length || 0
    });
    
    if (status.dispenserProgress) {
      logger.info(`[DEBUG] Dispenser progress details:`, JSON.stringify(status.dispenserProgress, null, 2));
    }
    
    res.json(status);
  } catch (error) {
    logger.error(`Error getting unified status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get specific batch job status
router.get('/form-automation/batch/:jobId/status', (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    const status = getBatchStatusPatched();
    res.json(status);
  } catch (error) {
    logger.error(`Error getting batch job status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Pause a running job
router.post('/form-automation/pause/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    // Pause the job
    formAutomation.pauseJob(jobId, reason);
    
    res.json({
      success: true,
      message: 'Job paused successfully'
    });
  } catch (error) {
    logger.error(`Error pausing job: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Resume a paused job
router.post('/form-automation/resume/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    // Resume the job
    formAutomation.resumeJob(jobId);
    
    res.json({
      success: true,
      message: 'Job resumed successfully'
    });
  } catch (error) {
    logger.error(`Error resuming job: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Open URL with debug mode
router.post('/form-automation/open-debug', async (req, res) => {
  try {
    const { url, headless } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Call the implemented function to open URL in debug mode
    logger.info(`Opening URL in debug mode: ${url}, headless: ${headless}`);
    
    // Use the function we implemented - pass headless directly
    await formAutomation.openUrlInDebugMode(url, headless);
    
    res.json({
      success: true,
      message: 'URL opened in debug mode'
    });
  } catch (error) {
    logger.error(`Error opening URL in debug mode: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get list of active jobs
router.get('/form-automation/active-jobs', (req, res) => {
  try {
    // This would need to be implemented to track all active jobs
    const activeJobs = formAutomation.getActiveJobs ? formAutomation.getActiveJobs() : [];
    
    res.json(activeJobs);
  } catch (error) {
    logger.error(`Error getting active jobs: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Clear job history
router.post('/form-automation/clear-history', (req, res) => {
  try {
    const { userId, jobType } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!jobType || !['single', 'batch', 'all'].includes(jobType)) {
      return res.status(400).json({ error: 'Valid job type is required (single, batch, or all)' });
    }
    
    logger.info(`Clearing ${jobType} job history for user: ${userId}`);
    
    // Since jobs are currently kept in memory on the frontend,
    // we don't have persistent job history on the backend yet.
    // This endpoint is ready for when we implement persistent job storage.
    
    // For now, we'll just return success as the frontend handles its own state
    res.json({
      success: true,
      message: `${jobType} job history cleared for user ${userId}`
    });
  } catch (error) {
    logger.error(`Error clearing job history: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router; 