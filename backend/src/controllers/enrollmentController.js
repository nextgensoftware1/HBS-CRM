// backend/src/controllers/enrollmentController.js
const Enrollment = require('../models/Enrollment');
const Provider = require('../models/Provider');
const Payer = require('../models/Payer');
const Document = require('../models/Document');

// @desc    Get all enrollments
// @route   GET /api/enrollments
// @access  Private
exports.getAllEnrollments = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      providerId, 
      payerId, 
      assignedTo, 
      priority,
      page = 1, 
      limit = 10 
    } = req.query;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (providerId) {
      query.providerId = providerId;
    }
    
    if (payerId) {
      query.payerId = payerId;
    }
    
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    // Execute query with pagination
    const enrollments = await Enrollment.find(query)
      .populate('providerId', 'firstName lastName npi specialization')
      .populate('payerId', 'payerName payerType')
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Get total count
    const total = await Enrollment.countDocuments(query);
    
    // If search term provided, filter by provider name
    let filteredEnrollments = enrollments;
    if (search) {
      filteredEnrollments = enrollments.filter(enrollment => {
        const providerName = `${enrollment.providerId.firstName} ${enrollment.providerId.lastName}`.toLowerCase();
        const payerName = enrollment.payerId.payerName.toLowerCase();
        const searchLower = search.toLowerCase();
        return providerName.includes(searchLower) || payerName.includes(searchLower);
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        enrollments: filteredEnrollments,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching enrollments'
    });
  }
};

// @desc    Get single enrollment
// @route   GET /api/enrollments/:id
// @access  Private
exports.getEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate('providerId')
      .populate('payerId')
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName')
      .populate('timeline.performedBy', 'fullName')
      .populate('notes.createdBy', 'fullName');
    
    if (!enrollment) {
      return res.status(404).json({
        status: 'error',
        message: 'Enrollment not found'
      });
    }
    
    // Get documents for this enrollment
    const documents = await Document.find({ enrollmentId: enrollment._id })
      .populate('uploadedBy', 'fullName')
      .populate('verifiedBy', 'fullName')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      data: {
        enrollment,
        documents
      }
    });
  } catch (error) {
    console.error('Get enrollment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching enrollment'
    });
  }
};

// @desc    Create new enrollment
// @route   POST /api/enrollments
// @access  Private (Admin/Specialist)
exports.createEnrollment = async (req, res) => {
  try {
    const {
      providerId,
      payerId,
      priority,
      assignedTo,
      notes
    } = req.body;
    
    // Check if enrollment already exists
    const existingEnrollment = await Enrollment.findOne({ providerId, payerId });
    
    if (existingEnrollment) {
      return res.status(400).json({
        status: 'error',
        message: 'Enrollment already exists for this provider and payer'
      });
    }
    
    // Create enrollment
    const enrollment = await Enrollment.create({
      providerId,
      payerId,
      priority: priority || 'medium',
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id
    });
    
    // Add initial timeline event
    await enrollment.addTimelineEvent({
      eventType: 'status_change',
      eventDescription: 'Enrollment created',
      performedBy: req.user._id
    });
    
    // Add initial note if provided
    if (notes) {
      await enrollment.addNote({
        content: notes,
        noteType: 'internal',
        createdBy: req.user._id
      });
    }
    
    // Populate before sending response
    await enrollment.populate('providerId payerId assignedTo createdBy');
    
    res.status(201).json({
      status: 'success',
      message: 'Enrollment created successfully',
      data: { enrollment }
    });
  } catch (error) {
    console.error('Create enrollment error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error creating enrollment'
    });
  }
};

// @desc    Update enrollment
// @route   PUT /api/enrollments/:id
// @access  Private (Admin/Specialist)
exports.updateEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        status: 'error',
        message: 'Enrollment not found'
      });
    }
    
    const oldStatus = enrollment.status;
    
    // Update enrollment
    Object.assign(enrollment, req.body);
    await enrollment.save();
    
    // If status changed, add timeline event
    if (req.body.status && req.body.status !== oldStatus) {
      await enrollment.addTimelineEvent({
        eventType: 'status_change',
        eventDescription: `Status changed from ${oldStatus} to ${req.body.status}`,
        performedBy: req.user._id,
        metadata: { oldStatus, newStatus: req.body.status }
      });
    }
    
    await enrollment.populate('providerId payerId assignedTo');
    
    res.status(200).json({
      status: 'success',
      message: 'Enrollment updated successfully',
      data: { enrollment }
    });
  } catch (error) {
    console.error('Update enrollment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating enrollment'
    });
  }
};

// @desc    Delete enrollment
// @route   DELETE /api/enrollments/:id
// @access  Private (Admin only)
exports.deleteEnrollment = async (req, res) => {
  try {
    // Check if enrollment has documents
    const documentsCount = await Document.countDocuments({ enrollmentId: req.params.id });
    
    if (documentsCount > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete enrollment with ${documentsCount} document(s). Delete documents first.`
      });
    }
    
    const enrollment = await Enrollment.findByIdAndDelete(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        status: 'error',
        message: 'Enrollment not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Enrollment deleted successfully'
    });
  } catch (error) {
    console.error('Delete enrollment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting enrollment'
    });
  }
};

// @desc    Update enrollment status
// @route   PUT /api/enrollments/:id/status
// @access  Private
exports.updateEnrollmentStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const enrollment = await Enrollment.findById(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        status: 'error',
        message: 'Enrollment not found'
      });
    }
    
    const oldStatus = enrollment.status;
    enrollment.status = status;
    
    // Update specific dates based on status
    if (status === 'submitted' && !enrollment.submissionDate) {
      enrollment.submissionDate = new Date();
    }
    
    if (status === 'approved') {
      enrollment.approvalDate = new Date();
      enrollment.progressPercentage = 100;
    }
    
    await enrollment.save();
    
    // Add timeline event
    await enrollment.addTimelineEvent({
      eventType: 'status_change',
      eventDescription: `Status changed from ${oldStatus} to ${status}`,
      performedBy: req.user._id,
      metadata: { oldStatus, newStatus: status }
    });
    
    // Add note if provided
    if (notes) {
      await enrollment.addNote({
        content: notes,
        noteType: 'internal',
        createdBy: req.user._id
      });
    }
    
    await enrollment.populate('providerId payerId assignedTo');
    
    res.status(200).json({
      status: 'success',
      message: 'Enrollment status updated successfully',
      data: { enrollment }
    });
  } catch (error) {
    console.error('Update enrollment status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating enrollment status'
    });
  }
};

// @desc    Add note to enrollment
// @route   POST /api/enrollments/:id/notes
// @access  Private
exports.addNote = async (req, res) => {
  try {
    const { content, noteType, isPinned } = req.body;
    
    const enrollment = await Enrollment.findById(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        status: 'error',
        message: 'Enrollment not found'
      });
    }
    
    await enrollment.addNote({
      content,
      noteType: noteType || 'internal',
      createdBy: req.user._id,
      isPinned: isPinned || false
    });
    
    // Add timeline event
    await enrollment.addTimelineEvent({
      eventType: 'note_added',
      eventDescription: 'Note added to enrollment',
      performedBy: req.user._id
    });
    
    await enrollment.populate('notes.createdBy', 'fullName');
    
    res.status(200).json({
      status: 'success',
      message: 'Note added successfully',
      data: { enrollment }
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error adding note'
    });
  }
};

// @desc    Get enrollment timeline
// @route   GET /api/enrollments/:id/timeline
// @access  Private
exports.getEnrollmentTimeline = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .select('timeline')
      .populate('timeline.performedBy', 'fullName email');
    
    if (!enrollment) {
      return res.status(404).json({
        status: 'error',
        message: 'Enrollment not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { timeline: enrollment.timeline }
    });
  } catch (error) {
    console.error('Get enrollment timeline error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching enrollment timeline'
    });
  }
};

// @desc    Calculate and update enrollment progress
// @route   PUT /api/enrollments/:id/calculate-progress
// @access  Private
exports.calculateProgress = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        status: 'error',
        message: 'Enrollment not found'
      });
    }
    
    await enrollment.calculateProgress();
    
    res.status(200).json({
      status: 'success',
      message: 'Progress calculated successfully',
      data: { 
        progressPercentage: enrollment.progressPercentage 
      }
    });
  } catch (error) {
    console.error('Calculate progress error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error calculating progress'
    });
  }
};

// @desc    Get enrollments by status (for Kanban board)
// @route   GET /api/enrollments/kanban/board
// @access  Private
exports.getEnrollmentsByStatus = async (req, res) => {
  try {
    const statuses = [
      'intake',
      'document_collection',
      'ready_for_submission',
      'submitted',
      'in_review',
      'approved'
    ];
    
    const kanbanData = {};
    
    for (const status of statuses) {
      const enrollments = await Enrollment.find({ status })
        .populate('providerId', 'firstName lastName npi')
        .populate('payerId', 'payerName')
        .populate('assignedTo', 'fullName')
        .sort({ priority: -1, createdAt: -1 });
      
      kanbanData[status] = enrollments;
    }
    
    res.status(200).json({
      status: 'success',
      data: kanbanData
    });
  } catch (error) {
    console.error('Get kanban data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching kanban data'
    });
  }
};
