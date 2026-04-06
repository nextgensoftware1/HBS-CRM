// backend/src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getOverviewDashboard,
  getClientDashboard,
  getProviderDashboard,
  getOperationalDashboard,
  getAnalytics
} = require('../controllers/dashboardController');

// Protect all routes
router.use(protect);
router.use(restrictTo('admin'));

// Routes
router.get('/overview', getOverviewDashboard);
router.get('/client/:clientId', getClientDashboard);
router.get('/provider/:providerId', getProviderDashboard);
router.get('/operational', getOperationalDashboard);
router.get('/analytics', getAnalytics);

module.exports = router;
