import { setActiveUser } from './server/utils/userManager.js';
import { sendTestEmail } from './scripts/notifications/emailService.js';

async function main() {
  try {
    console.log('Setting Bruce as active user...');
    await setActiveUser('Bruce');
    console.log('Sending test email...');
    const result = await sendTestEmail();
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 