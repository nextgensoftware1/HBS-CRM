// backend/src/controllers/payerController.js
const Payer = require('../models/Payer');
const Enrollment = require('../models/Enrollment');

// @desc    Get all payers
// @route   GET /api/payers
// @access  Private
exports.getAllPayers = async (req, res) => {
  try {
    const { search, payerType, isActive, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = {};
    
    if (search) {
      query.payerName = { $regex: search, $options: 'i' };
    }
    
    if (payerType) {
      query.payerType = payerType;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Execute query
    const payers = await Payer.find(query)
      .sort({ payerName: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Payer.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      data: {
        payers,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get payers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching payers'
    });
  }
};

// @desc    Get single payer
// @route   GET /api/payers/:id
// @access  Private
exports.getPayer = async (req, res) => {
  try {
    const payer = await Payer.findById(req.params.id);
    
    if (!payer) {
      return res.status(404).json({
        status: 'error',
        message: 'Payer not found'
      });
    }
    
    // Get enrollments count for this payer
    const enrollmentsCount = await Enrollment.countDocuments({ payerId: payer._id });
    const activeEnrollments = await Enrollment.countDocuments({ 
      payerId: payer._id, 
      status: { $nin: ['approved', 'rejected'] }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        payer,
        stats: {
          totalEnrollments: enrollmentsCount,
          activeEnrollments
        }
      }
    });
  } catch (error) {
    console.error('Get payer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching payer'
    });
  }
};

// @desc    Create new payer
// @route   POST /api/payers
// @access  Private (Admin only)
exports.createPayer = async (req, res) => {
  try {
    const payer = await Payer.create({
      ...req.body,
      createdBy: req.user._id
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Payer created successfully',
      data: { payer }
    });
  } catch (error) {
    console.error('Create payer error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error creating payer'
    });
  }
};

// @desc    Update payer
// @route   PUT /api/payers/:id
// @access  Private (Admin only)
exports.updatePayer = async (req, res) => {
  try {
    const payer = await Payer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!payer) {
      return res.status(404).json({
        status: 'error',
        message: 'Payer not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Payer updated successfully',
      data: { payer }
    });
  } catch (error) {
    console.error('Update payer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating payer'
    });
  }
};

// @desc    Delete payer
// @route   DELETE /api/payers/:id
// @access  Private (Admin only)
exports.deletePayer = async (req, res) => {
  try {
    // Check if payer has enrollments
    const enrollmentsCount = await Enrollment.countDocuments({ payerId: req.params.id });
    
    if (enrollmentsCount > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete payer with ${enrollmentsCount} enrollment(s)`
      });
    }
    
    const payer = await Payer.findByIdAndDelete(req.params.id);
    
    if (!payer) {
      return res.status(404).json({
        status: 'error',
        message: 'Payer not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Payer deleted successfully'
    });
  } catch (error) {
    console.error('Delete payer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting payer'
    });
  }
};

// @desc    Get payer requirements
// @route   GET /api/payers/:id/requirements
// @access  Private
exports.getPayerRequirements = async (req, res) => {
  try {
    const payer = await Payer.findById(req.params.id)
      .select('payerName requiredDocuments credentialingSteps');
    
    if (!payer) {
      return res.status(404).json({
        status: 'error',
        message: 'Payer not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        payerName: payer.payerName,
        requiredDocuments: payer.requiredDocuments,
        credentialingSteps: payer.credentialingSteps
      }
    });
  } catch (error) {
    console.error('Get payer requirements error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching payer requirements'
    });
  }
};
