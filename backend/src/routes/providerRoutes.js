// backend/src/routes/providerRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getAllProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  getProviderStats,
  getProvidersByClient,
  getProviderClientOptions
} = require('../controllers/providerController');

// Protect all routes
router.use(protect);

// Routes
router.route('/')
  .get(getAllProviders)
  .post(restrictTo('admin', 'credentialing_specialist'), createProvider);

router.get('/client-options', getProviderClientOptions);
router.get('/client/:clientId', getProvidersByClient);

router.route('/:id')
  .get(getProvider)
  .put(restrictTo('admin', 'credentialing_specialist'), updateProvider)
  .delete(restrictTo('admin'), deleteProvider);

router.get('/:id/stats', getProviderStats);

module.exports = router;
