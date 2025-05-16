import { sendTestEmail } from './emailService.js';

console.log('Starting email test...');

try {
  console.log('1. Environment check:');
  console.log('EMAIL_USERNAME:', process.env.EMAIL_USERNAME);
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***' : 'not set');
  console.log('VITE_EMAIL_USERNAME:', process.env.VITE_EMAIL_USERNAME);
  console.log('VITE_EMAIL_PASSWORD:', process.env.VITE_EMAIL_PASSWORD ? '***' : 'not set');

  console.log('\n2. Attempting to send test email...');
  const result = await sendTestEmail();
  console.log('Test result:', result);
} catch (error) {
  console.error('Test failed with error:', {
    name: error.name,
    message: error.message,
    code: error.code,
    command: error.command,
    responseCode: error.responseCode,
    response: error.response,
    stack: error.stack
  });
} 