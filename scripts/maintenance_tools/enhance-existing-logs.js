#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { enhanceScrapeLogs } from './enhance-scrape-logs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Enhances all scraped content files in the data directory
 */
async function enhanceAllLogs() {
    console.log('Enhancing all existing scrape logs...');
    
    const dataDir = path.join(__dirname, '..', 'data');
    
    try {
        // Get all scraped content files
        const files = fs.readdirSync(dataDir)
            .filter(file => file.match(/^scraped_content.*\.json$/));
        
        if (files.length === 0) {
            console.log('No scrape log files found');
            return;
        }
        
        console.log(`Found ${files.length} scrape log files`);
        
        // Backup the original scraped_content.json
        const mainLogPath = path.join(dataDir, 'scraped_content.json');
        if (fs.existsSync(mainLogPath)) {
            // Create backup with timestamp in filename
            const timestamp = Date.now();
            const backupPath = path.join(dataDir, `scraped_content.backup-${timestamp}.json`);
            fs.copyFileSync(mainLogPath, backupPath);
            console.log(`Backed up main scrape log to ${backupPath}`);
            
            // Also create a file in the format used for history comparison
            const isoTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const historyPath = path.join(dataDir, `scraped_content_${isoTimestamp}.json`);
            fs.copyFileSync(mainLogPath, historyPath);
            console.log(`Created history-compatible backup at ${historyPath}`);
        }
        
        // Run the enhancement
        enhanceScrapeLogs();
        
        console.log('Enhancement of all logs complete!');
    } catch (error) {
        console.error('Error enhancing logs:', error);
    }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    enhanceAllLogs();
}

export { enhanceAllLogs }; 