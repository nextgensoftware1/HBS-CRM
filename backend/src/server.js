// backend/src/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const providerRoutes = require('./routes/providerRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const documentRoutes = require('./routes/documentRoutes');
const payerRoutes = require('./routes/payerRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { checkDriveAccess } = require('./services/googleDriveService');

// Import cron jobs
const { startReminderCron } = require('./services/cronService');
const seedAdmin = require('./utils/seedAdmin');

const app = express();

const logStorageHealth = async () => {
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials/google-credentials.json';

  try {
    const driveOk = await checkDriveAccess();

    if (driveOk) {
      console.log('✅ Google Drive storage is configured and reachable');
      return;
    }

    console.warn('⚠️ Google Drive storage check failed.');
    console.warn(`   Expected credentials path: ${credentialsPath}`);
    console.warn('   Fix: add a valid service account JSON and share the Drive folder with that service account email.');
  } catch (error) {
    console.warn('⚠️ Google Drive storage check errored at startup:', error.message);
  }
};

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Serve local uploads when using development fallback storage
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Healthcare CRM API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/payers', payerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Seed admin user if configured
    await seedAdmin();

    // Start cron jobs after DB connection
    startReminderCron();
    console.log('✅ Cron jobs started');
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 API URL: http://localhost:${PORT}`);
    console.log(`💚 Health Check: http://localhost:${PORT}/health`);
    logStorageHealth();
    console.log('');
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});
