// Direct comparison script to manually check for changes between two specific JSON files

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

// Specify the files to compare directly
const file1 = path.join(projectRoot, 'data', 'scraped_content_2025-04-19T00-00-00-000Z.json');
const file2 = path.join(projectRoot, 'data', 'scraped_content_2025-04-17T21-23-54-881Z.json');

console.log(`Comparing files directly:\n${file1}\n${file2}`);

// Load the files
try {
  console.log('Reading file 1...');
  const file1Content = fs.readFileSync(file1, 'utf8');
  console.log(`File 1 size: ${file1Content.length} bytes`);
  
  console.log('Reading file 2...');
  const file2Content = fs.readFileSync(file2, 'utf8');
  console.log(`File 2 size: ${file2Content.length} bytes`);
  
  console.log('Parsing file 1...');
  const data1 = JSON.parse(file1Content);
  
  console.log('Parsing file 2...');
  const data2 = JSON.parse(file2Content);
  
  console.log(`\nFile 1 job count: ${data1.workOrders.length}`);
  console.log(`File 2 job count: ${data2.workOrders.length}`);
  
  // Create maps for easy lookup
  const jobs1 = new Map(data1.workOrders.map(job => [job.id, job]));
  const jobs2 = new Map(data2.workOrders.map(job => [job.id, job]));
  
  // Check for jobs in file 2 that aren't in file 1 (removed jobs)
  const removedJobs = [];
  for (const [jobId, job] of jobs2) {
    if (!jobs1.has(jobId)) {
      removedJobs.push(job);
    }
  }
  
  // Check for jobs in file 1 that aren't in file 2 (added jobs)
  const addedJobs = [];
  for (const [jobId, job] of jobs1) {
    if (!jobs2.has(jobId)) {
      addedJobs.push(job);
    }
  }
  
  // Output results
  console.log(`\nJobs removed (in file 2 but not in file 1): ${removedJobs.length}`);
  if (removedJobs.length > 0) {
    console.log('Removed jobs:');
    removedJobs.forEach(job => {
      console.log(`- ${job.id}: ${job.customer?.name || 'Unknown'}`);
    });
  }
  
  console.log(`\nJobs added (in file 1 but not in file 2): ${addedJobs.length}`);
  if (addedJobs.length > 0) {
    console.log('Added jobs:');
    addedJobs.forEach(job => {
      console.log(`- ${job.id}: ${job.customer?.name || 'Unknown'}`);
    });
  }
  
  // Check specific job
  const jobIdToCheck = 'W-126676';
  console.log(`\nChecking job ${jobIdToCheck}:`);
  console.log(`Exists in file 1: ${jobs1.has(jobIdToCheck)}`);
  console.log(`Exists in file 2: ${jobs2.has(jobIdToCheck)}`);
} catch (error) {
  console.error('Error comparing files:', error);
} 