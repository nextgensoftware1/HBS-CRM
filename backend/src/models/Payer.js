// backend/src/models/Payer.js
const mongoose = require('mongoose');

const payerSchema = new mongoose.Schema({
  payerName: {
    type: String,
    required: [true, 'Payer name is required'],
    unique: true,
    trim: true
  },
  payerType: {
    type: String,
    enum: ['Medicare', 'Medicaid', 'Commercial', 'Other'],
    required: true
  },
  payerId: {
    type: String,
    unique: true,
    sparse: true, // Allow null values
    trim: true
  },
  portalUrl: {
    type: String,
    trim: true
  },
  contactInfo: {
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true }
  },
  processingTimeDays: {
    type: Number,
    default: 90,
    min: 0
  },
  requiredDocuments: [{
    documentType: {
      type: String,
      enum: ['License', 'DEA', 'Malpractice', 'CAQH', 'W9', 'CV', 'Board Certification', 'Other'],
      required: true
    },
    isMandatory: {
      type: Boolean,
      default: true
    },
    specialInstructions: {
      type: String,
      trim: true
    }
  }],
  credentialingSteps: [{
    stepName: { type: String, required: true },
    stepOrder: { type: Number, required: true },
    estimatedDays: { type: Number, default: 0 }
  }],
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster searches
payerSchema.index({ payerName: 'text' });

module.exports = mongoose.model('Payer', payerSchema);
