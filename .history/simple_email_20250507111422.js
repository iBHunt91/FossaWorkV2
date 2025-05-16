import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

async function sendSimpleEmail() {
  try {
    // Load email settings
    const settingsPath = path.resolve(process.cwd(), 'data', 'email-settings.json');
    const emailSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    // Create a transporter object using SMTP
    const transporter = nodemailer.createTransport({
      host: emailSettings.smtpServer || 'smtp.gmail.com',
      port: emailSettings.smtpPort || 587,
      secure: emailSettings.smtpPort === 465, // Standard for SMTPS, or use emailSettings.useSSL
      auth: {
        user: emailSettings.username,
        pass: emailSettings.password // This should be the App Password
      },
      // Add more verbose debugging
      logger: true,
      debug: true 
    });

    // Email options
    const mailOptions = {
      from: `${emailSettings.senderName} <${emailSettings.senderEmail}>`,
      to: 'bruce.hunt@owlservices.com',
      subject: 'Simple Test Email for Bruce (with App Password from settings)',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Hello Bruce!</h1>
          <p>This is a simple test email sent at ${new Date().toLocaleString()} using credentials from email-settings.json.</p>
          <p>Using user: ${emailSettings.username}</p>
        </div>
      `
    };

    console.log('Sending email to:', mailOptions.to);
    console.log('Using SMTP Host:', transporter.options.host);
    console.log('Using SMTP Port:', transporter.options.port);
    console.log('Using Secure connection:', transporter.options.secure);
    console.log('Using Username:', emailSettings.username);
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    console.log('Full response:', info);
    return { success: true, messageId: info.messageId, response: info };
  } catch (error) {
    console.error('Error sending email:', error); // Log the full error object
    return { success: false, error: error }; // Return the full error object
  }
}

// Run the function
sendSimpleEmail().then(result => {
  console.log('Final Result:', result);
}).catch(error => {
  console.error('Final Error:', error);
}); 