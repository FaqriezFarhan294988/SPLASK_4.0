import pool from '../database/db.js';
import { crawlWebsite } from '../services/crawlerService.js';
import { runComplianceRules } from '../services/complianceRulesService.js';

const CATEGORY_ORDER = [
  'Accessibility',
  'Ease of Use',
  'Quality of Content',
  'Privacy / Security',
  'Responsiveness',
  'Reliability',
];

// Scan website
export const scanWebsite = async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
      });
    }

    const connection = await pool.getConnection();

    // Check if website exists, if not create it
    let [websites] = await connection.execute(
      'SELECT id FROM websites WHERE url = ?',
      [url]
    );

    let websiteId;
    if (websites.length === 0) {
      let result;
      try {
        // Preferred schema (name + url)
        [result] = await connection.execute(
          'INSERT INTO websites (name, url) VALUES (?, ?)',
          [new URL(url).hostname, url]
        );
      } catch (insertError) {
        // Backward-compatible schema (url only)
        [result] = await connection.execute(
          'INSERT INTO websites (url) VALUES (?)',
          [url]
        );
      }
      websiteId = result.insertId;
    } else {
      websiteId = websites[0].id;
    }

    // Create scan result record
    const [scanResult] = await connection.execute(
      'INSERT INTO scan_results (website_id, status) VALUES (?, ?)',
      [websiteId, 'PROCESSING']
    );
    const scanId = scanResult.insertId;

    connection.release();

    // Start scan asynchronously
    performScan(scanId, websiteId, url).catch((error) => {
      console.error(`Scan error for ${url}:`, error);
    });

    res.status(202).json({
      success: true,
      message: 'Scan initiated',
      data: {
        scan_id: scanId,
        website_id: websiteId,
        url,
        status: 'PROCESSING',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all scan results for dashboard
export const getScanResults = async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.execute(
      `SELECT
         sr.id AS scan_id,
         w.url AS website_name,
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
       ORDER BY sr.created_at DESC`
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const scanIds = rows.map((row) => row.scan_id);
    const placeholders = scanIds.map(() => '?').join(',');

    const [ruleRows] = await connection.execute(
      `SELECT scan_result_id, rule_name, status, score, message
       FROM rule_results
       WHERE scan_result_id IN (${placeholders})
       ORDER BY created_at ASC`,
      scanIds
    );

    const rulesByScanId = new Map();
    for (const rule of ruleRows) {
      const list = rulesByScanId.get(rule.scan_result_id) || [];
      list.push(rule);
      rulesByScanId.set(rule.scan_result_id, list);
    }

    const data = rows.map((scan) => {
      const rawRules = rulesByScanId.get(scan.scan_id) || [];
      const categories = buildCategoriesFromRules(rawRules, scan);

      return {
        scanId: scan.scan_id,
        website: scan.website_name,
        url: scan.website_url,
        score: Number(scan.total_score || 0),
        status: scan.status,
        date: scan.created_at,
        categoryScores: {
          accessibility: Number(scan.accessibility_score || 0),
          easeOfUse: Number(scan.ease_of_use_score || 0),
          qualityOfContent: Number(scan.content_quality_score || 0),
          privacySecurity: Number(scan.security_score || 0),
          responsiveness: Number(scan.responsiveness_score || 0),
          reliability: Number(scan.reliability_score || 0),
        },
        categories,
      };
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};

// Perform scan operation (async)
async function performScan(scanId, websiteId, url) {
  const connection = await pool.getConnection();

  try {
    // Crawl website
    console.log(`Crawling ${url}...`);
    const crawlData = await crawlWebsite(url);

    // Run compliance rules
    console.log(`Running compliance rules for ${url}...`);
    const results = await runComplianceRules(crawlData);

    // Calculate scores
    const scores = calculateScores(results);

    // Update scan result with scores
    await connection.execute(
      `UPDATE scan_results
       SET status = ?,
           total_score = ?,
           accessibility_score = ?,
           ease_of_use_score = ?,
           content_quality_score = ?,
           security_score = ?,
           responsiveness_score = ?,
           reliability_score = ?
       WHERE id = ?`,
      [
        'COMPLETED',
        scores.totalScore,
        scores.accessibilityScore,
        scores.easeOfUseScore,
        scores.contentQualityScore,
        scores.securityScore,
        scores.responsivenessScore,
        scores.reliabilityScore,
        scanId,
      ]
    );

    // Insert rule results
    const ruleRows = flattenRuleRows(results.categories || []);
    for (const result of ruleRows) {
      await connection.execute(
        `INSERT INTO rule_results (scan_result_id, rule_name, status, score, message)
         VALUES (?, ?, ?, ?, ?)`,
        [scanId, result.name, result.status, result.score, result.message]
      );
    }

    console.log(`✓ Scan completed for ${url} (Scan ID: ${scanId})`);
  } catch (error) {
    console.error(`✗ Scan failed for ${url}:`, error);
    await connection.execute(
      'UPDATE scan_results SET status = ? WHERE id = ?',
      ['FAILED', scanId]
    );
  } finally {
    connection.release();
  }
}

// Calculate compliance scores from rule results
function calculateScores(ruleResults) {
  const categories = ruleResults.categories || [];

  const toPercentage = (name) => {
    const category = categories.find((cat) =>
      (cat.name || '').toLowerCase() === name.toLowerCase()
    );

    if (!category || !category.total) {
      return 0;
    }

    return (category.score / category.total) * 100;
  };

  const accessibilityScore = toPercentage('Accessibility');
  const easeOfUseScore = toPercentage('Ease of Use');
  const contentQualityScore = toPercentage('Quality of Content');
  const securityScore = toPercentage('Privacy / Security');
  const responsivenessScore = toPercentage('Responsiveness');
  const reliabilityScore = toPercentage('Reliability');

  return {
    accessibilityScore,
    easeOfUseScore,
    contentQualityScore,
    securityScore,
    responsivenessScore,
    reliabilityScore,
    totalScore: ruleResults.percentage || 0,
  };
}

function flattenRuleRows(categories) {
  const rows = [];
  for (const category of categories) {
    const categoryTotal = category.total || 0;
    const categoryPercent = categoryTotal > 0 ? (category.score / categoryTotal) * 100 : 0;

    for (const rule of category.rules || []) {
      rows.push({
        name: `${category.name} - ${rule.name}`,
        status: rule.status,
        score: rule.status === 'PASS' ? categoryPercent : 0,
        message: rule.details || '',
      });
    }
  }

  return rows;
}

function buildCategoriesFromRules(ruleRows, scan) {
  const scoreByCategory = {
    Accessibility: Number(scan.accessibility_score || 0),
    'Ease of Use': Number(scan.ease_of_use_score || 0),
    'Quality of Content': Number(scan.content_quality_score || 0),
    'Privacy / Security': Number(scan.security_score || 0),
    Responsiveness: Number(scan.responsiveness_score || 0),
    Reliability: Number(scan.reliability_score || 0),
  };

  const grouped = new Map();
  for (const name of CATEGORY_ORDER) {
    grouped.set(name, []);
  }

  for (const row of ruleRows) {
    const { categoryName, subCategoryName } = splitRuleName(row.rule_name);
    const list = grouped.get(categoryName) || [];
    list.push({
      name: subCategoryName,
      status: row.status,
      score: Number(row.score || 0),
      explanation: row.message || '',
    });
    grouped.set(categoryName, list);
  }

  return CATEGORY_ORDER.map((name) => {
    const rules = grouped.get(name) || [];
    const passCount = rules.filter((rule) => rule.status === 'PASS').length;

    return {
      name,
      score: scoreByCategory[name],
      status: rules.length > 0 && passCount === rules.length ? 'PASS' : 'FAIL',
      explanation: buildCategoryExplanation(name),
      subCategories: rules,
    };
  });
}

function splitRuleName(ruleName = '') {
  const marker = ' - ';
  const idx = ruleName.indexOf(marker);

  if (idx === -1) {
    return {
      categoryName: 'Accessibility',
      subCategoryName: ruleName,
    };
  }

  return {
    categoryName: ruleName.slice(0, idx),
    subCategoryName: ruleName.slice(idx + marker.length),
  };
}

// GET /api/scan/:id/status - Public scan status check (no auth required)
export const getScanStatus = async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const scanId = Number(req.params.id);
    if (!scanId || Number.isNaN(scanId)) {
      return res.status(400).json({ success: false, error: 'Invalid scan ID' });
    }

    const [[row]] = await connection.execute(
      'SELECT id, status FROM scan_results WHERE id = ?',
      [scanId]
    );

    if (!row) {
      return res.status(404).json({ success: false, error: 'Scan not found' });
    }

    res.json({ success: true, data: { scanId: row.id, status: row.status } });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};

function buildCategoryExplanation(categoryName) {
  if (categoryName === 'Accessibility') {
    return 'Validates sitemap quality and search visibility compliance.';
  }
  if (categoryName === 'Ease of Use') {
    return 'Checks search availability, W3C access tools, and advanced search support.';
  }
  if (categoryName === 'Quality of Content') {
    return 'Assesses information transparency, procurement, and participation quality.';
  }
  if (categoryName === 'Privacy / Security') {
    return 'Evaluates privacy policy correctness and secure transport via HTTPS.';
  }
  if (categoryName === 'Responsiveness') {
    return 'Ensures feedback form readiness and interaction support.';
  }
  return 'Measures reliability through load time, redirects, and downtime simulation.';
}