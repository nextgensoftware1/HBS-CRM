// backend/src/controllers/documentController.js
const Document = require('../models/Document');
const Enrollment = require('../models/Enrollment');
// const { uploadFile, deleteFile, getSignedUrl } = require('../services/s3Service');
const googleDriveOAuthService = require('../services/googleDriveOAuthService');
const { createNotification, notifyAdmins } = require('../services/notificationService');
const multer = require('multer');
const path = require('path');

const isAdminUser = (user) => user?.role === 'admin';

const isEnrollmentAssignedToUser = (enrollment, userId) => {
  if (!enrollment?.assignedTo) return false;
  return String(enrollment.assignedTo) === String(userId);
};

const canUserAccessDocument = async (document, user) => {
  if (isAdminUser(user)) return true;

  if (String(document.uploadedBy || '') === String(user._id || '')) {
    return true;
  }

  if (!document.enrollmentId) {
    return false;
  }

  const enrollment = await Enrollment.findById(document.enrollmentId)
    .select('assignedTo')
    .lean();

  return isEnrollmentAssignedToUser(enrollment, user._id);
};

const parsedUploadLimitMb = parseInt(process.env.MAX_DOCUMENT_FILE_SIZE_MB || '100', 10);
const maxUploadBytes = Number.isFinite(parsedUploadLimitMb) && parsedUploadLimitMb > 0
  ? parsedUploadLimitMb * 1024 * 1024
  : 100 * 1024 * 1024;

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: maxUploadBytes
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, JPG, JPEG, PNG, and GIF files are allowed'));
    }
  }
}).single('file');

const getOnboardingSelectionSignature = (metadata = {}) => {
  const onboarding = metadata.onboardingData || {};

  if (Array.isArray(onboarding.selectedInsuranceSelections)) {
    return onboarding.selectedInsuranceSelections
      .map((item) => `${item?.clientId || ''}:${item?.insurance || ''}`)
      .sort()
      .join(',');
  }

  const legacyFormFingerprint = [
    String(onboarding.legalName || '').trim().toLowerCase(),
    String(onboarding.taxId || '').trim().toLowerCase(),
    String(onboarding.npi || '').trim().toLowerCase(),
    String(onboarding.authorizedPersonName || '').trim().toLowerCase(),
    String(onboarding.email || '').trim().toLowerCase(),
  ]
    .filter(Boolean)
    .join('|');

  if (legacyFormFingerprint) {
    return `form:${legacyFormFingerprint}`;
  }

  const fallbackClient = String(metadata.clientName || '').trim();
  const fallbackInsurance = String(metadata.insuranceService || '').trim();
  return `${fallbackClient}:${fallbackInsurance}`;
};

const getSubmissionHourBucket = (dateValue) => {
  const timestamp = new Date(dateValue || Date.now()).getTime();
  return Math.floor(timestamp / (60 * 60 * 1000));
};

const mergeSelectionArrays = (existingSelections = [], incomingSelections = []) => {
  const selectionMap = new Map();

  [...existingSelections, ...incomingSelections].forEach((item) => {
    if (!item || typeof item !== 'object') return;

    const clientId = String(item.clientId || '').trim();
    const insurance = String(item.insurance || '').trim();
    if (!clientId || !insurance) return;

    selectionMap.set(`${clientId}::${insurance}`, {
      clientId,
      clientName: item.clientName || '',
      insurance,
    });
  });

  return Array.from(selectionMap.values());
};

const buildSubmissionKey = (doc) => {
  const metadata = doc?.metadata || {};
  const explicitSubmissionId = metadata.submissionId;
  const hasOnboardingPayload = Boolean(metadata.onboardingData);

  if (hasOnboardingPayload) {
    const onboarding = metadata.onboardingData || {};
    const explicitBatchId = String(onboarding.batchSubmissionId || '').trim();
    const selectionSignature = getOnboardingSelectionSignature(metadata);
    const hourBucket = getSubmissionHourBucket(doc.createdAt);

    if (explicitBatchId) {
      return `onboarding-batch-id|${explicitBatchId}`;
    }

    return [
      'onboarding-batch',
      String(doc.uploadedBy?._id || doc.uploadedBy || ''),
      String(onboarding.intakeOption || ''),
      selectionSignature,
      String(hourBucket),
    ].join('|');
  }

  if (explicitSubmissionId) {
    return explicitSubmissionId;
  }

  return String(doc._id);
};

const resolveGroupedStatus = (statuses = []) => {
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('under_review')) return 'under_review';
  if (statuses.includes('submitted')) return 'submitted';
  if (statuses.includes('rejected')) return 'rejected';
  if (statuses.includes('approved')) return 'approved';
  return 'pending';
};

const getSubmissionQuery = (document) => {
  const metadata = document?.metadata || {};
  const onboardingData = metadata.onboardingData || {};
  const onboardingBatchId = String(onboardingData.batchSubmissionId || '').trim();

  if (onboardingBatchId) {
    return {
      uploadedBy: document.uploadedBy,
      'metadata.onboardingData.batchSubmissionId': onboardingBatchId,
    };
  }

  if (metadata.submissionId) {
    return {
      uploadedBy: document.uploadedBy,
      'metadata.submissionId': metadata.submissionId,
    };
  }

  if (metadata.onboardingData) {
    return { _id: document._id };
  }

  return { _id: document._id };
};

const ensureEnrollmentForApprovedDocument = async (document, actorId) => {
  if (document.enrollmentId) {
    return Enrollment.findById(document.enrollmentId);
  }

  const insuranceService = String(document?.metadata?.insuranceService || '').trim();
  if (!insuranceService) {
    return null;
  }

  let enrollment = await Enrollment.findOne({
    providerId: document.providerId,
    insuranceService,
  });

  if (!enrollment) {
    enrollment = await Enrollment.create({
      providerId: document.providerId,
      insuranceService,
      status: 'document_collection',
      assignedTo: actorId,
      createdBy: actorId,
    });
  }

  const submissionQuery = getSubmissionQuery(document);
  await Document.updateMany(
    {
      ...submissionQuery,
      enrollmentId: null,
    },
    {
      $set: { enrollmentId: enrollment._id },
    }
  );

  document.enrollmentId = enrollment._id;
  return enrollment;
};

// @desc    Get all documents
// @route   GET /api/documents
// @access  Private
exports.getAllDocuments = async (req, res) => {
  try {
    const { 
      providerId, 
      enrollmentId, 
      documentType, 
      status,
      page = 1,
      limit = 10
    } = req.query;
    
    // Build query
    const query = {};

    // Non-admin users can see their uploads and documents tied to enrollments assigned to them.
    if (req.user?.role !== 'admin') {
      const assignedEnrollments = await Enrollment.find({ assignedTo: req.user._id })
        .select('_id')
        .lean();
      const assignedEnrollmentIds = assignedEnrollments.map((entry) => entry._id);

      query.$or = [
        { uploadedBy: req.user._id },
        { enrollmentId: { $in: assignedEnrollmentIds } },
      ];
    }
    
    if (providerId) {
      query.providerId = providerId;
    }
    
    if (enrollmentId) {
      query.enrollmentId = enrollmentId;
    }
    
    if (documentType) {
      query.documentType = documentType;
    }
    
    if (status) {
      query.status = status;
    }
    
    // Fetch all matching docs, then group by submission to show one row per full-form upload.
    const allDocuments = await Document.find(query)
      .populate('providerId', 'firstName lastName npi')
      .populate('enrollmentId')
      .populate('uploadedBy', 'fullName email')
      .populate('verifiedBy', 'fullName')
      .sort({ createdAt: -1 });

    const groupedMap = new Map();
    for (const doc of allDocuments) {
      const metadata = doc?.metadata || {};
      const hasOnboardingPayload = Boolean(metadata.onboardingData);
      const submissionId = buildSubmissionKey(doc);

      if (!groupedMap.has(submissionId)) {
        groupedMap.set(submissionId, {
          ...doc.toObject(),
          documentType: hasOnboardingPayload ? 'Insurance Intake Packet' : doc.documentType,
          filesCount: 1,
          fileNames: [doc.fileName],
          fileNameSet: new Set([doc.fileName]),
          statusList: [doc.status],
          providerNameSet: new Set([
            typeof doc.providerId === 'object'
              ? `${doc.providerId.firstName || ''} ${doc.providerId.lastName || ''}`.trim()
              : ''
          ].filter(Boolean)),
          metadata: {
            ...(doc.metadata || {}),
            submissionId,
          },
        });
      } else {
        const existing = groupedMap.get(submissionId);
        existing.fileNameSet.add(doc.fileName);
        existing.filesCount = existing.fileNameSet.size;
        existing.fileNames = Array.from(existing.fileNameSet);
        existing.statusList.push(doc.status);
        if (typeof doc.providerId === 'object') {
          const providerLabel = `${doc.providerId.firstName || ''} ${doc.providerId.lastName || ''}`.trim();
          if (providerLabel) {
            existing.providerNameSet.add(providerLabel);
          }
        }

        // Keep the most recently updated document details as the representative row.
        const currentUpdatedAt = new Date(doc.updatedAt || doc.createdAt).getTime();
        const existingUpdatedAt = new Date(existing.updatedAt || existing.createdAt).getTime();
        if (currentUpdatedAt > existingUpdatedAt) {
          groupedMap.set(submissionId, {
            ...existing,
            ...doc.toObject(),
            documentType: hasOnboardingPayload ? 'Insurance Intake Packet' : doc.documentType,
            filesCount: existing.filesCount,
            fileNames: existing.fileNames,
            fileNameSet: existing.fileNameSet,
            statusList: existing.statusList,
            providerNameSet: existing.providerNameSet,
            metadata: {
              ...(doc.metadata || {}),
              submissionId,
            },
          });
        }
      }
    }

    const groupedDocuments = Array.from(groupedMap.values()).map((row) => ({
      ...row,
      status: resolveGroupedStatus(row.statusList || []),
      statusList: undefined,
      fileNameSet: undefined,
      providerSummary: row.providerNameSet?.size > 1
        ? `${row.providerNameSet.size} providers`
        : Array.from(row.providerNameSet || [])[0] || null,
      providerNameSet: undefined,
    })).sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const total = groupedDocuments.length;
    const documents = groupedDocuments.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
    
    res.status(200).json({
      status: 'success',
      data: {
        documents,
        pagination: {
          total,
          page: pageNumber,
          pages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching documents'
    });
  }
};

// @desc    Get single document
// @route   GET /api/documents/:id
// @access  Private
exports.getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('providerId')
      .populate('enrollmentId')
      .populate('uploadedBy', 'fullName email')
      .populate('verifiedBy', 'fullName email');
    
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    const hasAccess = await canUserAccessDocument(document, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only access documents for enrollments assigned to you'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { document }
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching document'
    });
  }
};

// @desc    Get grouped submission detail by document row id
// @route   GET /api/documents/:id/submission
// @access  Private
exports.getDocumentSubmission = async (req, res) => {
  try {
    const anchorDocument = await Document.findById(req.params.id)
      .populate('providerId', 'firstName lastName npi')
      .populate('uploadedBy', 'fullName email');

    if (!anchorDocument) {
      return res.status(404).json({
        status: 'error',
        message: 'Document submission not found'
      });
    }

    const hasAccess = await canUserAccessDocument(anchorDocument, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only access document submissions for enrollments assigned to you'
      });
    }

    const metadata = anchorDocument.metadata || {};
    const visibilityQuery = req.user?.role === 'admin'
      ? {}
      : (anchorDocument.enrollmentId
        ? {
            $or: [
              { uploadedBy: req.user._id },
              { enrollmentId: anchorDocument.enrollmentId },
            ],
          }
        : { uploadedBy: req.user._id });
    const anchorSubmissionKey = buildSubmissionKey(anchorDocument);

    // Pull likely candidates first, then filter by the same grouping key used in list view.
    let candidateQuery = { ...visibilityQuery };
    if (metadata.onboardingData) {
      const bucket = getSubmissionHourBucket(anchorDocument.createdAt);
      const bucketStart = new Date(bucket * 60 * 60 * 1000);
      const bucketEnd = new Date((bucket + 1) * 60 * 60 * 1000);

      candidateQuery = {
        ...visibilityQuery,
        uploadedBy: anchorDocument.uploadedBy?._id || anchorDocument.uploadedBy,
        'metadata.onboardingData': { $exists: true },
        createdAt: {
          $gte: bucketStart,
          $lt: bucketEnd,
        },
      };
    } else if (metadata.submissionId) {
      candidateQuery = {
        ...visibilityQuery,
        $or: [
          { 'metadata.submissionId': metadata.submissionId },
          { _id: anchorDocument._id },
        ],
      };
    } else {
      candidateQuery = { ...visibilityQuery, _id: anchorDocument._id };
    }

    const candidateDocs = await Document.find(candidateQuery)
      .populate('providerId', 'firstName lastName npi')
      .populate('uploadedBy', 'fullName email')
      .populate('verifiedBy', 'fullName')
      .sort({ createdAt: -1 });

    const submissionDocs = candidateDocs.filter((doc) => buildSubmissionKey(doc) === anchorSubmissionKey);
    const docs = submissionDocs.length > 0 ? submissionDocs : [anchorDocument];
    const firstWithOnboarding = docs.find((doc) => Boolean(doc?.metadata?.onboardingData));
    const onboardingData = firstWithOnboarding?.metadata?.onboardingData || null;
    const submissionId = buildSubmissionKey(anchorDocument);

    const latest = docs[0];
    const providers = Array.from(
      new Map(
        docs
          .map((doc) => {
            const provider = doc.providerId;
            if (!provider || typeof provider !== 'object') return null;
            return [String(provider._id || ''), provider];
          })
          .filter(Boolean)
      ).values()
    );

    const selectedInsuranceMap = new Map();
    for (const doc of docs) {
      const selections = doc?.metadata?.onboardingData?.selectedInsuranceSelections;
      if (!Array.isArray(selections)) continue;

      for (const item of selections) {
        if (!item || typeof item !== 'object') continue;
        const clientId = String(item.clientId || '').trim();
        const clientName = String(item.clientName || '').trim();
        const insurance = String(item.insurance || '').trim();
        if (!clientId || !insurance) continue;

        selectedInsuranceMap.set(`${clientId}::${insurance}`, {
          clientId,
          clientName,
          insurance,
        });
      }
    }

    const selectedInsuranceSelections = Array.from(selectedInsuranceMap.values());

    const clients = selectedInsuranceSelections.length
      ? Array.from(
          new Set(
            selectedInsuranceSelections
              .map((item) => item.clientName)
              .filter(Boolean)
          )
        )
      : Array.from(
          new Set(
            docs
              .map((doc) => String(doc?.metadata?.clientName || '').trim())
              .filter(Boolean)
          )
        );

    const insuranceServices = selectedInsuranceSelections.length
      ? Array.from(
          new Set(
            selectedInsuranceSelections
              .map((item) => item.insurance)
              .filter(Boolean)
          )
        )
      : Array.from(
          new Set(
            docs
              .map((doc) => String(doc?.metadata?.insuranceService || '').trim())
              .filter(Boolean)
          )
        );

    const uniqueFilesMap = new Map();
    for (const doc of docs) {
      const uniqueFileKey = `${doc.documentType}::${doc.fileName}`;
      if (!uniqueFilesMap.has(uniqueFileKey)) {
        uniqueFilesMap.set(uniqueFileKey, {
          _id: doc._id,
          fileName: doc.fileName,
          documentType: doc.documentType,
          status: doc.status,
          createdAt: doc.createdAt,
          fileUrl: doc.fileUrl,
        });
      }
    }

    const uniqueFiles = Array.from(uniqueFilesMap.values());

    res.status(200).json({
      status: 'success',
      data: {
        submission: {
          submissionId,
          provider: latest.providerId,
          providers,
          uploadedBy: latest.uploadedBy,
          clientName: latest.metadata?.clientName || null,
          clients,
          insuranceService: latest.metadata?.insuranceService || null,
          insuranceServices,
          selectedInsuranceSelections,
          status: latest.status,
          createdAt: latest.createdAt,
          filesCount: uniqueFiles.length,
          onboardingData,
          files: uniqueFiles,
        }
      }
    });
  } catch (error) {
    console.error('Get document submission error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching document submission'
    });
  }
};

// @desc    Upload document
// @route   POST /api/documents/upload
// @access  Private
exports.uploadDocument = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMb = Math.floor(maxUploadBytes / (1024 * 1024));
        return res.status(400).json({
          status: 'error',
          message: `File too large. Max allowed size is ${maxMb}MB.`
        });
      }

      return res.status(400).json({
        status: 'error',
        message: err.message
      });
    }
    
    try {
      const driveAccessible = await googleDriveOAuthService.checkDriveAccess();
      const allowLocalFallback = typeof googleDriveOAuthService.isLocalFallbackEnabled === 'function'
        ? googleDriveOAuthService.isLocalFallbackEnabled()
        : false;

      if (!driveAccessible && !allowLocalFallback) {
        return res.status(503).json({
          status: 'error',
          message: 'Google Drive is not connected yet. Please connect admin Google account first.'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded'
        });
      }
      
      const {
        providerId,
        enrollmentId,
        documentType,
        issueDate,
        expiryDate,
        notes,
        clientName,
        insuranceService,
        submissionId,
        onboardingData,
        replaceDocumentId
      } = req.body;

      let validatedEnrollment = null;

      if (!isAdminUser(req.user)) {
        if (!enrollmentId) {
          return res.status(400).json({
            status: 'error',
            message: 'Enrollment is required for non-admin uploads'
          });
        }

        validatedEnrollment = await Enrollment.findById(enrollmentId)
          .select('providerId assignedTo status')
          .lean();

        if (!validatedEnrollment) {
          return res.status(404).json({
            status: 'error',
            message: 'Enrollment not found'
          });
        }

        if (!isEnrollmentAssignedToUser(validatedEnrollment, req.user._id)) {
          return res.status(403).json({
            status: 'error',
            message: 'You can only upload documents for enrollments assigned to you'
          });
        }

        const enrollmentStatus = String(validatedEnrollment.status || '').toLowerCase();
        if (['submitted', 'approved'].includes(enrollmentStatus)) {
          return res.status(400).json({
            status: 'error',
            message: 'This enrollment is already completed and cannot accept new submissions'
          });
        }

        if (!replaceDocumentId) {
          const existingEnrollmentDocuments = await Document.countDocuments({
            enrollmentId,
          });

          if (existingEnrollmentDocuments > 0) {
            return res.status(400).json({
              status: 'error',
              message: 'Documents were already submitted for this enrollment'
            });
          }
        }
      }
      
      // Validate required fields for new uploads
      if (!replaceDocumentId && (!documentType || (!providerId && !validatedEnrollment?.providerId))) {
        return res.status(400).json({
          status: 'error',
          message: 'Provider and document type are required'
        });
      }

      let parsedOnboardingData = null;
      if (onboardingData) {
        try {
          parsedOnboardingData = typeof onboardingData === 'string'
            ? JSON.parse(onboardingData)
            : onboardingData;
        } catch (parseError) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid onboarding data format'
          });
        }
      }

      const enrollmentReference = enrollmentId || null;
      const effectiveProviderId = validatedEnrollment?.providerId || providerId;

      if (!isAdminUser(req.user) && providerId && String(providerId) !== String(validatedEnrollment.providerId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Provider does not match the assigned enrollment'
        });
      }

      const versionQuery = {
        providerId: effectiveProviderId,
        enrollmentId: enrollmentReference,
        documentType,
      };

      const onboardingBatchId = String(parsedOnboardingData?.batchSubmissionId || '').trim();
      if (onboardingBatchId && !replaceDocumentId) {
        const existingBatchDocument = await Document.findOne({
          uploadedBy: req.user._id,
          documentType,
          fileName: req.file.originalname,
          'metadata.onboardingData.batchSubmissionId': onboardingBatchId,
        });

        if (existingBatchDocument) {
          const existingOnboarding = existingBatchDocument.metadata?.onboardingData || {};
          const mergedSelections = mergeSelectionArrays(
            existingOnboarding.selectedInsuranceSelections || [],
            parsedOnboardingData.selectedInsuranceSelections || []
          );

          existingBatchDocument.metadata = {
            ...(existingBatchDocument.metadata || {}),
            clientName: clientName || existingBatchDocument.metadata?.clientName || null,
            insuranceService: insuranceService || existingBatchDocument.metadata?.insuranceService || null,
            submissionId: submissionId || existingBatchDocument.metadata?.submissionId || null,
            onboardingData: {
              ...existingOnboarding,
              ...parsedOnboardingData,
              selectedInsuranceSelections: mergedSelections,
              batchSubmissionId: onboardingBatchId,
            },
          };

          await existingBatchDocument.save();
          await existingBatchDocument.populate('providerId enrollmentId uploadedBy');

          return res.status(200).json({
            status: 'success',
            message: 'Document already exists for this submission batch',
            data: { document: existingBatchDocument }
          });
        }
      }
      
      // Upload file to Google Drive (external storage)
      const uploadResult = await googleDriveOAuthService.uploadFileToAdminDrive(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Re-upload flow: replace existing rejected document in-place (no new DB row)
      if (replaceDocumentId) {
        const existingDocument = await Document.findById(replaceDocumentId);
        if (!existingDocument) {
          return res.status(404).json({
            status: 'error',
            message: 'Original document not found for re-upload'
          });
        }

        const canAccessExistingDocument = await canUserAccessDocument(existingDocument, req.user);
        if (!canAccessExistingDocument) {
          return res.status(403).json({
            status: 'error',
            message: 'You can only re-upload documents for enrollments assigned to you'
          });
        }

        if (req.user?.role !== 'admin' && existingDocument.status !== 'rejected') {
          return res.status(400).json({
            status: 'error',
            message: 'Only rejected documents can be re-uploaded'
          });
        }

        // Best-effort deletion of old storage object.
        try {
          if (existingDocument.fileKey) {
            await googleDriveOAuthService.deleteFile(existingDocument.fileKey);
          }
        } catch (deleteErr) {
          console.error('Old file deletion warning:', deleteErr);
        }

        existingDocument.fileName = req.file.originalname;
        existingDocument.fileUrl = uploadResult.fileUrl;
        existingDocument.fileKey = uploadResult.fileKey;
        existingDocument.fileSize = req.file.size;
        existingDocument.mimeType = req.file.mimetype;
        existingDocument.version = (existingDocument.version || 1) + 1;
        existingDocument.status = 'pending';
        existingDocument.rejectionReason = null;
        existingDocument.verifiedBy = null;
        existingDocument.verifiedAt = null;
        existingDocument.isLatestVersion = true;
        existingDocument.issueDate = issueDate || existingDocument.issueDate || null;
        existingDocument.expiryDate = expiryDate || existingDocument.expiryDate || null;

        if (notes) {
          existingDocument.notes = existingDocument.notes
            ? `${existingDocument.notes}\n${notes}`
            : notes;
        }

        existingDocument.metadata = {
          ...(existingDocument.metadata || {}),
          clientName: clientName || existingDocument.metadata?.clientName || null,
          insuranceService: insuranceService || existingDocument.metadata?.insuranceService || null,
          submissionId: submissionId || existingDocument.metadata?.submissionId || null,
          onboardingData: parsedOnboardingData || existingDocument.metadata?.onboardingData || null,
        };

        await existingDocument.save();

        const existingEnrollment = existingDocument.enrollmentId
          ? await Enrollment.findById(existingDocument.enrollmentId)
          : null;
        if (existingEnrollment) {
          await existingEnrollment.addTimelineEvent({
            eventType: 'document_uploaded',
            eventDescription: `${existingDocument.documentType} re-uploaded after rejection`,
            performedBy: req.user._id,
            metadata: {
              documentId: existingDocument._id,
              documentType: existingDocument.documentType,
              source: 'reupload_replace'
            }
          });

          await existingEnrollment.calculateProgress();
        }

        await existingDocument.populate('providerId enrollmentId uploadedBy');

        await notifyAdmins({
          actor: req.user._id,
          type: 'document_reuploaded',
          title: 'Document re-uploaded',
          message: `${req.user.fullName} re-uploaded ${existingDocument.documentType} (${existingDocument.fileName}) for review.`,
          entityId: existingDocument._id,
          metadata: {
            documentType: existingDocument.documentType,
            fileName: existingDocument.fileName,
            source: 'reupload',
          },
        });

        return res.status(200).json({
          status: 'success',
          message: 'Document re-uploaded successfully',
          data: { document: existingDocument }
        });
      }
      
      // Mark previous versions as not latest
      await Document.updateMany(
        {
          ...versionQuery,
          isLatestVersion: true,
        },
        {
          isLatestVersion: false
        }
      );
      
      // Get version number
      const previousVersions = await Document.countDocuments(versionQuery);
      
      // Create document record
      const document = await Document.create({
        providerId: effectiveProviderId,
        enrollmentId: enrollmentReference,
        documentType,
        fileName: req.file.originalname,
        fileUrl: uploadResult.fileUrl,
        fileKey: uploadResult.fileKey,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        version: previousVersions + 1,
        issueDate: issueDate || null,
        expiryDate: expiryDate || null,
        notes: notes || null,
        metadata: {
          clientName: clientName || null,
          insuranceService: insuranceService || null,
          submissionId: submissionId || null,
          onboardingData: parsedOnboardingData || null,
        },
        uploadedBy: req.user._id
      });
      
      // Update enrollment timeline
      const enrollment = enrollmentReference ? await Enrollment.findById(enrollmentReference) : null;
      if (enrollment) {
        await enrollment.addTimelineEvent({
          eventType: 'document_uploaded',
          eventDescription: `${documentType} uploaded`,
          performedBy: req.user._id,
          metadata: { documentId: document._id, documentType }
        });
        
        // Recalculate progress
        await enrollment.calculateProgress();
      }
      
      await document.populate('providerId enrollmentId uploadedBy');

      await notifyAdmins({
        actor: req.user._id,
        type: 'document_uploaded',
        title: 'New document uploaded',
        message: `${req.user.fullName} uploaded ${document.documentType} (${document.fileName}).`,
        entityId: document._id,
        metadata: {
          documentType: document.documentType,
          fileName: document.fileName,
          submissionId: document.metadata?.submissionId || null,
        },
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Document uploaded successfully',
        data: { document }
      });
    } catch (error) {
      console.error('Upload document error:', error);

      if (String(error.message || '').toLowerCase().includes('google drive')) {
        return res.status(503).json({
          status: 'error',
          message: error.message
        });
      }

      res.status(500).json({
        status: 'error',
        message: error.message || 'Error uploading document'
      });
    }
  });
};

// @desc    Update document status
// @route   PUT /api/documents/:id/status
// @access  Private
exports.updateDocumentStatus = async (req, res) => {
  try {
    const { status, rejectionReason, adminNote, applyToSubmission = true } = req.body;
    
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }
    
    const shouldApplyToSubmission = applyToSubmission !== false;
    let docsToUpdate = [document];

    if (shouldApplyToSubmission) {
      const submissionQuery = getSubmissionQuery(document);
      const targetDocuments = await Document.find(submissionQuery).sort({ createdAt: -1 });
      docsToUpdate = targetDocuments.length ? targetDocuments : [document];
    }

    const nowIso = new Date().toISOString();
    for (const docItem of docsToUpdate) {
      const oldStatus = docItem.status;
      docItem.status = status;

      if (status === 'approved') {
        docItem.verifiedBy = req.user._id;
        docItem.verifiedAt = new Date();
        docItem.rejectionReason = null;
      }

      if (status === 'rejected') {
        docItem.rejectionReason = rejectionReason || docItem.rejectionReason || null;
      }

      if (adminNote) {
        docItem.notes = docItem.notes
          ? `${docItem.notes}\n[${nowIso}] ${adminNote}`
          : `[${nowIso}] ${adminNote}`;
      }

      if (status === 'approved') {
        await ensureEnrollmentForApprovedDocument(docItem, req.user._id);
      }

      await docItem.save();

      const enrollment = await Enrollment.findById(docItem.enrollmentId);
      if (enrollment) {
        const eventType = status === 'approved'
          ? 'document_approved'
          : status === 'rejected'
            ? 'document_rejected'
            : 'status_change';

        await enrollment.addTimelineEvent({
          eventType,
          eventDescription: `${docItem.documentType} ${status}`,
          performedBy: req.user._id,
          metadata: {
            documentId: docItem._id,
            oldStatus,
            newStatus: status,
            adminNote: adminNote || null,
          }
        });

        await enrollment.calculateProgress();
      }
    }

    const responseDocument = docsToUpdate[0];
    await responseDocument.populate('providerId enrollmentId uploadedBy verifiedBy');

    await createNotification({
      recipient: responseDocument.uploadedBy?._id || responseDocument.uploadedBy,
      actor: req.user._id,
      type:
        status === 'approved'
          ? 'document_approved'
          : status === 'rejected'
            ? 'document_rejected'
            : 'document_status_changed',
      title:
        status === 'approved'
          ? 'Document approved'
          : status === 'rejected'
            ? 'Document rejected'
            : 'Document status updated',
      message:
        status === 'rejected' && rejectionReason
          ? `${responseDocument.documentType} submission was rejected. Reason: ${rejectionReason}`
          : `${responseDocument.documentType} submission status updated to ${status}.`,
      entityId: responseDocument._id,
      metadata: {
        documentType: responseDocument.documentType,
        fileName: responseDocument.fileName,
        status,
        affectedFiles: docsToUpdate.length,
      },
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Document submission status updated successfully',
      data: { document: responseDocument }
    });
  } catch (error) {
    console.error('Update document status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating document status'
    });
  }
};

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Private (Admin only)
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }
    
    const submissionQuery = getSubmissionQuery(document);
    const docsToDelete = await Document.find(submissionQuery);
    const targets = docsToDelete.length ? docsToDelete : [document];

    for (const docItem of targets) {
      try {
        await googleDriveOAuthService.deleteFile(docItem.fileKey);
      } catch (storageError) {
        console.error('Storage deletion error:', storageError);
      }
    }

    const deletedDocumentSnapshot = {
      uploadedBy: document.uploadedBy,
      documentType: document.documentType,
      fileName: document.fileName,
      _id: document._id,
    };

    await Document.deleteMany({ _id: { $in: targets.map((docItem) => docItem._id) } });

    const enrollmentIds = Array.from(new Set(targets.map((docItem) => String(docItem.enrollmentId || '')).filter(Boolean)));
    for (const enrollmentId of enrollmentIds) {
      const enrollment = await Enrollment.findById(enrollmentId);
      if (enrollment) {
        await enrollment.calculateProgress();
      }
    }

    await createNotification({
      recipient: deletedDocumentSnapshot.uploadedBy,
      actor: req.user._id,
      type: 'document_deleted',
      title: 'Document deleted',
      message: `${deletedDocumentSnapshot.documentType} (${deletedDocumentSnapshot.fileName}) was deleted by admin.`,
      entityId: deletedDocumentSnapshot._id,
      metadata: {
        documentType: deletedDocumentSnapshot.documentType,
        fileName: deletedDocumentSnapshot.fileName,
        affectedFiles: targets.length,
      },
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Document submission deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting document'
    });
  }
};

// @desc    Download document (get signed URL)
// @route   GET /api/documents/:id/download
// @access  Private
exports.downloadDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    const hasAccess = await canUserAccessDocument(document, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only download documents for enrollments assigned to you'
      });
    }
    
    // Generate signed URL (valid for 1 hour)
    // const signedUrl = getSignedUrl(document.fileKey, 3600);
    // Get Google Drive view link
    const metadata = await googleDriveOAuthService.getFileMetadata(document.fileKey);
    const viewUrl = metadata.file.webViewLink;
    
    
    res.status(200).json({
      status: 'success',
      data: {
        downloadUrl: viewUrl,
        fileName: document.fileName,
        fileId: document.fileKey
      }

    });
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating download link'
    });
  }
};

// @desc    Get expiring documents
// @route   GET /api/documents/expiring
// @access  Private
exports.getExpiringDocuments = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + parseInt(days));
    
    const query = {
      expiryDate: {
        $gte: today,
        $lte: futureDate
      },
      status: { $in: ['approved', 'submitted'] }
    };

    if (req.user?.role !== 'admin') {
      query.uploadedBy = req.user._id;
    }

    const expiringDocuments = await Document.find(query)
      .populate('providerId', 'firstName lastName npi')
      .populate('enrollmentId')
      .sort({ expiryDate: 1 });
    
    res.status(200).json({
      status: 'success',
      data: {
        documents: expiringDocuments,
        count: expiringDocuments.length
      }
    });
  } catch (error) {
    console.error('Get expiring documents error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching expiring documents'
    });
  }
};

// @desc    Get document statistics
// @route   GET /api/documents/stats
// @access  Private
exports.getDocumentStats = async (req, res) => {
  try {
    const visibilityQuery = req.user?.role === 'admin' ? {} : { uploadedBy: req.user._id };

    const total = await Document.countDocuments(visibilityQuery);
    const approved = await Document.countDocuments({ ...visibilityQuery, status: 'approved' });
    const pending = await Document.countDocuments({ ...visibilityQuery, status: 'pending' });
    const rejected = await Document.countDocuments({ ...visibilityQuery, status: 'rejected' });
    const underReview = await Document.countDocuments({ ...visibilityQuery, status: 'under_review' });
    
    // Expiring in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = await Document.countDocuments({
      ...visibilityQuery,
      expiryDate: {
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      }
    });
    
    // Already expired
    const expired = await Document.countDocuments({
      ...visibilityQuery,
      expiryDate: { $lt: new Date() }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        total,
        byStatus: {
          approved,
          pending,
          rejected,
          underReview
        },
        expiry: {
          expiringSoon,
          expired
        }
      }
    });
  } catch (error) {
    console.error('Get document stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching document statistics'
    });
  }
};
