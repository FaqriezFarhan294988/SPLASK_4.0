import express from 'express';
import { scanWebsite, getScanResults, getScanStatus } from '../controllers/scanController.js';
import { requireAdminToken } from '../middleware/auth.js';
import { getPublicSummary } from '../controllers/publicController.js';

const router = express.Router();

// POST /api/scan - Initiate website scan
router.post('/scan', scanWebsite);

// GET /api/scan/:id/status - Public scan status (no auth)
router.get('/scan/:id/status', getScanStatus);

// GET /api/public/summary - Aggregate stats for public dashboard (no URLs exposed)
router.get('/public/summary', getPublicSummary);

// GET /api/results - Full scan results (admin only)
router.get('/results', requireAdminToken, getScanResults);

export default router;