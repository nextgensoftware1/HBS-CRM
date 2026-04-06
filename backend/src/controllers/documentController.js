// backend/src/controllers/documentController.js
const Document = require('../models/Document');
const Enrollment = require('../models/Enrollment');
const Payer = require('../models/Payer');
// const { uploadFile, deleteFile, getSignedUrl } = require('../services/s3Service');
const { uploadFile, deleteFile, getFileMetadata, checkDriveAccess } = require('../services/googleDriveService');
const { createNotification, notifyAdmins } = require('../services/notificationService');
const multer = require('multer');
const path = require('path');

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

const buildSubmissionKey = (doc) => {
  const metadata = doc?.metadata || {};
  const explicitSubmissionId = metadata.submissionId;
  const hasOnboardingPayload = Boolean(metadata.onboardingData);

  const onboardingStableKey = hasOnboardingPayload
    ? [
        'onboarding',
        String(doc.uploadedBy?._id || doc.uploadedBy || ''),
        String(doc.providerId?._id || doc.providerId || ''),
        String(metadata.clientName || ''),
        String(metadata.insuranceService || ''),
      ].join('|')
    : null;

  return onboardingStableKey || explicitSubmissionId || String(doc._id);
};

const resolveGroupedStatus = (statuses = []) => {
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('under_review')) return 'under_review';
  if (statuses.includes('submitted')) return 'submitted';
  if (statuses.includes('rejected')) return 'rejected';
  if (statuses.includes('approved')) return 'approved';
  return 'pending';
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getSubmissionQuery = (document) => {
  const metadata = document?.metadata || {};

  if (metadata.submissionId) {
    return { 'metadata.submissionId': metadata.submissionId };
  }

  if (metadata.onboardingData) {
    return {
      providerId: document.providerId,
      uploadedBy: document.uploadedBy,
      'metadata.clientName': metadata.clientName || null,
      'metadata.insuranceService': metadata.insuranceService || null,
    };
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

  let payer = await Payer.findOne({
    payerName: { $regex: `^${escapeRegex(insuranceService)}$`, $options: 'i' },
  });

  if (!payer) {
    payer = await Payer.create({
      payerName: insuranceService,
      payerType: 'Other',
      isActive: true,
      createdBy: actorId,
    });
  }

  let enrollment = await Enrollment.findOne({
    providerId: document.providerId,
    payerId: payer._id,
  });

  if (!enrollment) {
    enrollment = await Enrollment.create({
      providerId: document.providerId,
      payerId: payer._id,
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

    // Non-admin users can only see documents they uploaded.
    if (req.user?.role !== 'admin') {
      query.uploadedBy = req.user._id;
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
      const explicitSubmissionId = metadata.submissionId;
      const hasOnboardingPayload = Boolean(metadata.onboardingData);
      const legacyTimeBucket = new Date(doc.createdAt).toISOString().slice(0, 16); // yyyy-mm-ddThh:mm

      const onboardingStableKey = hasOnboardingPayload
        ? [
            'onboarding',
            String(doc.uploadedBy || ''),
            String(doc.providerId?._id || doc.providerId || ''),
            String(metadata.clientName || ''),
            String(metadata.insuranceService || ''),
          ].join('|')
        : null;

      // Backward compatibility: group legacy full-form uploads that were stored without submissionId.
      const legacyGroupKey = hasOnboardingPayload
        ? [
            String(doc.uploadedBy || ''),
            String(doc.providerId?._id || doc.providerId || ''),
            String(metadata.clientName || ''),
            String(metadata.insuranceService || ''),
            legacyTimeBucket,
          ].join('|')
        : null;

      const submissionId = onboardingStableKey || explicitSubmissionId || legacyGroupKey || String(doc._id);

      if (!groupedMap.has(submissionId)) {
        groupedMap.set(submissionId, {
          ...doc.toObject(),
          documentType: hasOnboardingPayload ? 'Insurance Intake Packet' : doc.documentType,
          filesCount: 1,
          fileNames: [doc.fileName],
          statusList: [doc.status],
          metadata: {
            ...(doc.metadata || {}),
            submissionId,
          },
        });
      } else {
        const existing = groupedMap.get(submissionId);
        existing.filesCount += 1;
        existing.fileNames.push(doc.fileName);
        existing.statusList.push(doc.status);

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
            statusList: existing.statusList,
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
    const query = { _id: req.params.id };
    if (req.user?.role !== 'admin') {
      query.uploadedBy = req.user._id;
    }

    const document = await Document.findOne(query)
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
    const query = { _id: req.params.id };
    if (req.user?.role !== 'admin') {
      query.uploadedBy = req.user._id;
    }

    const anchorDocument = await Document.findOne(query)
      .populate('providerId', 'firstName lastName npi')
      .populate('uploadedBy', 'fullName email');

    if (!anchorDocument) {
      return res.status(404).json({
        status: 'error',
        message: 'Document submission not found'
      });
    }

    const metadata = anchorDocument.metadata || {};
    const visibilityQuery = req.user?.role === 'admin' ? {} : { uploadedBy: req.user._id };
    const anchorSubmissionKey = buildSubmissionKey(anchorDocument);

    // Pull likely candidates first, then filter by the same grouping key used in list view.
    let candidateQuery = { ...visibilityQuery };
    if (metadata.onboardingData) {
      candidateQuery = {
        ...visibilityQuery,
        providerId: anchorDocument.providerId?._id || anchorDocument.providerId,
        uploadedBy: anchorDocument.uploadedBy?._id || anchorDocument.uploadedBy,
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

    res.status(200).json({
      status: 'success',
      data: {
        submission: {
          submissionId,
          provider: latest.providerId,
          uploadedBy: latest.uploadedBy,
          clientName: latest.metadata?.clientName || null,
          insuranceService: latest.metadata?.insuranceService || null,
          status: latest.status,
          createdAt: latest.createdAt,
          filesCount: docs.length,
          onboardingData,
          files: docs.map((doc) => ({
            _id: doc._id,
            fileName: doc.fileName,
            documentType: doc.documentType,
            status: doc.status,
            createdAt: doc.createdAt,
            fileUrl: doc.fileUrl,
          })),
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
      const driveAccessible = await checkDriveAccess();
      if (!driveAccessible) {
        return res.status(503).json({
          status: 'error',
          message: 'Google Drive storage is not configured correctly. Please set valid service account credentials before uploading documents.'
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
      
      // Validate required fields for new uploads
      if (!replaceDocumentId && (!providerId || !documentType)) {
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
      const versionQuery = {
        providerId,
        enrollmentId: enrollmentReference,
        documentType,
      };
      
      // Upload file to Google Drive (external storage)
      const uploadResult = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Re-upload flow: replace existing rejected document in-place (no new DB row)
      if (replaceDocumentId) {
        const replaceQuery = { _id: replaceDocumentId };
        if (req.user?.role !== 'admin') {
          replaceQuery.uploadedBy = req.user._id;
        }

        const existingDocument = await Document.findOne(replaceQuery);
        if (!existingDocument) {
          return res.status(404).json({
            status: 'error',
            message: 'Original document not found for re-upload'
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
            await deleteFile(existingDocument.fileKey);
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
        providerId,
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
    const { status, rejectionReason, adminNote } = req.body;
    
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }
    
    const oldStatus = document.status;
    document.status = status;
    
    if (status === 'approved') {
      document.verifiedBy = req.user._id;
      document.verifiedAt = new Date();
    }
    
    if (status === 'rejected' && rejectionReason) {
      document.rejectionReason = rejectionReason;
    }

    if (adminNote) {
      document.notes = document.notes
        ? `${document.notes}\n[${new Date().toISOString()}] ${adminNote}`
        : `[${new Date().toISOString()}] ${adminNote}`;
    }
    
    if (status === 'approved') {
      await ensureEnrollmentForApprovedDocument(document, req.user._id);
    }

    await document.save();
    
    // Update enrollment timeline
    const enrollment = await Enrollment.findById(document.enrollmentId);
    if (enrollment) {
      const eventType = status === 'approved' ? 'document_approved' : 
                       status === 'rejected' ? 'document_rejected' : 
                       'status_change';
      
      await enrollment.addTimelineEvent({
        eventType,
        eventDescription: `${document.documentType} ${status}`,
        performedBy: req.user._id,
        metadata: { documentId: document._id, oldStatus, newStatus: status, adminNote: adminNote || null }
      });
      
      // Recalculate progress
      await enrollment.calculateProgress();
    }
    
    await document.populate('providerId enrollmentId uploadedBy verifiedBy');

    await createNotification({
      recipient: document.uploadedBy?._id || document.uploadedBy,
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
        status === 'rejected' && document.rejectionReason
          ? `${document.documentType} was rejected. Reason: ${document.rejectionReason}`
          : `${document.documentType} status updated to ${status}.`,
      entityId: document._id,
      metadata: {
        documentType: document.documentType,
        fileName: document.fileName,
        status,
      },
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Document status updated successfully',
      data: { document }
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
    
    // Delete file from S3
    try {
      await deleteFile(document.fileKey);
    } catch (s3Error) {
      console.error('S3 deletion error:', s3Error);
      // Continue with database deletion even if S3 deletion fails
    }
    
    // Delete document from database
    const deletedDocumentSnapshot = {
      uploadedBy: document.uploadedBy,
      documentType: document.documentType,
      fileName: document.fileName,
      _id: document._id,
    };

    await document.deleteOne();
    
    // Update enrollment progress
    const enrollment = await Enrollment.findById(document.enrollmentId);
    if (enrollment) {
      await enrollment.calculateProgress();
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
      },
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Document deleted successfully'
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
    const query = { _id: req.params.id };
    if (req.user?.role !== 'admin') {
      query.uploadedBy = req.user._id;
    }

    const document = await Document.findOne(query);
    
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }
    
    // Generate signed URL (valid for 1 hour)
    // const signedUrl = getSignedUrl(document.fileKey, 3600);
    // Get Google Drive view link
    const metadata = await getFileMetadata(document.fileKey);
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
