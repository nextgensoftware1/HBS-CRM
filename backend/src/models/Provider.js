// backend/src/models/Provider.js
const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  npi: {
    type: String,
    required: [true, 'NPI is required'],
    unique: true,
    match: [/^\d{10}$/, 'NPI must be 10 digits']
  },
  specialization: {
    type: String,
    required: [true, 'Specialization is required'],
    trim: true
  },
  licenseNumber: {
    type: String,
    required: true,
    trim: true
  },
  licenseState: {
    type: String,
    required: true,
    trim: true
  },
  licenseExpiryDate: {
    type: Date,
    required: true
  },
  deaNumber: {
    type: String,
    trim: true
  },
  deaExpiryDate: {
    type: Date
  },
  caqhId: {
    type: String,
    trim: true
  },
  medicarePTAN: {
    type: String,
    trim: true
  },
  medicaidId: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  ssn: {
    type: String,
    trim: true,
    select: false // Don't return SSN by default for security
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  credentialLogins: {
    pecosUsername: { type: String, trim: true },
    pecosPassword: { type: String, trim: true },
    caqhUsername: { type: String, trim: true },
    caqhPassword: { type: String, trim: true }
  },
  insuranceServices: [{
    type: String,
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster searches
providerSchema.index({ firstName: 'text', lastName: 'text', npi: 'text' });
providerSchema.index({ clientId: 1 });

// Virtual for full name
providerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for enrollments count
providerSchema.virtual('enrollmentsCount', {
  ref: 'Enrollment',
  localField: '_id',
  foreignField: 'providerId',
  count: true
});

module.exports = mongoose.model('Provider', providerSchema);
