import nodemailer from 'nodemailer';
import fs from 'fs';

// Hard-coded configuration
const settings = {
  username: "fossamonitor@gmail.com",
  password: "ccvs xlch zmus pmpv"
};

console.log('Creating transporter with direct IP address and security options for VPN compatibility');
const transporter = nodemailer.createTransport({
  host: '74.125.140.108', // Direct Gmail SMTP IP
  port: 465,
  secure: true, // SSL
  auth: {
    user: settings.username,
    pass: settings.password
  },
  // Additional options for working with VPN
  tls: {
    // Don't fail on invalid certs - this helps when VPN intercepts traffic
    rejectUnauthorized: false,
    // Use direct connection rather than proxied
    servername: 'smtp.gmail.com' // Identify server by name for TLS SNI
  },
  // Debug mode
  debug: true,
  logger: true
});

console.log('Attempting to send test email via direct IP with VPN compatibility settings');
transporter.sendMail({
  from: `"Fossa Monitor" <${settings.username}>`,
  to: "bruce.hunt@owlservices.com",
  subject: "VPN Direct IP Test",
  text: "If you see this, the VPN direct IP workaround was successful",
  html: "<b>If you see this, the VPN direct IP workaround was successful</b>"
})
.then(info => {
  console.log('✅ Email sent successfully!');
  console.log('Message ID:', info.messageId);

  // Update settings with working configuration
  const updatedSettings = {
    senderName: "Fossa Monitor",
    senderEmail: "fossamonitor@gmail.com",
    smtpServer: "74.125.140.108", // Direct IP
    smtpPort: 465,
    useSSL: true,
    username: "fossamonitor@gmail.com",
    password: "ccvs xlch zmus pmpv",
    // Add VPN-specific TLS settings that can be loaded by the main application
    tlsOptions: {
      rejectUnauthorized: false,
      servername: 'smtp.gmail.com'
    }
  };

  // Write the successful settings back to the file
  fs.writeFileSync('data/email-settings.json', JSON.stringify(updatedSettings, null, 2));
  console.log('Updated email-settings.json with VPN-compatible settings');
})
.catch(error => {
  console.error('❌ Failed to send email:', error.message);
  console.log('Try modifying the script to use different IP addresses for Gmail SMTP servers:');
  console.log('- 142.250.152.108');
  console.log('- 173.194.202.108');
  console.log('- 142.250.4.108');
}); 