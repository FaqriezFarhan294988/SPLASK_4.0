#!/usr/bin/env node

import crawler from './crawler/crawler.js';

/**
 * Test script for SPLaSK Professional Crawler
 * Run with: node test-crawler.js <url>
 */

const testUrl = process.argv[2] || 'https://example.com';

console.log('🧪 Testing SPLaSK Professional Crawler');
console.log('=====================================');
console.log(`Target URL: ${testUrl}`);
console.log('');

async function runTest() {
  try {
    console.log('🚀 Starting crawl...');
    const startTime = Date.now();

    const result = await crawler.crawl(testUrl);

    const totalTime = Date.now() - startTime;

    console.log('');
    console.log('✅ Crawl completed successfully!');
    console.log('================================');
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Pages crawled: ${result.summary.totalPages}`);
    console.log(`Links found: ${result.summary.totalLinks}`);
    console.log(`Broken links: ${result.summary.brokenLinks}`);
    console.log(`Forms found: ${result.summary.totalForms}`);
    console.log(`Images found: ${result.summary.totalImages}`);
    console.log(`Total load time: ${result.loadTime}ms`);
    console.log(`Total redirects: ${result.redirects}`);
    console.log(`Average load time: ${result.summary.averageLoadTime}ms`);
    console.log('');

    // Show sample data
    if (result.pages.length > 0) {
      console.log('📄 Sample Pages:');
      result.pages.slice(0, 3).forEach((page, index) => {
        console.log(`  ${index + 1}. ${page.title} (${page.url}) - ${page.loadTime}ms`);
      });
      console.log('');
    }

    if (result.links.length > 0) {
      console.log('🔗 Sample Links:');
      result.links.slice(0, 5).forEach((link, index) => {
        console.log(`  ${index + 1}. ${link.url}${link.isBroken ? ' ❌ BROKEN' : ''}`);
      });
      console.log('');
    }

    if (result.meta.title) {
      console.log('📋 Meta Information:');
      console.log(`  Title: ${result.meta.title}`);
      if (result.meta.description) {
        console.log(`  Description: ${result.meta.description}`);
      }
      console.log('');
    }

    console.log('🎯 Crawler test passed!');

  } catch (error) {
    console.error('❌ Crawler test failed:');
    console.error(error.message);
    process.exit(1);
  }
}

runTest();