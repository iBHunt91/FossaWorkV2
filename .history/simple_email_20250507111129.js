import nodemailer from 'nodemailer';

async function sendSimpleEmail() {
  try {
    // Create a transporter object using SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'fossamonitor@gmail.com',
        pass: 'xaja psvu ilfc konf'
      }
    });

    // Email options
    const mailOptions = {
      from: 'Fossa Monitor <fossamonitor@gmail.com>',
      to: 'bruce.hunt@owlservices.com',
      subject: 'Simple Test Email for Bruce',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Hello Bruce!</h1>
          <p>This is a simple test email sent at ${new Date().toLocaleString()}</p>
        </div>
      `
    };

    console.log('Sending email to:', mailOptions.to);
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error };
  }
}

// Run the function
sendSimpleEmail().then(result => {
  console.log('Result:', result);
}).catch(error => {
  console.error('Error:', error);
}); 