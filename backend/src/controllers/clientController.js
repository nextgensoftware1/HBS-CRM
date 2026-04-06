// backend/src/controllers/clientController.js
const Client = require('../models/Client');
const Provider = require('../models/Provider');

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
exports.getAllClients = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { practiceName: { $regex: search, $options: 'i' } },
        { taxId: { $regex: search, $options: 'i' } },
        { npi: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }
    
    // Execute query with pagination
    const clients = await Client.find(query)
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Get total count
    const total = await Client.countDocuments(query);
    
    // Get providers count for each client
    const clientsWithCounts = await Promise.all(
      clients.map(async (client) => {
        const providersCount = await Provider.countDocuments({ clientId: client._id });
        return {
          ...client.toObject(),
          providersCount
        };
      })
    );
    
    res.status(200).json({
      status: 'success',
      data: {
        clients: clientsWithCounts,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching clients'
    });
  }
};

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
exports.getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('createdBy', 'fullName email');
    
    if (!client) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found'
      });
    }
    
    // Get providers for this client
    const providers = await Provider.find({ clientId: client._id })
      .select('firstName lastName npi specialization status');
    
    res.status(200).json({
      status: 'success',
      data: {
        client,
        providers
      }
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching client'
    });
  }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Private (Admin/Specialist)
exports.createClient = async (req, res) => {
  try {
    const {
      practiceName,
      taxId,
      npi,
      address,
      contactInfo,
      specialties,
      notes
    } = req.body;
    
    // Check if client already exists
    const existingClient = await Client.findOne({
      $or: [{ taxId }, { npi }]
    });
    
    if (existingClient) {
      return res.status(400).json({
        status: 'error',
        message: 'Client already exists with this Tax ID or NPI'
      });
    }
    
    // Create client
    const client = await Client.create({
      practiceName,
      taxId,
      npi,
      address,
      contactInfo,
      specialties,
      notes,
      createdBy: req.user._id
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Client created successfully',
      data: { client }
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error creating client'
    });
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private (Admin/Specialist)
exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!client) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Client updated successfully',
      data: { client }
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating client'
    });
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private (Admin only)
exports.deleteClient = async (req, res) => {
  try {
    // Check if client has providers
    const providersCount = await Provider.countDocuments({ clientId: req.params.id });
    
    if (providersCount > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete client with ${providersCount} provider(s). Delete providers first.`
      });
    }
    
    const client = await Client.findByIdAndDelete(req.params.id);
    
    if (!client) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting client'
    });
  }
};

// @desc    Get client statistics
// @route   GET /api/clients/:id/stats
// @access  Private
exports.getClientStats = async (req, res) => {
  try {
    const clientId = req.params.id;
    
    // Get providers count
    const totalProviders = await Provider.countDocuments({ clientId });
    const activeProviders = await Provider.countDocuments({ 
      clientId, 
      status: 'active' 
    });
    
    // Get enrollments count
    const Enrollment = require('../models/Enrollment');
    const providers = await Provider.find({ clientId }).select('_id');
    const providerIds = providers.map(p => p._id);
    
    const totalEnrollments = await Enrollment.countDocuments({
      providerId: { $in: providerIds }
    });
    
    const approvedEnrollments = await Enrollment.countDocuments({
      providerId: { $in: providerIds },
      status: 'approved'
    });
    
    const pendingEnrollments = await Enrollment.countDocuments({
      providerId: { $in: providerIds },
      status: { $nin: ['approved', 'rejected'] }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        providers: {
          total: totalProviders,
          active: activeProviders
        },
        enrollments: {
          total: totalEnrollments,
          approved: approvedEnrollments,
          pending: pendingEnrollments
        }
      }
    });
  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching client statistics'
    });
  }
};
