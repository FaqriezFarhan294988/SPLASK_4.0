import ruleEngine from '../rules/ruleEngine.js';

/**
 * SPLaSK Compliance Rules Service
 * Evaluates websites using the professional rule engine
 */

/**
 * Run compliance evaluation using the SPLaSK rule engine
 * @param {Object} crawlData - Data from the crawler
 * @returns {Object} - Complete compliance evaluation results
 */
export const runComplianceRules = async (crawlData) => {
  try {
    console.log('🏛️ Starting SPLaSK compliance evaluation...');

    // Run the rule engine evaluation
    const evaluationResult = await ruleEngine.evaluate(crawlData);

    if (evaluationResult.error) {
      throw new Error(evaluationResult.error);
    }

    // Transform results to match expected format for backward compatibility
    const transformedResults = {
      categories: evaluationResult.categories,
      totalScore: evaluationResult.percentage,
      totalPossible: 100,
      percentage: evaluationResult.percentage,
      timestamp: evaluationResult.timestamp,
      summary: {
        totalCategories: evaluationResult.categories.length,
        passedCategories: evaluationResult.categories.filter(cat => cat.score === cat.total).length,
        failedCategories: evaluationResult.categories.filter(cat => cat.score < cat.total).length,
        totalRules: evaluationResult.categories.reduce((sum, cat) => sum + cat.rules.length, 0),
        passedRules: evaluationResult.categories.reduce((sum, cat) =>
          sum + cat.rules.filter(rule => rule.status === 'PASS').length, 0),
        failedRules: evaluationResult.categories.reduce((sum, cat) =>
          sum + cat.rules.filter(rule => rule.status === 'FAIL').length, 0)
      }
    };

    console.log(`✅ Compliance evaluation complete: ${evaluationResult.percentage}% overall score`);

    return transformedResults;

  } catch (error) {
    console.error('🚨 Compliance evaluation failed:', error.message);
    return {
      categories: [],
      totalScore: 0,
      totalPossible: 100,
      percentage: 0,
      error: error.message,
      timestamp: new Date().toISOString(),
      summary: {
        totalCategories: 0,
        passedCategories: 0,
        failedCategories: 0,
        totalRules: 0,
        passedRules: 0,
        failedRules: 0
      }
    };
  }
};

/**
 * Get detailed rule evaluation for a specific category
 * @param {string} categoryName - Name of the category
 * @param {Object} crawlData - Crawler data
 * @returns {Object} - Category evaluation result
 */
export const evaluateCategory = async (categoryName, crawlData) => {
  try {
    return await ruleEngine.evaluateCategory(categoryName, crawlData);
  } catch (error) {
    console.error(`🚨 Category evaluation failed for ${categoryName}:`, error.message);
    return {
      name: categoryName,
      score: 0,
      total: 10,
      rules: [],
      error: error.message
    };
  }
};

/**
 * Get compliance score summary
 * @param {Object} evaluationResult - Result from runComplianceRules
 * @returns {Object} - Score summary
 */
export const getComplianceSummary = (evaluationResult) => {
  if (!evaluationResult || evaluationResult.error) {
    return {
      overall: 0,
      categories: {},
      status: 'ERROR',
      message: evaluationResult?.error || 'Evaluation failed'
    };
  }

  const categoryScores = {};
  evaluationResult.categories.forEach(cat => {
    const key = cat.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    categoryScores[key] = {
      score: cat.score,
      total: cat.total,
      percentage: Math.round((cat.score / cat.total) * 100),
      status: cat.score === cat.total ? 'PASS' : 'FAIL'
    };
  });

  return {
    overall: evaluationResult.percentage,
    categories: categoryScores,
    status: evaluationResult.percentage >= 80 ? 'PASS' : 'FAIL',
    message: `${evaluationResult.percentage}% compliance achieved`
  };
};

// Legacy exports for backward compatibility
export const evaluateAccessibility = () => [];
export const evaluateEaseOfUse = () => [];
export const evaluateContentQuality = () => [];
export const evaluateSecurity = () => [];
export const evaluateResponsiveness = () => [];
export const evaluateReliability = () => [];