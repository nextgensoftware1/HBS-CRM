// backend/src/controllers/enrollmentController.js
const Enrollment = require('../models/Enrollment');
const Provider = require('../models/Provider');
const Document = require('../models/Document');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const googleDriveOAuthService = require('../services/googleDriveOAuthService');
const { createNotification } = require('../services/notificationService');

const isAdminUser = (user) => user?.role === 'admin';

const isAssignedEnrollmentUser = (enrollment, userId) => {
  if (!enrollment?.assignedTo) return false;
  return String(enrollment.assignedTo) === String(userId);
};

const getProviderDisplayName = (provider) => {
  if (!provider) return 'Provider';
  const firstName = String(provider.firstName || '').trim();
  const lastName = String(provider.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || provider.npi || 'Provider';
};

const buildEnrollmentProfileFromProviderData = (providerPayload = {}) => ({
  clientName: String(providerPayload.clientName || '').trim(),
  firstName: String(providerPayload.firstName || '').trim(),
  lastName: String(providerPayload.lastName || '').trim(),
  npi: String(providerPayload.npi || '').trim(),
  specialization: String(providerPayload.specialization || '').trim(),
  providerCategory: providerPayload.providerCategory || 'Individual',
  dateOfBirth: providerPayload.dateOfBirth || null,
  email: String(providerPayload.email || '').trim(),
  phone: String(providerPayload.phone || '').trim(),
  ssn: String(providerPayload.ssn || '').trim() || null,
  caqhId: String(providerPayload.caqhId || '').trim() || null,
  medicarePTAN: String(providerPayload.medicarePTAN || '').trim() || null,
  medicaidId: String(providerPayload.medicaidId || '').trim() || null,
  licenseNumber: String(providerPayload.licenseNumber || '').trim(),
  licenseState: String(providerPayload.licenseState || '').trim(),
  licenseExpiryDate: providerPayload.licenseExpiryDate || null,
  credentialLogins: {
    pecosUsername: String(providerPayload.pecosUsername || '').trim() || null,
    pecosPassword: String(providerPayload.pecosPassword || '').trim() || null,
    caqhUsername: String(providerPayload.caqhUsername || '').trim() || null,
    caqhPassword: String(providerPayload.caqhPassword || '').trim() || null,
  },
  insuranceServices: Array.isArray(providerPayload.insuranceServices)
    ? providerPayload.insuranceServices.map((value) => String(value).trim()).filter(Boolean)
    : [],
});

const notifyEnrollmentAssignee = async ({ enrollment, recipientUserId, actorUserId, provider }) => {
  if (!recipientUserId || !actorUserId || !enrollment?._id) {
    return;
  }

  const providerLabel = getProviderDisplayName(provider);
  const insuranceValues = Array.isArray(enrollment.insuranceServices)
    ? enrollment.insuranceServices.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const insuranceLabel = insuranceValues.length
    ? insuranceValues.join(', ')
    : (String(enrollment.insuranceService || '').trim() || 'Insurance Service');

  await createNotification({
    recipient: recipientUserId,
    actor: actorUserId,
    type: 'enrollment_assigned',
    title: 'Enrollment assigned to you',
    message: `You have been assigned enrollment for ${providerLabel} - ${insuranceLabel}.`,
    entityType: 'enrollment',
    entityId: enrollment._id,
    metadata: {
      enrollmentId: enrollment._id,
      providerId: provider?._id || enrollment.providerId,
      insuranceService: insuranceLabel,
    },
  });
};

// @desc    Get all enrollments
// @route   GET /api/enrollments
// @access  Private
exports.getAllEnrollments = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      providerId, 
      insuranceService,
      assignedTo, 
      priority,
      uploadReadyOnly,
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
    
    if (insuranceService) {
      const insuranceRegex = { $regex: insuranceService, $options: 'i' };
      query.$or = [
        { insuranceService: insuranceRegex },
        { insuranceServices: insuranceRegex },
      ];
    }
    
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }
    
    if (priority) {
      query.priority = priority;
    }

    const shouldFilterUploadReadyOnly = ['1', 'true', 'yes'].includes(
      String(uploadReadyOnly || '').trim().toLowerCase()
    );

    if (shouldFilterUploadReadyOnly && !status) {
      query.status = { $nin: ['submitted', 'approved'] };
    }

    if (!isAdminUser(req.user)) {
      query.assignedTo = req.user._id;
    }

    if (shouldFilterUploadReadyOnly) {
      const usedEnrollmentIds = await Document.distinct('enrollmentId', {
        enrollmentId: { $ne: null },
      });

      if (usedEnrollmentIds.length > 0) {
        query._id = {
          ...(query._id && typeof query._id === 'object' ? query._id : {}),
          $nin: usedEnrollmentIds,
        };
      }
    }
    
    // Execute query with pagination
    const enrollments = await Enrollment.find(query)
      .populate('providerId', 'clientName firstName lastName npi specialization')
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const enrollmentIds = enrollments.map((item) => item._id);
    const enrollmentDocuments = enrollmentIds.length
      ? await Document.find({ enrollmentId: { $in: enrollmentIds } })
          .select('enrollmentId documentType fileName metadata')
          .sort({ createdAt: -1 })
          .lean()
      : [];

    const documentsByEnrollmentId = new Map();
    for (const document of enrollmentDocuments) {
      const key = String(document.enrollmentId || '');
      if (!key) continue;

      if (!documentsByEnrollmentId.has(key)) {
        documentsByEnrollmentId.set(key, []);
      }

      documentsByEnrollmentId.get(key).push(document);
    }

    const enrollmentsWithDocumentState = enrollments.map((item) => {
      const enrollmentKey = String(item._id);
      const enrollmentDocs = documentsByEnrollmentId.get(enrollmentKey) || [];
      const documentCount = enrollmentDocs.length;
      const computedProgress = Enrollment.computeProgressFromDocuments(enrollmentDocs);

      return {
        ...item.toObject(),
        progressPercentage: computedProgress,
        documentsCount: documentCount,
        hasUploadedDocuments: documentCount > 0,
      };
    });
    
    // Get total count
    const total = await Enrollment.countDocuments(query);
    
    // If search term provided, filter by provider name
    let filteredEnrollments = enrollmentsWithDocumentState;
    if (search) {
      filteredEnrollments = enrollmentsWithDocumentState.filter(enrollment => {
        const providerName = `${enrollment.providerId?.firstName || ''} ${enrollment.providerId?.lastName || ''}`.toLowerCase();
        const clientName = String(
          enrollment.enrollmentProfile?.clientName || enrollment.providerId?.clientName || ''
        ).toLowerCase();
        const insuranceName = Array.isArray(enrollment.insuranceServices) && enrollment.insuranceServices.length
          ? enrollment.insuranceServices.map((value) => String(value || '').toLowerCase()).join(' ')
          : String(enrollment.insuranceService || '').toLowerCase();
        const searchLower = search.toLowerCase();
        return providerName.includes(searchLower) || clientName.includes(searchLower) || insuranceName.includes(searchLower);
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

    if (!isAdminUser(req.user) && !isAssignedEnrollmentUser(enrollment, req.user._id)) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only access enrollments assigned to you'
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
      insuranceService,
      insuranceServices,
      priority,
      assignedTo,
      notes,
      providerData,
    } = req.body;

    const normalizedInsuranceServices = Array.from(new Set(
      (Array.isArray(insuranceServices) ? insuranceServices : [insuranceService])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));
    const normalizedInsuranceService = normalizedInsuranceServices[0] || '';
    if (!normalizedInsuranceServices.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Insurance service is required'
      });
    }

    let resolvedProviderId = providerId;
    let enrollmentProfile = {};
    let normalizedEnrollmentNpi = '';
    const providerPayload = providerData || {};

    if (!resolvedProviderId) {
      const requiredProviderFields = [
        'clientName',
        'firstName',
        'lastName',
        'npi',
        'specialization',
        'licenseNumber',
        'licenseState',
        'licenseExpiryDate',
        'email',
      ];

      const missingField = requiredProviderFields.find((field) => !String(providerPayload[field] || '').trim());
      if (missingField) {
        return res.status(400).json({
          status: 'error',
          message: `Enrollment ${missingField} is required`
        });
      }

      normalizedEnrollmentNpi = String(providerPayload.npi || '').trim();
      resolvedProviderId = null;

      enrollmentProfile = buildEnrollmentProfileFromProviderData(providerPayload);
    } else if (providerPayload && Object.keys(providerPayload).length > 0) {
      // Preserve admin-entered snapshot (including clientName) for linked-provider enrollments.
      enrollmentProfile = buildEnrollmentProfileFromProviderData(providerPayload);
    }

    const requestedAssigneeId = String(assignedTo || '').trim();
    if (requestedAssigneeId && !isAdminUser(req.user) && requestedAssigneeId !== String(req.user._id)) {
      return res.status(403).json({
        status: 'error',
        message: 'Only admin can assign enrollments to other users'
      });
    }

    const assigneeId = requestedAssigneeId || String(req.user._id);
    const assignmentUser = await User.findOne({ _id: assigneeId, isActive: true }).select('_id fullName');

    if (!assignmentUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Assigned user not found or inactive'
      });
    }
    
    // Check if enrollment already exists
    const existingEnrollmentQuery = resolvedProviderId
      ? {
          providerId: resolvedProviderId,
          assignedTo: assigneeId,
          $or: [
            { insuranceService: { $in: normalizedInsuranceServices } },
            { insuranceServices: { $in: normalizedInsuranceServices } },
          ],
        }
      : {
          providerId: null,
          'enrollmentProfile.npi': normalizedEnrollmentNpi,
          assignedTo: assigneeId,
          $or: [
            { insuranceService: { $in: normalizedInsuranceServices } },
            { insuranceServices: { $in: normalizedInsuranceServices } },
          ],
        };

    const existingEnrollment = await Enrollment.findOne(existingEnrollmentQuery);

    const forceCreate = Boolean(req.body.forceCreate);

    if (existingEnrollment && !forceCreate) {
      // Return 409 Conflict with existing enrollment details so frontend
      // can offer to open/reassign the existing enrollment instead of silently failing.
      await existingEnrollment.populate('providerId assignedTo createdBy');
      return res.status(409).json({
        status: 'conflict',
        message: 'Enrollment already exists for one or more selected insurance services',
        data: { existingEnrollment }
      });
    }
    
    // Create enrollment
    const enrollment = await Enrollment.create({
      providerId: resolvedProviderId,
      insuranceService: normalizedInsuranceService,
      insuranceServices: normalizedInsuranceServices,
      enrollmentProfile,
      priority: priority || 'medium',
      assignedTo: assignmentUser._id,
      createdBy: req.user._id
    });
    
    // Add initial timeline event
    await enrollment.addTimelineEvent({
      eventType: 'status_change',
      eventDescription: 'Enrollment created',
      performedBy: req.user._id
    });

    await enrollment.addTimelineEvent({
      eventType: 'assignment',
      eventDescription: `Enrollment assigned to ${assignmentUser.fullName}`,
      performedBy: req.user._id,
      metadata: { assignedTo: assignmentUser._id }
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
    await enrollment.populate('providerId assignedTo createdBy');

    await notifyEnrollmentAssignee({
      enrollment,
      recipientUserId: assignmentUser._id,
      actorUserId: req.user._id,
      provider: enrollment.providerId,
    });
    
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

    if (!isAdminUser(req.user) && !isAssignedEnrollmentUser(enrollment, req.user._id)) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only update enrollments assigned to you'
      });
    }
    
    const oldStatus = enrollment.status;
    const previousAssignedTo = enrollment.assignedTo ? String(enrollment.assignedTo) : '';
    const updatePayload = { ...req.body };
    let assignmentUser = null;

    if (Object.prototype.hasOwnProperty.call(updatePayload, 'assignedTo')) {
      if (!isAdminUser(req.user)) {
        return res.status(403).json({
          status: 'error',
          message: 'Only admin can reassign enrollments'
        });
      }

      const requestedAssigneeId = String(updatePayload.assignedTo || '').trim();

      if (!requestedAssigneeId) {
        updatePayload.assignedTo = null;
      } else {
        assignmentUser = await User.findOne({ _id: requestedAssigneeId, isActive: true }).select('_id fullName');
        if (!assignmentUser) {
          return res.status(400).json({
            status: 'error',
            message: 'Assigned user not found or inactive'
          });
        }
        updatePayload.assignedTo = assignmentUser._id;
      }
    }
    
    // Update enrollment
    Object.assign(enrollment, updatePayload);
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

    const currentAssignedTo = enrollment.assignedTo ? String(enrollment.assignedTo) : '';
    if (Object.prototype.hasOwnProperty.call(updatePayload, 'assignedTo') && previousAssignedTo !== currentAssignedTo) {
      const assignmentLabel = assignmentUser?.fullName || 'Unassigned';
      await enrollment.addTimelineEvent({
        eventType: 'assignment',
        eventDescription: `Enrollment reassigned to ${assignmentLabel}`,
        performedBy: req.user._id,
        metadata: {
          previousAssignedTo: previousAssignedTo || null,
          currentAssignedTo: currentAssignedTo || null,
        }
      });
    }
    
    await enrollment.populate('providerId assignedTo');

    if (Object.prototype.hasOwnProperty.call(updatePayload, 'assignedTo') && currentAssignedTo) {
      await notifyEnrollmentAssignee({
        enrollment,
        recipientUserId: currentAssignedTo,
        actorUserId: req.user._id,
        provider: enrollment.providerId,
      });
    }
    
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
    const enrollment = await Enrollment.findById(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        status: 'error',
        message: 'Enrollment not found'
      });
    }

    const linkedDocuments = await Document.find({ enrollmentId: enrollment._id })
      .select('_id fileKey');

    for (const doc of linkedDocuments) {
      if (!doc.fileKey) continue;

      try {
        await googleDriveOAuthService.deleteFile(doc.fileKey);
      } catch (storageError) {
        console.error(`Storage deletion warning for document ${doc._id}:`, storageError);
      }
    }

    const deletedDocumentsResult = await Document.deleteMany({ enrollmentId: enrollment._id });
    const deletedRemindersResult = await Reminder.deleteMany({ enrollmentId: enrollment._id });

    await enrollment.deleteOne();
    
    res.status(200).json({
      status: 'success',
      message: 'Enrollment deleted successfully',
      data: {
        deletedDocuments: deletedDocumentsResult.deletedCount || 0,
        deletedReminders: deletedRemindersResult.deletedCount || 0,
      }
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

    const requiresUploadedDocuments = ['submitted', 'approved', 'rejected'].includes(String(status || '').toLowerCase());
    if (requiresUploadedDocuments) {
      const uploadedDocumentsCount = await Document.countDocuments({ enrollmentId: enrollment._id });
      if (uploadedDocumentsCount === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Waiting for documents upload before this status update'
        });
      }
    }
    
    const oldStatus = enrollment.status;
    enrollment.status = status;
    
    // Update specific dates based on status
    if (status === 'submitted' && !enrollment.submissionDate) {
      enrollment.submissionDate = new Date();
    }
    
    if (status === 'approved') {
      enrollment.approvalDate = new Date();
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
    
    await enrollment.populate('providerId assignedTo');
    
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

    if (!isAdminUser(req.user) && !isAssignedEnrollmentUser(enrollment, req.user._id)) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only add notes to enrollments assigned to you'
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

    if (!isAdminUser(req.user) && !isAssignedEnrollmentUser(enrollment, req.user._id)) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only access timeline for enrollments assigned to you'
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

    if (!isAdminUser(req.user) && !isAssignedEnrollmentUser(enrollment, req.user._id)) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only calculate progress for enrollments assigned to you'
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
      const query = { status };
      if (!isAdminUser(req.user)) {
        query.assignedTo = req.user._id;
      }

      const enrollments = await Enrollment.find(query)
        .populate('providerId', 'firstName lastName npi')
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
