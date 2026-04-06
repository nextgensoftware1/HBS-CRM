// backend/src/models/Enrollment.js
const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider is required']
  },
  payerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payer',
    required: [true, 'Payer is required']
  },
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
      enum: ['internal', 'client_communication', 'payer_communication'],
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

// Compound index to ensure one enrollment per provider-payer combination
enrollmentSchema.index({ providerId: 1, payerId: 1 }, { unique: true });

// Index for queries
enrollmentSchema.index({ status: 1 });
enrollmentSchema.index({ assignedTo: 1 });
enrollmentSchema.index({ createdAt: -1 });

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
  
  // Get total required documents for this payer
  const Payer = mongoose.model('Payer');
  const payer = await Payer.findById(this.payerId);
  
  if (!payer || !payer.requiredDocuments || payer.requiredDocuments.length === 0) {
    this.progressPercentage = 0;
    return this.save();
  }
  
  const totalRequired = payer.requiredDocuments.filter(doc => doc.isMandatory).length;
  
  // Get approved documents for this enrollment
  const approvedDocs = await Document.countDocuments({
    enrollmentId: this._id,
    status: 'approved'
  });
  
  this.progressPercentage = Math.round((approvedDocs / totalRequired) * 100);
  return this.save();
};

module.exports = mongoose.model('Enrollment', enrollmentSchema);
