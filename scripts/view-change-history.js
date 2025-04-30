// Script to view archived schedule changes
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to list and view archived schedule changes
async function viewChangeHistory() {
  const archiveDir = path.join(__dirname, '..', 'data/changes_archive');
  
  // Check if archive directory exists
  if (!fs.existsSync(archiveDir)) {
    console.log('Schedule changes archive directory does not exist yet.');
    console.log('Changes will be archived when important schedule changes are detected.');
    return;
  }
  
  // Get all archived files
  const files = fs.readdirSync(archiveDir)
    .filter(file => file.startsWith('schedule_changes_') && file.endsWith('.txt'))
    .sort((a, b) => {
      // Sort from newest to oldest
      const timeA = a.replace('schedule_changes_', '').replace('.txt', '');
      const timeB = b.replace('schedule_changes_', '').replace('.txt', '');
      return timeB.localeCompare(timeA);
    });
  
  if (files.length === 0) {
    console.log('No archived schedule changes found.');
    return;
  }
  
  console.log(`Found ${files.length} archived schedule change files:\n`);
  
  // Display list of archives
  files.forEach((file, index) => {
    const timestamp = file.replace('schedule_changes_', '').replace('.txt', '');
    const readableTime = timestamp.replace('T', ' ').replace(/-/g, (m, i) => {
      // Replace only the hyphens in the date, not in the timestamp
      return i < 10 ? '/' : (i < 16 ? ':' : '-');
    });
    console.log(`${index + 1}. ${readableTime}`);
  });
  
  // Check if a specific file was requested via command line
  const requestedIndex = process.argv[2] ? parseInt(process.argv[2]) - 1 : null;
  
  if (requestedIndex !== null && requestedIndex >= 0 && requestedIndex < files.length) {
    // Display the selected archive file
    const selectedFile = files[requestedIndex];
    const filePath = path.join(archiveDir, selectedFile);
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log('\n' + '='.repeat(50));
    console.log(`Contents of ${selectedFile}:`);
    console.log('='.repeat(50));
    console.log(content);
  } else {
    console.log('\nTo view a specific archive, run:');
    console.log('node scripts/view-change-history.js <number>');
  }
}

// Run the function
viewChangeHistory().catch(console.error); 