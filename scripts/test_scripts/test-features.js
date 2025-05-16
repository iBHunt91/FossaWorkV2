import readline from 'readline';
import { sendDailyDigestForUser } from './notifications/notificationScheduler.js';
import { getActiveUser } from '../server/utils/userManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask a question
function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Define digest storage directory path
const DIGEST_STORAGE_DIR = path.join(__dirname, '..', 'data', 'notification-digests');

// Function to create sample digest data
async function createSampleDigestData() {
  try {
    // Get the active user ID
    const userId = getActiveUser();
    if (!userId) {
      console.error('No active user found. Please log in first.');
      return;
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(DIGEST_STORAGE_DIR)) {
      fs.mkdirSync(DIGEST_STORAGE_DIR, { recursive: true });
    }

    // Define the digest file path for the current user
    const digestFilePath = path.join(DIGEST_STORAGE_DIR, `${userId}-digest.json`);

    // Create sample schedule changes
    const sampleChanges = [
      {
        allChanges: [
          {
            type: 'added',
            jobId: 'W-110185',
            store: '5137',
            storeName: 'Wawa #5137',
            location: 'Philadelphia, PA',
            date: '2023-05-10',
            dispensers: 4
          },
          {
            type: 'removed',
            jobId: 'W-110186',
            store: '5253',
            storeName: 'Wawa #5253',
            location: 'Cherry Hill, NJ',
            date: '2023-05-08',
            dispensers: 3
          }
        ],
        summary: {
          removed: 1,
          added: 1,
          modified: 0,
          swapped: 0,
          replaced: 0
        },
        timestamp: new Date().toISOString()
      },
      {
        allChanges: [
          {
            type: 'date_changed',
            jobId: 'W-126753',
            store: '33105',
            storeName: '7-Eleven #33105',
            location: 'Miami, FL',
            oldDate: '2023-05-07',
            newDate: '2023-05-12',
            dispensers: 6
          }
        ],
        summary: {
          removed: 0,
          added: 0,
          modified: 1,
          swapped: 0,
          replaced: 0
        },
        timestamp: new Date().toISOString()
      }
    ];

    // Write the sample changes to the digest file
    fs.writeFileSync(digestFilePath, JSON.stringify(sampleChanges, null, 2), 'utf8');

    console.log(`\n✅ Successfully created sample digest data for user ${userId}`);
    console.log(`Digest file created at: ${digestFilePath}`);
  } catch (error) {
    console.error('❌ Error creating sample digest data:', error);
  }
}

// Function to test sending the daily digest
async function testDailyDigest() {
  try {
    // Get the active user ID
    const userId = getActiveUser();
    if (!userId) {
      console.error('No active user found. Please log in first.');
      return;
    }

    console.log(`\nTesting daily digest for user: ${userId}`);
    
    // Send the daily digest
    const result = await sendDailyDigestForUser(userId);
    
    console.log('\nDaily digest test result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success && result.sent) {
      console.log(`\n✅ Daily digest sent successfully with ${result.changesCount} changes!`);
      console.log('Check your email inbox for the digest report.');
    } else if (result.success && !result.sent) {
      console.log(`\n⚠️ Digest was not sent: ${result.reason}`);
      if (result.reason === 'no_digest_file') {
        console.log('Try running option 1 first to create sample data.');
      }
    } else {
      console.error(`\n❌ Failed to send digest: ${result.error}`);
    }
  } catch (error) {
    console.error('\n❌ Error running daily digest test:', error);
  }
}

// Check if digest file exists
function checkDigestFile() {
  try {
    const userId = getActiveUser();
    if (!userId) {
      console.error('No active user found. Please log in first.');
      return false;
    }
    
    const digestFilePath = path.join(DIGEST_STORAGE_DIR, `${userId}-digest.json`);
    const exists = fs.existsSync(digestFilePath);
    
    if (exists) {
      const data = fs.readFileSync(digestFilePath, 'utf8');
      const changes = JSON.parse(data);
      
      console.log(`\n✅ Digest file exists for user ${userId}`);
      console.log(`Contains ${changes.length} change sets with a total of ${changes.reduce((total, set) => total + (set.allChanges?.length || 0), 0)} changes`);
      return true;
    } else {
      console.log(`\n❌ No digest file exists for user ${userId}`);
      return false;
    }
  } catch (error) {
    console.error('\n❌ Error checking digest file:', error);
    return false;
  }
}

// Main menu function
async function showMenu() {
  console.log('\n=== Daily Digest Testing Tool ===');
  console.log('1. Create sample digest data');
  console.log('2. Check if digest file exists');
  console.log('3. Test sending daily digest');
  console.log('4. Exit');
  
  const choice = await ask('\nEnter your choice (1-4): ');
  
  switch (choice) {
    case '1':
      await createSampleDigestData();
      break;
    case '2':
      checkDigestFile();
      break;
    case '3':
      await testDailyDigest();
      break;
    case '4':
      console.log('\nExiting...');
      rl.close();
      return;
    default:
      console.log('\nInvalid choice. Please try again.');
  }
  
  // Show menu again unless user chose to exit
  if (choice !== '4') {
    await showMenu();
  }
}

// Start the program
console.log('Welcome to the Fossa Monitor Feature Testing Tool');
showMenu(); 