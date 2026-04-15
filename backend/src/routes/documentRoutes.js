// backend/src/routes/documentRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getAllDocuments,
  getDocument,
  getDocumentSubmission,
  uploadDocument,
  updateDocumentStatus,
  updateSubmittedRequests,
  deleteDocument,
  downloadDocument,
  getExpiringDocuments,
  getDocumentStats
} = require('../controllers/documentController');

// Protect all routes
router.use(protect);

// Special routes
router.get('/expiring', getExpiringDocuments);
router.get('/stats', getDocumentStats);

// Main routes
router.route('/')
  .get(getAllDocuments);

router.post('/upload', uploadDocument);
router.get('/:id/submission', getDocumentSubmission);

router.route('/:id')
  .get(getDocument)
  .delete(restrictTo('admin'), deleteDocument);

router.put('/:id/status', restrictTo('admin'), updateDocumentStatus);
router.put('/:id/submitted-requests', updateSubmittedRequests);
router.get('/:id/download', downloadDocument);

module.exports = router;
