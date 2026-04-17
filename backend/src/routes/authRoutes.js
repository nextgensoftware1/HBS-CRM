// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updatePassword,
  getAllUsers,
  updateUserRole,
  createUserByAdmin,
  deleteUserByAdmin,
  assignUserProvider
} = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);
router.get('/users', protect, restrictTo('admin'), getAllUsers);
router.post('/users', protect, restrictTo('admin'), createUserByAdmin);
router.delete('/users/:id', protect, restrictTo('admin'), deleteUserByAdmin);
router.patch('/users/:id/role', protect, restrictTo('admin'), updateUserRole);
router.patch('/users/:id/provider', protect, restrictTo('admin'), assignUserProvider);

module.exports = router;
