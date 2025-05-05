/**
 * Bootstrap Templates
 * 
 * This script copies template files from the backup directory
 * to create a working bootstrap for new installations.
 */

const fs = require('fs');
const path = require('path');

// Define paths
const projectRoot = path.resolve(__dirname, '..');
const backupDir = path.join(projectRoot, 'backup');
const templatesDir = path.join(projectRoot, 'data', 'templates');
const dataDir = path.join(projectRoot, 'data');

// Create necessary directories
console.log('Creating necessary directories...');
[
  path.join(projectRoot, 'data'),
  path.join(projectRoot, 'logs'),
  path.join(projectRoot, 'data', 'users'),
  path.join(projectRoot, 'data', 'templates'),
].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created ${dir}`);
  }
});

// Copy files from backup to templates
console.log('Creating template files from backup...');
const filesToTemplate = [
  'dispenser_store.json',
  'scraped_content.json',
  'metadata.json',
  'settings.json',
  'email-settings.json',
  'users.json'
];

filesToTemplate.forEach(file => {
  const backupFile = path.join(backupDir, file);
  const templateFile = path.join(templatesDir, `${file.replace('.json', '')}.template.json`);
  
  try {
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, templateFile);
      console.log(`Created template: ${templateFile}`);
    } else {
      console.warn(`Warning: Backup file not found: ${backupFile}`);
    }
  } catch (err) {
    console.error(`Error creating template for ${file}:`, err);
  }
});

// Update the initialization scripts to use these templates
console.log('Updating initialization script content...');

// Create the init-data.js module
const initDataScriptPath = path.join(__dirname, 'init-data.js');
const initDataScript = `/**
 * Data Initialization Module
 * 
 * This module contains functions to initialize data files from templates.
 */

const fs = require('fs');
const path = require('path');

/**
 * Initialize data files from templates
 */
function initializeDataFromTemplates() {
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
        console.log(\`Initialized \${target} from template\`);
      } catch (err) {
        console.error(\`Error initializing \${target}:\`, err);
      }
    }
  });
}

module.exports = {
  initializeDataFromTemplates
};
`;

fs.writeFileSync(initDataScriptPath, initDataScript);
console.log(`Created init-data.js module`);

console.log('Bootstrap templates created successfully!'); 