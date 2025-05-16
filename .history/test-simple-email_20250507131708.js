import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a test email function with a specified configuration
async function sendTestEmail() {
  try {
    // Update these values to the correct ones
    const settings = {
      username: "fossamonitor@gmail.com",
      password: "ccvs xlch zmus pmpv"
    };
    
    console.log("Creating transporter with Gmail's recommended settings");
    
    // Using Gmail's recommended settings
    const transporter = nodemailer.createTransport({
      service: 'gmail',  // Use Gmail's predefined settings
      auth: {
        user: settings.username,
        pass: settings.password
      }
    });
    
    console.log("Sending test email...");
    const info = await transporter.sendMail({
      from: `"Fossa Monitor" <${settings.username}>`,
      to: "bruce.hunt@owlservices.com",
      subject: "Email Configuration Test",
      text: "If you see this, your email configuration is working correctly.",
      html: "<b>If you see this, your email configuration is working correctly.</b>"
    });
    
    console.log("Email sent successfully:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

// Execute the test
sendTestEmail().then(success => {
  if (success) {
    console.log("\n✅ Success! Email configuration works. Check your inbox.");
    
    // Update the data/email-settings.json file with working settings
    const settings = {
      senderName: "Fossa Monitor",
      senderEmail: "fossamonitor@gmail.com",
      smtpServer: "smtp.gmail.com",
      smtpPort: 465,
      useSSL: true,
      username: "fossamonitor@gmail.com",
      password: "ccvs xlch zmus pmpv"
    };
    
    try {
      const filePath = path.join(__dirname, 'data', 'email-settings.json');
      fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
      console.log("✓ Updated email-settings.json with working configuration");
    } catch (err) {
      console.error("Failed to update configuration file:", err);
    }
  } else {
    console.log("\n❌ Failed to send email. Check the error above.");
  }
}); 