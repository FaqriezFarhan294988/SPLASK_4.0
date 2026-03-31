import express from 'express';
import { requireAdminToken } from '../middleware/auth.js';
import { getAdminStats, getAdminScans, getAdminScanDetail } from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require a valid token
router.use(requireAdminToken);

// GET /api/admin/stats
router.get('/stats', getAdminStats);

// GET /api/admin/scans?page=1&limit=10&search=&status=
router.get('/scans', getAdminScans);

// GET /api/admin/scans/:id
router.get('/scans/:id', getAdminScanDetail);

export default router;
