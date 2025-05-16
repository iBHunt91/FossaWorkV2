import { sendTestEmail } from './emailService.js';

console.log('Starting email test...');

try {
  const result = await sendTestEmail();
  console.log('Test result:', result);
} catch (error) {
  console.error('Test failed:', error);
} 