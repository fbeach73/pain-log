import nodemailer from 'nodemailer';

// For development, use a testing service
// In production, you would use real SMTP credentials
let transporter: nodemailer.Transporter;

export const initializeEmailService = () => {
  // Check if we have SMTP credentials in environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Use real SMTP credentials
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('Email service initialized with real SMTP credentials');
  } else {
    // For development, use a test account
    console.log('No SMTP credentials found, using ethereal email for testing');
    createTestAccount();
  }
};

// Create a test account for development
const createTestAccount = async () => {
  try {
    // Generate test SMTP service account from ethereal.email
    const testAccount = await nodemailer.createTestAccount();

    // Create a transporter object using the default SMTP transport
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });

    console.log('Test email account created:', testAccount.user);
  } catch (error) {
    console.error('Failed to create test email account:', error);
  }
};

// Send an email with an attachment
export const sendEmailWithAttachment = async (
  to: string,
  subject: string,
  text: string,
  html: string,
  attachmentBuffer: Buffer,
  attachmentFilename: string
): Promise<{ success: boolean; previewUrl?: string; error?: any }> => {
  if (!transporter) {
    await initializeEmailService();
  }

  try {
    // Define email options
    const mailOptions = {
      from: process.env.SMTP_FROM || '"PainTracker" <noreply@painclinics.com>',
      to,
      subject,
      text,
      html,
      attachments: [
        {
          filename: attachmentFilename,
          content: attachmentBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent:', info.messageId);

    // Get the URL for development testing (only works with Ethereal)
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('Preview URL:', previewUrl);
    }

    return { success: true, previewUrl };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
};