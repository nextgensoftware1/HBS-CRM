// backend/src/controllers/providerController.js
const Provider = require('../models/Provider');
const Enrollment = require('../models/Enrollment');
const Document = require('../models/Document');
const Client = require('../models/Client');

// @desc    Get all providers
// @route   GET /api/providers
// @access  Private
exports.getAllProviders = async (req, res) => {
  try {
    const { search, clientId, status, specialization, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { npi: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (clientId) {
      query.clientId = clientId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (specialization) {
      query.specialization = { $regex: specialization, $options: 'i' };
    }
    
    // Execute query with pagination
    const providers = await Provider.find(query)
      .populate('clientId', 'practiceName npi')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Get total count
    const total = await Provider.countDocuments(query);
    
    // Get enrollments count for each provider
    const providersWithCounts = await Promise.all(
      providers.map(async (provider) => {
        const enrollmentsCount = await Enrollment.countDocuments({ providerId: provider._id });
        const approvedEnrollments = await Enrollment.countDocuments({ 
          providerId: provider._id, 
          status: 'approved' 
        });

        const enrollments = await Enrollment.find({ providerId: provider._id })
          .populate('payerId', 'payerName')
          .select('payerId');

        const insuranceFromEnrollments = enrollments
          .map((entry) => entry.payerId?.payerName)
          .filter(Boolean);

        const insuranceFromProvider = Array.isArray(provider.insuranceServices)
          ? provider.insuranceServices.filter(Boolean)
          : [];

        const insuranceServices = Array.from(new Set([
          ...insuranceFromProvider,
          ...insuranceFromEnrollments,
        ]));
        
        return {
          ...provider.toObject(),
          enrollmentsCount,
          approvedEnrollments,
          insuranceServices,
        };
      })
    );
    
    res.status(200).json({
      status: 'success',
      data: {
        providers: providersWithCounts,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching providers'
    });
  }
};

// @desc    Get single provider
// @route   GET /api/providers/:id
// @access  Private
exports.getProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id)
      .select('+ssn')
      .populate('clientId')
      .populate('createdBy', 'fullName email');
    
    if (!provider) {
      return res.status(404).json({
        status: 'error',
        message: 'Provider not found'
      });
    }
    
    // Get enrollments for this provider
    const enrollments = await Enrollment.find({ providerId: provider._id })
      .populate('payerId', 'payerName payerType')
      .sort({ createdAt: -1 });
    
    // Get documents for this provider
    const documents = await Document.find({ providerId: provider._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.status(200).json({
      status: 'success',
      data: {
        provider,
        enrollments,
        recentDocuments: documents
      }
    });
  } catch (error) {
    console.error('Get provider error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching provider'
    });
  }
};

// @desc    Create new provider
// @route   POST /api/providers
// @access  Private (Admin/Specialist)
exports.createProvider = async (req, res) => {
  try {
    const {
      clientId,
      firstName,
      lastName,
      npi,
      specialization,
      licenseNumber,
      licenseState,
      licenseExpiryDate,
      deaNumber,
      deaExpiryDate,
      caqhId,
      medicarePTAN,
      medicaidId,
      dateOfBirth,
      ssn,
      email,
      phone,
      address,
      notes,
      credentialLogins,
      insuranceServices
    } = req.body;
    
    // Check if provider already exists
    const existingProvider = await Provider.findOne({ npi });
    
    if (existingProvider) {
      return res.status(400).json({
        status: 'error',
        message: 'Provider already exists with this NPI'
      });
    }
    
    // Create provider
    const provider = await Provider.create({
      clientId,
      firstName,
      lastName,
      npi,
      specialization,
      licenseNumber,
      licenseState,
      licenseExpiryDate,
      deaNumber,
      deaExpiryDate,
      caqhId,
      medicarePTAN,
      medicaidId,
      dateOfBirth,
      ssn,
      email,
      phone,
      address,
      notes,
      credentialLogins: {
        pecosUsername: credentialLogins?.pecosUsername || null,
        pecosPassword: credentialLogins?.pecosPassword || null,
        caqhUsername: credentialLogins?.caqhUsername || null,
        caqhPassword: credentialLogins?.caqhPassword || null,
      },
      insuranceServices: Array.isArray(insuranceServices)
        ? insuranceServices.map((value) => String(value).trim()).filter(Boolean)
        : [],
      createdBy: req.user._id
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Provider created successfully',
      data: { provider }
    });
  } catch (error) {
    console.error('Create provider error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error creating provider'
    });
  }
};

// @desc    Update provider
// @route   PUT /api/providers/:id
// @access  Private (Admin/Specialist)
exports.updateProvider = async (req, res) => {
  try {
    const updatePayload = { ...req.body };

    if (Array.isArray(updatePayload.insuranceServices)) {
      updatePayload.insuranceServices = updatePayload.insuranceServices
        .map((value) => String(value).trim())
        .filter(Boolean);
    }

    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!provider) {
      return res.status(404).json({
        status: 'error',
        message: 'Provider not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Provider updated successfully',
      data: { provider }
    });
  } catch (error) {
    console.error('Update provider error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating provider'
    });
  }
};

// @desc    Delete provider
// @route   DELETE /api/providers/:id
// @access  Private (Admin only)
exports.deleteProvider = async (req, res) => {
  try {
    // Check if provider has enrollments
    const enrollmentsCount = await Enrollment.countDocuments({ providerId: req.params.id });
    
    if (enrollmentsCount > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete provider with ${enrollmentsCount} enrollment(s). Delete enrollments first.`
      });
    }
    
    const provider = await Provider.findByIdAndDelete(req.params.id);
    
    if (!provider) {
      return res.status(404).json({
        status: 'error',
        message: 'Provider not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Provider deleted successfully'
    });
  } catch (error) {
    console.error('Delete provider error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting provider'
    });
  }
};

// @desc    Get provider statistics
// @route   GET /api/providers/:id/stats
// @access  Private
exports.getProviderStats = async (req, res) => {
  try {
    const providerId = req.params.id;
    
    // Get enrollments count
    const totalEnrollments = await Enrollment.countDocuments({ providerId });
    const approvedEnrollments = await Enrollment.countDocuments({ 
      providerId, 
      status: 'approved' 
    });
    const pendingEnrollments = await Enrollment.countDocuments({
      providerId,
      status: { $nin: ['approved', 'rejected'] }
    });
    
    // Get documents count
    const totalDocuments = await Document.countDocuments({ providerId });
    const approvedDocuments = await Document.countDocuments({ 
      providerId, 
      status: 'approved' 
    });
    const pendingDocuments = await Document.countDocuments({
      providerId,
      status: { $in: ['pending', 'under_review'] }
    });
    
    // Get expiring documents (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringDocuments = await Document.countDocuments({
      providerId,
      expiryDate: {
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        enrollments: {
          total: totalEnrollments,
          approved: approvedEnrollments,
          pending: pendingEnrollments
        },
        documents: {
          total: totalDocuments,
          approved: approvedDocuments,
          pending: pendingDocuments,
          expiringSoon: expiringDocuments
        }
      }
    });
  } catch (error) {
    console.error('Get provider stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching provider statistics'
    });
  }
};

// @desc    Get providers by client
// @route   GET /api/providers/client/:clientId
// @access  Private
exports.getProvidersByClient = async (req, res) => {
  try {
    const providers = await Provider.find({ clientId: req.params.clientId })
      .sort({ lastName: 1, firstName: 1 });
    
    res.status(200).json({
      status: 'success',
      data: { providers }
    });
  } catch (error) {
    console.error('Get providers by client error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching providers'
    });
  }
};

// @desc    Get client options for provider forms
// @route   GET /api/providers/client-options
// @access  Private
exports.getProviderClientOptions = async (req, res) => {
  try {
    const clients = await Client.find({})
      .select('_id practiceName status')
      .sort({ practiceName: 1 });

    res.status(200).json({
      status: 'success',
      data: {
        clients,
      },
    });
  } catch (error) {
    console.error('Get provider client options error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching client options',
    });
  }
};
