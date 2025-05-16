/**
 * Setup Script for Fossa Monitor
 * 
 * This script helps set up the initial configuration for Fossa Monitor.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initializeDataFromTemplates } from './init-data.js';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const usersDir = path.join(dataDir, 'users');
const templatesDir = path.join(dataDir, 'templates');
const logsDir = path.join(projectRoot, 'logs');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main setup function
async function setup() {
  console.log('=== Fossa Monitor Setup ===');
  
  // Create necessary directories
  createDirectories();
  
  // Initialize data files from templates
  initializeDataFromTemplates();
  
  // Ask if user wants to create a default user
  rl.question('Do you want to create a default user? (y/n): ', async (answer) => {
    if (answer.toLowerCase() === 'y') {
      await createDefaultUser();
    } else {
      console.log('Skipping user creation...');
      console.log('You can create users through the application UI.');
      finish();
    }
  });
}

// Create necessary directories
function createDirectories() {
  console.log('Creating necessary directories...');
  
  [dataDir, usersDir, logsDir, templatesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created ${dir}`);
    }
  });
}

// Create a default user
async function createDefaultUser() {
  const username = await askQuestion('Enter username: ');
  const email = await askQuestion('Enter email: ');
  
  // Generate a user ID (MD5 hash of username)
  const userId = crypto.createHash('md5').update(username).digest("hex");
  const userDir = path.join(usersDir, userId);
  
  // Create user directory
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  
  // Create archive directory
  const archiveDir = path.join(userDir, 'archive');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  
  // Create user metadata
  const metadata = {
    id: userId,
    username: username,
    email: email,
    created: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };
  
  fs.writeFileSync(path.join(userDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  
  // Create email settings
  const emailSettings = {
    enabled: true,
    email: email,
    notifyOnChanges: true,
    notifyOnFailures: true
  };
  
  fs.writeFileSync(path.join(userDir, 'email_settings.json'), JSON.stringify(emailSettings, null, 2));
  
  // Create empty change history
  const changeHistory = {
    changes: []
  };
  
  fs.writeFileSync(path.join(userDir, 'change_history.json'), JSON.stringify(changeHistory, null, 2));
  
  // Create empty scraped content
  const scrapedContent = {
    jobs: [],
    lastUpdated: new Date().toISOString()
  };
  
  fs.writeFileSync(path.join(userDir, 'scraped_content.json'), JSON.stringify(scrapedContent, null, 2));
  
  // Update users.json
  let users = { users: [] };
  const usersFile = path.join(dataDir, 'users.json');
  
  if (fs.existsSync(usersFile)) {
    try {
      users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    } catch (error) {
      console.error('Error reading users.json:', error);
    }
  }
  
  users.users.push({
    id: userId,
    username: username,
    email: email
  });
  
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  
  console.log(`User "${username}" created successfully!`);
  finish();
}

// Ask a question and return the answer
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Finish setup
function finish() {
  console.log('\nSetup completed successfully!');
  console.log('You can now start the application with: npm run electron:dev:start');
  rl.close();
}

// Run setup
setup(); 