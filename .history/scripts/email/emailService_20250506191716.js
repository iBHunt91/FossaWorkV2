import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define path to settings file
const userSettingsPath = path.join(__dirname, '..', '..', 'data', 'user-settings.json');
const defaultSettingsPath = path.join(__dirname, '..', '..', 'data', 'email-settings.json');

/**
 * Get the user's email settings
 * @returns {Object} The user's email settings
 */
export async function getUserEmailSettings() {
  try {
    // First try to get from user settings
    if (fs.existsSync(userSettingsPath)) {
      const userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      if (userSettings && userSettings.email) {
        return userSettings.email;
      }
    }
    
    // Fall back to default settings
    if (fs.existsSync(defaultSettingsPath)) {
      const settings = JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));
      return settings;
    }
    
    // Return empty settings as a last resort
    return {
      senderName: 'Schedule Notification System',
      senderEmail: process.env.EMAIL_USERNAME || '',
      recipientEmail: process.env.RECIPIENT_EMAIL || '',
      smtpServer: 'smtp.gmail.com',
      smtpPort: 587,
      useSSL: true,
      username: process.env.EMAIL_USERNAME || '',
      password: process.env.EMAIL_PASSWORD || ''
    };
  } catch (error) {
    console.error('Error loading email settings:', error);
    return {
      senderName: 'Schedule Notification System',
      senderEmail: process.env.EMAIL_USERNAME || '',
      recipientEmail: process.env.RECIPIENT_EMAIL || '',
      smtpServer: 'smtp.gmail.com',
      smtpPort: 587,
      useSSL: true,
      username: process.env.EMAIL_USERNAME || '',
      password: process.env.EMAIL_PASSWORD || ''
    };
  }
}

/**
 * Send an email using nodemailer
 * @param {Object} options - Email options
 * @returns {Promise<Object>}
 */
export async function sendEmail(options) {
  try {
    // Get email settings directly from this file, not importing from another module
    const emailSettings = await getUserEmailSettings();
    
    // Create a transporter object using SMTP
    const transporter = nodemailer.createTransport({
      host: emailSettings.smtpServer || 'smtp.gmail.com',
      port: emailSettings.smtpPort || 587,
      secure: emailSettings.useSSL === true,
      auth: {
        user: emailSettings.username || process.env.EMAIL_USERNAME,
        pass: emailSettings.password || process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: `${emailSettings.senderName} <${emailSettings.senderEmail || emailSettings.username}>`,
      to: options.to || emailSettings.recipientEmail || process.env.RECIPIENT_EMAIL,
      subject: options.subject,
      ...(options.text && { text: options.text }),
      ...(options.html && { html: options.html }),
      ...(options.cc && { cc: options.cc })
    };

    console.log('Sending email with options:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      from: mailOptions.from,
      cc: mailOptions.cc || 'none'
    });

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message || error };
  }
}

export async function sendScheduleChangeEmail(changes, user) {
    console.log('Starting email notification for user:', user.id);

    // Format date and time
    const now = new Date();
    const formattedDate = now.toLocaleDateString();
    const formattedTime = now.toLocaleTimeString();

    // Count changes
    const summaryParts = [];
    if (changes.summary.removed > 0) {
        summaryParts.push(`${changes.summary.removed} removed`);
    }
    if (changes.summary.added > 0) {
        summaryParts.push(`${changes.summary.added} added`);
    }
    if (changes.summary.modified > 0) {
        summaryParts.push(`${changes.summary.modified} modified`);
    }
    if (changes.summary.swapped > 0) {
        summaryParts.push(`${changes.summary.swapped} swapped`);
    }
    const summary = summaryParts.join(', ');

    // Create HTML email with modern styling
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                max-width: 200px;
                margin-bottom: 20px;
            }
            .change-block {
                margin-bottom: 15px;
                padding: 15px;
                border-radius: 5px;
                background-color: #f8f9fa;
                border-left: 4px solid;
            }
            .critical {
                border-left-color: #FF3B30;
            }
            .high {
                border-left-color: #FF9500;
            }
            .summary {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }
            .actions {
                background-color: #e9ecef;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #dee2e6;
                font-size: 0.9em;
                color: #6c757d;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="[COMPANY_LOGO_URL]" alt="Company Logo" class="logo">
            <h1>📅 Schedule Changes</h1>
            <p style="color: ${changes.critical.length > 0 ? '#FF3B30' : '#34C759'}">
                ${summaryParts.length} change${summaryParts.length !== 1 ? 's' : ''} detected
            </p>
            <p><i>Generated: ${formattedDate} at ${formattedTime}</i></p>
        </div>`;

    // Add critical changes section
    if (changes.critical.length > 0) {
        html += `
        <h2 style="color: #FF3B30">⚠️ CRITICAL CHANGES (${changes.critical.length})</h2>`;
        for (const change of changes.critical) {
            html += `<div class="change-block critical">`;
            if (change.type === 'removed') {
                html += `
                <h3>🗑️ Removed Visit</h3>
                <p>• Job: ${change.jobId}</p>
                <p>• Store: ${change.store}</p>
                <p>• Location: ${change.location}</p>
                <p>• Dispensers: ${change.dispensers}</p>
                <p>• Date: ${change.date}</p>`;
            } else if (change.type === 'added') {
                html += `
                <h3>➕ Added Visit</h3>
                <p>• Job: ${change.jobId}</p>
                <p>• Store: ${change.store}</p>
                <p>• Location: ${change.location}</p>
                <p>• Dispensers: ${change.dispensers}</p>
                <p>• Date: ${change.date}</p>`;
            }
            html += `</div>`;
        }
    }

    // Add high priority changes section
    if (changes.high.length > 0) {
        html += `
        <h2 style="color: #FF9500">⚠️ HIGH PRIORITY CHANGES (${changes.high.length})</h2>`;
        for (const change of changes.high) {
            html += `<div class="change-block high">`;
            if (change.type === 'date_changed') {
                html += `
                <h3>📅 Date Changed</h3>
                <p>• Job: ${change.jobId}</p>
                <p>• Store: ${change.store}</p>
                <p>• Location: ${change.location}</p>
                <p>• From: ${change.oldDate}</p>
                <p>• To: ${change.newDate}</p>`;
            }
            html += `</div>`;
        }
    }

    // Add summary section
    html += `
    <div class="summary">
        <h2>📊 SUMMARY</h2>
        <p>• Total changes: ${changes.critical.length + changes.high.length}</p>
        <p>• Critical: ${changes.critical.length}</p>
        <p>• High priority: ${changes.high.length}</p>
    </div>`;

    // Add action items
    html += `
    <div class="actions">
        <h2>🛠️ ACTIONS REQUIRED</h2>`;
    if (changes.critical.length > 0) {
        html += `<p style="color: #FF3B30"><strong>• IMMEDIATE ACTION REQUIRED</strong></p>`;
    }
    html += `
        <p>• Review schedule changes</p>
        <p>• Update team calendar</p>
        <p>• Confirm resource availability</p>
    </div>`;

    // Add footer
    html += `
        <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
            <p>If you have any questions, please contact your supervisor.</p>
        </div>
    </body>
    </html>`;

    try {
        // Send email using your email service
        const emailParams = {
            to: user.email,
            subject: `📅 Schedule Changes (${changes.critical.length + changes.high.length})`,
            html: html
        };

        // Add CC if specified in user settings
        if (user.notificationSettings?.email?.cc) {
            emailParams.cc = user.notificationSettings.email.cc;
        }

        console.log('Sending email with params:', {
            to: emailParams.to,
            subject: emailParams.subject,
            cc: emailParams.cc || 'none'
        });

        const result = await sendEmail(emailParams);
        console.log(`Email notification sent successfully to user ${user.id}`);
        return { success: true, result };
    } catch (error) {
        console.error('Error sending email notification:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send a test email
 * @returns {Promise<Object>}
 */
export async function sendTestEmail() {
  try {
    const emailSettings = await getUserEmailSettings();

    if (!emailSettings || !emailSettings.recipientEmail) {
      console.error('No recipient email configured');
      return { success: false, error: 'No recipient email configured' };
    }

    const emailParams = {
      to: emailSettings.recipientEmail,
      subject: 'Test Email - FM Application',
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
            .details { margin-top: 20px; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Email Configuration Test</h1>
            </div>
            <div class="content">
              <p>This is a test email to verify that your email configuration is working correctly.</p>
              
              <div class="details">
                <h3>Configuration Details</h3>
                <p><strong>SMTP Server:</strong> ${emailSettings.smtpServer}</p>
                <p><strong>SMTP Port:</strong> ${emailSettings.smtpPort}</p>
                <p><strong>SSL Enabled:</strong> ${emailSettings.useSSL ? 'Yes' : 'No'}</p>
                <p><strong>Sender:</strong> ${emailSettings.senderName} (${emailSettings.senderEmail || emailSettings.username})</p>
                <p><strong>Recipient:</strong> ${emailSettings.recipientEmail}</p>
              </div>
              
              <p style="margin-top: 20px;">If you received this email, your email configuration is working properly.</p>
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
    console.log('Test email sent successfully');
    return { success: true, result };
  } catch (error) {
    console.error('Error sending test email:', error);
    return { success: false, error: error.message };
  }
} 