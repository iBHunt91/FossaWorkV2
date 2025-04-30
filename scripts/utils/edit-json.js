// Script to edit JSON files to help with testing
// Remove a specific work order from a JSON file

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

// Use the current main file instead of a timestamped version
const sourceFile = path.join(projectRoot, 'data', 'scraped_content.json');
const targetFile = path.join(projectRoot, 'data', 'scraped_content-modified.json');

console.log(`Reading file: ${sourceFile}`);
const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

// Find index of work order to remove - using the first job as an example
const workOrders = data.workOrders;
const jobToRemove = workOrders[0]; // Remove the first job
const jobIdToRemove = jobToRemove.id;
const indexToRemove = 0;

console.log(`Removing work order ${jobIdToRemove} at index ${indexToRemove}`);
const removedJob = workOrders.splice(indexToRemove, 1)[0];
console.log(`Removed job: ${removedJob.id} (${removedJob.customer?.name || 'unknown'})`);

// Save modified data
fs.writeFileSync(targetFile, JSON.stringify(data, null, 2));
console.log(`Saved modified file to: ${targetFile}`);

// Rename the modified file to replace the original, keeping a backup
const backupFile = path.join(projectRoot, 'data', `scraped_content.backup-${Date.now()}.json`);
fs.renameSync(sourceFile, backupFile);
fs.renameSync(targetFile, sourceFile);
console.log(`Renamed files: original → backup, modified → original`);
console.log(`Original backup at: ${backupFile}`);
console.log(`Operation complete`); 