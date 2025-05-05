import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getActiveUser } from '../server/utils/userManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the active user ID
const userId = getActiveUser();
if (!userId) {
  console.error('No active user found. Please log in first.');
  process.exit(1);
}

// Define digest storage directory path
const DIGEST_STORAGE_DIR = path.join(__dirname, '..', 'data', 'notification-digests');

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

console.log(`Successfully created sample digest data for user ${userId}`);
console.log(`Digest file created at: ${digestFilePath}`);
console.log('You can now test the daily digest by clicking the "Test Digest" button in the Email Settings.'); 