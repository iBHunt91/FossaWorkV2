import { sendDailyDigestForUser } from './notifications/notificationScheduler.js';
import { getActiveUser } from '../server/utils/userManager.js';

// Main function to test the daily digest
async function testDailyDigest() {
  try {
    // Get the active user ID
    const userId = getActiveUser();
    if (!userId) {
      console.error('No active user found. Please log in first.');
      process.exit(1);
    }

    console.log(`Testing daily digest for user: ${userId}`);
    
    // Send the daily digest
    const result = await sendDailyDigestForUser(userId);
    
    console.log('Daily digest test result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success && result.sent) {
      console.log(`✅ Daily digest sent successfully with ${result.changesCount} changes!`);
      console.log('Check your email inbox for the digest report.');
    } else if (result.success && !result.sent) {
      console.log(`⚠️ Digest was not sent: ${result.reason}`);
      if (result.reason === 'no_digest_file') {
        console.log('Try running scripts/test-digest-data.js first to create sample data.');
      }
    } else {
      console.error(`❌ Failed to send digest: ${result.error}`);
    }
  } catch (error) {
    console.error('Error running daily digest test:', error);
  }
}

// Run the test
testDailyDigest(); 