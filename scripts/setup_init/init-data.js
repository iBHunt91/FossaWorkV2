/**
 * Data Initialization Module
 * 
 * This module contains functions to initialize data files from templates.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize data files from templates
 */
export function initializeDataFromTemplates() {
  const projectRoot = path.resolve(__dirname, '..');
  const templatesDir = path.join(projectRoot, 'data', 'templates');
  const dataDir = path.join(projectRoot, 'data');
  
  // List of files to copy from templates
  const filesToInitialize = [
    { template: 'dispenser_store.template.json', target: 'dispenser_store.json' },
    { template: 'scraped_content.template.json', target: 'scraped_content.json' },
    { template: 'metadata.template.json', target: 'metadata.json' },
    { template: 'settings.template.json', target: 'settings.json' },
    { template: 'email-settings.template.json', target: 'email-settings.json' },
    { template: 'users.template.json', target: 'users.json' }
  ];
  
  filesToInitialize.forEach(({ template, target }) => {
    const templateFile = path.join(templatesDir, template);
    const targetFile = path.join(dataDir, target);
    
    // Only copy if target doesn't exist and template exists
    if (!fs.existsSync(targetFile) && fs.existsSync(templateFile)) {
      try {
        const content = fs.readFileSync(templateFile, 'utf8');
        fs.writeFileSync(targetFile, content);
        console.log(`Initialized ${target} from template`);
      } catch (err) {
        console.error(`Error initializing ${target}:`, err);
      }
    }
  });
} 