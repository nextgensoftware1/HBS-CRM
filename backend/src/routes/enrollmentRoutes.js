// backend/src/routes/enrollmentRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getAllEnrollments,
  getEnrollment,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
  updateEnrollmentStatus,
  addNote,
  getEnrollmentTimeline,
  calculateProgress,
  getEnrollmentsByStatus
} = require('../controllers/enrollmentController');

// Protect all routes
router.use(protect);

// Special routes
router.get('/kanban/board', getEnrollmentsByStatus);

// Main routes
router.route('/')
  .get(getAllEnrollments)
  .post(restrictTo('admin', 'credentialing_specialist'), createEnrollment);

router.route('/:id')
  .get(getEnrollment)
  .put(restrictTo('admin', 'credentialing_specialist'), updateEnrollment)
  .delete(restrictTo('admin'), deleteEnrollment);

// Additional routes
router.put('/:id/status', restrictTo('admin'), updateEnrollmentStatus);
router.post('/:id/notes', addNote);
router.get('/:id/timeline', getEnrollmentTimeline);
router.put('/:id/calculate-progress', calculateProgress);

module.exports = router;
