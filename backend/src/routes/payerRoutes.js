// backend/src/routes/payerRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getAllPayers,
  getPayer,
  createPayer,
  updatePayer,
  deletePayer,
  getPayerRequirements
} = require('../controllers/payerController');

// Protect all routes
router.use(protect);

// Routes
router.route('/')
  .get(getAllPayers)
  .post(restrictTo('admin'), createPayer);

router.route('/:id')
  .get(getPayer)
  .put(restrictTo('admin'), updatePayer)
  .delete(restrictTo('admin'), deletePayer);

router.get('/:id/requirements', getPayerRequirements);

module.exports = router;
