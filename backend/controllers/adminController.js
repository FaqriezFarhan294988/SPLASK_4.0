import pool from '../database/db.js';

const CATEGORY_ORDER = [
  'Accessibility',
  'Ease of Use',
  'Quality of Content',
  'Privacy / Security',
  'Responsiveness',
  'Reliability',
];

// GET /api/admin/stats
export const getAdminStats = async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const [[totals]] = await connection.execute(`
      SELECT
        COUNT(*) AS totalScans,
        ROUND(AVG(CASE WHEN status = 'COMPLETED' THEN total_score ELSE NULL END), 2) AS avgScore,
        SUM(CASE WHEN status = 'COMPLETED' AND total_score >= 80 THEN 1 ELSE 0 END) AS passedCount,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedCount,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedCount,
        SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) AS processingCount
      FROM scan_results
    `);

    const [[websiteCount]] = await connection.execute(
      'SELECT COUNT(DISTINCT website_id) AS total FROM scan_results WHERE status = ?',
      ['COMPLETED']
    );

    const completed = Number(totals.completedCount || 0);
    const passed = Number(totals.passedCount || 0);
    const overallCompliance = completed > 0 ? Math.round((passed / completed) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalWebsites: Number(websiteCount.total || 0),
        totalScans: Number(totals.totalScans || 0),
        completedScans: completed,
        failedScans: Number(totals.failedCount || 0),
        processingScans: Number(totals.processingCount || 0),
        avgScore: Number(totals.avgScore || 0),
        passedCount: passed,
        overallCompliance,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};

// GET /api/admin/scans?page=1&limit=10&search=&status=
export const getAdminScans = async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const search = (req.query.search || '').trim();
    const statusFilter = (req.query.status || '').trim().toUpperCase();
    const offset = (page - 1) * limit;

    const params = [];
    const conditions = [];

    if (search) {
      conditions.push('w.url LIKE ?');
      params.push(`%${search}%`);
    }

    if (['COMPLETED', 'FAILED', 'PROCESSING'].includes(statusFilter)) {
      conditions.push('sr.status = ?');
      params.push(statusFilter);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM scan_results sr
       INNER JOIN websites w ON w.id = sr.website_id
       ${where}`,
      params
    );

    const [rows] = await connection.execute(
      `SELECT
         sr.id AS scan_id,
         w.url AS website_url,
         sr.total_score,
         sr.accessibility_score,
         sr.ease_of_use_score,
         sr.content_quality_score,
         sr.security_score,
         sr.responsiveness_score,
         sr.reliability_score,
         sr.status,
         sr.created_at
       FROM scan_results sr
       INNER JOIN websites w ON w.id = sr.website_id
       ${where}
       ORDER BY sr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const data = rows.map((row, idx) => ({
      index: offset + idx + 1,
      scanId: row.scan_id,
      url: row.website_url,
      score: Number(row.total_score || 0),
      status: row.status,
      date: row.created_at,
      categoryScores: {
        accessibility: Number(row.accessibility_score || 0),
        easeOfUse: Number(row.ease_of_use_score || 0),
        qualityOfContent: Number(row.content_quality_score || 0),
        privacySecurity: Number(row.security_score || 0),
        responsiveness: Number(row.responsiveness_score || 0),
        reliability: Number(row.reliability_score || 0),
      },
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total: Number(total),
        page,
        limit,
        pages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};

// GET /api/admin/scans/:id
export const getAdminScanDetail = async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const scanId = parseInt(req.params.id, 10);
    if (!scanId || scanId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid scan ID.' });
    }

    const [[scan]] = await connection.execute(
      `SELECT
         sr.id AS scan_id,
         w.url AS website_url,
         sr.total_score,
         sr.accessibility_score,
         sr.ease_of_use_score,
         sr.content_quality_score,
         sr.security_score,
         sr.responsiveness_score,
         sr.reliability_score,
         sr.status,
         sr.created_at
       FROM scan_results sr
       INNER JOIN websites w ON w.id = sr.website_id
       WHERE sr.id = ?`,
      [scanId]
    );

    if (!scan) {
      return res.status(404).json({ success: false, error: 'Scan not found.' });
    }

    const [ruleRows] = await connection.execute(
      `SELECT rule_name, status, score, message
       FROM rule_results
       WHERE scan_result_id = ?
       ORDER BY created_at ASC`,
      [scanId]
    );

    const scoreByCategory = {
      Accessibility: Number(scan.accessibility_score || 0),
      'Ease of Use': Number(scan.ease_of_use_score || 0),
      'Quality of Content': Number(scan.content_quality_score || 0),
      'Privacy / Security': Number(scan.security_score || 0),
      Responsiveness: Number(scan.responsiveness_score || 0),
      Reliability: Number(scan.reliability_score || 0),
    };

    const grouped = new Map();
    for (const name of CATEGORY_ORDER) grouped.set(name, []);

    for (const row of ruleRows) {
      const marker = ' - ';
      const idx = row.rule_name.indexOf(marker);
      const categoryName = idx !== -1 ? row.rule_name.slice(0, idx) : 'Accessibility';
      const subName = idx !== -1 ? row.rule_name.slice(idx + marker.length) : row.rule_name;
      const list = grouped.get(categoryName) || [];
      list.push({ name: subName, status: row.status, score: Number(row.score || 0), explanation: row.message || '' });
      grouped.set(categoryName, list);
    }

    const categories = CATEGORY_ORDER.map((name) => {
      const rules = grouped.get(name) || [];
      const passCount = rules.filter((r) => r.status === 'PASS').length;
      return {
        name,
        score: scoreByCategory[name],
        status: rules.length > 0 && passCount === rules.length ? 'PASS' : 'FAIL',
        rules,
      };
    });

    res.json({
      success: true,
      data: {
        scanId: scan.scan_id,
        url: scan.website_url,
        score: Number(scan.total_score || 0),
        status: scan.status,
        date: scan.created_at,
        categoryScores: scoreByCategory,
        categories,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};
