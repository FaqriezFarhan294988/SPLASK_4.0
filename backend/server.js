import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import scanRoutes from './routes/scanRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { initDatabase, testConnection, recoverProcessingScans } from './database/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'SPLaSK Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', scanRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Initialize database tables
    await initDatabase();

    // Recover stale processing scans from unexpected restarts.
    await recoverProcessingScans();

    app.listen(PORT, () => {
      console.log(`\n✓ SPLaSK Backend running on http://localhost:${PORT}`);
      console.log(`✓ API base URL: http://localhost:${PORT}/api\n`);
      console.log('Available endpoints:');
      console.log('  POST   /api/scan              - Scan website');
      console.log('  GET    /api/results           - Dashboard results');
      console.log('  GET    /api/admin/stats       - Admin statistics (token required)');
      console.log('  GET    /api/admin/scans       - Admin scan list  (token required)');
      console.log('  GET    /api/admin/scans/:id   - Admin scan detail (token required)');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();