// backend/src/controllers/reminderController.js
const Reminder = require('../models/Reminder');

// @desc    Get all reminders
// @route   GET /api/reminders
// @access  Private
exports.getAllReminders = async (req, res) => {
  try {
    const { 
      status, 
      assignedTo, 
      reminderType, 
      priority,
      page = 1,
      limit = 20
    } = req.query;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (assignedTo) {
      query.assignedTo = assignedTo;
    } else if (req.user.role !== 'admin') {
      // Non-admin users see only their reminders
      query.assignedTo = req.user._id;
    }
    
    if (reminderType) {
      query.reminderType = reminderType;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    // Execute query
    const reminders = await Reminder.find(query)
      .populate('providerId', 'firstName lastName npi')
      .populate('enrollmentId')
      .populate('assignedTo', 'fullName email')
      .sort({ dueDate: 1, priority: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Reminder.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      data: {
        reminders,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching reminders'
    });
  }
};

// @desc    Get single reminder
// @route   GET /api/reminders/:id
// @access  Private
exports.getReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id)
      .populate('providerId')
      .populate('enrollmentId')
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName');
    
    if (!reminder) {
      return res.status(404).json({
        status: 'error',
        message: 'Reminder not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { reminder }
    });
  } catch (error) {
    console.error('Get reminder error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching reminder'
    });
  }
};

// @desc    Create new reminder
// @route   POST /api/reminders
// @access  Private
exports.createReminder = async (req, res) => {
  try {
    const reminder = await Reminder.create({
      ...req.body,
      createdBy: req.user._id
    });
    
    await reminder.populate('providerId enrollmentId assignedTo');
    // Send notifications and emails for missing document requests
    try {
      const { createNotification, notifyAdmins } = require('../services/notificationService');
      const { sendMissingDocumentReminder } = require('../services/emailService');

      // Notify the assigned user (if not the same as actor)
      if (reminder.assignedTo && String(reminder.assignedTo._id || reminder.assignedTo) !== String(req.user._id)) {
        await createNotification({
          recipient: reminder.assignedTo._id || reminder.assignedTo,
          actor: req.user._id,
          type: 'document_status_changed',
          title: reminder.title,
          message: reminder.description || 'A reminder has been created',
          entityType: 'reminder',
          entityId: reminder._id,
          metadata: reminder.metadata || {}
        });
      }

      // Notify all admins (except actor)
      await notifyAdmins({
        actor: req.user._id,
        type: 'document_status_changed',
        title: reminder.title,
        message: reminder.description || 'A reminder has been created',
        entityType: 'reminder',
        entityId: reminder._id,
        metadata: reminder.metadata || {}
      });

      // If this is a missing document reminder, attempt to send an email to assigned user
      if (String(reminder.reminderType) === 'missing_document' && reminder.assignedTo && reminder.assignedTo.email) {
        try {
          await sendMissingDocumentReminder({
            toEmail: reminder.assignedTo.email,
            providerName: `${reminder.providerId?.firstName || ''} ${reminder.providerId?.lastName || ''}`.trim(),
            documentType: Array.isArray(reminder.metadata?.requestedDocuments) ? reminder.metadata.requestedDocuments.join(', ') : (reminder.metadata?.requestedDocuments || reminder.title),
            clientName: reminder.providerId?.clientId?.practiceName || ''
          });

          reminder.emailSent = true;
          reminder.emailSentAt = new Date();
          await reminder.save();
        } catch (emailErr) {
          console.error('Failed to send missing document email on manual reminder creation:', emailErr.message || emailErr);
        }
      }
    } catch (notifErr) {
      console.error('Notification/email sending error for reminder:', notifErr.message || notifErr);
    }

    res.status(201).json({
      status: 'success',
      message: 'Reminder created successfully',
      data: { reminder }
    });
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error creating reminder'
    });
  }
};

// @desc    Update reminder
// @route   PUT /api/reminders/:id
// @access  Private
exports.updateReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('providerId enrollmentId assignedTo');
    
    if (!reminder) {
      return res.status(404).json({
        status: 'error',
        message: 'Reminder not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Reminder updated successfully',
      data: { reminder }
    });
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating reminder'
    });
  }
};

// @desc    Mark reminder as completed
// @route   PUT /api/reminders/:id/complete
// @access  Private
exports.completeReminder = async (req, res) => {
  try {
    const { actionNote } = req.body;
    const reminder = await Reminder.findById(req.params.id);
    
    if (!reminder) {
      return res.status(404).json({
        status: 'error',
        message: 'Reminder not found'
      });
    }
    
    if (actionNote) {
      reminder.metadata = reminder.metadata || {};
      reminder.metadata.auditTrail = reminder.metadata.auditTrail || [];
      reminder.metadata.auditTrail.push({
        action: 'completed',
        note: actionNote,
        by: req.user._id,
        at: new Date(),
      });
      await reminder.save();
    }

    await reminder.markAsCompleted();
    await reminder.populate('providerId enrollmentId assignedTo');
    
    res.status(200).json({
      status: 'success',
      message: 'Reminder marked as completed',
      data: { reminder }
    });
  } catch (error) {
    console.error('Complete reminder error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error completing reminder'
    });
  }
};

// @desc    Dismiss reminder
// @route   PUT /api/reminders/:id/dismiss
// @access  Private
exports.dismissReminder = async (req, res) => {
  try {
    const { actionNote } = req.body;
    const update = { $set: { status: 'dismissed' } };

    if (actionNote) {
      update.$push = {
        'metadata.auditTrail': {
          action: 'dismissed',
          note: actionNote,
          by: req.user._id,
          at: new Date(),
        }
      };
    }

    const reminder = await Reminder.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).populate('providerId enrollmentId assignedTo');
    
    if (!reminder) {
      return res.status(404).json({
        status: 'error',
        message: 'Reminder not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Reminder dismissed',
      data: { reminder }
    });
  } catch (error) {
    console.error('Dismiss reminder error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error dismissing reminder'
    });
  }
};

// @desc    Delete reminder
// @route   DELETE /api/reminders/:id
// @access  Private
exports.deleteReminder = async (req, res) => {
  try {
    const { actionNote } = req.body;

    if (actionNote) {
      const reminder = await Reminder.findById(req.params.id);
      if (reminder) {
        reminder.metadata = reminder.metadata || {};
        reminder.metadata.auditTrail = reminder.metadata.auditTrail || [];
        reminder.metadata.auditTrail.push({
          action: 'deleted',
          note: actionNote,
          by: req.user._id,
          at: new Date(),
        });
        await reminder.save();
      }
    }

    const reminder = await Reminder.findByIdAndDelete(req.params.id);
    
    if (!reminder) {
      return res.status(404).json({
        status: 'error',
        message: 'Reminder not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Reminder deleted successfully'
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting reminder'
    });
  }
};

// @desc    Get reminder statistics
// @route   GET /api/reminders/stats
// @access  Private
exports.getReminderStats = async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { assignedTo: req.user._id };
    
    const total = await Reminder.countDocuments(query);
    const pending = await Reminder.countDocuments({ ...query, status: 'pending' });
    const overdue = await Reminder.countDocuments({
      ...query,
      status: 'pending',
      dueDate: { $lt: new Date() }
    });
    const completed = await Reminder.countDocuments({ ...query, status: 'completed' });
    
    const byType = await Reminder.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$reminderType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const byPriority = await Reminder.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: {
        total,
        pending,
        overdue,
        completed,
        byType,
        byPriority
      }
    });
  } catch (error) {
    console.error('Get reminder stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching reminder statistics'
    });
  }
};
