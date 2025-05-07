import express from 'express';
import { runDispenserScrape, syncDispenserStore, getDispenserStore, deleteDispenserDataForStore } from '../services/dispenserService.js';
import { runScrape } from '../../scripts/unified_scrape.js';
import { analyzeScheduleChanges } from '../../scripts/utils/scheduleComparator.js';
import { sendScheduleChangeNotifications } from '../../scripts/notifications/notificationService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getScrapedFiles, getLatestScrapeFile } from '../../scripts/utils/dataManager.js';
import { getActiveUser, resolveUserFilePath } from '../utils/userManager.js';
import * as logger from '../../scripts/utils/logger.js';

// Define __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add this line to define projectRoot
const projectRoot = path.resolve(__dirname, '../..');

const router = express.Router();

// Store recent log messages for UI display
const scrapeJobLogs = {
  workOrder: [],
  dispenser: [],
  server: [],
  formPrep: []
};

// Maximum number of log entries to keep
const MAX_LOG_ENTRIES = 100;

// Helper to add a log entry
const addLogEntry = (type, message) => {
  // Validate the type
  if (!['workOrder', 'dispenser', 'server', 'formPrep'].includes(type)) {
    console.warn(`Invalid log type '${type}'. Using 'server' instead.`);
    type = 'server';
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    message
  };
  
  // Ensure the log array exists
  if (!scrapeJobLogs[type]) {
    scrapeJobLogs[type] = [];
  }
  
  scrapeJobLogs[type].unshift(logEntry); // Add to beginning of array
  
  // Trim logs if they get too long
  if (scrapeJobLogs[type].length > MAX_LOG_ENTRIES) {
    scrapeJobLogs[type] = scrapeJobLogs[type].slice(0, MAX_LOG_ENTRIES);
  }
  
  return logEntry;
};

// Initialize the scrape job objects
let scrapeProgress = {
  status: 'idle',
  progress: 0,
  message: '',
  error: null,
  lastScraped: null
};

let dispenserScrapeJob = {
  status: 'idle',
  progress: 0,
  message: 'No dispenser scrape job is running',
  error: null,
  startTime: null
};

// Reset any stuck job status on server startup
const resetStuckJobs = () => {
  console.log('Checking for stuck jobs on server startup');
  
  // Reset work order scrape job if it's stuck at "running" with 100% progress
  if (scrapeProgress.status === 'running' && scrapeProgress.progress === 100) {
    console.log('Found stuck work order job at 100% - resetting to completed');
    scrapeProgress.status = 'completed';
    scrapeProgress.lastScraped = scrapeProgress.lastScraped || new Date().toISOString();
  }
  
  // Reset dispenser scrape job if it's stuck at "running" with 100% progress
  if (dispenserScrapeJob.status === 'running' && dispenserScrapeJob.progress === 100) {
    console.log('Found stuck dispenser job at 100% - resetting to completed');
    dispenserScrapeJob.status = 'completed';
  }
};

// Run the check immediately
resetStuckJobs();

/**
 * Get the logs for a specific scrape job type
 */
router.get('/scrape-logs/:type', (req, res) => {
  const { type } = req.params;
  
  if (!['workOrder', 'dispenser', 'server', 'formPrep'].includes(type)) {
    return res.status(400).json({ error: 'Invalid log type' });
  }
  
  // Initialize logs array if it doesn't exist yet
  if (!scrapeJobLogs[type]) {
    scrapeJobLogs[type] = [];
  }
  
  return res.json({
    logs: scrapeJobLogs[type]
  });
});

/**
 * Get the status of the work order scrape job
 */
router.get('/status', (req, res) => {
  console.log('Status endpoint called, current state:', {
    status: scrapeProgress.status,
    progress: scrapeProgress.progress,
    message: scrapeProgress.message,
    lastScraped: scrapeProgress.lastScraped
  });

  // Auto-correct status: if progress is 100% or message indicates completion but status is still "running"
  if (scrapeProgress.status === 'running' && 
      (scrapeProgress.progress === 100 || 
       (scrapeProgress.message && (
         scrapeProgress.message.includes('complete') || 
         scrapeProgress.message.includes('success') ||
         scrapeProgress.message.includes('finished'))))) {
    
    console.log('Auto-correcting job status from "running" to "completed"');
    scrapeProgress = {
      ...scrapeProgress,
      status: 'completed',
      progress: 100,
      lastScraped: new Date().toISOString()
    };
  }

  // If the job is completed but progress isn't 100%, fix it
  if (scrapeProgress.status === 'completed' && scrapeProgress.progress !== 100) {
    console.log('Fixing progress for completed job');
    scrapeProgress.progress = 100;
  }

  // Log the final status being sent
  console.log('Sending status:', scrapeProgress);

  return res.json(scrapeProgress);
});

/**
 * Start a dispenser scrape job
 */
router.post('/dispenser-scrape', async (req, res) => {
  try {
    if (dispenserScrapeJob.status === 'running') {
      const message = 'A dispenser scrape job is already running. Please wait for it to complete.';
      addLogEntry('dispenser', message);
      return res.status(400).json({
        error: message
      });
    }

    // Set up a new scrape job object for dispensers
    dispenserScrapeJob = {
      status: 'running',
      progress: 0,
      message: 'Starting dispenser scrape...',
      error: null,
      startTime: new Date()
    };
    
    addLogEntry('dispenser', 'Starting new dispenser scrape job');

    // Run the dispenser scrape script asynchronously with completion callback
    runDispenserScrape(
      dispenserScrapeJob,
      null,
      false, // Normal scrape - don't force rescrape of jobs that already have data
      () => {
        console.log('Dispenser scrape completion callback triggered');
        
        // Ensure we update all status fields atomically
        const completedStatus = {
          status: 'completed',
          progress: 100,
          message: 'Dispenser scraping completed successfully!',
          error: null,
          startTime: dispenserScrapeJob.startTime,
          lastScraped: new Date().toISOString()
        };
        
        console.log('Setting completed status:', completedStatus);
        dispenserScrapeJob = completedStatus;
        
        addLogEntry('dispenser', 'Dispenser scrape completed successfully!');
      }
    );

    return res.json({
      message: 'Dispenser scrape job started successfully!'
    });
  } catch (error) {
    console.error('Error starting dispenser scrape job:', error);
    dispenserScrapeJob = {
      status: 'error',
      progress: 0,
      message: 'Error starting scrape',
      error: error.message,
      startTime: new Date()
    };
    addLogEntry('dispenser', `Error starting dispenser scrape: ${error.message}`);
    return res.status(500).json({
      error: 'Failed to start dispenser scrape job: ' + error.message
    });
  }
});

/**
 * Get the status of the dispenser scrape job
 */
router.get('/dispenser-status', (req, res) => {
  console.log('Dispenser status endpoint called, current state:', {
    status: dispenserScrapeJob.status,
    progress: dispenserScrapeJob.progress,
    message: dispenserScrapeJob.message
  });

  // Auto-correct status: if progress is 100% or message indicates completion but status is still "running"
  if (dispenserScrapeJob.status === 'running' && 
      (dispenserScrapeJob.progress === 100 || 
       (dispenserScrapeJob.message && (
         dispenserScrapeJob.message.includes('complete') || 
         dispenserScrapeJob.message.includes('success') ||
         dispenserScrapeJob.message.includes('finished'))))) {
    
    console.log('Auto-correcting dispenser job status from "running" to "completed"');
    dispenserScrapeJob = {
      ...dispenserScrapeJob,
      status: 'completed',
      progress: 100,
      message: dispenserScrapeJob.message || 'Scraping completed successfully!'
    };
  }

  // If the job is completed but progress isn't 100%, fix it
  if (dispenserScrapeJob.status === 'completed' && dispenserScrapeJob.progress !== 100) {
    console.log('Fixing progress for completed job');
    dispenserScrapeJob.progress = 100;
  }

  // Log the final status being sent
  console.log('Sending dispenser status:', dispenserScrapeJob);

  return res.json(dispenserScrapeJob);
});

/**
 * Start a work order scrape job
 */
router.post('/scrape', async (req, res) => {
  try {
    // Check if a scrape is already running
    if (scrapeProgress.status === 'running') {
      return res.status(409).json({
        success: false,
        message: 'A scrape job is already running'
      });
    }
    
    console.log('[API] Starting new scrape job');
    
    // Reset the progress object
    scrapeProgress = {
      status: 'running',
      progress: 0,
      message: 'Starting scrape job...',
      error: null
    };
    
    // Add new entry to logs
    addLogEntry('workOrder', 'Manual scrape job started via API');
    
    // Ensure user directory exists before scraping (if using multi-user)
    const activeUser = getActiveUser();
    if (activeUser) {
      const userDir = path.join(__dirname, '..', '..', 'data', 'users', activeUser);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
        console.log(`Created user directory: ${userDir}`);
        
        // Create necessary subdirectories
        fs.mkdirSync(path.join(userDir, 'archive'), { recursive: true });
        fs.mkdirSync(path.join(userDir, 'changes_archive'), { recursive: true });
      }
    }
    
    // Run the scrape using the unified scrape script
    runScrape({
      isManual: true,
      progressCallback: (progress, message) => {
        console.log(`[API] Scrape progress update: ${progress}% - ${message}`);
        
        // Update the progress object
        scrapeProgress.progress = progress;
        scrapeProgress.message = message;
        
        // Handle completion
        if (progress === 100) {
          scrapeProgress.status = 'completed';
          scrapeProgress.lastScraped = new Date().toISOString();
          addLogEntry('workOrder', 'Manual scrape job completed successfully');
        } 
        // Handle error
        else if (progress === -1) {
          scrapeProgress.status = 'error';
          scrapeProgress.error = message;
          addLogEntry('workOrder', `Manual scrape job failed: ${message}`);
        }
      }
    })
    .then(result => {
      console.log('[API] Scrape job promise resolved:', result);
      
      // If we get here but progress isn't 100%, update it
      if (scrapeProgress.progress !== 100 && scrapeProgress.status !== 'error') {
        scrapeProgress.status = result.success ? 'completed' : 'error';
        scrapeProgress.message = result.success ? 'Scrape completed successfully' : result.error;
        scrapeProgress.error = result.success ? null : result.error;
        scrapeProgress.lastScraped = result.success ? new Date().toISOString() : null;
      }
    })
    .catch(error => {
      console.error('[API] Error in scrape job:', error);
      
      // Update progress with error
      scrapeProgress.status = 'error';
      scrapeProgress.progress = -1;
      scrapeProgress.message = `Error: ${error.message}`;
      scrapeProgress.error = error.message;
      
      addLogEntry('workOrder', `Manual scrape job error: ${error.message}`);
    });
    
    // Return success immediately, client can poll for progress
    res.json({
      success: true,
      message: 'Scrape job started successfully'
    });
  } catch (error) {
    console.error('[API] Error handling scrape request:', error);
    
    res.status(500).json({
      success: false,
      message: `Error starting scrape: ${error.message}`
    });
  }
});

/**
 * Clear dispenser data for a specific store
 */
router.post('/clear-dispenser-data', async (req, res) => {
  try {
    const { storeId } = req.body;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }
    
    console.log(`Attempting to clear dispenser data for store ID: ${storeId}`);
    
    // Load the current data from the user-specific file
    const dataPath = getLatestScrapeFile();
    console.log(`Looking for data file at: ${dataPath}`);
    
    if (!fs.existsSync(dataPath)) {
      console.error(`Data file not found at: ${dataPath}`);
      return res.status(500).json({ error: 'Data file not found' });
    }
    
    const scrapedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    // Find the store by ID
    const storeIndex = scrapedData.workOrders.findIndex(order => order.id === storeId);
    
    if (storeIndex === -1) {
      console.error(`Store with ID ${storeId} not found in data file`);
      return res.status(404).json({ error: 'Store not found' });
    }
    
    console.log(`Found store at index ${storeIndex}, clearing dispenser data`);
    
    // Save old data for logging
    const hadDispensers = scrapedData.workOrders[storeIndex].dispensers && 
                          scrapedData.workOrders[storeIndex].dispensers.length > 0;
    const hadHtml = Boolean(scrapedData.workOrders[storeIndex].dispenserHtml);
    
    // Clear dispenser data
    scrapedData.workOrders[storeIndex].dispensers = [];
    scrapedData.workOrders[storeIndex].dispenserHtml = "";
    
    // Save the updated data
    fs.writeFileSync(dataPath, JSON.stringify(scrapedData, null, 2));
    
    console.log(`Successfully cleared dispenser data from ${dataPath}`);
    
    // Use the external script to handle clearing the dispenser store
    const { spawn } = await import('child_process');
    const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'clear_dispenser.cjs');
    
    console.log(`Running script to clear dispenser store: ${scriptPath}`);
    
    const process = spawn('node', [scriptPath, storeId], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let scriptOutput = '';
    let scriptError = '';
    
    // Collect script output
    process.stdout.on('data', (data) => {
      const output = data.toString();
      scriptOutput += output;
      console.log(`Script output: ${output.trim()}`);
    });
    
    // Collect script errors
    process.stderr.on('data', (data) => {
      const error = data.toString();
      scriptError += error;
      console.error(`Script error: ${error.trim()}`);
    });
    
    // Handle script completion
    await new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) {
          console.log(`Script completed successfully (${scriptOutput.trim()})`);
          resolve();
        } else {
          console.error(`Script failed with code ${code}: ${scriptError}`);
          reject(new Error(`Script exited with code ${code}: ${scriptError}`));
        }
      });
    });
    
    console.log(`Successfully cleared dispenser data for store ${storeId}`);
    console.log(`Previous data: dispensers=${hadDispensers}, html=${hadHtml}`);
    
    return res.json({
      message: 'Dispenser data cleared successfully',
      storeId,
      previousData: {
        hadDispensers,
        hadHtml
      }
    });
  } catch (error) {
    console.error('Error clearing dispenser data:', error);
    return res.status(500).json({
      error: 'Failed to clear dispenser data: ' + error.message
    });
  }
});

/**
 * Force rescrape of dispenser data for a specific store
 */
router.post('/force-rescrape-dispenser', async (req, res) => {
  try {
    const { storeId } = req.body;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }
    
    console.log(`Attempting to force rescrape dispenser data for store ID: ${storeId}`);
    
    if (dispenserScrapeJob.status === 'running') {
      console.warn('Cannot start new dispenser scrape: a job is already running');
      return res.status(400).json({
        error: 'A dispenser scrape job is already running. Please wait for it to complete.'
      });
    }
    
    // Load the current data from the user-specific file
    const dataPath = getLatestScrapeFile();
    console.log(`Looking for data file at: ${dataPath}`);
    
    if (!fs.existsSync(dataPath)) {
      console.error(`Data file not found at: ${dataPath}`);
      return res.status(500).json({ error: 'Data file not found' });
    }
    
    const scrapedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    const store = scrapedData.workOrders.find(order => order.id === storeId);
    
    if (!store) {
      console.error(`Store with ID ${storeId} not found in data file`);
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Set up a new scrape job object for the specific store
    dispenserScrapeJob = {
      status: 'running',
      progress: 0,
      message: `Starting dispenser scrape for store ${storeId}...`,
      error: null,
      startTime: new Date(),
      storeId: storeId
    };
    
    // Run the dispenser scrape script asynchronously with completion callback
    runDispenserScrape(
      dispenserScrapeJob,
      storeId,
      true,
      () => {
        console.log(`Dispenser scrape completion callback triggered for store ${storeId}`);
        dispenserScrapeJob = {
          ...dispenserScrapeJob,
          status: 'completed',
          progress: 100,
          message: `Dispenser scraping completed successfully for store ${storeId}!`,
          error: null
        };
        addLogEntry('dispenser', `Dispenser scrape completed successfully for store ${storeId}!`);
      }
    );
    
    return res.json({
      message: `Dispenser scrape job started for store ${storeId}`,
      storeId
    });
  } catch (error) {
    console.error('Error starting dispenser scrape job:', error);
    dispenserScrapeJob = {
      status: 'error',
      progress: 0,
      message: 'Error starting scrape',
      error: error.message,
      startTime: new Date()
    };
    return res.status(500).json({
      error: 'Failed to force rescrape dispenser data: ' + error.message
    });
  }
});

/**
 * Get schedule change history
 */
router.get('/history', async (req, res) => {
  try {
    // Get the active user
    const activeUserId = getActiveUser();
    if (!activeUserId) {
      console.log('No active user found, using global archives');
      // If no active user, fall back to global archives
    }
    
    // If we have an active user, check their archives directory first
    if (activeUserId) {
      // Get paths to the user's archive directories
      const userDir = path.join(projectRoot, 'data', 'users', activeUserId);
      const archivesDir = path.join(userDir, 'archives');
      
      // Check for consolidated history file in the archives directory
      const userHistoryFilePath = path.join(archivesDir, 'change_history.json');
      console.log(`Looking for user history file: ${userHistoryFilePath}`);
      
      if (fs.existsSync(userHistoryFilePath)) {
        console.log('Found user history file in archives directory');
        try {
          // Read the consolidated history file
          const historyContent = fs.readFileSync(userHistoryFilePath, 'utf8');
          const historyData = JSON.parse(historyContent);
          
          // Ensure it's an array
          if (Array.isArray(historyData)) {
            // Format dates and return
            const formattedHistory = historyData.map(entry => {
              const date = new Date(entry.timestamp);
              const dateString = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              
              return {
                date: dateString,
                changes: entry.changes
              };
            });
            
            console.log(`Returning ${formattedHistory.length} entries from user history file`);
            return res.json(formattedHistory);
          } else {
            console.warn('User history file exists but is not an array');
          }
        } catch (historyError) {
          console.error('Error reading user history file:', historyError);
          // Continue to check other locations
        }
      }
      
      // If no consolidated history file, get individual archive files from the user's archives directory
      console.log('No consolidated history file found, checking individual archive files');
      
      if (fs.existsSync(archivesDir)) {
        console.log(`Reading files from user archives directory: ${archivesDir}`);
        const files = fs.readdirSync(archivesDir)
          .filter(file => file.startsWith('changes_') && file.endsWith('.json'))
          .sort((a, b) => {
            // Sort from newest to oldest
            const timeA = a.replace('changes_', '').replace('.json', '');
            const timeB = b.replace('changes_', '').replace('.json', '');
            return timeB.localeCompare(timeA);
          });
        
        console.log(`Found ${files.length} files in user archives directory`);
        
        if (files.length > 0) {
          const historyData = [];
          
          for (const file of files) {
            try {
              const filePath = path.join(archivesDir, file);
              const content = fs.readFileSync(filePath, 'utf8');
              console.log(`Processing user archive file: ${file}`);
              
              // Extract timestamp from filename
              const timestamp = file.replace('changes_', '').replace('.json', '');
              const date = new Date(timestamp.replace(/-/g, (m, i) => {
                // Convert the timestamp format back to ISO format for parsing
                return i < 10 ? '-' : (i < 16 ? ':' : '.');
              }));
              
              const dateString = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
              // Parse the changes data
              const data = JSON.parse(content);
              const changes = data.changes || data;
        
              // Add entry
        historyData.push({
          date: dateString,
          changes: changes
        });
      } catch (error) {
              console.error(`Error processing user archive file ${file}:`, error);
              // Continue to next file
        continue;
      }
    }
    
          if (historyData.length > 0) {
            console.log(`Returning ${historyData.length} entries from user archives directory`);
    return res.json(historyData);
          }
        }
      }
    }
    
    // Check for the consolidated history file in global changes_archive next
    const globalArchiveDir = path.join(projectRoot, 'data', 'changes_archive');
    const globalHistoryFile = path.join(globalArchiveDir, 'change_history.json');
    
    console.log(`Checking for global history file: ${globalHistoryFile}`);
    if (fs.existsSync(globalHistoryFile)) {
      console.log('Found global history file');
      try {
        // Read the consolidated history file
        const historyContent = fs.readFileSync(globalHistoryFile, 'utf8');
        const historyData = JSON.parse(historyContent);
        
        // Ensure it's an array
        if (Array.isArray(historyData)) {
          // Format dates and return
          const formattedHistory = historyData.map(entry => {
            const date = new Date(entry.timestamp);
            const dateString = date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            
            return {
              date: dateString,
              changes: entry.changes
            };
          });
          
          console.log(`Returning ${formattedHistory.length} entries from global history file`);
          return res.json(formattedHistory);
        } else {
          console.warn('Global history file exists but is not an array');
        }
      } catch (historyError) {
        console.error('Error reading global history file:', historyError);
        // Continue to user-specific checks if global file couldn't be read
      }
    }
    
    // Fallback: Read from individual archive files in global directory
    console.log('Falling back to individual global archive files');
    const historyData = [];
    
    // Process files in the global changes_archive directory
    const processGlobalArchives = () => {
      if (!fs.existsSync(globalArchiveDir)) {
        console.log(`Global archive directory does not exist: ${globalArchiveDir}`);
        return [];
      }
      
      console.log(`Reading files from global archive directory: ${globalArchiveDir}`);
      const files = fs.readdirSync(globalArchiveDir)
        .filter(file => 
          (file.startsWith('schedule_changes_') || file.startsWith('changes_')) && 
          (file.endsWith('.txt') || file.endsWith('.json')) &&
          file !== 'change_history.json' // Skip the consolidated history file
        )
        .sort((a, b) => {
          // Sort from newest to oldest
          const timeA = a.replace(/^(schedule_changes_|changes_)/, '').replace(/\.(txt|json)$/, '');
          const timeB = b.replace(/^(schedule_changes_|changes_)/, '').replace(/\.(txt|json)$/, '');
          return timeB.localeCompare(timeA);
        });
      
      console.log(`Found ${files.length} files in global archive directory`);
      
      const entries = [];
      for (const file of files) {
        try {
          const filePath = path.join(globalArchiveDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          console.log(`Processing global file: ${file}`);
          
          // Extract timestamp from filename
          const timestamp = file.replace(/^(schedule_changes_|changes_)/, '').replace(/\.(txt|json)$/, '');
          const date = new Date(timestamp.replace(/-/g, (m, i) => {
            // Convert the timestamp format back to ISO format for parsing
            return i < 10 ? '-' : (i < 16 ? ':' : '.');
          }));
          
          const dateString = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          // Parse the changes data
          let changes;
          if (file.endsWith('.json')) {
            // For JSON files, parse directly
            const data = JSON.parse(content);
            changes = data.changes || data;
          } else {
            // For text files, extract summary and changes
            const summaryMatch = content.match(/Jobs Removed: (\d+)[\s\S]*?Jobs Added: (\d+)[\s\S]*?Jobs Modified: (\d+)/);
            const criticalSection = content.match(/Critical Changes:[\s\S]*?(?=High Severity Changes:|$)/);
            const highSection = content.match(/High Severity Changes:[\s\S]*?(?=$)/);
            
            changes = {
              summary: {
                removed: summaryMatch ? parseInt(summaryMatch[1]) : 0,
                added: summaryMatch ? parseInt(summaryMatch[2]) : 0,
                modified: summaryMatch ? parseInt(summaryMatch[3]) : 0
              },
              critical: criticalSection ? 
                criticalSection[0].split('\n')
                  .filter(line => line.trim().startsWith('- '))
                  .map(line => line.trim()) : [],
              high: highSection ? 
                highSection[0].split('\n')
                  .filter(line => line.trim().startsWith('- '))
                  .map(line => line.trim()) : [],
              medium: [],
              low: []
            };
          }
          
          // Add entry
          entries.push({
            date: dateString,
            changes: changes
          });
        } catch (error) {
          console.error(`Error processing global archive file ${file}:`, error);
          // Continue to next file
          continue;
        }
      }
      
      return entries;
    };
    
    // Get entries from global archive
    const globalEntries = processGlobalArchives();
    historyData.push(...globalEntries);
    
    console.log(`Total history entries found: ${historyData.length}`);
    
    return res.json(historyData);
  } catch (error) {
    console.error('Error retrieving schedule history:', error);
    return res.status(500).json({
      error: 'Failed to retrieve schedule history: ' + error.message
    });
  }
});

/**
 * Get archived schedule changes
 */
router.get('/schedule-archives', async (req, res) => {
  try {
    const archiveDir = path.join(__dirname, '..', '..', 'data/changes_archive');
    
    // Check if archive directory exists
    if (!fs.existsSync(archiveDir)) {
      return res.json({ archives: [] });
    }
    
    // Get all archived files
    const files = fs.readdirSync(archiveDir)
      .filter(file => 
        file.startsWith('schedule_changes_') && 
        (file.endsWith('.txt') || file.endsWith('.json'))
      )
      .sort((a, b) => {
        // Sort from newest to oldest
        const timeA = a.replace('schedule_changes_', '').replace(/\.(txt|json)$/, '');
        const timeB = b.replace('schedule_changes_', '').replace(/\.(txt|json)$/, '');
        return timeB.localeCompare(timeA);
      });
    
    // Map to a more usable format
    const archives = files.map(file => {
      const timestamp = file.replace('schedule_changes_', '').replace(/\.(txt|json)$/, '');
      const date = new Date(timestamp.replace(/-/g, (m, i) => {
        // Convert the timestamp format back to ISO format for parsing
        return i < 10 ? '-' : (i < 16 ? ':' : '.');
      }));
      
      return {
        id: file,
        date: date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        timestamp: date.getTime(),
        format: file.endsWith('.json') ? 'json' : 'txt'
      };
    });
    
    return res.json({ archives });
  } catch (error) {
    console.error('Error retrieving schedule archives:', error);
    return res.status(500).json({
      error: 'Failed to retrieve schedule archives: ' + error.message
    });
  }
});

/**
 * Get a specific archived schedule change file
 */
router.get('/schedule-archives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const archiveDir = path.join(__dirname, '..', '..', 'data/changes_archive');
    const filePath = path.join(archiveDir, id);
    
    // Basic security check to prevent path traversal
    if (!id.startsWith('schedule_changes_') || !(id.endsWith('.txt') || id.endsWith('.json')) || id.includes('..')) {
      return res.status(400).json({ error: 'Invalid archive ID' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archive file not found' });
    }
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Initialize summary
    const summary = {
      removed: 0,
      added: 0,
      modified: 0
    };
    
    // Initialize changes
    const changesResult = {
      critical: [],
      high: []
    };
    
    // Check if it's a JSON file
    if (id.endsWith('.json')) {
      try {
        const jsonData = JSON.parse(content);
        
        // Extract summary 
        if (jsonData.summary) {
          summary.removed = jsonData.summary.removed || 0;
          summary.added = jsonData.summary.added || 0;
          summary.modified = jsonData.summary.modified || 0;
        }
        
        // Extract change categories
        if (jsonData.changes) {
          // Convert each change to a string representation for display
          if (Array.isArray(jsonData.changes.critical)) {
            changesResult.critical = jsonData.changes.critical.map(change => {
              switch(change.type) {
                case 'removed':
                  return `- Visit #${change.jobId} (Store #${change.store}, ${change.dispensers || 0} dispensers) was removed from ${change.date}`;
                case 'added':
                  return `- Visit #${change.jobId} (Store #${change.store}, ${change.dispensers || 0} dispensers) was added on ${change.date}`;
                case 'date_changed':
                  return `- Date changed for Visit #${change.jobId} at store #${change.store}: ${change.oldDate} -> ${change.newDate}`;
                case 'replacement':
                  return `- Visit #${change.removedJobId} (Store #${change.removedStore}, ${change.removedDispensers || 0} dispensers) was removed and replaced with Visit #${change.addedJobId} (Store #${change.addedStore}, ${change.addedDispensers || 0} dispensers) on ${change.date}`;
                default:
                  return `- Unknown change: ${JSON.stringify(change)}`;
              }
            });
          }
          
          if (Array.isArray(jsonData.changes.high)) {
            changesResult.high = jsonData.changes.high.map(change => {
              switch(change.type) {
                case 'removed':
                  return `- Visit #${change.jobId} (Store #${change.store}, ${change.dispensers || 0} dispensers) was removed from ${change.date}`;
                case 'added':
                  return `- Visit #${change.jobId} (Store #${change.store}, ${change.dispensers || 0} dispensers) was added on ${change.date}`;
                case 'date_changed':
                  return `- Date changed for Visit #${change.jobId} at store #${change.store}: ${change.oldDate} -> ${change.newDate}`;
                default:
                  return `- Unknown change: ${JSON.stringify(change)}`;
              }
            });
          }
        }
      } catch (jsonError) {
        console.error('Error parsing JSON report:', jsonError);
        // Fall back to text parsing
      }
    } else {
      // Traditional text report parsing
      const summaryMatch = content.match(/Jobs Removed: (\d+)[\s\S]*?Jobs Added: (\d+)[\s\S]*?Jobs Modified: (\d+)/);
      if (summaryMatch) {
        summary.removed = parseInt(summaryMatch[1]);
        summary.added = parseInt(summaryMatch[2]);
        summary.modified = parseInt(summaryMatch[3]);
      }
      
      // Extract critical changes section
      const criticalSection = content.match(/Critical Changes:[\s\S]*?(?=High Severity Changes:|$)/);
      if (criticalSection) {
        const criticalLines = criticalSection[0].split('\n').filter(line => line.trim().startsWith('- '));
        changesResult.critical = criticalLines.map(line => line.trim());
      } else {
        // If no specific Critical Changes section, check All Changes section
        const allChangesSection = content.match(/All Changes:[\s\S]*?(?=$)/);
        if (allChangesSection) {
          const allLines = allChangesSection[0].split('\n').filter(line => line.trim().startsWith('- '));
          changesResult.critical = allLines.map(line => line.trim());
        }
      }
      
      // Extract high severity changes section
      const highSection = content.match(/High Severity Changes:[\s\S]*?(?=$)/);
      if (highSection) {
        const highLines = highSection[0].split('\n').filter(line => line.trim().startsWith('- '));
        changesResult.high = highLines.map(line => line.trim());
      }
    }
    
    return res.json({
      id,
      content,
      summary,
      changes: changesResult
    });
  } catch (error) {
    console.error('Error retrieving schedule archive:', error);
    return res.status(500).json({
      error: 'Failed to retrieve schedule archive: ' + error.message
    });
  }
});

/**
 * Delete a specific archived schedule change file
 */
router.delete('/schedule-archives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const archiveDir = path.join(__dirname, '..', '..', 'data/changes_archive');
    const filePath = path.join(archiveDir, id);
    
    // Basic security check to prevent path traversal
    if (!id.startsWith('schedule_changes_') || !(id.endsWith('.txt') || id.endsWith('.json')) || id.includes('..')) {
      return res.status(400).json({ error: 'Invalid archive ID' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archive file not found' });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    console.log(`Archive deleted: ${id}`);
    
    return res.json({
      message: 'Archive deleted successfully',
      id
    });
  } catch (error) {
    console.error('Error deleting schedule archive:', error);
    return res.status(500).json({
      error: 'Failed to delete schedule archive: ' + error.message
    });
  }
});

/**
 * Manually trigger a sync of the dispenser store with scraped_content.json
 */
router.post('/sync-dispenser-store', async (req, res) => {
  try {
    console.log('Manual dispenser store sync requested');
    addLogEntry('dispenser', 'Manual dispenser store sync requested');
    
    const result = syncDispenserStore();
    
    if (result) {
      const storeData = getDispenserStore();
      const storeCount = Object.keys(storeData.dispenserData || {}).length;
      
      console.log(`Dispenser store sync completed successfully. Store contains data for ${storeCount} locations.`);
      addLogEntry('dispenser', `Dispenser store sync completed successfully. Store contains data for ${storeCount} locations.`);
      
      return res.json({
        success: true,
        message: 'Dispenser store synced successfully',
        storeCount,
        lastUpdated: storeData.metadata?.lastUpdated
      });
    } else {
      console.log('Dispenser store sync completed with no changes');
      addLogEntry('dispenser', 'Dispenser store sync completed with no changes');
      
      return res.json({
        success: true,
        message: 'Dispenser store sync completed with no changes',
        storeCount: 0
      });
    }
  } catch (error) {
    console.error('Error syncing dispenser store:', error);
    addLogEntry('dispenser', `Error syncing dispenser store: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to sync dispenser store: ' + error.message
    });
  }
});

/**
 * Get the entire dispenser store data
 */
router.get('/dispenser-store', async (req, res) => {
  try {
    console.log('Dispenser store data requested');
    
    const storeData = getDispenserStore();
    const storeCount = Object.keys(storeData.dispenserData || {}).length;
    
    // For security and bandwidth reasons, don't return the full dispensers data
    // Instead, return summary information about each store
    const summary = {
      metadata: storeData.metadata,
      stores: {}
    };
    
    // Create a summary for each store
    Object.entries(storeData.dispenserData || {}).forEach(([storeId, data]) => {
      summary.stores[storeId] = {
        dispenserCount: data.dispensers?.length || 0,
        lastUpdated: data.lastUpdated
      };
    });
    
    return res.json({
      success: true,
      summary,
      storeCount
    });
  } catch (error) {
    console.error('Error retrieving dispenser store data:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve dispenser store data: ' + error.message
    });
  }
});

/**
 * Get work orders for the active user
 */
router.get('/work-orders', (req, res) => {
  try {
    // Get the active user
    const activeUser = getActiveUser();
    
    if (!activeUser) {
      console.error('No active user found when trying to load work orders');
      return res.status(400).json({ 
        error: 'No active user found. Please select a user first.',
        activeUser: null,
        workOrders: []
      });
    }
    
    console.log(`Loading work orders for active user: ${activeUser}`);
    
    // Get the user-specific data file path
    const dataPath = getLatestScrapeFile(activeUser);
    
    if (!dataPath) {
      console.error(`Could not resolve data path for user: ${activeUser}`);
      return res.status(404).json({ 
        error: 'Could not locate work order data for this user.',
        activeUser: activeUser,
        workOrders: []
      });
    }
    
    console.log(`Loading work orders from: ${dataPath}`);
    
    // Check if the file exists
    if (!fs.existsSync(dataPath)) {
      console.error(`Data file not found at: ${dataPath}`);
      return res.status(404).json({ 
        error: 'No work order data found. Please run a scrape first.',
        activeUser: activeUser,
        workOrders: []
      });
    }
    
    // Read the data file
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`Successfully loaded ${data.workOrders ? data.workOrders.length : 0} work orders for user ${activeUser}`);
    
    // Return the work orders
    return res.json({
      workOrders: data.workOrders || [],
      metadata: data.metadata || {},
      activeUser: activeUser
    });
  } catch (error) {
    console.error('Error retrieving work orders:', error);
    return res.status(500).json({
      error: 'Failed to retrieve work orders: ' + error.message,
      activeUser: getActiveUser(),
      workOrders: []
    });
  }
});

/**
 * Get prover preferences for the active user
 */
router.get('/prover-preferences', (req, res) => {
  try {
    // Get the user-specific prover preferences file path using resolveUserFilePath
    const preferencesPath = resolveUserFilePath('prover_preferences.json');
    console.log(`Loading prover preferences from: ${preferencesPath}`);
    
    // Check if the file exists, if not, return default preferences
    if (!fs.existsSync(preferencesPath)) {
      console.log(`Prover preferences file not found at: ${preferencesPath}, returning defaults`);
      return res.json({
        provers: [],
        last_updated: new Date().toISOString()
      });
    }
    
    // Read the preferences file
    const preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
    
    // Return the preferences
    return res.json(preferences);
  } catch (error) {
    console.error('Error retrieving prover preferences:', error);
    return res.status(500).json({
      error: 'Failed to retrieve prover preferences: ' + error.message
    });
  }
});

/**
 * Save prover preferences for the active user
 */
router.post('/prover-preferences', (req, res) => {
  try {
    const preferences = req.body;
    
    if (!preferences || !Array.isArray(preferences.provers)) {
      return res.status(400).json({ error: 'Invalid prover preferences format' });
    }
    
    // Add last updated timestamp
    const data = {
      provers: preferences.provers,
      last_updated: new Date().toISOString()
    };
    
    // Get the user-specific prover preferences file path using resolveUserFilePath
    const preferencesPath = resolveUserFilePath('prover_preferences.json');
    console.log(`Saving prover preferences to: ${preferencesPath}`);
    
    // Ensure the directory exists
    const dir = path.dirname(preferencesPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
    
    // Write the preferences file
    fs.writeFileSync(preferencesPath, JSON.stringify(data, null, 2));
    
    return res.json({
      success: true,
      message: 'Prover preferences saved successfully',
      preferences: data
    });
  } catch (error) {
    console.error('Error saving prover preferences:', error);
    return res.status(500).json({
      error: 'Failed to save prover preferences: ' + error.message
    });
  }
});

// Add new endpoint for scraping prover information
router.post('/scrape-prover-info', async (req, res) => {
  logger.info('API', 'Received request to scrape prover information');
  
  try {
    // Import the prover info scraper dynamically
    const { scrapeProverInfo } = await import('../../scripts/utils/scrape_prover_info.js');
    
    // Run the scraper with headless mode enabled
    const result = await scrapeProverInfo({ headless: true });
    
    if (result && result.success) {
      logger.success('API', 'Successfully scraped prover information');
      res.json({ success: true, data: result.data });
    } else {
      throw new Error('Scraping failed or returned unexpected result');
    }
  } catch (error) {
    logger.error('API', `Error scraping prover info: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error while scraping prover information'
    });
  }
});

/**
 * Get user-specific dispenser data
 */
router.get('/dispensers', async (req, res) => {
  console.log('========== DISPENSER DATA API CALLED ==========');
  try {
    const userId = (req.session?.userId) || getActiveUser();
    console.log(`Active user ID: ${userId || 'none'}`);
    
    const filePath = resolveUserFilePath('dispenser_store.json', userId);
    console.log(`Resolved file path: ${filePath}`);
    
    // Ensure directory structure exists
    const dirPath = path.dirname(filePath);
    console.log(`Directory ${dirPath} exists: ${fs.existsSync(dirPath)}`);
    
    if (!fs.existsSync(dirPath)) {
      console.log(`Creating directory structure: ${dirPath}`);
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        fs.mkdirSync(path.join(dirPath, 'archive'), { recursive: true });
        fs.mkdirSync(path.join(dirPath, 'changes_archive'), { recursive: true });
        console.log(`Successfully created directory structure: ${dirPath}`);
      } catch (dirError) {
        console.error(`Failed to create directory structure: ${dirError.message}`);
        logger.error('API', `Failed to create directory for dispenser data: ${dirError.message}`);
        return res.status(500).json({ error: 'Failed to create directory structure for dispenser data' });
      }
    }
    
    // Check if file exists
    const fileExists = fs.existsSync(filePath);
    console.log(`File ${filePath} exists: ${fileExists}`);
    
    if (!fileExists) {
      console.log('Dispenser store file not found, creating empty data structure.');
      logger.info('API', 'Dispenser store file not found, creating empty data structure');
      
      // Create a properly structured empty file
      const emptyData = {
        dispenserData: {},
        metadata: {
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          isEmpty: true
        }
      };
      
      // Write the file
      fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
      
      return res.json(emptyData);
    }
    
    // Read data from file
    console.log('Reading dispenser store file');
    let fileContent;
    
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (readError) {
      console.error(`Error reading dispenser store file: ${readError.message}`);
      logger.error('API', `Error reading dispenser store file: ${readError.message}`);
      return res.status(500).json({ error: 'Failed to read dispenser data file' });
    }
    
    // Parse JSON data
    console.log('Parsing dispenser store data');
    let parsedData;
    
    try {
      parsedData = JSON.parse(fileContent);
    } catch (parseError) {
      console.error(`Error parsing dispenser store JSON: ${parseError.message}`);
      logger.error('API', `Error parsing dispenser store JSON: ${parseError.message}`);
      return res.status(500).json({ error: 'Failed to parse dispenser data JSON' });
    }
    
    // Validate data structure
    if (!parsedData || typeof parsedData !== 'object') {
      console.error('Invalid dispenser store data format - not an object');
      logger.error('API', 'Invalid dispenser store data format - not an object');
      return res.status(500).json({ error: 'Invalid dispenser data format' });
    }
    
    // Initialize dispenserData if it doesn't exist
    if (!parsedData.dispenserData) {
      console.log('Missing dispenserData field, initializing empty object');
      parsedData.dispenserData = {};
    }
    
    // Initialize metadata if it doesn't exist
    if (!parsedData.metadata) {
      console.log('Missing metadata field, initializing');
      parsedData.metadata = {
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Log the final structure
    const numWorkOrders = Object.keys(parsedData.dispenserData || {}).length;
    console.log(`Loaded dispenser data for ${numWorkOrders} work orders`);
    
    // Prepare response
    const responseData = {
      dispenserData: parsedData.dispenserData || {},
      metadata: parsedData.metadata || {
        lastUpdated: new Date().toISOString()
      }
    };
    
    console.log('Sending dispenser data response');
    return res.json(responseData);
  } catch (error) {
    console.error('========== ERROR LOADING DISPENSER DATA ==========');
    console.error(error);
    console.error('Stack trace:', error.stack);
    logger.error('API', `Error loading dispenser data: ${error.message}`);
    return res.status(500).json({ error: 'Failed to load dispenser data' });
  } finally {
    console.log('========== DISPENSER DATA API COMPLETED ==========');
  }
});

/**
 * Debug endpoint to check the dispenser store file
 */
router.get('/debug-dispenser-file', (req, res) => {
  try {
    const userId = (req.session?.userId) || getActiveUser();
    const filePath = resolveUserFilePath('dispenser_store.json', userId);
    const result = {
      userId,
      filePath,
      exists: false,
      stats: null,
      dirExists: false,
      dirStats: null,
      sampleContent: null,
      error: null
    };
    
    // Check if directory exists
    const dirPath = path.dirname(filePath);
    result.dirExists = fs.existsSync(dirPath);
    
    if (result.dirExists) {
      try {
        const dirStats = fs.statSync(dirPath);
        result.dirStats = {
          isDirectory: dirStats.isDirectory(),
          mode: dirStats.mode.toString(8),
          uid: dirStats.uid,
          gid: dirStats.gid,
          size: dirStats.size,
          mtime: dirStats.mtime
        };
      } catch (dirStatsError) {
        result.error = `Failed to get directory stats: ${dirStatsError.message}`;
      }
    }
    
    // Check if file exists
    result.exists = fs.existsSync(filePath);
    
    if (result.exists) {
      try {
        const stats = fs.statSync(filePath);
        result.stats = {
          size: stats.size,
          mode: stats.mode.toString(8),
          uid: stats.uid,
          gid: stats.gid,
          mtime: stats.mtime
        };
        
        // If file is not empty, get a sample of its content
        if (stats.size > 0) {
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            result.sampleContent = data.length > 200 ? 
              data.substring(0, 200) + "..." : 
              data;
              
            // Try to parse as JSON to verify it's valid
            try {
              JSON.parse(data);
              result.isValidJson = true;
            } catch (jsonError) {
              result.isValidJson = false;
              result.jsonError = jsonError.message;
              result.jsonErrorPosition = jsonError.position;
              
              // Get content around the error position
              if (jsonError.position) {
                const start = Math.max(0, jsonError.position - 50);
                const end = Math.min(data.length, jsonError.position + 50);
                result.contentAroundError = data.substring(start, end);
              }
            }
          } catch (readError) {
            result.error = `Failed to read file: ${readError.message}`;
          }
        }
      } catch (statsError) {
        result.error = `Failed to get file stats: ${statsError.message}`;
      }
    }
    
    // Create a new empty file if it doesn't exist
    if (!result.exists) {
      try {
        // Ensure directory exists
        if (!result.dirExists) {
          fs.mkdirSync(dirPath, { recursive: true });
          result.dirCreated = true;
        }
        
        // Create an empty structure
        const emptyData = {
          dispenserData: {},
          metadata: {
            lastUpdated: new Date().toISOString()
          }
        };
        
        // Write the empty file
        fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
        result.fileCreated = true;
      } catch (createError) {
        result.error = `Failed to create file: ${createError.message}`;
      }
    }
    
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: `Debug error: ${error.message}`,
      stack: error.stack
    });
  }
});

/**
 * Reset the dispenser store file to an empty valid structure
 */
router.post('/reset-dispenser-data', (req, res) => {
  try {
    const userId = (req.session?.userId) || getActiveUser();
    const filePath = resolveUserFilePath('dispenser_store.json', userId);
    
    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Create a properly structured empty file
    const emptyData = {
      dispenserData: {},
      metadata: {
        lastUpdated: new Date().toISOString(),
        reset: true
      }
    };
    
    // Write the file
    fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
    
    logger.info('API', `Reset dispenser data file for user ${userId || 'unknown'}`);
    
    return res.json({
      success: true,
      message: 'Dispenser data file has been reset successfully',
      data: emptyData
    });
  } catch (error) {
    logger.error('API', `Failed to reset dispenser data: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: `Failed to reset dispenser data: ${error.message}`
    });
  }
});

/**
 * Get the work orders data for the active user
 */
router.get('/workorders', (req, res) => {
  try {
    const activeUser = getActiveUser();
    
    if (!activeUser) {
      console.error('No active user found when trying to load workorders');
      return res.status(400).json({ 
        error: 'No active user found. Please select a user first.',
        workOrders: [] 
      });
    }
    
    console.log(`Loading workorders for active user: ${activeUser}`);
    
    // Resolve the path to the user's scraped_content.json file
    const filePath = resolveUserFilePath('scraped_content.json', activeUser);
    
    if (!filePath) {
      console.error(`Could not resolve file path for user: ${activeUser}`);
      return res.status(404).json({ 
        error: 'Could not locate work order data for this user.',
        workOrders: [] 
      });
    }
    
    if (!fs.existsSync(filePath)) {
      console.log(`No scraped_content.json found for user ${activeUser} at ${filePath}`);
      return res.json({ 
        workOrders: [],
        metadata: {
          timestamp: new Date().toISOString(),
          message: 'No work order data found. Please run a scrape first.'
        } 
      });
    }
    
    // Read and parse the file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const workOrderData = JSON.parse(fileContent);
    
    console.log(`Successfully loaded workorders for user ${activeUser}`);
    
    return res.json(workOrderData);
  } catch (error) {
    console.error('Error fetching work orders:', error);
    return res.status(500).json({ 
      error: `Failed to fetch work orders: ${error.message}`,
      workOrders: [] 
    });
  }
});

/**
 * List archive directories and their contents for debugging
 */
router.get('/archive-debug', async (req, res) => {
  try {
    // Get the active user
    const activeUserId = getActiveUser();
    if (!activeUserId) {
      return res.status(400).json({
        error: 'No active user found'
      });
    }
    
    // Define all possible archive paths
    const userDir = path.join(projectRoot, 'data', 'users', activeUserId);
    const changesArchiveDir = path.join(userDir, 'changes_archive');
    const archivesDir = path.join(userDir, 'archives');
    const globalArchiveDir = path.join(projectRoot, 'data', 'changes_archive');
    
    // Create result object
    const result = {
      activeUserId,
      paths: {
        userDir: {
          path: userDir,
          exists: fs.existsSync(userDir),
          files: []
        },
        changesArchiveDir: {
          path: changesArchiveDir,
          exists: fs.existsSync(changesArchiveDir),
          files: []
        },
        archivesDir: {
          path: archivesDir, 
          exists: fs.existsSync(archivesDir),
          files: []
        },
        globalArchiveDir: {
          path: globalArchiveDir,
          exists: fs.existsSync(globalArchiveDir),
          files: []
        }
      }
    };
    
    // Get files from each directory
    if (result.paths.userDir.exists) {
      result.paths.userDir.files = fs.readdirSync(userDir);
    }
    
    if (result.paths.changesArchiveDir.exists) {
      result.paths.changesArchiveDir.files = fs.readdirSync(changesArchiveDir);
    }
    
    if (result.paths.archivesDir.exists) {
      result.paths.archivesDir.files = fs.readdirSync(archivesDir);
    }
    
    if (result.paths.globalArchiveDir.exists) {
      result.paths.globalArchiveDir.files = fs.readdirSync(globalArchiveDir);
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Error listing archive directories:', error);
    return res.status(500).json({
      error: 'Failed to list archive directories: ' + error.message
    });
  }
});

/**
 * Convert archive files for a specific user
 */
router.post('/convert-archives/:userId?', async (req, res) => {
  // Return a response indicating this functionality has been removed
  return res.json({
    success: false,
    message: "Archive conversion functionality has been removed",
    error: "This feature is no longer available"
  });
});

/**
 * Convert archive files for all users
 */
router.post('/convert-all-archives', async (req, res) => {
  // Return a response indicating this functionality has been removed
  return res.json({
    success: false,
    message: "Archive conversion functionality has been removed",
    error: "This feature is no longer available"
  });
});

/**
 * Get the consolidated change history for the active user
 */
router.get('/change-history', (req, res) => {
  try {
    // Get the active user
    const activeUser = getActiveUser();
    
    if (!activeUser) {
      console.error('No active user found when trying to load change history');
      return res.status(400).json({ 
        error: 'No active user found. Please select a user first.',
        changes: []
      });
    }
    
    // Get the user-specific change history file path
    const historyFilePath = resolveUserFilePath('change_history.json', activeUser);
    
    // Check if the file exists
    if (!fs.existsSync(historyFilePath)) {
      console.log(`Change history file not found at: ${historyFilePath}, creating empty file`);
      // Create an empty file - no conversion needed
      fs.writeFileSync(historyFilePath, JSON.stringify([], null, 2));
      return res.json([]);
    }
    
    // Read the change history file
    const historyContent = fs.readFileSync(historyFilePath, 'utf8');
    let historyData;
    
    try {
      historyData = JSON.parse(historyContent);
      
      if (!Array.isArray(historyData)) {
        console.warn(`Change history file is not an array, converting to array: ${historyFilePath}`);
        historyData = [historyData]; // Convert to array if it's not already
      }
    } catch (parseError) {
      console.error(`Error parsing change history file: ${parseError.message}`);
      return res.status(500).json({ 
        error: 'Failed to parse change history file.',
        changes: []
      });
    }
    
    // Return the history data
    return res.json(historyData);
  } catch (error) {
    console.error('Error retrieving change history:', error);
    return res.status(500).json({
      error: 'Failed to retrieve change history: ' + error.message,
      changes: []
    });
  }
});

/**
 * Add an entry directly to the change history
 * This allows adding data without needing archive conversion
 */
router.post('/change-history/entry', (req, res) => {
  try {
    // Get the active user
    const activeUser = getActiveUser();
    
    if (!activeUser) {
      console.error('No active user found when trying to add history entry');
      return res.status(400).json({ 
        error: 'No active user found. Please select a user first.',
        success: false
      });
    }
    
    // Get the entry data from the request body
    const entry = req.body;
    
    // Validate the entry data
    if (!entry || !entry.timestamp || !entry.changes) {
      return res.status(400).json({
        error: 'Invalid entry format. Entry must contain timestamp and changes.',
        success: false
      });
    }
    
    // Get the user-specific change history file path
    const historyFilePath = resolveUserFilePath('change_history.json', activeUser);
    
    // Read existing history or create a new array
    let history = [];
    if (fs.existsSync(historyFilePath)) {
      try {
        const historyContent = fs.readFileSync(historyFilePath, 'utf8');
        history = JSON.parse(historyContent);
        
        if (!Array.isArray(history)) {
          console.warn(`Change history file is not an array, converting to array: ${historyFilePath}`);
          history = [history]; // Convert to array if it's not already
        }
      } catch (parseError) {
        console.error(`Error parsing change history file: ${parseError.message}`);
        // Continue with an empty array
      }
    }
    
    // Check if entry with the same timestamp already exists
    const existingIndex = history.findIndex(item => item.timestamp === entry.timestamp);
    if (existingIndex >= 0) {
      // Replace existing entry
      history[existingIndex] = entry;
      console.log(`Replaced existing entry with timestamp ${entry.timestamp}`);
    } else {
      // Add new entry
      history.push(entry);
      console.log(`Added new entry with timestamp ${entry.timestamp}`);
    }
    
    // Sort history by timestamp (newest first)
    history.sort((a, b) => {
      // Try to parse ISO date strings first
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateB - dateA; // newest first
      }
      
      // Fall back to string comparison
      return String(b.timestamp).localeCompare(String(a.timestamp));
    });
    
    // Write updated history back to file
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2));
    
    return res.json({
      success: true,
      message: 'History entry added successfully',
      timestamp: entry.timestamp,
      entriesCount: history.length
    });
  } catch (error) {
    console.error('Error adding history entry:', error);
    return res.status(500).json({
      error: 'Failed to add history entry: ' + error.message,
      success: false
    });
  }
});

/**
 * Helper to add a form prep automation log entry
 * @param {string} message - Log message
 * @returns {Object} Log entry
 */
const addFormPrepLog = (message) => {
  return addLogEntry('formPrep', message);
};

// Export the router
export { router, addLogEntry, scrapeJobLogs, addFormPrepLog }; 