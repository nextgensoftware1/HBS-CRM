// backend/src/controllers/dashboardController.js
const Client = require('../models/Client');
const Provider = require('../models/Provider');
const Enrollment = require('../models/Enrollment');
const Document = require('../models/Document');
const Reminder = require('../models/Reminder');

// @desc    Get overview dashboard stats
// @route   GET /api/dashboard/overview
// @access  Private
exports.getOverviewDashboard = async (req, res) => {
  try {
    // Get counts
    const totalClients = await Client.countDocuments({ status: 'active' });
    const totalProviders = await Provider.countDocuments({ status: 'active' });
    const totalEnrollments = await Enrollment.countDocuments();
    const totalDocuments = await Document.countDocuments();
    
    // Enrollment status breakdown
    const enrollmentsByStatus = await Enrollment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Document status breakdown
    const documentsByStatus = await Document.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Recent activity - last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentEnrollments = await Enrollment.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });
    
    const recentDocuments = await Document.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });
    
    // Pending actions
    const pendingReminders = await Reminder.countDocuments({
      status: 'pending',
      dueDate: { $lte: new Date() }
    });
    
    const documentsNeedingReview = await Document.countDocuments({
      status: 'under_review'
    });
    
    // Expiring documents (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringDocuments = await Document.countDocuments({
      expiryDate: {
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      }
    });
    
    // Enrollment by priority
    const enrollmentsByPriority = await Enrollment.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: {
        totals: {
          clients: totalClients,
          providers: totalProviders,
          enrollments: totalEnrollments,
          documents: totalDocuments
        },
        enrollments: {
          byStatus: enrollmentsByStatus,
          byPriority: enrollmentsByPriority
        },
        documents: {
          byStatus: documentsByStatus,
          expiringSoon: expiringDocuments
        },
        recentActivity: {
          newEnrollments: recentEnrollments,
          newDocuments: recentDocuments
        },
        pendingActions: {
          reminders: pendingReminders,
          documentsToReview: documentsNeedingReview
        }
      }
    });
  } catch (error) {
    console.error('Get overview dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching dashboard data'
    });
  }
};

// @desc    Get client-specific dashboard
// @route   GET /api/dashboard/client/:clientId
// @access  Private
exports.getClientDashboard = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    
    // Get client info
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found'
      });
    }
    
    // Get providers for this client
    const providers = await Provider.find({ clientId }).select('_id');
    const providerIds = providers.map(p => p._id);
    
    // Provider stats
    const totalProviders = providers.length;
    const activeProviders = await Provider.countDocuments({ 
      clientId, 
      status: 'active' 
    });
    
    // Enrollment stats
    const totalEnrollments = await Enrollment.countDocuments({
      providerId: { $in: providerIds }
    });
    
    const enrollmentsByStatus = await Enrollment.aggregate([
      {
        $match: { providerId: { $in: providerIds } }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Document stats
    const totalDocuments = await Document.countDocuments({
      providerId: { $in: providerIds }
    });
    
    const approvedDocuments = await Document.countDocuments({
      providerId: { $in: providerIds },
      status: 'approved'
    });
    
    // Recent enrollments
    const recentEnrollments = await Enrollment.find({
      providerId: { $in: providerIds }
    })
      .populate('providerId', 'firstName lastName')
      .populate('payerId', 'payerName')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.status(200).json({
      status: 'success',
      data: {
        client,
        providers: {
          total: totalProviders,
          active: activeProviders
        },
        enrollments: {
          total: totalEnrollments,
          byStatus: enrollmentsByStatus,
          recent: recentEnrollments
        },
        documents: {
          total: totalDocuments,
          approved: approvedDocuments
        }
      }
    });
  } catch (error) {
    console.error('Get client dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching client dashboard'
    });
  }
};

// @desc    Get provider-specific dashboard
// @route   GET /api/dashboard/provider/:providerId
// @access  Private
exports.getProviderDashboard = async (req, res) => {
  try {
    const providerId = req.params.providerId;
    
    // Get provider info
    const provider = await Provider.findById(providerId)
      .populate('clientId', 'practiceName');
    
    if (!provider) {
      return res.status(404).json({
        status: 'error',
        message: 'Provider not found'
      });
    }
    
    // Enrollment stats
    const enrollments = await Enrollment.find({ providerId })
      .populate('payerId', 'payerName payerType')
      .sort({ createdAt: -1 });
    
    const enrollmentsByStatus = await Enrollment.aggregate([
      {
        $match: { providerId: provider._id }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Document stats
    const documents = await Document.find({ providerId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    const documentsByType = await Document.aggregate([
      {
        $match: { providerId: provider._id }
      },
      {
        $group: {
          _id: '$documentType',
          count: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      }
    ]);
    
    // Expiring documents
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringDocuments = await Document.find({
      providerId,
      expiryDate: {
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      }
    }).sort({ expiryDate: 1 });
    
    // Active reminders
    const reminders = await Reminder.find({
      providerId,
      status: { $in: ['pending', 'sent'] }
    }).sort({ dueDate: 1 });
    
    res.status(200).json({
      status: 'success',
      data: {
        provider,
        enrollments: {
          list: enrollments,
          byStatus: enrollmentsByStatus
        },
        documents: {
          recent: documents,
          byType: documentsByType,
          expiring: expiringDocuments
        },
        reminders
      }
    });
  } catch (error) {
    console.error('Get provider dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching provider dashboard'
    });
  }
};

// @desc    Get operational dashboard (for specialists)
// @route   GET /api/dashboard/operational
// @access  Private
exports.getOperationalDashboard = async (req, res) => {
  try {
    // Workload by specialist
    const workloadBySpecialist = await Enrollment.aggregate([
      {
        $match: { 
          status: { $nin: ['approved', 'rejected'] },
          assignedTo: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          activeEnrollments: { $sum: 1 },
          highPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          },
          urgent: {
            $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'specialist'
        }
      },
      {
        $unwind: '$specialist'
      },
      {
        $project: {
          specialistName: '$specialist.fullName',
          activeEnrollments: 1,
          highPriority: 1,
          urgent: 1
        }
      }
    ]);
    
    // Bottlenecks - enrollments stuck in same status
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const stuckEnrollments = await Enrollment.find({
      status: { $nin: ['approved', 'rejected'] },
      updatedAt: { $lte: thirtyDaysAgo }
    })
      .populate('providerId', 'firstName lastName')
      .populate('payerId', 'payerName')
      .populate('assignedTo', 'fullName')
      .sort({ updatedAt: 1 });
    
    // Enrollments by stage (funnel view)
    const enrollmentStages = await Enrollment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProgress: { $avg: '$progressPercentage' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Documents pending review
    const pendingDocuments = await Document.find({
      status: 'under_review'
    })
      .populate('providerId', 'firstName lastName')
      .populate('enrollmentId')
      .sort({ createdAt: 1 })
      .limit(20);
    
    // Overdue reminders
    const overdueReminders = await Reminder.find({
      status: 'pending',
      dueDate: { $lt: new Date() }
    })
      .populate('providerId', 'firstName lastName')
      .populate('assignedTo', 'fullName')
      .sort({ dueDate: 1 })
      .limit(20);
    
    // SLA tracking - enrollments over processing time
    const slaViolations = await Enrollment.aggregate([
      {
        $lookup: {
          from: 'payers',
          localField: 'payerId',
          foreignField: '_id',
          as: 'payer'
        }
      },
      {
        $unwind: '$payer'
      },
      {
        $addFields: {
          daysSinceCreation: {
            $divide: [
              { $subtract: [new Date(), '$createdAt'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $match: {
          status: { $nin: ['approved', 'rejected'] },
          $expr: { $gt: ['$daysSinceCreation', '$payer.processingTimeDays'] }
        }
      },
      {
        $lookup: {
          from: 'providers',
          localField: 'providerId',
          foreignField: '_id',
          as: 'provider'
        }
      },
      {
        $unwind: '$provider'
      },
      {
        $project: {
          providerName: {
            $concat: ['$provider.firstName', ' ', '$provider.lastName']
          },
          payerName: '$payer.payerName',
          daysSinceCreation: 1,
          expectedDays: '$payer.processingTimeDays',
          status: 1
        }
      }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: {
        workload: workloadBySpecialist,
        bottlenecks: stuckEnrollments,
        enrollmentStages,
        pendingActions: {
          documentsToReview: pendingDocuments,
          overdueReminders
        },
        slaTracking: {
          violations: slaViolations,
          count: slaViolations.length
        }
      }
    });
  } catch (error) {
    console.error('Get operational dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching operational dashboard'
    });
  }
};

// @desc    Get analytics data for charts
// @route   GET /api/dashboard/analytics
// @access  Private
exports.getAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    // Enrollments trend over time
    const enrollmentsTrend = await Enrollment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Documents uploaded trend
    const documentsTrend = await Document.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Approval rate
    const totalCompleted = await Enrollment.countDocuments({
      status: { $in: ['approved', 'rejected'] }
    });
    
    const approved = await Enrollment.countDocuments({
      status: 'approved'
    });
    
    const approvalRate = totalCompleted > 0 ? (approved / totalCompleted) * 100 : 0;
    
    res.status(200).json({
      status: 'success',
      data: {
        enrollmentsTrend,
        documentsTrend,
        approvalRate: Math.round(approvalRate * 10) / 10
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching analytics'
    });
  }
};
