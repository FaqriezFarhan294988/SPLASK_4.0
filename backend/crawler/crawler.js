import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

/**
 * Professional Website Crawler for SPLaSK
 * Crawls homepage + max 20 internal pages with comprehensive data extraction
 */
class SPLaSKCrawler {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000;
    this.maxPages = options.maxPages || 20;
    this.maxRedirects = options.maxRedirects || 5;
    this.retryAttempts = options.retryAttempts || 2;
    this.retryDelayMs = options.retryDelayMs || 1200;
    this.userAgent = options.userAgent || 'SPLaSK-Crawler/1.0';

    // Initialize axios instance with default config
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      maxRedirects: this.maxRedirects,
      headers: {
        'User-Agent': this.userAgent,
      },
    });
  }

  /**
   * Main crawl function
   * @param {string} startUrl - Starting URL to crawl
   * @returns {Promise<Object>} - Structured crawl results
   */
  async crawl(startUrl) {
    try {
      console.log(`🚀 Starting SPLaSK crawl: ${startUrl}`);

      // Validate and normalize start URL
      const normalizedUrl = this.normalizeUrl(startUrl);
      if (!normalizedUrl) {
        throw new Error('Invalid start URL');
      }

      const visitedUrls = new Set();
      const queuedUrls = new Set([normalizedUrl]);
      const allLinks = new Set();
      const allForms = [];
      const allImages = [];
      const metaData = {};
      let totalLoadTime = 0;
      let totalRedirects = 0;

      // Queue for pages to crawl
      const queue = [normalizedUrl];
      const pages = [];

      while (queue.length > 0 && pages.length < this.maxPages) {
        const currentUrl = queue.shift();
        queuedUrls.delete(currentUrl);

        if (visitedUrls.has(currentUrl)) {
          continue;
        }
        visitedUrls.add(currentUrl);

        console.log(`📄 Crawling: ${currentUrl} (${pages.length + 1}/${this.maxPages})`);

        try {
          const pageData = await this.crawlPage(currentUrl);

          if (pageData.skipped) {
            console.log(`↷ Skipping ${currentUrl}: ${pageData.reason}`);
            continue;
          }

          // Accumulate data
          pages.push({
            url: currentUrl,
            title: pageData.title,
            statusCode: pageData.statusCode,
            loadTime: pageData.loadTime,
            redirects: pageData.redirects,
            contentLength: pageData.contentLength,
            headings: pageData.headings,
            html: pageData.html,
            links: pageData.pageLinks,
            forms: pageData.pageForms,
            images: pageData.pageImages,
            meta: pageData.pageMeta,
          });

          totalLoadTime += pageData.loadTime;
          totalRedirects += pageData.redirects;

          // Extract and process links
          const pageLinks = pageData.pageLinks;
          pageLinks.forEach(link => {
            allLinks.add(link.url);

            if (
              link.isInternal &&
              this.shouldQueueUrl(link.url) &&
              !visitedUrls.has(link.url) &&
              !queuedUrls.has(link.url) &&
              queue.length < this.maxPages * 4
            ) {
              queue.push(link.url);
              queuedUrls.add(link.url);
            }
          });

          // Extract forms
          const pageForms = pageData.pageForms;
          allForms.push(...pageForms);

          // Extract images
          const pageImages = pageData.pageImages;
          allImages.push(...pageImages);

          // Extract meta data (from first page)
          if (pages.length === 1) {
            Object.assign(metaData, pageData.pageMeta);
          }

        } catch (error) {
          console.error(`❌ Error crawling ${currentUrl}:`, error.message);
          // Continue with next page
        }
      }

      // Check for broken links
      const brokenLinks = await this.checkBrokenLinks(Array.from(allLinks));

      console.log(`✅ Crawl completed: ${pages.length} pages, ${allLinks.size} links`);

      return {
        success: true,
        pages: pages,
        links: Array.from(allLinks).map(url => ({
          url,
          isBroken: brokenLinks.has(url),
        })),
        forms: allForms,
        images: allImages,
        meta: metaData,
        loadTime: totalLoadTime,
        redirects: totalRedirects,
        summary: {
          totalPages: pages.length,
          totalLinks: allLinks.size,
          brokenLinks: brokenLinks.size,
          totalForms: allForms.length,
          totalImages: allImages.length,
          averageLoadTime: pages.length > 0 ? Math.round(totalLoadTime / pages.length) : 0,
        },
      };

    } catch (error) {
      console.error('🚨 Crawler error:', error.message);
      return {
        success: false,
        error: error.message,
        pages: [],
        links: [],
        forms: [],
        images: [],
        meta: {},
        loadTime: 0,
        redirects: 0,
      };
    }
  }

  /**
   * Crawl a single page
   * @param {string} url - URL to crawl
   * @returns {Promise<Object>} - Page data
   */
  async crawlPage(url) {
    const startTime = Date.now();

    try {
      const response = await this.fetchWithRetry(url);

      if (!this.isHtmlResponse(url, response)) {
        return {
          skipped: true,
          reason: `non-HTML content (${response.headers['content-type'] || 'unknown'})`,
        };
      }

      const loadTime = Date.now() - startTime;
      const html = typeof response.data === 'string' ? response.data : String(response.data || '');
      const $ = cheerio.load(html);
      const pageLinks = this.extractLinks($, url);
      const pageForms = this.extractForms($, url);
      const pageImages = this.extractImages($, url);
      const pageMeta = this.extractMetaData($);

      return {
        skipped: false,
        $,
        html,
        title: $('title').text().trim() || '',
        statusCode: response.status,
        loadTime,
        redirects: response.request?._redirectable?._redirectCount || 0,
        contentLength: html.length,
        headings: this.extractHeadings($),
        pageLinks,
        pageForms,
        pageImages,
        pageMeta,
      };

    } catch (error) {
      const loadTime = Date.now() - startTime;
      throw new Error(`Page crawl failed: ${error.message}`);
    }
  }

  async fetchWithRetry(url) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt += 1) {
      try {
        return await this.axiosInstance.get(url, {
          timeout: this.timeout + (attempt * 3000),
          validateStatus: (status) => status < 500,
        });
      } catch (error) {
        lastError = error;
        const retryable = this.isRetryableError(error);
        if (!retryable || attempt === this.retryAttempts) {
          break;
        }

        await this.delay(this.retryDelayMs * (attempt + 1));
      }
    }

    throw lastError;
  }

  isRetryableError(error) {
    const code = error?.code || '';
    const message = (error?.message || '').toLowerCase();
    return [
      'ECONNABORTED',
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
    ].includes(code) || message.includes('timeout') || message.includes('socket hang up');
  }

  isHtmlResponse(url, response) {
    const contentType = (response?.headers?.['content-type'] || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      return true;
    }

    if (this.isSkippableAssetUrl(url)) {
      return false;
    }

    const body = typeof response?.data === 'string' ? response.data.slice(0, 500).toLowerCase() : '';
    return body.includes('<html') || body.includes('<!doctype html');
  }

  shouldQueueUrl(url) {
    return !this.isSkippableAssetUrl(url);
  }

  isSkippableAssetUrl(url) {
    return /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|jpg|jpeg|png|gif|svg|webp|mp3|mp4|avi|mov)(\?|$)/i.test(url);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Extract all links from a page
   * @param {CheerioStatic} $ - Cheerio instance
   * @param {string} baseUrl - Base URL for resolving relative links
   * @returns {Array} - Array of link objects
   */
  extractLinks($, baseUrl) {
    const links = [];
    const baseDomain = this.getDomain(baseUrl);

    $('a[href]').each((index, element) => {
      try {
        const href = $(element).attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
          return;
        }

        const absoluteUrl = this.resolveUrl(href, baseUrl);
        if (!absoluteUrl) return;

        const linkDomain = this.getDomain(absoluteUrl);
        const isInternal = linkDomain === baseDomain;

        // Only include internal links or skip external
        if (isInternal) {
          links.push({
            url: absoluteUrl,
            text: $(element).text().trim(),
            isInternal: true,
          });
        }
      } catch (error) {
        // Skip malformed links
      }
    });

    return links;
  }

  /**
   * Extract forms from a page
   * @param {CheerioStatic} $ - Cheerio instance
   * @param {string} baseUrl - Base URL for context
   * @returns {Array} - Array of form objects
   */
  extractForms($, baseUrl) {
    const forms = [];

    $('form').each((index, element) => {
      const $form = $(element);
      const action = $form.attr('action') || '';
      const method = $form.attr('method') || 'GET';

      const inputs = [];
      $form.find('input, select, textarea').each((i, input) => {
        const $input = $(input);
        inputs.push({
          type: $input.attr('type') || 'text',
          name: $input.attr('name') || '',
          required: $input.attr('required') !== undefined,
          placeholder: $input.attr('placeholder') || '',
        });
      });

      forms.push({
        action: this.resolveUrl(action, baseUrl) || baseUrl,
        method: method.toUpperCase(),
        inputs: inputs,
        inputCount: inputs.length,
      });
    });

    return forms;
  }

  /**
   * Extract images from a page
   * @param {CheerioStatic} $ - Cheerio instance
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Array} - Array of image objects
   */
  extractImages($, baseUrl) {
    const images = [];

    $('img[src]').each((index, element) => {
      try {
        const $img = $(element);
        const src = $img.attr('src');
        if (!src) return;

        const absoluteSrc = this.resolveUrl(src, baseUrl);
        if (!absoluteSrc) return;

        images.push({
          src: absoluteSrc,
          alt: $img.attr('alt') || '',
          title: $img.attr('title') || '',
          width: $img.attr('width') || '',
          height: $img.attr('height') || '',
          hasAlt: !!$img.attr('alt'),
        });
      } catch (error) {
        // Skip malformed images
      }
    });

    return images;
  }

  /**
   * Extract headings from a page
   * @param {CheerioStatic} $ - Cheerio instance
   * @returns {Object} - Heading counts by level
   */
  extractHeadings($) {
    const headings = {
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
    };

    $('h1, h2, h3, h4, h5, h6').each((index, element) => {
      const tagName = element.name.toLowerCase();
      const text = $(element).text().trim();
      if (text) {
        headings[tagName].push(text);
      }
    });

    return headings;
  }

  /**
   * Extract meta data from a page
   * @param {CheerioStatic} $ - Cheerio instance
   * @returns {Object} - Meta data object
   */
  extractMetaData($) {
    const meta = {};

    // Standard meta tags
    $('meta').each((index, element) => {
      const $meta = $(element);
      const name = $meta.attr('name') || $meta.attr('property');
      const content = $meta.attr('content');

      if (name && content) {
        meta[name] = content;
      }
    });

    // Title
    meta.title = $('title').text().trim() || '';

    // Canonical URL
    meta.canonical = $('link[rel="canonical"]').attr('href') || '';

    // Favicon
    meta.favicon = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href') || '';

    return meta;
  }

  /**
   * Check for broken links
   * @param {Array} urls - Array of URLs to check
   * @returns {Set} - Set of broken URLs
   */
  async checkBrokenLinks(urls) {
    const brokenLinks = new Set();
    const batchSize = 20; // Higher concurrency for faster scans on large sites

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const promises = batch.map(async (url) => {
        try {
          const headResponse = await this.axiosInstance.head(url, {
            validateStatus: () => true,
          });

          if (headResponse.status === 200) {
            return null;
          }

          // Only fallback when HEAD is commonly blocked/unsupported by origin.
          if ([403, 405, 501].includes(headResponse.status)) {
            const getResponse = await this.axiosInstance.get(url, {
              maxRedirects: this.maxRedirects,
              validateStatus: () => true,
            });

            return getResponse.status === 200 ? null : url;
          }

          // Strict requirement: status != 200 is broken.
          return url;
        } catch (error) {
          return url;
        }
      });

      const results = await Promise.all(promises);
      results.forEach((result) => {
        if (result) {
          brokenLinks.add(result);
        }
      });
    }

    return brokenLinks;
  }

  /**
   * Normalize URL (remove fragments, trailing slashes, etc.)
   * @param {string} url - URL to normalize
   * @returns {string|null} - Normalized URL or null if invalid
   */
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove fragment and normalize
      urlObj.hash = '';
      let normalized = urlObj.href;

      // Remove trailing slash unless it's the root
      if (normalized.endsWith('/') && normalized !== `${urlObj.protocol}//${urlObj.hostname}/`) {
        normalized = normalized.slice(0, -1);
      }

      return normalized;
    } catch (error) {
      return null;
    }
  }

  /**
   * Resolve relative URL to absolute
   * @param {string} href - Relative or absolute URL
   * @param {string} baseUrl - Base URL for resolution
   * @returns {string|null} - Absolute URL or null if invalid
   */
  resolveUrl(href, baseUrl) {
    try {
      const url = new URL(href, baseUrl);
      return this.normalizeUrl(url.href);
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract domain from URL
   * @param {string} url - URL to extract domain from
   * @returns {string} - Domain name
   */
  getDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch (error) {
      return '';
    }
  }
}

// Export singleton instance
const crawler = new SPLaSKCrawler();

export default crawler;

// Export class for custom instances
export { SPLaSKCrawler };