import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { runScrape } from './scripts/unified_scrape.js';
import cron from 'node-cron';
import { analyzeScheduleChanges } from './scripts/utils/scheduleComparator.js';
import { sendScheduleChangeEmail } from './scripts/email/emailService.js';
import { spawn } from 'child_process';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Store running script processes
const runningScripts = new Map();

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  console.log('Creating data directory:', dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
}

// Scrape progress tracking
let scrapeProgress = {
  status: 'idle', // idle, running, completed, error
  progress: 0,
  message: '',
  error: null,
  lastScraped: null // Add timestamp tracking
};

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Add these new routes after the existing /api/status endpoint

/**
 * Dispenser scraping endpoint
 */
app.post('/api/dispenser-scrape', async (req, res) => {
  try {
    if (dispenserScrapeJob.status === 'running') {
      return res.status(400).json({
        error: 'A dispenser scrape job is already running. Please wait for it to complete.'
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

    // Run the dispenser scrape script asynchronously
    runDispenserScrape();

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
    return res.status(500).json({
      error: 'Failed to start dispenser scrape job: ' + error.message
    });
  }
});

/**
 * Dispenser scrape status endpoint
 */
app.get('/api/dispenser-status', (req, res) => {
  return res.json(dispenserScrapeJob);
});

// Initialize the dispenser scrape job object
let dispenserScrapeJob = {
  status: 'idle',
  progress: 0,
  message: 'No dispenser scrape job is running',
  error: null,
  startTime: null
};

/**
 * Run the dispenser scrape script
 */
async function runDispenserScrape() {
  try {
    // Execute the dispenser scrape script
    const process = spawn('node', ['scripts/dispenserScrape.js'], {
      env: { ...global.process.env, NODE_ENV: 'production' }
    });
    
    // Update progress as the process runs
    process.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Dispenser scrape output: ${output}`);
      
      // Update progress based on output
      if (output.includes('Starting dispenser information scrape')) {
        dispenserScrapeJob.progress = 10;
        dispenserScrapeJob.message = 'Starting dispenser scrape...';
      } else if (output.includes('Successfully logged in to Fossa')) {
        dispenserScrapeJob.progress = 20;
        dispenserScrapeJob.message = 'Logged in to Fossa, preparing to scrape dispensers...';
      } else if (output.includes('Found work orders to process')) {
        const match = output.match(/Found (\d+) work orders/);
        if (match) {
          dispenserScrapeJob.progress = 30;
          dispenserScrapeJob.message = `Found ${match[1]} work orders to process`;
        }
      } else if (output.includes('Processing work order:')) {
        // Extract progress from work order processing
        const match = output.match(/\[(\d+)\/(\d+)\] Processing work order/);
        if (match) {
          const current = parseInt(match[1]);
          const total = parseInt(match[2]);
          const progress = Math.floor(30 + (current / total) * 60); // 30-90% progress range
          dispenserScrapeJob.progress = progress;
          dispenserScrapeJob.message = `Processing work order ${current} of ${total}`;
        }
      } else if (output.includes('SCRAPING COMPLETE')) {
        dispenserScrapeJob.progress = 95;
        dispenserScrapeJob.message = 'Scraping complete, finalizing...';
      }
    });
    
    // Handle errors
    process.stderr.on('data', (data) => {
      console.error(`Dispenser scrape error: ${data}`);
      if (dispenserScrapeJob.status === 'running') {
        dispenserScrapeJob.message = `Error: ${data.toString().trim()}`;
      }
    });
    
    // Handle completion
    process.on('close', (code) => {
      if (code === 0) {
        dispenserScrapeJob.status = 'completed';
        dispenserScrapeJob.progress = 100;
        dispenserScrapeJob.message = 'Dispenser scraping completed successfully!';
      } else {
        dispenserScrapeJob.status = 'error';
        dispenserScrapeJob.error = `Process exited with code ${code}`;
        dispenserScrapeJob.message = `Failed to complete dispenser scraping (exit code ${code})`;
      }
      logRuntime(dispenserScrapeJob);
    });
  } catch (error) {
    console.error('Error running dispenser scrape:', error);
    dispenserScrapeJob.status = 'error';
    dispenserScrapeJob.error = error.message;
    dispenserScrapeJob.message = 'Error running dispenser scrape: ' + error.message;
    logRuntime(dispenserScrapeJob);
  }
}

/**
 * Log the runtime of a scrape job
 */
function logRuntime(job) {
  if (job.startTime) {
    const endTime = new Date();
    const runtime = Math.round((endTime - job.startTime) / 1000);
    console.log(`Job ${job.status} in ${runtime} seconds`);
  }
}

// API endpoints
app.get('/api/status', (req, res) => {
  console.log('Status endpoint called, current state:', {
    status: scrapeProgress.status,
    progress: scrapeProgress.progress,
    message: scrapeProgress.message,
    lastScraped: scrapeProgress.lastScraped
  });
  res.json(scrapeProgress);
});

app.get('/api/last-scraped', (req, res) => {
  try {
    const outputPath = path.join(__dirname, 'data', 'scraped_content.json');
    console.log('Checking last scraped time from file:', outputPath);
    if (fs.existsSync(outputPath)) {
      const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      console.log('File exists, metadata:', data.metadata);
      res.json({ timestamp: data.metadata.timestamp });
    } else {
      console.log('File does not exist');
      res.json({ timestamp: null });
    }
  } catch (error) {
    console.error('Error reading last scraped time:', error);
    res.status(500).json({ error: 'Failed to read last scraped time' });
  }
});

app.get('/api/next-scrape', (req, res) => {
  try {
    const outputPath = path.join(__dirname, 'data', 'scraped_content.json');
    console.log('Checking next scrape time from file:', outputPath);
    
    // Always use current time for calculations
    const now = new Date();
    console.log('Current system time:', now.toISOString());
    
    // Calculate next scrape time (next hour at minute 0)
    const nextScrape = new Date(now);
    nextScrape.setMinutes(0);
    nextScrape.setSeconds(0);
    nextScrape.setMilliseconds(0);
    nextScrape.setHours(nextScrape.getHours() + 1);
    
    console.log('Calculated next scrape time:', nextScrape.toISOString());
    
    // Format the response in a more readable way
    const response = {
      timestamp: nextScrape.toISOString(),
      currentTime: now.toISOString(),
      timeUntilNextScrape: `${Math.floor((nextScrape - now) / (1000 * 60))} minutes`
    };
    
    console.log('Response:', response);
    res.json(response);
  } catch (error) {
    console.error('Error calculating next scrape time:', error);
    res.status(500).json({ error: 'Failed to calculate next scrape time' });
  }
});

app.post('/api/scrape', async (req, res) => {
  // Check if already running
  if (scrapeProgress.status === 'running') {
    return res.status(409).json({
      error: 'Scrape job already in progress'
    });
  }

  // Reset progress
  scrapeProgress = {
    status: 'running',
    progress: 0,
    message: 'Starting scrape job...',
    error: null,
    lastScraped: null
  };

  // Send immediate response
  res.json({ message: 'Scrape job started' });

  try {
    // Run the automation with progress callback
    await runScrape((progress, message) => {
      scrapeProgress.progress = progress;
      scrapeProgress.message = message;
    });

    // Update status on completion
    scrapeProgress.status = 'completed';
    scrapeProgress.progress = 100;
    scrapeProgress.message = 'Scrape job completed successfully';
    
    // Read the timestamp from the file that was just saved by the scraping script
    const outputPath = path.join(__dirname, 'data', 'scraped_content.json');
    console.log('Attempting to read timestamp from file after scrape:', outputPath);
    if (fs.existsSync(outputPath)) {
      const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      console.log('File exists after scrape, metadata:', data.metadata);
      scrapeProgress.lastScraped = data.metadata.timestamp;
      console.log('Updated scrapeProgress.lastScraped to:', scrapeProgress.lastScraped);
      console.log('Current scrapeProgress state:', {
        status: scrapeProgress.status,
        progress: scrapeProgress.progress,
        message: scrapeProgress.message,
        lastScraped: scrapeProgress.lastScraped
      });
    } else {
      console.log('Warning: File does not exist after scrape');
    }
  } catch (error) {
    console.error('Scrape job failed:', error);
    scrapeProgress.status = 'error';
    scrapeProgress.error = error.message;
    scrapeProgress.message = 'Scrape job failed';
  }
});

// Initialize cron job for hourly scraping
cron.schedule('0 * * * *', async () => {
    console.log('Starting scheduled scrape job...');
    try {
        await runScrape();
        console.log('Scheduled scrape completed successfully');
        
        // Analyze schedule changes after each scrape
        console.log('Analyzing schedule changes...');
        const changes = analyzeScheduleChanges();
        
        if (changes && (changes.removedJobs.length > 0 || changes.rescheduledJobs.length > 0)) {
            console.log('Important schedule changes detected! Sending email notification...');
            await sendScheduleChangeEmail(changes);
        }
    } catch (error) {
        console.error('Scheduled scrape failed:', error);
    }
});

// Run initial scrape on startup
console.log('Starting initial scrape...');
runScrape().then(async () => {
    console.log('Initial scrape completed successfully');
    
    // Only analyze changes if we have previous data
    const dataDir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dataDir)
        .filter(file => file.startsWith('scraped_content_') && file.endsWith('.json'));
    
    if (files.length > 1) {
        console.log('Analyzing schedule changes...');
        const changes = analyzeScheduleChanges();
        
        if (changes && (changes.removedJobs.length > 0 || changes.rescheduledJobs.length > 0)) {
            console.log('Important schedule changes detected! Sending email notification...');
            await sendScheduleChangeEmail(changes);
        }
    }
}).catch(error => {
    console.error('Initial scrape failed:', error);
});

// AutoFossa script execution endpoints
app.post('/api/auto-fossa/run', (req, res) => {
  const { scriptPath } = req.body;
  
  if (!scriptPath) {
    return res.status(400).json({ error: 'Script path is required' });
  }

  // Check if script is already running
  if (runningScripts.has(scriptPath)) {
    return res.status(409).json({ error: 'Script is already running' });
  }

  try {
    // Start Chrome in debug mode if not already running
    const chromeDebugPath = path.join(__dirname, 'scripts', 'AutoFossa', 'Chrome Debug.cmd');
    if (fs.existsSync(chromeDebugPath)) {
      spawn('cmd.exe', ['/c', chromeDebugPath], {
        detached: true,
        stdio: 'ignore'
      });
    }

    // Run the Python script
    const scriptProcess = spawn('python', [scriptPath], {
      cwd: path.join(__dirname, 'scripts', 'AutoFossa')
    });

    // Store the process
    runningScripts.set(scriptPath, scriptProcess);

    // Handle script output
    scriptProcess.stdout.on('data', (data) => {
      console.log(`Script output: ${data}`);
    });

    scriptProcess.stderr.on('data', (data) => {
      console.error(`Script error: ${data}`);
    });

    scriptProcess.on('close', (code) => {
      console.log(`Script exited with code ${code}`);
      runningScripts.delete(scriptPath);
    });

    res.json({ message: 'Script started successfully' });
  } catch (error) {
    console.error('Failed to start script:', error);
    res.status(500).json({ error: 'Failed to start script' });
  }
});

app.post('/api/auto-fossa/stop', (req, res) => {
  const { scriptPath } = req.body;
  
  if (!scriptPath) {
    return res.status(400).json({ error: 'Script path is required' });
  }

  const scriptProcess = runningScripts.get(scriptPath);
  if (!scriptProcess) {
    return res.status(404).json({ error: 'Script is not running' });
  }

  try {
    scriptProcess.kill();
    runningScripts.delete(scriptPath);
    res.json({ message: 'Script stopped successfully' });
  } catch (error) {
    console.error('Failed to stop script:', error);
    res.status(500).json({ error: 'Failed to stop script' });
  }
});

app.get('/api/auto-fossa/status', (req, res) => {
  const { scriptPath } = req.query;
  
  if (!scriptPath) {
    return res.status(400).json({ error: 'Script path is required' });
  }

  res.json({
    isRunning: runningScripts.has(scriptPath)
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 