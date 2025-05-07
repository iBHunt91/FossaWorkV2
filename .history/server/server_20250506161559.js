import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { router, addLogEntry, scrapeJobLogs } from './routes/api.js';
import { setAddLogEntryFunction } from './services/dispenserService.js';
import net from 'net';
import cron from 'node-cron';
import { analyzeScheduleChanges } from '../scripts/utils/scheduleComparator.js';
import { sendScheduleChangeNotifications } from '../scripts/notifications/notificationService.js';
import settingsRouter from './routes/settings.js';
import { runScrape } from '../scripts/unified_scrape.js';
// Import formAutomationRouter directly as an ES module
import formAutomationRouter from './routes/formAutomation.js';
import userRouter from './routes/users.js';
import { getActiveUser, getUserCredentials, listUsers, resolveUserFilePath } from './utils/userManager.js';

// Find script directory regardless of how the script is run
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - try different paths
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', 'scripts', '.env')
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`[${new Date().toLocaleTimeString()}] [INFO] Environment Configuration`);
    console.log(`  Loading environment from: ${envPath}`);
    console.log(`  Status:`);
    console.log(`  FOSSA_EMAIL:    [${process.env.FOSSA_EMAIL ? 'SET' : 'NOT SET'}]`);
    console.log(`  FOSSA_PASSWORD: [${process.env.FOSSA_PASSWORD ? 'SET' : 'NOT SET'}]`);
    console.log(`--------------------------------------------------`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn(`[${new Date().toLocaleTimeString()}] [WARN] No .env file found. Using default environment variables.`);
}

// Helper function to check if a port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => {
        // Port is in use
        resolve(true);
      })
      .once('listening', () => {
        // Port is free, close the server
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

const app = express();
const PREFERRED_PORT = parseInt(process.env.PORT || '3001', 10);
const FALLBACK_PORT = parseInt(process.env.PORT_FALLBACK || '3002', 10);

// Initialize progress tracking
let scrapeProgress = {
  status: 'idle',
  progress: 0,
  message: 'No scrape job is running',
  error: null,
  lastScraped: null
};

// Initialize the dispenser scrape job object
let dispenserScrapeJob = {
  status: 'idle',
  progress: 0,
  message: 'No dispenser scrape job is running',
  error: null,
  startTime: null
};

// Set of alternate ports to try if the preferred port is unavailable
const PORT_ALTERNATIVES = [3001, 3002, 3003, 3004, 3005];

// Find an available port function
async function findAvailablePort() {
  for (const port of PORT_ALTERNATIVES) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      console.log(`[SERVER] Found available port: ${port}`);
      return port;
    }
  }
  throw new Error('No available ports found in the alternatives list');
}

// Reset any previous in-progress jobs on server start
const forceResetJobs = () => {
  // Completely replace the scrapeProgress object to ensure clean state
  scrapeProgress = {
    status: 'idle',
    progress: 0,
    message: 'No scrape job is running',
    error: null,
    lastScraped: new Date().toISOString()
  };

  // Completely replace the dispenserScrapeJob object to ensure clean state
  dispenserScrapeJob = {
    status: 'idle',
    progress: 0,
    message: 'No dispenser scrape job is running',
    error: null,
    startTime: null
  };

  console.log('[SERVER] Force reset all job states to idle on server start');
  addLogEntry('workOrder', 'Server restarted - forced reset of job state');
  addLogEntry('dispenser', 'Server restarted - forced reset of job state');
};

// Initialize user management - set active user credentials to env vars
const initializeUserManagement = () => {
  const activeUserId = getActiveUser();
  
  if (activeUserId) {
    const credentials = getUserCredentials(activeUserId);
    
    if (credentials && credentials.email && credentials.password) {
      console.log(`[${new Date().toLocaleTimeString()}] [INFO] Setting credentials for active user: ${credentials.email}`);
      process.env.FOSSA_EMAIL = credentials.email;
      process.env.FOSSA_PASSWORD = credentials.password;
      
      // Ensure user directory structure exists
      const userDir = path.join(__dirname, '..', 'data', 'users', activeUserId);
      if (!fs.existsSync(userDir)) {
        console.log(`[${new Date().toLocaleTimeString()}] [INFO] Creating user directory structure for: ${activeUserId}`);
        fs.mkdirSync(userDir, { recursive: true });
        fs.mkdirSync(path.join(userDir, 'archive'), { recursive: true });
        fs.mkdirSync(path.join(userDir, 'changes_archive'), { recursive: true });
      }
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] [WARN] Active user found but credentials are invalid`);
    }
  } else {
    console.log(`[${new Date().toLocaleTimeString()}] [INFO] No active user found, using default credentials from .env`);
  }
};

// Initialize logs if they don't exist yet
if (!scrapeJobLogs.dispenser) {
  scrapeJobLogs.dispenser = [];
}
if (!scrapeJobLogs.workOrder) {
  scrapeJobLogs.workOrder = [];
}
if (!scrapeJobLogs.server) {
  scrapeJobLogs.server = [];
}
if (!scrapeJobLogs.formPrep) {
  scrapeJobLogs.formPrep = [];
}

// Add minimal log entries to confirm logs are working
addLogEntry('dispenser', 'Server started');
addLogEntry('workOrder', 'Server started');
addLogEntry('server', 'Server started');
addLogEntry('formPrep', 'Server started');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Routes
app.use('/api', router);
app.use('/api/settings', settingsRouter);
app.use('/api', formAutomationRouter);
app.use('/api/users', userRouter);

// Simple test route
app.get('/api/ping', (req, res) => {
  res.json({ message: 'API server is running!' });
});

// Health check endpoint - optimized for faster response
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// Last scraped endpoint
app.get('/api/last-scraped', (req, res) => {
  try {
    // Get user-specific path using resolveUserFilePath
    const outputPath = resolveUserFilePath('scraped_content.json');
    const metadataPath = resolveUserFilePath('metadata.json');
    console.log(`Checking last scraped time from user-specific file: ${outputPath}`);
    
    // First, try to read from the user-specific data file
    if (fs.existsSync(outputPath)) {
      // Try to read the timestamp from metadata
      const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      console.log('User data file exists, checking for metadata');
      
      // Check if metadata exists in the main file
      if (data.metadata && data.metadata.timestamp) {
        return res.json({ timestamp: data.metadata.timestamp });
      }
      
      // Fallback: use file modification time
      const stats = fs.statSync(outputPath);
      return res.json({ timestamp: stats.mtime.toISOString() });
    } 
    
    // If user-specific file doesn't exist, try the metadata file
    else if (fs.existsSync(metadataPath)) {
      console.log('Using user-specific metadata file');
      const metadataContent = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      if (metadataContent.metadata && metadataContent.metadata.timestamp) {
        return res.json({ timestamp: metadataContent.metadata.timestamp });
      }
      
      // Fallback: use file modification time of metadata file
      const stats = fs.statSync(metadataPath);
      return res.json({ timestamp: stats.mtime.toISOString() });
    }
    
    // No data file found for the user
    else {
      console.warn('No user-specific data files exist');
      return res.json({ timestamp: null });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to read last scraped time' });
  }
});

// Next scrape endpoint
app.get('/api/next-scrape', (req, res) => {
  try {
    console.log('Next scrape endpoint called');
    
    // Use current time for calculations
    const now = new Date();
    console.log(`Current system time: ${now.toISOString()}`);
    
    // Check if scraping is suspended
    const isSuspended = process.env.SUSPEND_HOURLY_SCRAPE === 'true';
    const suspendUntil = process.env.SUSPEND_HOURLY_SCRAPE_UNTIL;
    
    // Calculate next scrape time (next hour at minute 0)
    const nextScrape = new Date(now);
    nextScrape.setMinutes(0);
    nextScrape.setSeconds(0);
    nextScrape.setMilliseconds(0);
    nextScrape.setHours(nextScrape.getHours() + 1);
    
    console.log(`Calculated next scrape time: ${nextScrape.toISOString()}`);
    
    // Format response
    const response = {
      timestamp: nextScrape.toISOString(),
      currentTime: now.toISOString(),
      timeUntilNextScrape: `${Math.floor((nextScrape - now) / (1000 * 60))} minutes`,
      isSuspended: isSuspended
    };
    
    // Add suspension details if applicable
    if (isSuspended) {
      response.suspended = true;
      response.suspendedUntil = suspendUntil || null;
      
      if (suspendUntil) {
        const suspendDate = new Date(suspendUntil);
        if (suspendDate > now) {
          response.suspensionRemainingTime = `${Math.floor((suspendDate - now) / (1000 * 60))} minutes`;
        } else {
          // Suspension period has ended, but status hasn't been updated yet
          response.suspensionEnded = true;
        }
      } else {
        response.suspensionIndefinite = true;
      }
    }
    
    console.log('Response:', response);
    res.json(response);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to calculate next scrape time' });
  }
});

// Debug route for logs
app.get('/api/debug/logs', (req, res) => {
  res.json({
    dispenser: scrapeJobLogs.dispenser.length,
    workOrder: scrapeJobLogs.workOrder.length,
    samples: {
      dispenser: scrapeJobLogs.dispenser.slice(0, 3),
      workOrder: scrapeJobLogs.workOrder.slice(0, 3)
    }
  });
});

// Share job objects with API router
router.scrapeProgress = scrapeProgress;
router.dispenserScrapeJob = dispenserScrapeJob;

// Force reset any "stuck" jobs before starting
forceResetJobs();

// Initialize user management
initializeUserManagement();

// Connect the circular dependency
setAddLogEntryFunction(addLogEntry);
console.log('Dispenser service connected with addLogEntry function');

// Function to run scrape for all users sequentially
async function runScrapeForAllUsers() {
  console.log(`[${new Date().toLocaleTimeString()}] Starting multi-user work order scrape...`);
  addLogEntry('workOrder', 'Starting multi-user work order scrape');
  
  // Get all users
  const users = listUsers();
  
  if (users.length === 0) {
    console.log(`[${new Date().toLocaleTimeString()}] No users found, skipping scrape`);
    addLogEntry('workOrder', 'No users found, skipping scrape');
    return;
  }
  
  console.log(`[${new Date().toLocaleTimeString()}] Found ${users.length} users to process`);
  
  // Remember original active user to restore later
  const originalActiveUserId = getActiveUser();
  
  // Process each user sequentially
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`[${new Date().toLocaleTimeString()}] Processing user ${i+1}/${users.length}: ${user.label || user.email}`);
    addLogEntry('workOrder', `Processing user: ${user.label || user.email} (${i+1}/${users.length})`);
    
    // Set this user as active temporarily
    process.env.FOSSA_EMAIL = user.email;
    process.env.FOSSA_PASSWORD = user.password;
    
    // Run scrape for this user
    try {
      await runScrape({
        isManual: false,
        userId: user.id,
        progressCallback: (progress, message) => {
          console.log(`[${new Date().toLocaleTimeString()}] [User: ${user.label || user.email}] Scrape progress: ${progress}% - ${message}`);
          
          // If scraping is complete, analyze schedule changes
          if (progress === 100 && (message.includes('complete') || message.includes('success'))) {
            console.log(`[${new Date().toLocaleTimeString()}] [User: ${user.label || user.email}] Work order scrape completed successfully`);
            scrapeProgress.lastScraped = new Date().toISOString();
            addLogEntry('workOrder', `User ${user.label || user.email}: Scrape completed successfully`);
            
            // Analyze schedule changes after successful scrape
            console.log(`[${new Date().toLocaleTimeString()}] [User: ${user.label || user.email}] Analyzing schedule changes...`);
            addLogEntry('workOrder', `User ${user.label || user.email}: Analyzing schedule changes...`);
            
            // Schedule change analysis happens inside runScrape, we don't need to call it again
          }
        }
      });
      
      console.log(`[${new Date().toLocaleTimeString()}] Completed scrape for user: ${user.label || user.email}`);
      addLogEntry('workOrder', `Completed scrape for user: ${user.label || user.email}`);
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error scraping for user ${user.label || user.email}:`, error);
      addLogEntry('workOrder', `Error scraping for user ${user.label || user.email}: ${error.message}`);
    }
  }
  
  // Restore original active user
  if (originalActiveUserId) {
    const originalUserCredentials = getUserCredentials(originalActiveUserId);
    if (originalUserCredentials) {
      process.env.FOSSA_EMAIL = originalUserCredentials.email;
      process.env.FOSSA_PASSWORD = originalUserCredentials.password;
      console.log(`[${new Date().toLocaleTimeString()}] Restored original active user credentials`);
    }
  }
  
  console.log(`[${new Date().toLocaleTimeString()}] Multi-user work order scrape completed`);
  addLogEntry('workOrder', 'Multi-user work order scrape completed');
}

// Set up hourly scraping job
try {
  // Schedule work order scraping to run every hour at minute 0
  cron.schedule('0 * * * *', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Checking hourly work order scrape status...`);
    
    // Check if scraping is suspended
    const isSuspended = process.env.SUSPEND_HOURLY_SCRAPE === 'true';
    const suspendUntil = process.env.SUSPEND_HOURLY_SCRAPE_UNTIL;
    
    if (isSuspended) {
      // If suspendUntil is set and that time has passed, resume scraping automatically
      if (suspendUntil && new Date(suspendUntil) < new Date()) {
        console.log(`[${new Date().toLocaleTimeString()}] Suspension period has ended, resuming hourly scraping`);
        process.env.SUSPEND_HOURLY_SCRAPE = 'false';
        
        // Update the .env file as well
        try {
          const envPath = path.join(__dirname, '..', '.env');
          let envContent = fs.readFileSync(envPath, 'utf8');
          envContent = envContent.replace(/SUSPEND_HOURLY_SCRAPE=.*/g, 'SUSPEND_HOURLY_SCRAPE=false');
          fs.writeFileSync(envPath, envContent, 'utf8');
        } catch (error) {
          console.error(`[${new Date().toLocaleTimeString()}] Error updating .env file:`, error);
        }
      } else {
        // Skip this scrape
        const reason = suspendUntil 
          ? `until ${new Date(suspendUntil).toLocaleString()}`
          : 'indefinitely';
        console.log(`[${new Date().toLocaleTimeString()}] Skipping hourly work order scrape (suspended ${reason})`);
        addLogEntry('workOrder', `Skipping scheduled hourly scrape (suspended ${reason})`);
        return;
      }
    }
    
    console.log(`[${new Date().toLocaleTimeString()}] Starting hourly work order scrape for all users...`);
    
    // Use the multi-user scrape function instead of the single-user one
    runScrapeForAllUsers().catch(error => {
      console.error(`[${new Date().toLocaleTimeString()}] Hourly multi-user work order scrape failed:`, error);
      addLogEntry('workOrder', `Scheduled hourly multi-user scrape failed: ${error.message}`);
    });
  });
  
  console.log(`[${new Date().toLocaleTimeString()}] Hourly work order scraping job scheduled`);
  addLogEntry('workOrder', 'Hourly work order scraping job scheduled');
} catch (error) {
  console.error(`[${new Date().toLocaleTimeString()}] Error setting up hourly scraping job:`, error);
  addLogEntry('workOrder', `Error setting up hourly scraping job: ${error.message}`);
}

// Add a function to verify dispenser data integrity
function verifyDispenserDataIntegrity() {
  try {
    const dataPath = path.resolve(__dirname, '..', 'data', 'scraped_content.json');
    if (!fs.existsSync(dataPath)) {
      console.error('Data file not found at:', dataPath);
      return false;
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (!data.workOrders || !Array.isArray(data.workOrders)) {
      console.error('Invalid data structure: workOrders array not found');
      return false;
    }
    
    // Check for dispenser data
    const jobsWithDispensers = data.workOrders.filter(job => job.dispensers && Array.isArray(job.dispensers) && job.dispensers.length > 0);
    console.log(`[Data Verification] Found ${jobsWithDispensers.length} of ${data.workOrders.length} jobs with dispenser data`);
    
    if (jobsWithDispensers.length > 0) {
      const sampleJob = jobsWithDispensers[0];
      console.log(`[Data Verification] Sample job ${sampleJob.id} has ${sampleJob.dispensers.length} dispensers`);
      console.log(`[Data Verification] First dispenser sample: ${JSON.stringify(sampleJob.dispensers[0]).substring(0, 200)}...`);
    } else {
      console.warn('[Data Verification] No jobs with dispenser data found');
    }
    
    return jobsWithDispensers.length > 0;
  } catch (error) {
    console.error('[Data Verification] Error verifying dispenser data:', error);
    return false;
  }
}

// Run data verification on startup
const dataVerificationResult = verifyDispenserDataIntegrity();
console.log(`[Data Verification] Dispenser data verification result: ${dataVerificationResult ? 'PASS' : 'FAIL'}`);

// Start the server with port fallback - updated with new findAvailablePort function
async function startServer() {
  try {
    // Try to find an available port
    const port = await findAvailablePort();
    
    // Start server on the available port
    app.listen(port, '0.0.0.0', () => {
      console.log(`[SERVER] Running on port ${port}`);
      
      // Update environment variables and Vite config if needed
      process.env.SERVER_PORT = port.toString();
      
      // Log successful server start
      addLogEntry('workOrder', `Server started on port ${port}`);
    });
  } catch (error) {
    console.error('[SERVER] Failed to start server:', error);
    
    // If all else fails, let the system assign a random available port
    app.listen(0, '0.0.0.0', () => {
      const address = app.address();
      console.log(`[SERVER] Running on port ${address.port} (auto-assigned)`);
      process.env.SERVER_PORT = address.port.toString();
    });
  }
}

startServer();