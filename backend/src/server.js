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
const dashboardRoutes = require('./routes/dashboardRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const googleDriveOAuthRoutes = require('./routes/googleDriveOAuthRoutes');
const { checkDriveAccess } = require('./services/googleDriveOAuthService');
// Import cron jobs
const { startReminderCron } = require('./services/cronService');
const seedAdmin = require('./utils/seedAdmin');

const migrateEnrollmentIndexes = async () => {
  try {
    const collection = mongoose.connection.collection('enrollments');
    const indexes = await collection.indexes();

    const dropIfExists = async (indexName) => {
      const exists = indexes.some((entry) => entry.name === indexName);
      if (!exists) return;
      await collection.dropIndex(indexName);
      console.log(`🧹 Dropped legacy enrollment index: ${indexName}`);
    };

    // Remove stale indexes from payer-era and pre-separation uniqueness rules.
    await dropIfExists('providerId_1_payerId_1');
    await dropIfExists('providerId_1_insuranceService_1');

    await collection.createIndex(
      { providerId: 1, insuranceService: 1 },
      {
        unique: true,
        partialFilterExpression: { providerId: { $type: 'objectId' } },
        name: 'providerId_1_insuranceService_1_partial',
      }
    );

    await collection.createIndex(
      { 'enrollmentProfile.npi': 1, insuranceService: 1 },
      {
        unique: true,
        partialFilterExpression: {
          providerId: null,
          'enrollmentProfile.npi': { $type: 'string', $ne: '' },
        },
        name: 'enrollmentProfile_npi_1_insuranceService_1_partial',
      }
    );

    console.log('✅ Enrollment indexes verified/migrated');
  } catch (error) {
    console.warn('⚠️ Enrollment index migration warning:', error.message);
  }
};

const app = express();
// Avoid 304 responses for API XHR calls that can break client-side data loading flows.
app.set('etag', false);

const logStorageHealth = async () => {
  try {
    const driveOk = await checkDriveAccess();

    if (driveOk) {
      console.log('✅ Google Drive storage is configured and reachable');
      return;
    }

    console.warn('⚠️ Google Drive storage check failed.');
    console.warn('   Fix: connect an admin Google account via OAuth at /api/google-drive/connect.');
    console.warn('   Also ensure GOOGLE_OAUTH_REDIRECT_URI matches your Google Cloud authorized redirect URI.');
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
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/google-drive-oauth', googleDriveOAuthRoutes);
app.use('/api/google-drive', googleDriveOAuthRoutes);

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

    await migrateEnrollmentIndexes();
    
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
const DEFAULT_PORT = parseInt(process.env.PORT || '5000', 10);

const startServer = (port, retriesLeft = 10) => {
  const server = app.listen(port, () => {
    console.log(`\n🚀 Server running on port ${port}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 API URL: http://localhost:${port}`);
    console.log(`💚 Health Check: http://localhost:${port}/health`);
    logStorageHealth();
    console.log('');
  });

  server.on('error', (error) => {
    const canRetryInDev = process.env.NODE_ENV !== 'production' && retriesLeft > 0;

    if (error.code === 'EADDRINUSE' && canRetryInDev) {
      const nextPort = port + 1;
      console.warn(`⚠️ Port ${port} is in use. Retrying on port ${nextPort}...`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    console.error('❌ Server startup error:', error.message);
    process.exit(1);
  });
};

connectDB().then(() => {
  startServer(DEFAULT_PORT);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});
