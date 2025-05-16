// Simple script to test nodemailer with Gmail
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('Starting email test script...');

  // Gmail settings - same as in your data/email-settings.json
  const settings = {
    senderName: "Fossa Monitor",
    senderEmail: "fossamonitor@gmail.com",
    smtpServer: "smtp.gmail.com",
    smtpPort: 587,
    useSSL: false,
    username: "fossamonitor@gmail.com",
    password: "xaja psvu ilfc konf" // Your actual app password
  };

  // Test different transport configurations
  const transportConfigs = [
    {
      name: "Standard Config (Port 587, STARTTLS)",
      config: {
        host: settings.smtpServer,
        port: settings.smtpPort,
        secure: settings.useSSL, // false for 587, true for 465
        auth: {
          user: settings.username,
          pass: settings.password
        },
        debug: true,
        logger: true
      }
    },
    {
      name: "Explicit STARTTLS Config",
      config: {
        host: settings.smtpServer,
        port: settings.smtpPort,
        secure: settings.useSSL, // false for 587
        requireTLS: true,
        auth: {
          user: settings.username,
          pass: settings.password
        },
        debug: true,
        logger: true
      }
    },
    {
      name: "SSL/TLS Config (Port 465)",
      config: {
        host: settings.smtpServer,
        port: 465,
        secure: true, // true for 465
        auth: {
          user: settings.username,
          pass: settings.password
        },
        debug: true,
        logger: true
      }
    }
  ];

  // Recipient email
  const recipientEmail = "bruce.hunt@owlservices.com"; // Your test recipient

  for (const transportConfig of transportConfigs) {
    console.log(`\n\n-------------------- Testing: ${transportConfig.name} --------------------`);
    try {
      console.log("Creating transporter with config:", JSON.stringify(transportConfig.config, null, 2));
      const transporter = nodemailer.createTransport(transportConfig.config);

      console.log("Verifying transporter connection...");
      await transporter.verify().catch(err => {
        throw new Error(`Verification failed: ${err.message}`);
      });
      console.log("✅ Transporter verified successfully!");

      console.log(`Sending test email to ${recipientEmail}...`);
      const info = await transporter.sendMail({
        from: `${settings.senderName} <${settings.senderEmail}>`,
        to: recipientEmail,
        subject: `Test Email - ${transportConfig.name}`,
        text: `This is a test email sent using nodemailer with the following configuration: ${transportConfig.name}`,
        html: `<p>This is a test email sent using nodemailer with the following configuration:</p>
               <p><strong>${transportConfig.name}</strong></p>
               <p>Time: ${new Date().toLocaleString()}</p>`
      });

      console.log("✅ Email sent successfully!");
      console.log("Message ID:", info.messageId);
      console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
    } catch (error) {
      console.error(`❌ Error with ${transportConfig.name}:`, error);
    }
  }

  console.log("\n\nEmail testing completed.");
}

// Run the test and handle promise rejection
testEmail().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
}); 