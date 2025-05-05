/**
 * First-time setup script for Fossa Monitor
 * 
 * This script will:
 * 1. Create necessary directories
 * 2. Copy template files to their proper locations if they don't exist
 * 3. Guide the user through initial configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { execSync } from 'child_process';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const templateDir = path.join(dataDir, 'templates');
const usersDir = path.join(dataDir, 'users');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Ask a question and get user input
 */
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

/**
 * Create directory if it doesn't exist
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Copy template file to destination if destination doesn't exist
 */
function copyTemplateIfNeeded(templateName, destPath) {
  const templatePath = path.join(templateDir, templateName);
  
  if (!fs.existsSync(destPath) && fs.existsSync(templatePath)) {
    console.log(`Creating ${destPath} from template`);
    fs.copyFileSync(templatePath, destPath);
    return true;
  }
  
  return false;
}

/**
 * Setup email configuration
 */
async function setupEmailConfig() {
  console.log('\n===== Email Configuration =====');
  
  const emailSettingsPath = path.join(dataDir, 'email-settings.json');
  
  if (fs.existsSync(emailSettingsPath)) {
    const useExisting = await askQuestion('Email settings already exist. Use existing settings? (Y/n): ');
    if (useExisting.toLowerCase() !== 'n') {
      console.log('Using existing email settings.');
      return;
    }
  }
  
  console.log('Please configure your email settings:');
  const emailConfig = {};
  
  emailConfig.senderName = await askQuestion('Sender Name (e.g., Fossa Monitor): ');
  emailConfig.senderEmail = await askQuestion('Sender Email: ');
  emailConfig.smtpServer = await askQuestion('SMTP Server (e.g., smtp.gmail.com): ');
  emailConfig.smtpPort = parseInt(await askQuestion('SMTP Port (e.g., 587): '));
  
  const useSSLInput = await askQuestion('Use SSL? (y/N): ');
  emailConfig.useSSL = useSSLInput.toLowerCase() === 'y';
  
  emailConfig.username = await askQuestion('SMTP Username: ');
  emailConfig.password = await askQuestion('SMTP Password: ');
  
  fs.writeFileSync(emailSettingsPath, JSON.stringify(emailConfig, null, 2));
  console.log('Email settings saved successfully.');
}

/**
 * Setup FOSSA credentials
 */
async function setupFossaCredentials() {
  console.log('\n===== FOSSA Credentials =====');
  
  const envPath = path.join(rootDir, '.env');
  
  if (fs.existsSync(envPath)) {
    const useExisting = await askQuestion('Environment file already exists. Configure FOSSA credentials? (y/N): ');
    if (useExisting.toLowerCase() !== 'y') {
      console.log('Using existing environment configuration.');
      return;
    }
  }
  
  console.log('Please configure your FOSSA credentials:');
  
  const email = await askQuestion('FOSSA Email: ');
  const password = await askQuestion('FOSSA Password: ');
  
  const envContent = `FOSSA_EMAIL=${email}
FOSSA_PASSWORD=${password}
RUNNING_ELECTRON_DEV=true`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('FOSSA credentials saved to .env file.');
}

/**
 * Setup default user
 */
async function setupDefaultUser() {
  console.log('\n===== Default User Setup =====');
  
  const createUser = await askQuestion('Would you like to create a default user? (Y/n): ');
  if (createUser.toLowerCase() === 'n') {
    console.log('Skipping default user creation.');
    return;
  }
  
  const username = await askQuestion('Username: ');
  const email = await askQuestion('Email for notifications: ');
  
  if (!username || !username.trim()) {
    console.log('Invalid username, skipping user creation.');
    return;
  }
  
  const userDir = path.join(usersDir, username);
  ensureDirectoryExists(userDir);
  ensureDirectoryExists(path.join(userDir, 'archive'));
  ensureDirectoryExists(path.join(userDir, 'archives'));
  ensureDirectoryExists(path.join(userDir, 'data'));
  
  // Create empty files from templates
  const emailSettingsPath = path.join(userDir, 'email_settings.json');
  if (!fs.existsSync(emailSettingsPath)) {
    const template = JSON.parse(fs.readFileSync(path.join(templateDir, 'user-email-settings.template.json'), 'utf8'));
    template.recipientEmail = email;
    fs.writeFileSync(emailSettingsPath, JSON.stringify(template, null, 2));
  }
  
  // Create empty change_history.json
  copyTemplateIfNeeded('change_history.template.json', path.join(userDir, 'change_history.json'));
  
  // Create empty metadata.json
  copyTemplateIfNeeded('metadata.template.json', path.join(userDir, 'metadata.json'));
  
  // Create empty scraped_content.json
  fs.writeFileSync(path.join(userDir, 'scraped_content.json'), JSON.stringify({ jobs: [] }));
  
  console.log(`Default user '${username}' created successfully.`);
}

/**
 * Main setup function
 */
async function setup() {
  console.log('===== Fossa Monitor Setup =====');
  console.log('Setting up directories and configuration files...\n');

  // Create necessary directories
  ensureDirectoryExists(dataDir);
  ensureDirectoryExists(templateDir);
  ensureDirectoryExists(usersDir);
  ensureDirectoryExists(path.join(rootDir, 'logs'));
  
  // Set up email configuration
  await setupEmailConfig();
  
  // Set up FOSSA credentials
  await setupFossaCredentials();
  
  // Set up default user
  await setupDefaultUser();
  
  // Install dependencies if needed
  if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
    console.log('\nInstalling dependencies...');
    try {
      execSync('npm install', { stdio: 'inherit', cwd: rootDir });
      console.log('Dependencies installed successfully.');
    } catch (error) {
      console.error('Error installing dependencies:', error.message);
    }
  }
  
  console.log('\nSetup complete! You can now start the application:');
  console.log('  npm run electron:dev:start');
  
  rl.close();
}

// Run setup
setup().catch(error => {
  console.error('Setup error:', error);
  rl.close();
}); 