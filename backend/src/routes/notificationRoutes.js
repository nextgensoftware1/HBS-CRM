const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getMyNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../controllers/notificationController');

router.use(protect);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadNotificationsCount);
router.put('/read-all', markAllNotificationsAsRead);
router.put('/:id/read', markNotificationAsRead);

module.exports = router;
