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
import { checkAndSendScheduledDigests } from '../scripts/notifications/notificationScheduler.js';
import settingsRouter from './routes/settings.js';
import { runScrape } from '../scripts/unified_scrape.js';
// Import formAutomationRouter directly as an ES module
import formAutomationRouter from './routes/formAutomation.js';
import userRouter from './routes/users.js';
import circleKRouter from './routes/circleK.js';
import { getActiveUser, getUserCredentials, listUsers, resolveUserFilePath } from './utils/userManager.js';
import { debug, info, warn, error, success } from './utils/logger.js';
import { requestLogger, errorHandler, notFoundHandler, sanitizeRequest } from './utils/middlewares.js';
import { maskSensitiveEnv } from './utils/security.js';
import { EventEmitter } from 'events';

// Find script directory regardless of how the script is run
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - try different paths, but skip sensitive credentials
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', 'scripts', '.env')
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    // Load the entire file content
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    
    // Filter out sensitive credentials before loading into process.env
    const safeEnvConfig = { ...envConfig };
    delete safeEnvConfig.FOSSA_EMAIL;
    delete safeEnvConfig.FOSSA_PASSWORD;
    
    // Manually set non-sensitive environment variables
    Object.entries(safeEnvConfig).forEach(([key, value]) => {
      process.env[key] = value;
    });
    
    info(`Environment Configuration`, 'SERVER');
    info(`Loading environment from: ${envPath}`, 'SERVER');
    info(`--------------------------------------------------`, 'SERVER');
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  warn(`No .env file found. Using default environment variables.`, 'SERVER');
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

// Set environment variables
process.env.IS_SERVER_PROCESS = 'true';
process.env.SERVER_HANDLES_NOTIFICATIONS = 'true'; // Explicitly set server to handle notifications

// Initialize Express
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
async function findAvailablePort(preferredPort = null) {
  // If a preferred port is specified, try it first
  if (preferredPort) {
    const inUse = await isPortInUse(preferredPort);
    if (!inUse) {
      info(`Using preferred port: ${preferredPort}`, 'SERVER');
      return preferredPort;
    }
    info(`Preferred port ${preferredPort} is in use, trying alternatives`, 'SERVER');
  }
  
  // Try the alternatives
  for (const port of PORT_ALTERNATIVES) {
    // Skip the preferred port if we already tried it
    if (port === preferredPort) continue;
    
    const inUse = await isPortInUse(port);
    if (!inUse) {
      info(`Found available port: ${port}`, 'SERVER');
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

  info('Force reset all job states to idle on server start', 'SERVER');
  addLogEntry('workOrder', 'Server restarted - forced reset of job state');
  addLogEntry('dispenser', 'Server restarted - forced reset of job state');
};

// Initialize user management - set active user credentials to env vars
const initializeUserManagement = () => {
  const activeUserId = getActiveUser();
  
  if (activeUserId) {
    const credentials = getUserCredentials(activeUserId);
    
    if (credentials && credentials.email && credentials.password) {
      info(`Setting credentials for active user: ${credentials.email}`, 'USER');
      process.env.FOSSA_EMAIL = credentials.email;
      process.env.FOSSA_PASSWORD = credentials.password;
      
      // Ensure user directory structure exists
      const userDir = path.join(__dirname, '..', 'data', 'users', activeUserId);
      if (!fs.existsSync(userDir)) {
        info(`Creating user directory structure for: ${activeUserId}`, 'USER');
        fs.mkdirSync(userDir, { recursive: true });
        fs.mkdirSync(path.join(userDir, 'archive'), { recursive: true });
        fs.mkdirSync(path.join(userDir, 'changes_archive'), { recursive: true });
      }
    } else {
      warn(`Active user found but credentials are invalid`, 'USER');
    }
  } else {
    info(`No active user found, using default credentials from .env`, 'USER');
  }
};

// Initialize logs if they don't exist yet
if (!scrapeJobLogs.dispenser) {
  scrapeJobLogs.dispenser = [];
}
if (!scrapeJobLogs.workOrder) {
  scrapeJobLogs.workOrder = [];
}

// Add some initial log entries to confirm logs are working
addLogEntry('dispenser', 'Server started - Dispenser logging initialized');
addLogEntry('workOrder', 'Server started - Work order logging initialized');
info('Log entries initialized:', 'SERVER');
debug(`Dispenser logs: ${scrapeJobLogs.dispenser.length}, Work order logs: ${scrapeJobLogs.workOrder.length}`, 'LOGS');

// Middleware
app.use(cors());
app.use(express.json());
app.use(sanitizeRequest); // Add sanitization middleware
app.use(requestLogger); // Add request logging middleware
app.use(express.static(path.join(__dirname, '../client/dist')));

// Routes
app.use('/api', router);
app.use('/api/settings', settingsRouter);
app.use('/api', formAutomationRouter);
app.use('/api/users', userRouter);
app.use('/api/circle-k', circleKRouter);

// Simple test route
app.get('/api/ping', (req, res) => {
  res.json({ message: 'API server is running!' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Server is running'
  });
});

// Last scraped endpoint
app.get('/api/last-scraped', (req, res) => {
  try {
    // Get user-specific path using resolveUserFilePath
    const outputPath = resolveUserFilePath('scraped_content.json');
    const metadataPath = resolveUserFilePath('metadata.json');
    debug(`Checking last scraped time from user-specific file: ${outputPath}`, 'API');
    
    // First, try to read from the user-specific data file
    if (fs.existsSync(outputPath)) {
      // Try to read the timestamp from metadata
      const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      debug('User data file exists, checking for metadata', 'API');
      
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
      debug('Using user-specific metadata file', 'API');
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
      warn('No user-specific data files exist', 'API');
      return res.json({ timestamp: null });
    }
  } catch (err) {
    error(`Failed to read last scraped time: ${err.message}`, 'API');
    res.status(500).json({ error: 'Failed to read last scraped time' });
  }
});

// Next scrape endpoint
app.get('/api/next-scrape', (req, res) => {
  try {
    debug('Next scrape endpoint called', 'API');
    // Calculate next scrape time based on current time
    const now = new Date();
    debug(`Current system time: ${now.toISOString()}`, 'API');
    
    // Default: scrape at the top of each hour
    const nextScrape = new Date(now);
    
    // Reset minutes, seconds, milliseconds to target the next hour
    nextScrape.setMinutes(0);
    nextScrape.setSeconds(0);
    nextScrape.setMilliseconds(0);
    nextScrape.setHours(nextScrape.getHours() + 1);
    
    // If there's a scheduled scrape cron job, calculate based on that instead
    if (process.env.SCRAPE_SCHEDULE) {
      // Parse the cron schedule to calculate next run time
      // This would require a cron parser library to do properly
      // For now, we'll just return the default next hour calculation
    }
    
    info(`Calculated next scrape time: ${nextScrape.toISOString()}`, 'SCHEDULER');
    
    // Ensure we use timestamp as the primary field, but keep nextScrape for backward compatibility
    res.json({ 
      timestamp: nextScrape.toISOString(),
      nextScrape: nextScrape.toISOString(), // Keep for backward compatibility
      message: `Next automatic scrape scheduled for ${nextScrape.toLocaleTimeString()}`
    });
  } catch (err) {
    error(`Failed to calculate next scrape time: ${err.message}`, 'API');
    res.status(500).json({ error: 'Failed to calculate next scrape time' });
  }
});

// Force scrape endpoint
app.post('/api/force-scrape', async (req, res) => {
  try {
    // Check if a scrape is already in progress
    if (scrapeProgress.status === 'running') {
      return res.status(409).json({ 
        error: 'A scrape job is already in progress',
        status: scrapeProgress.status,
        progress: scrapeProgress.progress,
        message: scrapeProgress.message
      });
    }
    
    // Reset the progress object
    scrapeProgress = {
      status: 'running',
      progress: 0,
      message: 'Starting work order scrape...',
      error: null,
      lastScraped: null
    };
    
    // Start scraping
    try {
      // Trigger the unified scrape script
      const response = await runScrape({
        onProgress: (progress, message) => {
          scrapeProgress.progress = progress;
          scrapeProgress.message = message;
          addLogEntry('workOrder', message);
        }
      });
      
      debug('Response:', JSON.stringify(response));
      
      // Update progress to complete
      scrapeProgress.status = 'success';
      scrapeProgress.progress = 100;
      scrapeProgress.message = 'Work order scrape completed successfully';
      scrapeProgress.lastScraped = new Date().toISOString();
      
      // Return success
      res.json({ 
        status: 'success',
        message: 'Work order scrape completed successfully',
        timestamp: scrapeProgress.lastScraped
      });
      
      // Analyze schedule changes - this happens in the background
      setTimeout(async () => {
        try {
          info('Fetching completed jobs before analyzing schedule changes...', 'SCHEDULER');
          const { default: scrapeCompletedJobs } = await import('../scripts/scrapers/completedJobsScrape.js');
          
          // Scrape completed jobs for this user
          await scrapeCompletedJobs({
            isManual: false,
            userId: getActiveUser(),
            progressCallback: (progress, message) => {
              info(`Completed jobs scrape progress: ${progress}% - ${message}`, 'SCHEDULER');
            }
          });
          
          info('Analyzing schedule changes...', 'SCHEDULER');
          const changes = await analyzeScheduleChanges();
          if (changes && changes.length > 0) {
            info(`Found ${changes.length} schedule changes, sending notifications...`, 'SCHEDULER');
            await sendScheduleChangeNotifications(changes);
          } else {
            info('No schedule changes detected', 'SCHEDULER');
          }
        } catch (err) {
          error(`Failed to analyze schedule changes: ${err.message}`, 'SCHEDULER');
        }
      }, 1000);
      
    } catch (err) {
      error(`Scrape failed: ${err.message}`, 'SCRAPER');
      scrapeProgress.status = 'error';
      scrapeProgress.error = err.message;
      scrapeProgress.message = `Error during scrape: ${err.message}`;
      
      res.status(500).json({ 
        error: 'Failed to complete work order scrape',
        message: err.message
      });
    }
  } catch (err) {
    error(`Force scrape API error: ${err.message}`, 'API');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Connect dispenser service with log function
setAddLogEntryFunction(addLogEntry);
info('Dispenser service connected with addLogEntry function', 'SERVER');

// Function to run scrape for all users
async function runScrapeForAllUsers() {
  info('Starting multi-user work order scrape...', 'SCHEDULER');
  
  // Get the active user before we start
  const originalActiveUser = getActiveUser();
  const originalCredentials = originalActiveUser ? getUserCredentials(originalActiveUser) : null;
  
  // Get all users
  const users = listUsers();
  
  if (!users || users.length === 0) {
    warn('No users found, skipping scrape', 'SCHEDULER');
    return;
  }
  
  info(`Found ${users.length} users to process`, 'SCHEDULER');
  
  // Process each user in sequence
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    try {
      // Set this user as active to use their credentials
      if (user.id) {
        info(`Processing user ${i+1}/${users.length}: ${user.label || user.email}`, 'SCHEDULER');
        
        // Skip users without valid credentials
        if (!user.email || !user.password) {
          warn(`User ${user.label || user.id} has missing credentials, skipping`, 'SCHEDULER');
          continue;
        }
        
        // Set as active user to use their credentials
        process.env.FOSSA_EMAIL = user.email;
        process.env.FOSSA_PASSWORD = user.password;
        
        // Run scrape for this user
        await runScrape({
          userId: user.id,
          onProgress: (progress, message) => {
            info(`[User: ${user.label || user.email}] Scrape progress: ${progress}% - ${message}`, 'SCHEDULER');
          }
        });
        
        info(`[User: ${user.label || user.email}] Work order scrape completed successfully`, 'SCHEDULER');
        
        // Analyze schedule changes for this user
        try {
          info(`[User: ${user.label || user.email}] Analyzing schedule changes...`, 'SCHEDULER');
          const changes = await analyzeScheduleChanges(user.id);
          if (changes && changes.length > 0) {
            await sendScheduleChangeNotifications(changes, user.id);
          }
        } catch (analyzeErr) {
          error(`Failed to analyze schedule changes for user ${user.label || user.email}: ${analyzeErr.message}`, 'SCHEDULER');
        }
        
        info(`Completed scrape for user: ${user.label || user.email}`, 'SCHEDULER');
      }
    } catch (userErr) {
      error(`Failed to process user ${user.label || user.id}: ${userErr.message}`, 'SCHEDULER');
    }
  }
  
  // Restore original user credentials
  if (originalActiveUser && originalCredentials) {
    process.env.FOSSA_EMAIL = originalCredentials.email;
    process.env.FOSSA_PASSWORD = originalCredentials.password;
    info('Restored original active user credentials', 'SCHEDULER');
  }
  
  info('Multi-user work order scrape completed', 'SCHEDULER');
}

// Set up CRON job to trigger scraping on a schedule
// Default: Every hour at minute 0
const setupHourlyScrapeSchedule = () => {
  if (process.env.DISABLE_SERVER_SCRAPING === 'true') {
    info('Server scraping is disabled, skipping hourly work order scrape', 'SCHEDULER');
    return;
  }
  
  // Setup check for suspension first to run every hour
  cron.schedule('0 * * * *', async () => {
    info('Checking hourly work order scrape status...', 'SCHEDULER');
    
    // Check for suspension and see if suspension period has ended
    const suspendUntil = process.env.SUSPEND_SCRAPING_UNTIL ? new Date(process.env.SUSPEND_SCRAPING_UNTIL) : null;
    const suspendReason = process.env.SUSPEND_SCRAPING_REASON || 'by admin request';
    
    // If suspension has a date and it's in the past, remove suspension
    if (suspendUntil && suspendUntil < new Date()) {
      info('Suspension period has ended, resuming hourly scraping', 'SCHEDULER');
      delete process.env.SUSPEND_SCRAPING_UNTIL;
      delete process.env.SUSPEND_SCRAPING_REASON;
    }
    
    // If we're suspended, log but don't run
    if (process.env.SUSPEND_SCRAPING_UNTIL) {
      // Format the suspension date for logging
      const formattedDate = new Date(process.env.SUSPEND_SCRAPING_UNTIL).toLocaleString();
      warn(`Skipping hourly work order scrape (suspended ${suspendReason} until ${formattedDate})`, 'SCHEDULER');
      return;
    }
    
    // Not suspended, proceed with hourly scrape
    info('Starting hourly work order scrape for all users...', 'SCHEDULER');
    await runScrapeForAllUsers();
  });
  
  info('Hourly work order scraping job scheduled', 'SCHEDULER');
};

// Set up CRON job to check and send daily digest notifications
const setupDigestNotificationSchedule = () => {
  // Run every 5 minutes to check if any user has a digest due for delivery
  cron.schedule('*/5 * * * *', async () => {
    info('Checking for scheduled digest notifications...', 'SCHEDULER');
    try {
      const result = await checkAndSendScheduledDigests();
      if (result.processed > 0) {
        info(`Sent ${result.processed} digest notifications`, 'SCHEDULER');
      } else {
        debug('No digest notifications were due for delivery', 'SCHEDULER');
      }
    } catch (error) {
      error(`Error checking digest notifications: ${error.message}`, 'SCHEDULER');
    }
  });
  
  info('Digest notification check scheduled (every 5 minutes)', 'SCHEDULER');
};

// Verify dispenser data integrity function
function verifyDispenserDataIntegrity() {
  try {
    // Get user-specific path
    const outputPath = resolveUserFilePath('scraped_content.json');
    
    // Check if file exists
    if (!fs.existsSync(outputPath)) {
      warn('No data file found for verification', 'VERIFY');
      return false;
    }
    
    // Read data file
    const rawData = fs.readFileSync(outputPath, 'utf8');
    const data = JSON.parse(rawData);
    
    // Check if work orders exist
    if (!data.workOrders || data.workOrders.length === 0) {
      warn('No work orders found in data file', 'VERIFY');
      return false;
    }
    
    // Check if any jobs have dispenser data
    const jobsWithDispensers = data.workOrders.filter(job => job.dispensers && job.dispensers.length > 0);
    info(`[Data Verification] Found ${jobsWithDispensers.length} of ${data.workOrders.length} jobs with dispenser data`, 'VERIFY');
    
    // Sample a dispenser to check data structure
    if (jobsWithDispensers.length > 0) {
      const sampleJob = jobsWithDispensers[0];
      info(`[Data Verification] Sample job ${sampleJob.id} has ${sampleJob.dispensers.length} dispensers`, 'VERIFY');
      info(`[Data Verification] First dispenser sample: ${JSON.stringify(sampleJob.dispensers[0]).substring(0, 200)}...`, 'VERIFY');
      return true;
    }
    
    return false;
  } catch (err) {
    error(`Data integrity verification error: ${err.message}`, 'VERIFY');
    return false;
  }
}

// Define loadUserEnvironment function
const loadUserEnvironment = (userId = null) => {
  try {
    const envVars = getUserCredentials(userId || getActiveUser());
    
    if (envVars) {
      // Log masked environment variables
      const maskedEnv = maskSensitiveEnv(envVars);
      debug('Loading user environment variables:', 'SERVER');
      debug(JSON.stringify(maskedEnv, null, 2), 'SERVER');
      
      // Set the environment variables
      Object.assign(process.env, envVars);
    } else {
      warn('No environment variables found for user', 'SERVER');
    }
  } catch (err) {
    error('Failed to load user environment variables', 'SERVER', err);
  }
};

// Create cleanup function to handle application shutdown
const cleanup = () => {
  info('Cleaning up server resources before exit', 'SERVER');
  if (server) {
    server.close(() => {
      info('Server closed successfully', 'SERVER');
    });
  }
};

// Error handling middleware (must be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Define important global variables
let port = parseInt(process.env.PORT || '3001', 10);
let server = null;
let dispStatus = false;
const dataDir = path.join(__dirname, '..', 'data');
const eventEmitter = new EventEmitter();

// Start the server
async function startServer() {
  try {
    console.log('Starting server...');
    info('Starting server...', 'SERVER');
    
    // Load environment variables for the active user
    try {
      loadUserEnvironment();
    } catch (envErr) {
      console.error('Error loading user environment:', envErr);
      error('Error loading user environment:', 'SERVER', envErr);
    }
    
    // Force reset the jobs on server start
    try {
      forceResetJobs();
    } catch (resetErr) {
      console.error('Error resetting jobs:', resetErr);
      error('Error resetting jobs:', 'SERVER', resetErr);
    }
    
    // Initialize user management
    try {
      initializeUserManagement();
    } catch (userErr) {
      console.error('Error initializing user management:', userErr);
      error('Error initializing user management:', 'SERVER', userErr);
    }
    
    // Verify dispenser data integrity
    try {
      verifyDispenserDataIntegrity();
    } catch (dataErr) {
      console.error('Error verifying dispenser data integrity:', dataErr);
      error('Error verifying dispenser data integrity', 'SERVER', dataErr);
    }
    
    try {
      // Log crucial information (make sure to use the masked version)
      debug(`Server configuration:`, 'SERVER');
      const configSnapshot = {
        PREFERRED_PORT,
        NODE_ENV: process.env.NODE_ENV,
        DATA_DIR: dataDir,
        LOG_LEVEL: process.env.LOG_LEVEL,
      };
      debug(JSON.stringify(configSnapshot, null, 2), 'SERVER');
      
      // Find available port - try PREFERRED_PORT first
      console.log(`Attempting to find available port starting with ${PREFERRED_PORT}`);
      port = await findAvailablePort(PREFERRED_PORT);
      console.log(`Using port: ${port}`);
      
      // Create server
      console.log('Creating server...');
      server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        success(`Server running on port ${port}`, 'SERVER');
        
        // Emit server ready event
        try {
          eventEmitter.emit('server-ready', { port });
        } catch (eventErr) {
          console.error('Error emitting server-ready event:', eventErr);
        }
      });
      
      // Add error handler for server
      server.on('error', (serverErr) => {
        console.error('Server error:', serverErr.message);
        error(`Server error: ${serverErr.message}`, 'SERVER', serverErr);
        
        if (serverErr.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use. Please try another port.`);
        }
      });
      
      // Set up dispenser service and pass the addLogEntry function
      dispStatus = true;
      
      try {
        setAddLogEntryFunction(addLogEntry);
        success('Dispenser service connected with addLogEntry function', 'SERVER');
      } catch (serviceErr) {
        console.error('Failed to connect dispenser service with addLogEntry:', serviceErr);
        error('Failed to connect dispenser service with addLogEntry', 'SERVER', serviceErr);
      }
      
      // Set up hourly scrape schedule
      try {
        setupHourlyScrapeSchedule();
      } catch (scheduleErr) {
        console.error('Error setting up scrape schedule:', scheduleErr);
        error('Error setting up scrape schedule:', 'SERVER', scheduleErr);
      }
      
      // Set up digest notification schedule
      try {
        setupDigestNotificationSchedule();
      } catch (digestErr) {
        console.error('Error setting up digest notification schedule:', digestErr);
        error('Error setting up digest notification schedule:', 'SERVER', digestErr);
      }
      
      // Set up cleanup on app exit
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('exit', cleanup);
      
      return { port, server };
    } catch (err) {
      console.error('Failed to start server:', err.message);
      error('Failed to start server', 'SERVER', err);
      process.exit(1);
    }
  } catch (outerErr) {
    console.error('Critical server startup error:', outerErr);
    error('Critical server startup error', 'SERVER', outerErr);
    process.exit(1);
  }
}

// Start the server
startServer();