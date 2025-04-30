// Test script to run schedule comparison logic manually

import { analyzeScheduleChanges } from './scheduleComparator.js';
import { getLatestScrapeFile, getPreviousScrapeFile } from './dataManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Running schedule change analysis manually...');

// Get the files being compared
const latestFile = getLatestScrapeFile();
const previousFile = getPreviousScrapeFile();

console.log('\nFiles being compared:');
console.log(`Latest file: ${latestFile}`);
console.log(`Previous file: ${previousFile}`);

if (latestFile && previousFile) {
  // Load the files to see what they contain
  const latestData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
  const previousData = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
  
  console.log(`\nLatest file job count: ${latestData.workOrders.length}`);
  console.log(`Previous file job count: ${previousData.workOrders.length}`);
  
  // Check if W-126676 exists in both files
  const latestHasJob = latestData.workOrders.some(job => job.id === 'W-126676');
  const previousHasJob = previousData.workOrders.some(job => job.id === 'W-126676');
  
  console.log(`\nLatest file has W-126676: ${latestHasJob}`);
  console.log(`Previous file has W-126676: ${previousHasJob}`);
}

// Test the analysis function
try {
  const result = analyzeScheduleChanges();
  
  if (result) {
    console.log('\nAnalysis Results:');
    console.log('----------------');
    console.log('Critical changes:', result.critical.length);
    console.log('High priority changes:', result.high.length);
    console.log('Medium priority changes:', result.medium.length);
    console.log('Low priority changes:', result.low.length);
    
    console.log('\nSummary:');
    console.log('Removed:', result.summary.removed);
    console.log('Added:', result.summary.added);
    console.log('Modified:', result.summary.modified);
    
    // Get report content
    const reportPath = path.join(__dirname, '..', '..', 'data/schedule_changes.txt');
    if (fs.existsSync(reportPath)) {
      console.log('\nReport Contents:');
      console.log(fs.readFileSync(reportPath, 'utf8'));
    }
  } else {
    console.log('No changes detected or not enough data files to compare');
  }
} catch (error) {
  console.error('Error running schedule comparison:', error);
} 