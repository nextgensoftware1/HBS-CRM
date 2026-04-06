// backend/src/routes/reminderRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getAllReminders,
  getReminder,
  createReminder,
  updateReminder,
  completeReminder,
  dismissReminder,
  deleteReminder,
  getReminderStats
} = require('../controllers/reminderController');

// Protect all routes
router.use(protect);

// Stats route
router.get('/stats', getReminderStats);

// Main routes
router.route('/')
  .get(getAllReminders)
  .post(createReminder);

router.route('/:id')
  .get(getReminder)
  .put(updateReminder)
  .delete(restrictTo('admin'), deleteReminder);

// Action routes
router.put('/:id/complete', restrictTo('admin'), completeReminder);
router.put('/:id/dismiss', restrictTo('admin'), dismissReminder);

module.exports = router;
