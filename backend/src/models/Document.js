// backend/src/models/Document.js
const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider is required']
  },
  enrollmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment',
    required: false,
    default: null
  },
  documentType: {
    type: String,
    enum: [
      'License',
      'DEA',
      'Malpractice',
      'CAQH',
      'W9',
      'CV',
      'Board Certification',
      'Diploma',
      'Photo ID',
      'Other'
    ],
    required: [true, 'Document type is required']
  },
  fileName: {
    type: String,
    required: [true, 'File name is required'],
    trim: true
  },
  fileUrl: {
    type: String, // S3 URL
    required: [true, 'File URL is required']
  },
  fileKey: {
    type: String, // S3 key for deletion
    required: true
  },
  fileSize: {
    type: Number, // in bytes
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['pending', 'submitted', 'under_review', 'approved', 'rejected'],
    default: 'pending'
  },
  issueDate: {
    type: Date,
    default: null
  },
  expiryDate: {
    type: Date,
    default: null
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  isLatestVersion: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for queries
documentSchema.index({ providerId: 1, documentType: 1 });
documentSchema.index({ enrollmentId: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ expiryDate: 1 });

// Method to check if document is expiring soon
documentSchema.methods.isExpiringSoon = function(days = 30) {
  if (!this.expiryDate) return false;
  
  const today = new Date();
  const expiryDate = new Date(this.expiryDate);
  const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
  
  return daysUntilExpiry <= days && daysUntilExpiry > 0;
};

// Method to check if document is expired
documentSchema.methods.isExpired = function() {
  if (!this.expiryDate) return false;
  return new Date(this.expiryDate) < new Date();
};

module.exports = mongoose.model('Document', documentSchema);
