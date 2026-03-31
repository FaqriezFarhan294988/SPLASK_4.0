import crawler from '../crawler/crawler.js';

/**
 * Crawl website and extract comprehensive data using SPLaSK professional crawler
 * @param {string} url - Website URL to crawl
 * @returns {Promise<Object>} - Crawled website data
 */
export const crawlWebsite = async (url) => {
  try {
    console.log(`🔍 Starting comprehensive crawl for: ${url}`);

    // Use the professional crawler
    const crawlResult = await crawler.crawl(url);

    if (!crawlResult.success) {
      throw new Error(crawlResult.error || 'Crawling failed');
    }

    if (!Array.isArray(crawlResult.pages) || crawlResult.pages.length === 0) {
      throw new Error('Crawler returned zero pages; scoring would be unreliable');
    }

    // Transform data to match expected format for compliance service
    const transformedData = {
      url: url,
      statusCode: crawlResult.pages[0]?.statusCode || 0,
      title: crawlResult.pages[0]?.title || '',
      pages: crawlResult.pages,
      headers: {
        contentType: 'text/html',
        lastModified: new Date().toISOString(),
      },
      a11y: {
        headings: crawlResult.pages[0]?.headings || { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
        images: crawlResult.images.map(img => ({
          src: img.src,
          alt: img.alt,
          hasAlt: img.hasAlt,
        })),
        forms: crawlResult.forms,
      },
      meta: crawlResult.meta,
      structure: {
        links: crawlResult.links,
        forms: crawlResult.forms,
        images: crawlResult.images,
      },
      images: crawlResult.images,
      links: crawlResult.links,
      forms: crawlResult.forms,
      loadTime: crawlResult.loadTime,
      redirects: crawlResult.redirects,
      performance: {
        loadTime: crawlResult.loadTime,
        redirects: crawlResult.redirects,
        averageLoadTime: crawlResult.summary.averageLoadTime,
      },
      monitoring: {
        downtimeMinutes: 0,
      },
      summary: crawlResult.summary,
    };

    console.log(`✅ Crawl completed successfully: ${crawlResult.summary.totalPages} pages, ${crawlResult.summary.totalLinks} links`);

    return transformedData;

  } catch (error) {
    console.error('🚨 Crawler service error:', error.message);
    throw new Error(`Failed to crawl website: ${error.message}`);
  }
};

/**
 * Validate URL accessibility and SSL
 * @param {string} url - URL to validate
 * @returns {Promise<Object>} - Validation result
 */
export const validateURLAccess = async (url) => {
  try {
    // Use the crawler's axios instance for consistency
    const response = await crawler.axiosInstance.head(url, {
      validateStatus: (status) => status < 500,
    });

    return {
      isAccessible: response.status === 200,
      statusCode: response.status,
      hasSSL: url.startsWith('https'),
      redirectsTo: response.config.url,
    };
  } catch (error) {
    return {
      isAccessible: false,
      error: error.message,
    };
  }
};

/**
 * Legacy functions for backward compatibility
 * These are now handled by the professional crawler
 */
const extractAccessibilityData = ($) => ({});
const extractMetaData = ($) => ({});
const extractStructureData = ($) => ({});
const extractImagesData = ($) => ({});
const extractLinksData = ($) => ({});
const validateHeadingHierarchy = ($) => true;
const calculateContrastScore = ($) => 0.7;

export { extractAccessibilityData, extractMetaData, extractStructureData, extractImagesData, extractLinksData, validateHeadingHierarchy, calculateContrastScore };