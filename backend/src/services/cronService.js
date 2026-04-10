// backend/src/services/cronService.js
const cron = require('node-cron');
const Document = require('../models/Document');
const Enrollment = require('../models/Enrollment');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { sendExpiringCredentialReminder, sendMissingDocumentReminder } = require('./emailService');

/**
 * Check for expiring documents and create reminders
 * Runs daily at 8:00 AM
 */
const checkExpiringDocuments = async () => {
  try {
    console.log('🔍 Checking for expiring documents...');
    
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    // Find documents expiring in next 30 days
    const expiringDocs = await Document.find({
      expiryDate: {
        $gte: today,
        $lte: thirtyDaysFromNow
      },
      status: { $in: ['approved', 'submitted'] }
    }).populate('providerId enrollmentId');
    
    console.log(`Found ${expiringDocs.length} expiring documents`);
    
    for (const doc of expiringDocs) {
      // Calculate days until expiry
      const daysUntilExpiry = Math.ceil(
        (new Date(doc.expiryDate) - today) / (1000 * 60 * 60 * 24)
      );
      
      // Check if reminder already exists
      const existingReminder = await Reminder.findOne({
        enrollmentId: doc.enrollmentId,
        reminderType: 'expiring_credential',
        status: { $in: ['pending', 'sent'] },
        'metadata.documentType': doc.documentType
      });
      
      if (!existingReminder) {
        // Get assigned specialist
        const enrollment = await Enrollment.findById(doc.enrollmentId)
          .populate('assignedTo');
        
        if (enrollment && enrollment.assignedTo) {
          // Create reminder
          await Reminder.create({
            enrollmentId: doc.enrollmentId,
            providerId: doc.providerId,
            reminderType: 'expiring_credential',
            title: `${doc.documentType} expiring in ${daysUntilExpiry} days`,
            description: `The ${doc.documentType} for ${doc.providerId.firstName} ${doc.providerId.lastName} will expire on ${doc.expiryDate.toLocaleDateString()}`,
            dueDate: doc.expiryDate,
            priority: daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 15 ? 'high' : 'medium',
            assignedTo: enrollment.assignedTo._id,
            metadata: {
              documentType: doc.documentType,
              expiryDate: doc.expiryDate,
              daysSinceLastUpdate: daysUntilExpiry
            },
            createdBy: enrollment.assignedTo._id
          });
          
          // Send email notification
          try {
            await sendExpiringCredentialReminder({
              toEmail: enrollment.assignedTo.email,
              providerName: `${doc.providerId.firstName} ${doc.providerId.lastName}`,
              documentType: doc.documentType,
              expiryDate: doc.expiryDate,
              daysUntilExpiry
            });
          } catch (emailError) {
            console.error('Failed to send email:', emailError.message);
          }
          
          console.log(`✅ Created reminder for expiring ${doc.documentType}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking expiring documents:', error);
  }
};

/**
 * Check for missing documents on active enrollments
 * Runs daily at 9:00 AM
 */
const checkMissingDocuments = async () => {
  try {
    console.log('🔍 Checking for missing documents...');
    
    // Find active enrollments
    const activeEnrollments = await Enrollment.find({
      status: { $in: ['intake', 'document_collection', 'ready_for_submission'] }
    }).populate('providerId assignedTo');
    
    console.log(`Checking ${activeEnrollments.length} active enrollments`);
    
    for (const enrollment of activeEnrollments) {
      // Use a generic minimum required set when service-specific templates are removed.
      const mandatoryDocs = [
        { documentType: 'License' },
        { documentType: 'W9' },
      ];
      
      // Get uploaded documents
      const uploadedDocs = await Document.find({
        enrollmentId: enrollment._id,
        status: { $in: ['approved', 'submitted', 'under_review'] }
      });
      
      const uploadedTypes = uploadedDocs.map(doc => doc.documentType);
      
      // Find missing documents
      const missingDocs = mandatoryDocs
        .filter(doc => !uploadedTypes.includes(doc.documentType))
        .map(doc => doc.documentType);
      
      if (missingDocs.length > 0 && enrollment.assignedTo) {
        // Check if reminder already sent recently (within 7 days)
        const recentReminder = await Reminder.findOne({
          enrollmentId: enrollment._id,
          reminderType: 'missing_document',
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        });
        
        if (!recentReminder) {
          // Create reminder
          await Reminder.create({
            enrollmentId: enrollment._id,
            providerId: enrollment.providerId._id,
            reminderType: 'missing_document',
            title: `${missingDocs.length} missing document(s)`,
            description: `Missing documents for ${enrollment.providerId.firstName} ${enrollment.providerId.lastName}: ${missingDocs.join(', ')}`,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            priority: 'high',
            assignedTo: enrollment.assignedTo._id,
            metadata: {
              missingDocuments: missingDocs
            },
            createdBy: enrollment.assignedTo._id
          });
          
          // Send email notification
          try {
            await sendMissingDocumentReminder({
              toEmail: enrollment.assignedTo.email,
              providerName: `${enrollment.providerId.firstName} ${enrollment.providerId.lastName}`,
              documentType: missingDocs.join(', '),
              clientName: enrollment.providerId.clientId?.practiceName || 'N/A'
            });
          } catch (emailError) {
            console.error('Failed to send email:', emailError.message);
          }
          
          console.log(`✅ Created reminder for ${missingDocs.length} missing document(s)`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking missing documents:', error);
  }
};

/**
 * Check for enrollments stuck in same status for too long
 * Runs daily at 10:00 AM
 */
const checkStuckEnrollments = async () => {
  try {
    console.log('🔍 Checking for stuck enrollments...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Find enrollments not updated in 30 days
    const stuckEnrollments = await Enrollment.find({
      status: { $nin: ['approved', 'rejected'] },
      updatedAt: { $lte: thirtyDaysAgo }
    }).populate('providerId assignedTo');
    
    console.log(`Found ${stuckEnrollments.length} stuck enrollments`);
    
    for (const enrollment of stuckEnrollments) {
      if (enrollment.assignedTo) {
        const daysSinceUpdate = Math.ceil(
          (new Date() - new Date(enrollment.updatedAt)) / (1000 * 60 * 60 * 24)
        );
        
        // Check if reminder already exists
        const existingReminder = await Reminder.findOne({
          enrollmentId: enrollment._id,
          reminderType: 'enrollment_stuck',
          status: { $in: ['pending', 'sent'] }
        });
        
        if (!existingReminder) {
          await Reminder.create({
            enrollmentId: enrollment._id,
            providerId: enrollment.providerId._id,
            reminderType: 'enrollment_stuck',
            title: `Enrollment stuck for ${daysSinceUpdate} days`,
            description: `Enrollment for ${enrollment.providerId.firstName} ${enrollment.providerId.lastName} (${enrollment.insuranceService || 'Insurance'}) has not been updated in ${daysSinceUpdate} days`,
            dueDate: new Date(),
            priority: 'high',
            assignedTo: enrollment.assignedTo._id,
            metadata: {
              daysSinceLastUpdate: daysSinceUpdate
            },
            createdBy: enrollment.assignedTo._id
          });
          
          console.log(`✅ Created reminder for stuck enrollment`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking stuck enrollments:', error);
  }
};

/**
 * Start all cron jobs
 */
exports.startReminderCron = () => {
  // Check expiring documents daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('\n⏰ Running daily expiring documents check...');
    await checkExpiringDocuments();
  });
  
  // Check missing documents daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('\n⏰ Running daily missing documents check...');
    await checkMissingDocuments();
  });
  
  // Check stuck enrollments daily at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('\n⏰ Running daily stuck enrollments check...');
    await checkStuckEnrollments();
  });
  
  console.log('✅ Cron jobs scheduled:');
  console.log('   - Expiring documents check: Daily at 8:00 AM');
  console.log('   - Missing documents check: Daily at 9:00 AM');
  console.log('   - Stuck enrollments check: Daily at 10:00 AM');
};

// Manual trigger functions for testing
exports.triggerExpiringDocsCheck = checkExpiringDocuments;
exports.triggerMissingDocsCheck = checkMissingDocuments;
exports.triggerStuckEnrollmentsCheck = checkStuckEnrollments;
