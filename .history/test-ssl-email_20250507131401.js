import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the settings
const defaultSettingsPath = path.join(__dirname, 'data', 'email-settings.json');
const settings = JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));

console.log('Creating mail transporter with SSL on port 465');
// Create SSL transporter (port 465)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: settings.username,
    pass: settings.password
  },
  debug: true,
  logger: true
});

console.log(`Using app password: ${settings.password}`);
console.log(`Sending test email from ${settings.username} to bruce.hunt@owlservices.com`);

// Sending mail
transporter.sendMail({
  from: `Fossa Monitor <${settings.username}>`,
  to: 'bruce.hunt@owlservices.com',
  subject: 'SSL Test Email',
  html: '<h1>Testing SSL Config</h1><p>This email was sent using SSL on port 465.</p>'
})
.then(info => {
  console.log('✅ Email sent successfully!');
  console.log(`Message ID: ${info.messageId}`);
  
  // Update the configuration file
  const newConfig = {
    ...settings,
    smtpPort: 465,
    useSSL: true
  };
  
  console.log('Updating email-settings.json with working configuration');
  fs.writeFileSync(defaultSettingsPath, JSON.stringify(newConfig, null, 2));
  console.log('Configuration updated successfully');
})
.catch(error => {
  console.error('❌ Failed to send email:', error.message);
}); 