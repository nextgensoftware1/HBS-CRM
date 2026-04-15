// backend/src/routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getAllClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientStats
} = require('../controllers/clientController');

// Protect all routes
router.use(protect);

// Routes
router.route('/')
  .get(getAllClients)
  .post(restrictTo('admin', 'credentialing_specialist'), createClient);

router.route('/:id')
  .get(getClient)
  .put(restrictTo('admin', 'credentialing_specialist'), updateClient)
  .delete(restrictTo('admin'), deleteClient);

router.get('/:id/stats', getClientStats);

module.exports = router;
