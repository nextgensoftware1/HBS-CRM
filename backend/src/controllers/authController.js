// backend/src/controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public (but in production, restrict to admin only)
exports.register = async (req, res) => {
  try {
    const { email, password, fullName, clientId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      fullName,
      role: 'credentialing_specialist',
      clientId: clientId || null
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error registering user'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }

    // Check if user exists (include password for comparison)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Your account has been deactivated. Please contact admin.'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          permissions: user.permissions,
          clientId: user.clientId
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error logging in'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('clientId', 'practiceName');

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user data'
    });
  }
};

// @desc    Update user password
// @route   PUT /api/auth/update-password
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide current and new password'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating password'
    });
  }
};

// @desc    Get all users (admin)
// @route   GET /api/auth/users
// @access  Private (Admin)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('clientId', 'practiceName')
      .sort({ createdAt: -1 });

    const onlineThresholdMs = 5 * 60 * 1000;
    const now = Date.now();

    const usersWithPresence = users.map((user) => {
      const userObj = user.toObject();
      const lastSeen = userObj.lastSeenAt || userObj.lastLogin || null;
      const isOnline = lastSeen ? (now - new Date(lastSeen).getTime()) <= onlineThresholdMs : false;
      const lastLoginDisplay = userObj.lastLogin || userObj.lastSeenAt || null;

      return {
        ...userObj,
        isOnline,
        lastLoginDisplay,
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        users: usersWithPresence,
        total: usersWithPresence.length,
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching users',
    });
  }
};

// @desc    Update user role (admin)
// @route   PATCH /api/auth/users/:id/role
// @access  Private (Admin)
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    const allowedRoles = ['admin', 'credentialing_specialist'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid role value',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'User role updated successfully',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          lastSeenAt: user.lastSeenAt,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating user role',
    });
  }
};

// @desc    Create new user (admin)
// @route   POST /api/auth/users
// @access  Private (Admin)
exports.createUserByAdmin = async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide fullName, email, and password',
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters',
      });
    }

    const allowedRoles = ['admin', 'credentialing_specialist'];
    const normalizedRole = role || 'credentialing_specialist';

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid role value',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email',
      });
    }

    const user = await User.create({
      email,
      password,
      fullName,
      role: normalizedRole,
      clientId: null,
    });

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          lastSeenAt: user.lastSeenAt,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Create user by admin error:', error);

    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors || {})[0];
      return res.status(400).json({
        status: 'error',
        message: firstError?.message || 'Validation failed while creating user',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Error creating user',
    });
  }
};
