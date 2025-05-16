import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import nodemailer from 'nodemailer';
import { getVisitId } from './formatService.js';
import { getActiveUser, listUsers } from '../../server/utils/userManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define path to settings file
const userSettingsPath = path.join(__dirname, '..', '..', 'data', 'user-settings.json');
const defaultSettingsPath = path.join(__dirname, '..', '..', 'data', 'email-settings.json');

/**
 * Get the user's email settings
 * @returns {Promise<Object>} The user's email settings
 */
export async function getUserEmailSettings() {
  try {
    // Get default settings first
    let settings = {
      senderName: 'Fossa Monitor',
      senderEmail: process.env.EMAIL_USERNAME || '',
      recipientEmail: '',
      smtpServer: 'smtp.gmail.com',
      smtpPort: 587,
      useSSL: true,
      username: process.env.EMAIL_USERNAME || '',
      password: process.env.EMAIL_PASSWORD || '',
      enabled: true
    };

    // Load default settings from file if they exist
    if (fs.existsSync(defaultSettingsPath)) {
      const defaultSettings = JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));
      settings = { ...settings, ...defaultSettings };
    }

    // Get active user
    const activeUserId = getActiveUser();
    const users = listUsers();
    const activeUser = users.find(u => u.id === activeUserId);
    
    if (activeUser) {
      // Try all possible user-specific paths
      const possiblePaths = [
        // ID-based path
        path.join(__dirname, '..', '..', 'data', 'users', activeUser.id, 'email_settings.json'),
        // Name-based path
        path.join(__dirname, '..', '..', 'data', 'users', activeUser.label || '', 'email_settings.json'),
        // Email-based path
        path.join(__dirname, '..', '..', 'data', 'users', activeUser.email || '', 'email_settings.json')
      ];

      for (const userSpecificPath of possiblePaths) {
        if (fs.existsSync(userSpecificPath)) {
          console.log('Found user settings at:', userSpecificPath);
          const userSettings = JSON.parse(fs.readFileSync(userSpecificPath, 'utf8'));
          if (userSettings) {
            // Merge user settings with default settings, preserving SMTP settings
            settings = {
              ...settings,  // Keep SMTP settings from default
              recipientEmail: userSettings.recipientEmail,
              // Preserve other user preferences
              showJobId: userSettings.showJobId,
              showStoreNumber: userSettings.showStoreNumber,
              showStoreName: userSettings.showStoreName,
              showLocation: userSettings.showLocation,
              showDate: userSettings.showDate,
              showDispensers: userSettings.showDispensers,
              frequency: userSettings.frequency,
              deliveryTime: userSettings.deliveryTime,
              // Get enabled status from user's notification settings if available
              enabled: activeUser.notificationSettings?.email?.enabled ?? true
            };
            console.log('Merged email settings:', settings);
            return settings;
          }
        }
      }
    }
    
    // Try global user settings as a fallback
    if (fs.existsSync(userSettingsPath)) {
      const userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      if (userSettings && userSettings.email) {
        settings = { ...settings, ...userSettings.email };
      }
    }
    
    return settings;
  } catch (error) {
    console.error('Error loading email settings:', error);
    return {
      senderName: 'Fossa Monitor',
      senderEmail: process.env.EMAIL_USERNAME || '',
      recipientEmail: '',
      smtpServer: 'smtp.gmail.com',
      smtpPort: 587,
      useSSL: true,
      username: process.env.EMAIL_USERNAME || '',
      password: process.env.EMAIL_PASSWORD || '',
      enabled: true
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
    
    // Check if email notifications are enabled
    if (emailSettings.enabled === false) {
      console.log('Email notifications are disabled, skipping email send');
      return { success: false, error: 'Email notifications are disabled' };
    }
    
    console.log('Creating SMTP transporter with settings:', {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,  // Use STARTTLS
      auth: {
        user: emailSettings.username,
        pass: emailSettings.password
      }
    });

    // Create a transporter object using SMTP with explicit TLS
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,  // Use STARTTLS
      auth: {
        user: emailSettings.username,
        pass: emailSettings.password
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      }
    });

    // Check for recipient in multiple places with prioritization
    const recipientEmail = options.to || process.env.VITE_RECIPIENT_EMAIL || emailSettings.recipientEmail || process.env.RECIPIENT_EMAIL;

    // Ensure we have a valid sender email
    const senderEmail = emailSettings.senderEmail || emailSettings.username || process.env.EMAIL_USERNAME;
    const senderName = emailSettings.senderName || 'Fossa Monitor';

    const mailOptions = {
      from: `${senderName} <${senderEmail}>`,
      to: recipientEmail,
      subject: options.subject,
      ...(options.text && { text: options.text }),
      ...(options.html && { html: options.html }),
      ...(options.cc && { cc: options.cc })
    };

    // If no recipient, return error
    if (!mailOptions.to) {
      console.log('No recipient email configured, skipping email send');
      return { success: false, error: 'No recipient email configured' };
    }

    // If no sender, return error
    if (!senderEmail) {
      console.log('No sender email configured, skipping email send');
      return { success: false, error: 'No sender email configured' };
    }

    console.log('Sending email with options:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      from: mailOptions.from,
      cc: mailOptions.cc || 'none'
    });

    try {
      // First verify the connection
      console.log('Verifying SMTP connection...');
      await transporter.verify();
      console.log('SMTP connection verified successfully');

      // Then send the email
      console.log('Sending email...');
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Detailed error information:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        command: error.command
      });
      return { success: false, error: `Failed to send email: ${error.message}` };
    }
  } catch (error) {
    console.error('Error in sendEmail:', error);
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

    // Get user's display name - pass entire user object for better name extraction
    const userName = await getUserDisplayName(user);
    console.log('Using name for email greeting:', userName);

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
            .greeting {
                font-size: 1.1em;
                margin-bottom: 20px;
            }
            .change-block {
                margin-bottom: 15px;
                padding: 15px;
                border-radius: 5px;
                background-color: #f8f9fa;
                border-left: 4px solid;
            }
            .removed {
                border-left-color: #FF3B30;
            }
            .added {
                border-left-color: #34C759;
            }
            .date-changed {
                border-left-color: #FF9500;
            }
            .swap {
                border-left-color: #007AFF;
            }
            .replacement {
                border-left-color: #AF52DE;
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
            <h1>📅 Schedule Changes</h1>
            <p><i>Generated: ${formattedDate} at ${formattedTime}</i></p>
        </div>
        <p class="greeting">Hello ${userName},</p>`;

    // Add all changes section
    if (changes.allChanges && changes.allChanges.length > 0) {
        html += ``;
        
        for (const change of changes.allChanges) {
            if (change.type === 'removed') {
                let mapUrl;
                if (change.address) {
                    // If full address object is available, use all parts
                    const addressParts = [];
                    if (change.address.street) addressParts.push(change.address.street);
                    if (change.address.cityState) addressParts.push(change.address.cityState);
                    if (change.address.county) addressParts.push(change.address.county);
                    
                    const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
                    
                    // Create a Google Maps direct navigation URL with the full address
                    // Format: https://www.google.com/maps/place/FULL+ADDRESS
                    mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
                    
                    // For display, use just the city/town part or the first part of the address
                    
                } else {
                    // Fall back to location field
                    mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(change.location || 'Unknown')}`;
                }
                
                html += `
                <div class="change-block removed">
                    <h3 style="color: #FF3B30; border-bottom: 2px solid #FF3B30; padding-bottom: 5px; margin-bottom: 15px;">🗑️ Removed Visit</h3>
                    <p>• <strong>Visit:</strong> #${getVisitId(change.jobId)}</p>
                    <p>• <strong>Store:</strong> ${change.store}</p>
                    ${change.location ? `<p>• <strong>Location:</strong> <a href="${mapUrl}">${change.location}</a></p>` : ''}
                    <p>• <strong>Dispensers:</strong> ${change.dispensers || 0}</p>
                    <p>• <strong>Date:</strong> ${change.date}</p>
                </div>`;
            } else if (change.type === 'added') {
                let mapUrl;
                if (change.address) {
                    // If full address object is available, use all parts
                    const addressParts = [];
                    if (change.address.street) addressParts.push(change.address.street);
                    if (change.address.cityState) addressParts.push(change.address.cityState);
                    if (change.address.county) addressParts.push(change.address.county);
                    
                    const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
                    mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
                } else {
                    // Fall back to location field
                    mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(change.location || 'Unknown')}`;
                }
                
                html += `
                <div class="change-block added">
                    <h3 style="color: #34C759; border-bottom: 2px solid #34C759; padding-bottom: 5px; margin-bottom: 15px;">➕ Added Visit</h3>
                    <p>• <strong>Visit:</strong> #${getVisitId(change.jobId)}</p>
                    <p>• <strong>Store:</strong> ${change.store}</p>
                    ${change.location ? `<p>• <strong>Location:</strong> <a href="${mapUrl}">${change.location}</a></p>` : ''}
                    <p>• <strong>Dispensers:</strong> ${change.dispensers || 0}</p>
                    <p>• <strong>Date:</strong> ${change.date}</p>
                </div>`;
            } else if (change.type === 'date_changed') {
                let mapUrl;
                if (change.address) {
                    // If full address object is available, use all parts
                    const addressParts = [];
                    if (change.address.street) addressParts.push(change.address.street);
                    if (change.address.cityState) addressParts.push(change.address.cityState);
                    if (change.address.county) addressParts.push(change.address.county);
                    
                    const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
                    mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
                } else {
                    // Fall back to location field
                    mapUrl = `https://www.google.com/maps/place/${encodeURIComponent(change.location || 'Unknown')}`;
                }
                
                html += `
                <div class="change-block date-changed">
                    <h3 style="color: #FF9500; border-bottom: 2px solid #FF9500; padding-bottom: 5px; margin-bottom: 15px;">📅 Date Changed</h3>
                    <p>• <strong>Visit:</strong> #${getVisitId(change.jobId)}</p>
                    <p>• <strong>Store:</strong> ${change.store}</p>
                    ${change.location ? `<p>• <strong>Location:</strong> <a href="${mapUrl}">${change.location}</a></p>` : ''}
                    <p>• <strong>Dispensers:</strong> ${change.dispensers || 'Unknown'}</p>
                    <p>• <strong>From:</strong> ${change.oldDate}</p>
                    <p>• <strong>To:</strong> ${change.newDate}</p>
                </div>`;
            } else if (change.type === 'swap') {
                // Create Map URLs for both jobs
                let job1MapUrl, job2MapUrl;
                
                // For Job 1
                if (change.job1Address) {
                    // If full address object is available, use all parts
                    const addressParts = [];
                    if (change.job1Address.street) addressParts.push(change.job1Address.street);
                    if (change.job1Address.cityState) addressParts.push(change.job1Address.cityState);
                    if (change.job1Address.county) addressParts.push(change.job1Address.county);
                    
                    const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
                    job1MapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
                } else {
                    // Fall back to location field
                    job1MapUrl = `https://www.google.com/maps/place/${encodeURIComponent(change.job1Location || 'Unknown')}`;
                }
                
                // For Job 2
                if (change.job2Address) {
                    // If full address object is available, use all parts
                    const addressParts = [];
                    if (change.job2Address.street) addressParts.push(change.job2Address.street);
                    if (change.job2Address.cityState) addressParts.push(change.job2Address.cityState);
                    if (change.job2Address.county) addressParts.push(change.job2Address.county);
                    
                    const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
                    job2MapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
                } else {
                    // Fall back to location field
                    job2MapUrl = `https://www.google.com/maps/place/${encodeURIComponent(change.job2Location || 'Unknown')}`;
                }
                
                html += `
                <div class="change-block swap">
                    <h3 style="color: #007AFF; border-bottom: 2px solid #007AFF; padding-bottom: 5px; margin-bottom: 15px;">🔄 Visits Swapped</h3>
                    <p><strong>Visit 1:</strong></p>
                    <p>• <strong>Visit:</strong> #${getVisitId(change.job1Id)}</p>
                    <p>• <strong>Store:</strong> ${change.job1Store}</p>
                    ${change.job1Location ? `<p>• <strong>Location:</strong> <a href="${job1MapUrl}">${change.job1Location}</a></p>` : ''}
                    <p>• <strong>Date:</strong> ${change.oldDate1} → ${change.newDate1}</p>
                    <p><strong>Visit 2:</strong></p>
                    <p>• <strong>Visit:</strong> #${getVisitId(change.job2Id)}</p>
                    <p>• <strong>Store:</strong> ${change.job2Store}</p>
                    ${change.job2Location ? `<p>• <strong>Location:</strong> <a href="${job2MapUrl}">${change.job2Location}</a></p>` : ''}
                    <p>• <strong>Date:</strong> ${change.oldDate2} → ${change.newDate2}</p>
                </div>`;
            } else if (change.type === 'replacement') {
                // Create Map URLs for both removed and added jobs
                let removedMapUrl, addedMapUrl;
                
                // For Removed Job
                if (change.removedAddress) {
                    // If full address object is available, use all parts
                    const addressParts = [];
                    if (change.removedAddress.street) addressParts.push(change.removedAddress.street);
                    if (change.removedAddress.cityState) addressParts.push(change.removedAddress.cityState);
                    if (change.removedAddress.county) addressParts.push(change.removedAddress.county);
                    
                    const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
                    removedMapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
                } else if (change.removedLocation) {
                    // Fall back to location field
                    removedMapUrl = `https://www.google.com/maps/place/${encodeURIComponent(change.removedLocation)}`;
                }
                
                // For Added Job
                if (change.addedAddress) {
                    // If full address object is available, use all parts
                    const addressParts = [];
                    if (change.addedAddress.street) addressParts.push(change.addedAddress.street);
                    if (change.addedAddress.cityState) addressParts.push(change.addedAddress.cityState);
                    if (change.addedAddress.county) addressParts.push(change.addedAddress.county);
                    
                    const fullAddress = addressParts.join(', ').replace(/\s+/g, ' ').trim();
                    addedMapUrl = `https://www.google.com/maps/place/${encodeURIComponent(fullAddress)}`;
                } else if (change.addedLocation) {
                    // Fall back to location field
                    addedMapUrl = `https://www.google.com/maps/place/${encodeURIComponent(change.addedLocation)}`;
                }
                
                html += `
                <div class="change-block replacement">
                    <h3 style="color: #AF52DE; border-bottom: 2px solid #AF52DE; padding-bottom: 5px; margin-bottom: 15px;">♻️ Visit Replaced</h3>
                    <p><strong>Removed Visit:</strong></p>
                    <p>• <strong>Visit:</strong> #${getVisitId(change.removedJobId)}</p>
                    <p>• <strong>Store:</strong> ${change.removedStore}</p>
                    ${change.removedLocation ? `<p>• <strong>Location:</strong> <a href="${removedMapUrl}">${change.removedLocation}</a></p>` : ''}
                    <p>• <strong>Dispensers:</strong> ${change.removedDispensers || 'Unknown'}</p>
                    <p><strong>Added Visit:</strong></p>
                    <p>• <strong>Visit:</strong> #${getVisitId(change.addedJobId)}</p>
                    <p>• <strong>Store:</strong> ${change.addedStore}</p>
                    ${change.addedLocation ? `<p>• <strong>Location:</strong> <a href="${addedMapUrl}">${change.addedLocation}</a></p>` : ''}
                    <p>• <strong>Dispensers:</strong> ${change.addedDispensers || 'Unknown'}</p>
                    <p>• <strong>Date:</strong> ${change.date}</p>
                </div>`;
            }
        }
    }

    // Add footer
    html += `
        <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
            <p>If you have any questions, please contact your supervisor.</p>
        </div>
    </body>
    </html>
    `;

    // Send the email notification
    const emailSettings = await getUserEmailSettings();
    
    try {
        const result = await sendEmail({
            to: user.email || emailSettings.recipientEmail,
            subject: `Schedule Changes Alert: ${summary}`,
            html: html
        });
        
        return result;
    } catch (error) {
        console.error('Error sending schedule change email:', error);
        return { success: false, error: error.message || error };
    }
}

/**
 * Send a test email
 * @returns {Promise<Object>}
 */
export async function sendTestEmail() {
  try {
    const emailSettings = await getUserEmailSettings();
    
    // Use recipient email from settings or environment variable
    const recipientEmail = emailSettings.recipientEmail || process.env.VITE_RECIPIENT_EMAIL;
    
    // Skip if no recipient email configured (check both sources)
    if (!recipientEmail) {
      console.warn('No recipient email configured in settings or environment, cannot send test email');
      return { success: false, error: 'No recipient email configured' };
    }

    // Get the active user
    const activeUserId = getActiveUser();
    console.log('Active user ID for test email:', activeUserId);
    
    // Create a user object with as much info as possible
    const users = listUsers();
    const activeUser = users.find(u => u.id === activeUserId) || {};
    
    // Use complete user object for better name extraction
    const userName = await getUserDisplayName(activeUser);
    console.log('Using name for test email greeting:', userName);
    
    const emailParams = {
      to: recipientEmail,
      subject: 'Test Notification - Fossa Monitor',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { border-bottom: 2px solid #3498db; padding-bottom: 15px; margin-bottom: 20px; }
            .content { background-color: #f8f9fa; padding: 20px; border-radius: 5px; }
            .detail-block { margin: 15px 0; padding: 15px; border-radius: 5px; background-color: #fff; border-left: 4px solid #3498db; }
            .status-block { margin: 15px 0; padding: 15px; border-radius: 5px; background-color: #fff; border-left: 4px solid #27ae60; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 15px; }
            h1, h2, h3 { color: #2c3e50; }
            .success { color: #2ecc71; font-weight: bold; }
            .warning { color: #f39c12; font-weight: bold; }
            .details-row { margin: 8px 0; }
            .greeting { font-size: 1.1em; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Email Notification Test</h1>
            </div>
            <div class="content">
              <p class="greeting">Hello ${userName},</p>
              <p>Your email notification system is working correctly. Notifications will be sent when schedule changes occur.</p>
              
              <div class="status-block">
                <h3>📧 Connection Status</h3>
                <p class="details-row">
                  <span class="success">✓</span> Email service connected successfully
                </p>
                <p class="details-row">• SMTP Server: <span class="success">Connected</span></p>
                <p class="details-row">• Authentication: <span class="success">Verified</span></p>
              </div>
              
              <div class="detail-block">
                <h3>ℹ️ Notification Info</h3>
                <p class="details-row">• Type: <strong>System Test</strong></p>
                <p class="details-row">• Recipient: <strong>${recipientEmail}</strong></p>
                <p class="details-row">• User: <strong>${userName}</strong></p>
                <p class="details-row">• Time: <strong>${new Date().toLocaleString()}</strong></p>
              </div>
              
              <div class="detail-block">
                <h3>⚠️ Email Delivery Notice</h3>
                <p class="details-row">
                  <span class="warning">Important:</span> If this is your first time receiving emails from Fossa Monitor:
                </p>
                <p class="details-row">
                  • Check your spam/junk folder if you don't see notifications in your inbox
                </p>
                <p class="details-row">
                  • Add <strong>${emailSettings.senderEmail || emailSettings.username}</strong> to your contacts to ensure delivery
                </p>
                <p class="details-row">
                  • Mark this email as "Not Spam" if found in spam folder
                </p>
              </div>
            </div>
            <div class="footer">
              <p>Fossa Monitor Notification System</p>
              <p>Time sent: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Log the recipient for debugging
    console.log('Sending test email to:', recipientEmail);
    console.log('User name in email:', userName);

    // Use the proper sendEmail function that actually sends the email
    const result = await sendEmail(emailParams);
    console.log('Test email sent successfully');
    return { success: true, result };
  } catch (error) {
    console.error('Error sending test email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the user's display name for email personalization
 * @param {string|Object} user - The user ID or user object
 * @returns {string} - The user's display name
 */
async function getUserDisplayName(user) {
  try {
    // First, try to get the label (display name) using userManager since that has the UI names
    let userDisplayName = null;
    
    // If user is an object, use properties directly
    if (typeof user === 'object' && user !== null) {
      const userId = user.id;
      if (userId) {
        try {
          // Get user information from userManager as this has the display names from the UI
          const users = listUsers();
          const uiUser = users.find(u => u.id === userId);
          if (uiUser && uiUser.label) {
            // This is the name shown in the UI (e.g., "Bruce Hunt")
            userDisplayName = uiUser.label;
            console.log(`Found user display name from userManager: ${userDisplayName}`);
            return userDisplayName;
          }
        } catch (err) {
          console.warn('Error getting display name from userManager:', err);
        }
      }
      
      // If we couldn't get the name from userManager, try using the properties in the user object
      if (user.label) {
        return user.label;
      }
      
      if (user.friendlyName) {
        return user.friendlyName;
      }
      
      if (user.name) {
        return user.name;
      }
      
      // Only use email if we don't have a better option
      if (user.email) {
        // Don't use the email directly - try to extract a name from it
        // but only if we're sure it's not a display name already
        if (user.email.includes('@')) {
          // Format the email name nicely
          const emailName = user.email.split('@')[0];
          return emailName.split('.').map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
          ).join(' ');
        } else {
          return user.email;
        }
      }
    }
    
    // If user is a string, treat it as userId
    const userId = typeof user === 'string' ? user : user?.id;
    if (userId) {
      // Try to get user info from userManager
      const users = listUsers();
      const foundUser = users.find(u => u.id === userId);
      
      if (foundUser) {
        // The label property from userManager should be the display name shown in the UI
        if (foundUser.label) {
          return foundUser.label;
        }
        
        if (foundUser.friendlyName) {
          return foundUser.friendlyName;
        }
        
        if (foundUser.email && foundUser.email.includes('@')) {
          // Format email nicely
          const emailName = foundUser.email.split('@')[0];
          return emailName.split('.').map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
          ).join(' ');
        }
      }
    }
    
    // Default fallback
    return 'User';
  } catch (error) {
    console.warn('Could not get user display name:', error);
    return 'User';
  }
} 