// backend/src/models/Enrollment.js
const mongoose = require('mongoose');

const REQUIRED_DOCUMENT_SLOTS = 9;
const REQUIRED_ONBOARDING_TEXT_FIELDS = [
  'legalName',
  'taxId',
  'npi',
  'specialty',
  'practiceAddress',
  'mailingAddress',
  'billingAddress',
  'phone',
  'email',
  'authorizedPersonName',
  'authorizedPersonPhone',
  'authorizedPersonEmail',
  'medicareId',
  'medicaidId',
  'nppesLogin',
  'caqhLogin',
  'avilityLogin',
];

const calculateProgressFromDocuments = (documents = []) => {
  if (!Array.isArray(documents) || documents.length === 0) {
    return 0;
  }

  const uniqueDocumentKeys = new Set(
    documents.map((doc) => `${String(doc.documentType || '').trim()}::${String(doc.fileName || '').trim()}`)
  );

  const documentsRatio = Math.min(uniqueDocumentKeys.size / REQUIRED_DOCUMENT_SLOTS, 1);
  const latestOnboardingPayloadDoc = documents.find((doc) => doc?.metadata?.onboardingData);
  const onboardingData = latestOnboardingPayloadDoc?.metadata?.onboardingData || {};

  let formChecksTotal = 0;
  let formChecksPassed = 0;

  for (const fieldName of REQUIRED_ONBOARDING_TEXT_FIELDS) {
    formChecksTotal += 1;
    if (String(onboardingData[fieldName] || '').trim()) {
      formChecksPassed += 1;
    }
  }

  formChecksTotal += 1;
  if (String(onboardingData.providerType || '').trim()) {
    formChecksPassed += 1;
  }

  formChecksTotal += 1;
  if (String(onboardingData.enrollmentType || '').trim()) {
    formChecksPassed += 1;
  }

  const services = onboardingData.services || {};
  const anyServiceSelected = Boolean(
    services.outPatient || services.inPatient || services.emergency || services.other
  );
  formChecksTotal += 1;
  if (anyServiceSelected) {
    formChecksPassed += 1;
  }

  if (services.other) {
    formChecksTotal += 1;
    if (String(services.otherDescription || '').trim()) {
      formChecksPassed += 1;
    }
  }

  const formRatio = formChecksTotal > 0 ? (formChecksPassed / formChecksTotal) : 0;
  return Math.max(0, Math.min(100, Math.round(((documentsRatio * 0.7) + (formRatio * 0.3)) * 100)));
};

const enrollmentSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: false,
    default: null,
  },
  insuranceService: {
    type: String,
    required: [true, 'Insurance service is required'],
    trim: true
  },
  insuranceServices: [{
    type: String,
    trim: true,
  }],
  status: {
    type: String,
    enum: [
      'intake',
      'document_collection',
      'ready_for_submission',
      'submitted',
      'in_review',
      'follow_up_required',
      'approved',
      'rejected',
      'on_hold'
    ],
    default: 'intake'
  },
  currentStage: {
    type: String,
    default: 'Intake'
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  submissionDate: {
    type: Date,
    default: null
  },
  approvalDate: {
    type: Date,
    default: null
  },
  effectiveDate: {
    type: Date,
    default: null
  },
  expirationDate: {
    type: Date,
    default: null
  },
  applicationNumber: {
    type: String,
    trim: true,
    sparse: true // Allow null values but unique when exists
  },
  enrollmentProfile: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  timeline: [{
    eventType: {
      type: String,
      enum: [
        'status_change',
        'document_uploaded',
        'document_approved',
        'document_rejected',
        'note_added',
        'assignment',
        'follow_up',
        'submission',
        'approval',
        'rejection'
      ],
      required: true
    },
    eventDescription: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    eventDate: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  notes: [{
    content: {
      type: String,
      required: true
    },
    noteType: {
      type: String,
      enum: ['internal', 'client_communication'],
      default: 'internal'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  rejectionReason: {
    type: String,
    trim: true
  },
  followUpDate: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Unique only for linked providers (providerId exists)
enrollmentSchema.index(
  { providerId: 1, insuranceService: 1 },
  {
    unique: true,
    partialFilterExpression: { providerId: { $type: 'objectId' } },
    name: 'providerId_1_insuranceService_1_partial',
  }
);

// Unique for enrollment-only records (no provider link) by enrollment profile NPI + insurance.
enrollmentSchema.index(
  { 'enrollmentProfile.npi': 1, insuranceService: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerId: null,
      'enrollmentProfile.npi': { $type: 'string' },
    },
    name: 'enrollmentProfile_npi_1_insuranceService_1_partial',
  }
);

// Index for queries
enrollmentSchema.index({ status: 1 });
enrollmentSchema.index({ assignedTo: 1 });
enrollmentSchema.index({ createdAt: -1 });

// Keep legacy single-value field and new multi-value field in sync.
enrollmentSchema.pre('validate', function(next) {
  const normalizedInsuranceService = String(this.insuranceService || '').trim();
  const normalizedInsuranceServices = Array.isArray(this.insuranceServices)
    ? Array.from(new Set(this.insuranceServices.map((item) => String(item || '').trim()).filter(Boolean)))
    : [];

  if (!normalizedInsuranceServices.length && normalizedInsuranceService) {
    normalizedInsuranceServices.push(normalizedInsuranceService);
  }

  if (!normalizedInsuranceService && normalizedInsuranceServices.length) {
    this.insuranceService = normalizedInsuranceServices[0];
  }

  if (normalizedInsuranceService && !normalizedInsuranceServices.includes(normalizedInsuranceService)) {
    normalizedInsuranceServices.unshift(normalizedInsuranceService);
  }

  this.insuranceServices = normalizedInsuranceServices;
  next();
});

// Method to add timeline event
enrollmentSchema.methods.addTimelineEvent = function(eventData) {
  this.timeline.push({
    eventType: eventData.eventType,
    eventDescription: eventData.eventDescription,
    performedBy: eventData.performedBy,
    metadata: eventData.metadata || {}
  });
  return this.save();
};

// Method to add note
enrollmentSchema.methods.addNote = function(noteData) {
  this.notes.push({
    content: noteData.content,
    noteType: noteData.noteType || 'internal',
    createdBy: noteData.createdBy,
    isPinned: noteData.isPinned || false
  });
  return this.save();
};

// Method to update progress percentage
enrollmentSchema.methods.calculateProgress = async function() {
  const Document = mongoose.model('Document');

  const enrollmentDocuments = await Document.find({ enrollmentId: this._id })
    .select('documentType fileName metadata')
    .sort({ createdAt: -1 })
    .lean();

  if (!enrollmentDocuments.length) {
    this.progressPercentage = 0;
    return this.save();
  }

  this.progressPercentage = calculateProgressFromDocuments(enrollmentDocuments);
  return this.save();
};

enrollmentSchema.statics.computeProgressFromDocuments = function(documents = []) {
  return calculateProgressFromDocuments(documents);
};

module.exports = mongoose.model('Enrollment', enrollmentSchema);
