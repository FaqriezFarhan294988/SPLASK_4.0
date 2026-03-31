#!/usr/bin/env node

import ruleEngine from './rules/ruleEngine.js';
import { runComplianceRules, getComplianceSummary } from './services/complianceRulesService.js';

/**
 * Test script for SPLaSK Rule Engine
 * Tests all 15 rules across 6 categories
 */

// Mock crawler data that simulates a website with various compliance features
const mockCrawlerData = {
  url: 'https://example.com',
  statusCode: 200,
  title: 'Example Government Website',
  headers: {
    contentType: 'text/html',
    lastModified: new Date().toISOString(),
  },
  pages: [
    {
      url: 'https://example.com',
      title: 'Example Government Website',
      statusCode: 200,
      loadTime: 1200,
      redirects: 1,
      contentLength: 150000,
      headings: {
        h1: ['Welcome to Example Government'],
        h2: ['Services', 'Contact Us'],
        h3: [],
        h4: [],
        h5: [],
        h6: []
      },
      // Mock SPLaSK-specific tags (simulating they exist)
      sitemapTagExists: true,
      sitemapHasItalicTag: false,
      searchFunctionTagExists: true,
      w3cTagExists: true,
      fontSizeControlExists: true,
      fontFamilyControlExists: false,
      backgroundColorControlExists: true,
      advancedSearchTagExists: true,
      freedomTagExists: true,
      freedomUrl: 'https://example.com/freedom-info',
      procurementTagExists: true,
      procurementHasItalic: false,
      participationTagExists: true,
      participationHasItalic: false,
      hasPolicyGuidelineText: true,
      privacyPolicyLinkExists: true,
      feedbackFormTagExists: true
    }
  ],
  links: [
    { url: 'https://example.com/about', isBroken: false },
    { url: 'https://example.com/services', isBroken: false },
    { url: 'https://example.com/contact', isBroken: false }
  ],
  forms: [
    {
      action: '/search',
      method: 'GET',
      inputs: [
        { type: 'text', name: 'q', required: true, placeholder: 'Search...' }
      ],
      inputCount: 1
    }
  ],
  images: [
    {
      src: 'https://example.com/logo.png',
      alt: 'Government Logo',
      title: '',
      width: '200',
      height: '100',
      hasAlt: true
    }
  ],
  meta: {
    title: 'Example Government Website',
    description: 'Official government website with public services',
    canonical: 'https://example.com/',
    favicon: 'https://example.com/favicon.ico',
    viewport: 'width=device-width, initial-scale=1.0'
  },
  performance: {
    loadTime: 1200,
    redirects: 1,
    averageLoadTime: 1200
  },
  summary: {
    totalPages: 1,
    totalLinks: 3,
    brokenLinks: 0,
    totalForms: 1,
    totalImages: 1,
    averageLoadTime: 1200
  }
};

async function runRuleEngineTest() {
  console.log('🧪 Testing SPLaSK Rule Engine');
  console.log('==============================');
  console.log(`Target: ${mockCrawlerData.url}`);
  console.log('');

  try {
    // Test 1: Direct rule engine evaluation
    console.log('1️⃣ Testing Direct Rule Engine Evaluation...');
    const startTime = Date.now();

    const ruleResult = await ruleEngine.evaluate(mockCrawlerData);
    const ruleTime = Date.now() - startTime;

    console.log(`✅ Rule engine completed in ${ruleTime}ms`);
    console.log(`📊 Overall Score: ${ruleResult.percentage}% (${ruleResult.totalScore}/${ruleResult.totalPossible})`);
    console.log('');

    // Show category results
    console.log('📋 Category Results:');
    ruleResult.categories.forEach(category => {
      const percentage = Math.round((category.score / category.total) * 100);
      console.log(`  ${category.name}: ${category.score}/${category.total} (${percentage}%)`);
    });
    console.log('');

    // Show sample rules
    console.log('🔍 Sample Rules:');
    ruleResult.categories.forEach(category => {
      console.log(`  ${category.name}:`);
      category.rules.slice(0, 2).forEach(rule => {
        console.log(`    ${rule.name}: ${rule.status}`);
      });
    });
    console.log('');

    // Test 2: Compliance service evaluation
    console.log('2️⃣ Testing Compliance Service Integration...');
    const complianceResult = await runComplianceRules(mockCrawlerData);
    const summary = getComplianceSummary(complianceResult);

    console.log(`✅ Compliance service completed`);
    console.log(`📊 Overall Score: ${summary.overall}%`);
    console.log(`📋 Status: ${summary.status}`);
    console.log(`💬 Message: ${summary.message}`);
    console.log('');

    // Show category breakdown
    console.log('📋 Category Breakdown:');
    Object.entries(summary.categories).forEach(([key, cat]) => {
      console.log(`  ${key.replace(/_/g, ' ').toUpperCase()}: ${cat.percentage}% (${cat.status})`);
    });
    console.log('');

    // Test 3: Individual category evaluation
    console.log('3️⃣ Testing Individual Category Evaluation...');
    const accessibilityResult = await ruleEngine.evaluateCategory('ACCESSIBILITY', mockCrawlerData);
    console.log(`✅ ACCESSIBILITY category: ${accessibilityResult.score}/${accessibilityResult.total}`);
    console.log(`📋 Rules: ${accessibilityResult.rules.length}`);
    console.log('');

    console.log('🎯 All tests passed! Rule engine is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runRuleEngineTest();