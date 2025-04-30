import nodemailer from 'nodemailer';

// Create a transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: import.meta.env.VITE_EMAIL_USERNAME,
    pass: import.meta.env.VITE_EMAIL_PASSWORD
  }
});

/**
 * Email options interface
 */
interface EmailOptions {
  to?: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string;
}

/**
 * Email response interface
 */
interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: any;
}

/**
 * Send an email using nodemailer
 * @param {EmailOptions} options - Email options
 * @returns {Promise<EmailResponse>}
 */
export const sendEmail = async (options: EmailOptions): Promise<EmailResponse> => {
  try {
    const mailOptions = {
      from: import.meta.env.VITE_EMAIL_USERNAME,
      to: options.to || import.meta.env.VITE_RECIPIENT_EMAIL,
      subject: options.subject,
      ...options.text && { text: options.text },
      ...options.html && { html: options.html },
      ...options.cc && { cc: options.cc }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
};

/**
 * Legacy method for backward compatibility
 * @deprecated Use the object parameter version instead
 */
export const sendSimpleEmail = async (subject: string, text: string): Promise<EmailResponse> => {
  return sendEmail({
    subject,
    text
  });
}; 