// backend/src/models/Client.js
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  practiceName: {
    type: String,
    required: [true, 'Practice name is required'],
    trim: true
  },
  taxId: {
    type: String,
    required: [true, 'Tax ID is required'],
    unique: true,
    trim: true
  },
  npi: {
    type: String,
    required: [true, 'NPI is required'],
    unique: true,
    match: [/^\d{10}$/, 'NPI must be 10 digits']
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, default: 'USA' }
  },
  contactInfo: {
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    website: { type: String, trim: true }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  specialties: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
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
clientSchema.index({ practiceName: 'text', taxId: 'text' });

// Virtual for providers count
clientSchema.virtual('providersCount', {
  ref: 'Provider',
  localField: '_id',
  foreignField: 'clientId',
  count: true
});

module.exports = mongoose.model('Client', clientSchema);
