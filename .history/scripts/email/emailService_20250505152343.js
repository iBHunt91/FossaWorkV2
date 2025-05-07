// Re-export from the notifications/emailService.js file
export { 
  sendScheduleChangeEmail, 
  sendTestEmail, 
  sendEmail
} from '../notifications/emailService.js';

// Add implementation for sendSampleJobEmail
export async function sendSampleJobEmail() {
  const { sendEmail } = await import('../notifications/emailService.js');
  const { getUserEmailSettings } = await import('../notifications/emailService.js');
  
  try {
    const emailSettings = await getUserEmailSettings();
    
    if (!emailSettings || !emailSettings.recipientEmail) {
      console.error('No recipient email configured');
      return { success: false, error: 'No recipient email configured' };
    }
    
    const emailParams = {
      to: emailSettings.recipientEmail,
      subject: 'Sample Job Email - FM Application',
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
            .job-details { margin-top: 20px; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 Sample Job Details</h1>
            </div>
            <div class="content">
              <p>This is a sample job notification to verify that your email settings are working correctly.</p>
              
              <div class="job-details">
                <h3>Job Information</h3>
                <p><strong>Job ID:</strong> W-123456</p>
                <p><strong>Store:</strong> #1234 - Sample Store Location</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
                <p><strong>Status:</strong> <span style="color: #28a745;">Scheduled</span></p>
                <p><strong>Dispensers:</strong> 4</p>
              </div>
              
              <p style="margin-top: 20px;">If you received this email, your job notification settings are properly configured.</p>
            </div>
            <div class="footer">
              <p>This is an automated test message.</p>
              <p>Time sent: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    const result = await sendEmail(emailParams);
    console.log('Sample job email sent successfully');
    return { success: true, result };
  } catch (error) {
    console.error('Error sending sample job email:', error);
    return { success: false, error: error.message };
  }
} 