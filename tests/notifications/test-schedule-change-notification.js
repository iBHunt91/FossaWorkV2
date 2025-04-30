// Test script to send a schedule change notification via Pushover and Email
import { sendScheduleChangePushover } from './scripts/notifications/pushoverService.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root folder
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function sendEmailTest(subject, message) {
  try {
    // Create a transporter object using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.VITE_EMAIL_USERNAME,
        pass: process.env.VITE_EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.VITE_EMAIL_USERNAME,
      to: process.env.VITE_RECIPIENT_EMAIL,
      subject: subject,
      html: message
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

async function sendScheduleChangeTest() {
  console.log('Sending schedule change test notification...');

  // Create sample schedule changes with realistic data for Fossa clients
  const sampleChanges = [
    {
      type: 'replacement',
      priority: 'critical',
      old_dispenser_id: 'GVR-S5-4589',
      new_dispenser_id: 'GVR-S5-9842',
      customer: 'Crompco LLC',
      location: 'Wawa #8463 - Philadelphia',
      store_location: 'Main Forecourt',
      reason: 'EMV Upgrade Required',
      manufacturer: 'Gilbarco'
    },
    {
      type: 'removed',
      priority: 'high',
      dispenser_id: 'WYN-V12-7632',
      customer: 'Sheetz #234',
      location: 'Pittsburgh - Southside',
      store_location: 'Diesel Island',
      reason: 'Credit card reader failure',
      return_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    },
    {
      type: 'date_changed',
      priority: 'normal',
      dispenser_id: 'GVR-E700-5542',
      old_date: '2023-11-15',
      new_date: '2023-11-18',
      customer: 'Royal Farms #129',
      location: 'Baltimore',
      store_location: 'East Parking',
      reason: 'Parts delivery delay'
    }
  ];

  // Create a test user with the Pushover key from .env
  const testUser = {
    id: 'bruce',
    email: process.env.VITE_RECIPIENT_EMAIL,
    pushoverKey: process.env.PUSHOVER_USER_KEY,
    preferences: {
      notifications: {
        scheduleChanges: true
      }
    }
  };

  try {
    // Send Pushover notification
    console.log('Sending Pushover notification...');
    const pushoverResult = await sendScheduleChangePushover(sampleChanges, [testUser]);
    console.log('Pushover notification sent successfully:', pushoverResult);

    // Send Email notification
    console.log('Sending Email notification...');
    
    // Create email content with company branding
    let emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #2c3e50; margin: 0;">Fossa Monitor</h1>
          <h2 style="color: #e74c3c; margin: 10px 0;">🚨 Schedule Change Alert</h2>
        </div>
        
        <p>Hello Bruce,</p>
        
        <p>The following schedule changes have been detected and require your attention:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #e74c3c;">CRITICAL PRIORITY</h3>
          <p><strong>Customer:</strong> ${sampleChanges[0].customer}</p>
          <p><strong>Location:</strong> ${sampleChanges[0].location}</p>
          <p><strong>Change:</strong> Dispenser ${sampleChanges[0].old_dispenser_id} replaced with ${sampleChanges[0].new_dispenser_id}</p>
          <p><strong>Reason:</strong> ${sampleChanges[0].reason}</p>
          <p><strong>Manufacturer:</strong> ${sampleChanges[0].manufacturer}</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #f39c12;">HIGH PRIORITY</h3>
          <p><strong>Customer:</strong> ${sampleChanges[1].customer}</p>
          <p><strong>Location:</strong> ${sampleChanges[1].location}</p>
          <p><strong>Change:</strong> Dispenser ${sampleChanges[1].dispenser_id} removed</p>
          <p><strong>Reason:</strong> ${sampleChanges[1].reason}</p>
          <p><strong>Return Date:</strong> ${sampleChanges[1].return_date.toLocaleDateString()}</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #3498db;">NORMAL PRIORITY</h3>
          <p><strong>Customer:</strong> ${sampleChanges[2].customer}</p>
          <p><strong>Location:</strong> ${sampleChanges[2].location}</p>
          <p><strong>Change:</strong> Schedule date changed for dispenser ${sampleChanges[2].dispenser_id}</p>
          <p><strong>Previous Date:</strong> ${sampleChanges[2].old_date}</p>
          <p><strong>New Date:</strong> ${sampleChanges[2].new_date}</p>
          <p><strong>Reason:</strong> ${sampleChanges[2].reason}</p>
        </div>
        
        <p><strong>Action Required:</strong> Please review these changes in the Fossa Monitor dashboard and take appropriate action.</p>
        
        <p style="font-size: 0.8em; color: #7f8c8d; text-align: center; margin-top: 30px;">This is a test notification from the Fossa Monitor system.</p>
      </div>
    `;

    const emailResult = await sendEmailTest('🚨 Fossa Monitor - Schedule Changes Detected', emailContent);
    console.log('Email notification result:', emailResult);

    return { pushover: pushoverResult, email: emailResult };
  } catch (error) {
    console.error('Failed to send notifications:', error);
    throw error;
  }
}

// Execute the test function
sendScheduleChangeTest()
  .then(() => console.log('Test completed.'))
  .catch(err => console.error('Test failed:', err)); 