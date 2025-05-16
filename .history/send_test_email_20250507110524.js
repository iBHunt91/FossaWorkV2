import { setActiveUser } from './server/utils/userManager.js';
import { sendTestEmail } from './scripts/notifications/emailService.js';
import { sendEmail } from './scripts/notifications/emailService.js';

async function main() {
  try {
    console.log('Setting Bruce as active user...');
    await setActiveUser('Bruce');
    
    // Set the recipient email explicitly
    process.env.VITE_RECIPIENT_EMAIL = "bruce.hunt@owlservices.com";
    
    console.log('Sending test email...');
    
    // Option 1: Use sendTestEmail
    const result = await sendTestEmail();
    console.log('Result from sendTestEmail:', result);
    
    // Option 2: Use sendEmail directly with explicit recipient
    const emailParams = {
      to: "bruce.hunt@owlservices.com",
      subject: "Test Email for Bruce",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .content { background-color: #f8f9fa; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Test Email for Bruce</h1>
            </div>
            <div class="content">
              <p>This is a test email sent to Bruce.</p>
              <p>Time sent: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    const directResult = await sendEmail(emailParams);
    console.log('Result from direct sendEmail:', directResult);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 