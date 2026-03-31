import pool from '../database/db.js';

const CATEGORY_ORDER = [
  'Accessibility',
  'Ease of Use',
  'Quality of Content',
  'Privacy / Security',
  'Responsiveness',
  'Reliability',
];

// GET /api/public/summary
// Returns aggregate compliance statistics and latest scan breakdown.
// No individual website URLs or scan IDs are exposed.
export const getPublicSummary = async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    // Aggregate totals
    const [[totals]] = await connection.execute(`
      SELECT
        COUNT(*) AS totalScans,
        MAX(CASE WHEN status = 'COMPLETED' THEN created_at ELSE NULL END) AS latestDate
      FROM scan_results
      WHERE status = 'COMPLETED'
    `);

    if (Number(totals.totalScans) === 0) {
      return res.json({
        success: true,
        data: {
          totalScans: 0,
          latestScore: 0,
          latestDate: null,
          latestCategories: [],
          recentScores: [],
        },
      });
    }

    // Latest completed scan details (no URL exposed)
    const [[latest]] = await connection.execute(`
      SELECT
        id,
        total_score,
        accessibility_score,
        ease_of_use_score,
        content_quality_score,
        security_score,
        responsiveness_score,
        reliability_score,
        status,
        created_at
      FROM scan_results
      WHERE status = 'COMPLETED'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    // Rule results for the latest scan (for category breakdown)
    const [ruleRows] = await connection.execute(
      `SELECT rule_name, status, score, message
       FROM rule_results
       WHERE scan_result_id = ?
       ORDER BY created_at ASC`,
      [latest.id]
    );

    // Recent scores (last 5) for the compliance chart — no URLs
    const [recentRows] = await connection.execute(`
      SELECT total_score
      FROM scan_results
      WHERE status = 'COMPLETED'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    const scoreByCategory = {
      Accessibility: Number(latest.accessibility_score || 0),
      'Ease of Use': Number(latest.ease_of_use_score || 0),
      'Quality of Content': Number(latest.content_quality_score || 0),
      'Privacy / Security': Number(latest.security_score || 0),
      Responsiveness: Number(latest.responsiveness_score || 0),
      Reliability: Number(latest.reliability_score || 0),
    };

    const grouped = new Map();
    for (const name of CATEGORY_ORDER) grouped.set(name, []);

    for (const row of ruleRows) {
      const marker = ' - ';
      const idx = row.rule_name.indexOf(marker);
      const categoryName = idx !== -1 ? row.rule_name.slice(0, idx) : 'Accessibility';
      const subName = idx !== -1 ? row.rule_name.slice(idx + marker.length) : row.rule_name;
      const list = grouped.get(categoryName) || [];
      list.push({ name: subName, status: row.status, explanation: row.message || '' });
      grouped.set(categoryName, list);
    }

    const latestCategories = CATEGORY_ORDER.map((name) => {
      const rules = grouped.get(name) || [];
      const passCount = rules.filter((r) => r.status === 'PASS').length;
      return {
        name,
        score: scoreByCategory[name],
        status: rules.length > 0 && passCount === rules.length ? 'PASS' : 'FAIL',
        explanation: buildCategoryExplanation(name),
        subCategories: rules,
      };
    });

    res.json({
      success: true,
      data: {
        totalScans: Number(totals.totalScans),
        latestScore: Number(latest.total_score || 0),
        latestDate: latest.created_at,
        latestCategories,
        recentScores: recentRows.map((r) => Number(r.total_score || 0)),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};

function buildCategoryExplanation(categoryName) {
  if (categoryName === 'Accessibility') return 'Validates sitemap quality and search visibility compliance.';
  if (categoryName === 'Ease of Use') return 'Checks search availability, W3C access tools, and advanced search support.';
  if (categoryName === 'Quality of Content') return 'Assesses information transparency, procurement, and participation quality.';
  if (categoryName === 'Privacy / Security') return 'Evaluates privacy policy correctness and secure transport via HTTPS.';
  if (categoryName === 'Responsiveness') return 'Ensures feedback form readiness and interaction support.';
  return 'Measures reliability through load time, redirects, and downtime simulation.';
}
