// backend/src/services/emailService.js
const sgMail = require('@sendgrid/mail');

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const fromEmail = process.env.SENDGRID_FROM_EMAIL;
const fromName = process.env.SENDGRID_FROM_NAME;

/**
 * Send reminder email for missing documents
 * @param {Object} data - Email data
 */
exports.sendMissingDocumentReminder = async (data) => {
  try {
    const { toEmail, providerName, documentType, clientName } = data;
    
    const msg = {
      to: toEmail,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: `Missing Document Alert: ${documentType} - ${providerName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Missing Document Alert</h2>
          <p>Hello,</p>
          <p>This is a reminder that the following document is missing for provider credentialing:</p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Provider:</strong> ${providerName}</p>
            <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
            <p style="margin: 5px 0;"><strong>Missing Document:</strong> ${documentType}</p>
          </div>
          
          <p>Please upload this document as soon as possible to avoid delays in the credentialing process.</p>
          
          <p style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/documents" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Upload Document
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This is an automated message from Healthcare CRM.
          </p>
        </div>
      `
    };
    
    await sgMail.send(msg);
    console.log(`✅ Missing document email sent to ${toEmail}`);
    
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send reminder email for expiring credentials
 * @param {Object} data - Email data
 */
exports.sendExpiringCredentialReminder = async (data) => {
  try {
    const { toEmail, providerName, documentType, expiryDate, daysUntilExpiry } = data;
    
    const msg = {
      to: toEmail,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: `Credential Expiring Soon: ${documentType} - ${providerName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ea580c;">Credential Expiring Soon</h2>
          <p>Hello,</p>
          <p>This is a reminder that the following credential will expire soon:</p>
          
          <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Provider:</strong> ${providerName}</p>
            <p style="margin: 5px 0;"><strong>Document:</strong> ${documentType}</p>
            <p style="margin: 5px 0;"><strong>Expiry Date:</strong> ${new Date(expiryDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Days Until Expiry:</strong> ${daysUntilExpiry} days</p>
          </div>
          
          <p>Please renew this credential and upload the updated document to avoid any disruption in credentialing status.</p>
          
          <p style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/documents" 
               style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Update Document
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This is an automated message from Healthcare CRM.
          </p>
        </div>
      `
    };
    
    await sgMail.send(msg);
    console.log(`✅ Expiring credential email sent to ${toEmail}`);
    
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send enrollment status update notification
 * @param {Object} data - Email data
 */
exports.sendEnrollmentStatusUpdate = async (data) => {
  try {
    const { toEmail, providerName, insuranceService, oldStatus, newStatus } = data;
    const insuranceLabel = insuranceService || 'Insurance Service';
    
    const msg = {
      to: toEmail,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: `Enrollment Status Update: ${providerName} - ${insuranceLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Enrollment Status Update</h2>
          <p>Hello,</p>
          <p>The enrollment status has been updated:</p>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Provider:</strong> ${providerName}</p>
            <p style="margin: 5px 0;"><strong>Insurance Service:</strong> ${insuranceLabel}</p>
            <p style="margin: 5px 0;"><strong>Previous Status:</strong> ${oldStatus}</p>
            <p style="margin: 5px 0;"><strong>New Status:</strong> <span style="color: #16a34a; font-weight: bold;">${newStatus}</span></p>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/enrollments" 
               style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Enrollment
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This is an automated message from Healthcare CRM.
          </p>
        </div>
      `
    };
    
    await sgMail.send(msg);
    console.log(`✅ Status update email sent to ${toEmail}`);
    
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send welcome email to new user
 * @param {Object} data - Email data
 */
exports.sendWelcomeEmail = async (data) => {
  try {
    const { toEmail, userName } = data;
    
    const msg = {
      to: toEmail,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: 'Welcome to Healthcare CRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Healthcare CRM!</h2>
          <p>Hello ${userName},</p>
          <p>Your account has been successfully created. You can now access the Healthcare Credentialing Management System.</p>
          
          <p style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Login to Your Account
            </a>
          </p>
          
          <p>If you have any questions, please contact your system administrator.</p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This is an automated message from Healthcare CRM.
          </p>
        </div>
      `
    };
    
    await sgMail.send(msg);
    console.log(`✅ Welcome email sent to ${toEmail}`);
    
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send generic notification email
 * @param {Object} data - Email data
 */
exports.sendNotification = async (data) => {
  try {
    const { toEmail, subject, message } = data;
    
    const msg = {
      to: toEmail,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Notification</h2>
          <div style="padding: 20px; background-color: #f3f4f6; border-radius: 5px;">
            ${message}
          </div>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This is an automated message from Healthcare CRM.
          </p>
        </div>
      `
    };
    
    await sgMail.send(msg);
    console.log(`✅ Notification email sent to ${toEmail}`);
    
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    throw new Error('Failed to send email');
  }
};
