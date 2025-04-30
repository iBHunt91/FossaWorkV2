import { sendTestEmail } from './emailService.js';

// Run the test
console.log('Starting email test...');
sendTestEmail()
    .then(() => console.log('Test completed successfully'))
    .catch(error => console.error('Test failed:', error)); 