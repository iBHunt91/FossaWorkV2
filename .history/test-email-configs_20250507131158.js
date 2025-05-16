import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load email settings
const defaultSettingsPath = path.join(__dirname, 'data', 'email-settings.json');
const settings = JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));

// Email content
const recipient = 'bruce.hunt@owlservices.com'; // Replace with your actual recipient
const subject = 'Email Configuration Test';
const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { padding: 20px; }
    .header { padding-bottom: 15px; margin-bottom: 20px; }
    .success { color: #2ecc71; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Email Configuration Test</h1>
    </div>
    <p>Your email is now working correctly!</p>
    <p class="success">✓ Configuration successful</p>
    <p>Time sent: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
`;

// Different configurations to try
const configurations = [
  {
    name: "Gmail STARTTLS (default)",
    config: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: settings.username,
        pass: settings.password
      }
    }
  },
  {
    name: "Gmail SSL",
    config: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: settings.username,
        pass: settings.password
      }
    }
  },
  {
    name: "Gmail STARTTLS with explicit requireTLS",
    config: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: settings.username,
        pass: settings.password
      }
    }
  },
  {
    name: "Gmail STARTTLS with timeout and tls options",
    config: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false // Be cautious with this in production
      },
      auth: {
        user: settings.username,
        pass: settings.password
      }
    }
  },
  {
    name: "Gmail OAuth2",
    config: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        type: 'login', // Force login type instead of OAuth2
        user: settings.username,
        pass: settings.password
      }
    }
  }
];

// Test each configuration with timeout protection
async function testConfigurations() {
  console.log(`Starting email configuration tests at ${new Date().toLocaleString()}`);
  console.log(`Using sender: ${settings.username}`);
  console.log(`Testing with recipient: ${recipient}`);
  console.log('-'.repeat(50));

  for (let i = 0; i < configurations.length; i++) {
    const config = configurations[i];
    console.log(`\nTrying configuration ${i + 1}/${configurations.length}: ${config.name}`);
    console.log(JSON.stringify(config.config, null, 2));
    
    // Create a promise that rejects after a timeout
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timed out after 20 seconds')), 20000);
    });
    
    try {
      const transporter = nodemailer.createTransport(config.config);
      
      console.log('Verifying connection...');
      try {
        // Race the verify operation against the timeout
        await Promise.race([
          transporter.verify(),
          timeout
        ]);
        console.log('✓ Connection verified!');
      } catch (verifyError) {
        console.error('✗ Connection verification failed:', verifyError.message);
        // Continue to sending attempt anyway
      }
      
      console.log(`Sending test email to ${recipient}...`);
      // Race the sendMail operation against the timeout
      const info = await Promise.race([
        transporter.sendMail({
          from: `Fossa Monitor <${settings.username}>`,
          to: recipient,
          subject: subject,
          html: html
        }),
        timeout
      ]);
      
      console.log('✅ SUCCESS! Email sent successfully!');
      console.log(`Message ID: ${info.messageId}`);
      console.log(`\nSuccessful configuration:`);
      console.log(JSON.stringify(config.config, null, 2));
      
      // Write the successful configuration to a file
      const successConfig = {
        ...settings,
        smtpServer: config.config.host,
        smtpPort: config.config.port,
        useSSL: config.config.secure
      };
      
      fs.writeFileSync('successful-email-config.json', JSON.stringify(successConfig, null, 2));
      console.log('Saved successful configuration to successful-email-config.json');
      
      // If we got here, it worked! No need to try more configs
      return true;
    } catch (error) {
      console.error(`✗ Failed with configuration ${i + 1}:`, error.message);
      console.log('-'.repeat(50));
    }
  }
  
  console.log('\n❌ All configurations failed. Please check:');
  console.log('1. App password is correct and recently generated');
  console.log('2. All security alerts in Gmail have been addressed');
  console.log('3. Two-factor authentication is enabled on your Google account');
  console.log('4. Network/firewall is not blocking SMTP connections');
  
  return false;
}

// Run the test
testConfigurations().then(success => {
  if (success) {
    console.log('\n✅ Found working configuration! Update your email-settings.json accordingly.');
  } else {
    console.log('\n❌ No working configuration found.');
  }
}); 