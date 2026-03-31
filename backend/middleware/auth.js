import dotenv from 'dotenv';
dotenv.config();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'splask-admin-2024';

export function requireAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Invalid or missing admin token.' });
  }

  next();
}
