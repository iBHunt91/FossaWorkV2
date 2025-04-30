import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import cron from 'node-cron';
import { analyzeScheduleChanges } from '../scripts/utils/scheduleComparator.js';
import { sendScheduleChangeEmail } from '../scripts/email/emailService.js';
import config from './config/config.js';
import { router as apiRouter } from './routes/api.js';

// Create Express app
const app = express();
const port = config.port;

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  console.log('Creating data directory:', config.dataDir);
  fs.mkdirSync(config.dataDir, { recursive: true });
}

// Ensure logs directory exists
if (!fs.existsSync(config.logsDir)) {
  console.log('Creating logs directory:', config.logsDir);
  fs.mkdirSync(config.logsDir, { recursive: true });
}

// Enable CORS for the frontend
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  methods: ['GET', 'POST'],
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// API routes
app.use('/api', apiRouter);

// Serve static files from the frontend build
if (config.env === 'production') {
  app.use(express.static(path.join(config.rootDir, 'dist')));
  
  // Handle SPA routing - send all requests to index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(config.rootDir, 'dist', 'index.html'));
  });
}

// Set up scheduled tasks
try {
  // Schedule daily analysis for schedule changes at 6 AM
  cron.schedule('0 6 * * *', async () => {
    console.log('Running scheduled schedule change analysis...');
    try {
      const changes = await analyzeScheduleChanges();
      if (changes && changes.length > 0) {
        console.log(`Found ${changes.length} schedule changes, sending email notification`);
        await sendScheduleChangeEmail(changes);
      } else {
        console.log('No schedule changes detected');
      }
    } catch (error) {
      console.error('Error in scheduled task:', error);
    }
  });

  console.log('Scheduled tasks set up successfully');
} catch (error) {
  console.error('Error setting up scheduled tasks:', error);
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${config.env}`);
});

export default app; 