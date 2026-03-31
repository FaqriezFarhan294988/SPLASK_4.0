import axios from 'axios';
import * as cheerio from 'cheerio';

class SPLaSKRuleEngine {
  constructor(options = {}) {
    this.serpApiKey = options.serpApiKey || process.env.SERP_API_KEY || '';
    this.serpApiUrl = 'https://serpapi.com/search.json';
    this.requestTimeout = 5000;
    this.schedulerTime = '11:15 PM';
  }

  async evaluate(crawlerData) {
    const categories = [];

    const accessibility = await this.evaluateAccessibility(crawlerData);
    const easeOfUse = this.evaluateEaseOfUse(crawlerData);
    const quality = this.evaluateQualityOfContent(crawlerData);
    const privacy = this.evaluatePrivacySecurity(crawlerData);
    const responsiveness = this.evaluateResponsiveness(crawlerData);
    const reliability = this.evaluateReliability(crawlerData);

    categories.push(accessibility, easeOfUse, quality, privacy, responsiveness, reliability);

    const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
    const totalPossible = categories.reduce((sum, cat) => sum + cat.total, 0);
    const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

    return {
      categories,
      totalScore,
      totalPossible,
      percentage,
      timestamp: new Date().toISOString(),
    };
  }

  async evaluateCategory(categoryName, crawlerData) {
    const key = (categoryName || '').toUpperCase();
    if (key === 'ACCESSIBILITY') return this.evaluateAccessibility(crawlerData);
    if (key === 'EASE_OF_USE') return this.evaluateEaseOfUse(crawlerData);
    if (key === 'QUALITY_OF_CONTENT') return this.evaluateQualityOfContent(crawlerData);
    if (key === 'PRIVACY_SECURITY') return this.evaluatePrivacySecurity(crawlerData);
    if (key === 'RESPONSIVENESS') return this.evaluateResponsiveness(crawlerData);
    if (key === 'RELIABILITY') return this.evaluateReliability(crawlerData);
    throw new Error(`Unknown category: ${categoryName}`);
  }

  async evaluateAccessibility(crawlerData) {
    const rules = [];
    let score = 0;

    const sitemap = await this.evaluateSitemap(crawlerData);
    const search = await this.evaluateSearchTool(crawlerData);

    rules.push(sitemap, search);
    if (sitemap.status === 'PASS') score += 5;
    if (search.status === 'PASS') score += 5;

    return this.buildCategory('Accessibility', score, 10, rules);
  }

  evaluateEaseOfUse(crawlerData) {
    const rules = [];
    let score = 0;

    const searchFn = this.evaluateSearchFunction(crawlerData);
    const w3c = this.evaluateW3CAccessibility(crawlerData);
    const advanced = this.evaluateAdvancedSearch(crawlerData);

    rules.push(searchFn, w3c, advanced);
    if (searchFn.status === 'PASS') score += 3;
    if (w3c.status === 'PASS') score += 3;
    if (advanced.status === 'PASS') score += 4;

    return this.buildCategory('Ease of Use', score, 10, rules);
  }

  evaluateQualityOfContent(crawlerData) {
    const rules = [];
    let score = 0;

    const freedom = this.evaluateFreedomOfInformation(crawlerData);
    const procurement = this.evaluateProcurement(crawlerData);
    const participation = this.evaluateOnlineEParticipation(crawlerData);

    rules.push(freedom, procurement, participation);
    if (freedom.status === 'PASS') score += 3;
    if (procurement.status === 'PASS') score += 3;
    if (participation.status === 'PASS') score += 4;

    return this.buildCategory('Quality of Content', score, 10, rules);
  }

  evaluatePrivacySecurity(crawlerData) {
    const rules = [];
    let score = 0;

    const privacy = this.evaluatePrivacyPolicy(crawlerData);
    const https = this.evaluateHTTPS(crawlerData);

    rules.push(privacy, https);
    if (privacy.status === 'PASS') score += 6;
    if (https.status === 'PASS') score += 4;

    return this.buildCategory('Privacy / Security', score, 10, rules);
  }

  evaluateResponsiveness(crawlerData) {
    const feedback = this.evaluateFeedbackForm(crawlerData);
    const score = feedback.status === 'PASS' ? 10 : 0;
    return this.buildCategory('Responsiveness', score, 10, [feedback]);
  }

  evaluateReliability(crawlerData) {
    const rules = [];
    let score = 0;

    const loadingTime = this.evaluateLoadingTime(crawlerData);
    const redirects = this.evaluateRedirects(crawlerData);
    const downtime = this.evaluateDowntime(crawlerData);

    rules.push(loadingTime, redirects, downtime);
    if (loadingTime.status === 'PASS') score += 3;
    if (redirects.status === 'PASS') score += 3;
    score += downtime.points;

    return this.buildCategory('Reliability', score, 10, rules);
  }

  async evaluateSitemap(crawlerData) {
    const baseUrl = crawlerData?.url || '';

    // Check 1: /sitemap.xml exists with XML content
    try {
      const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
      const response = await axios.get(sitemapUrl, {
        timeout: this.requestTimeout,
        validateStatus: () => true,
        maxRedirects: 3,
      });
      if (response.status === 200) {
        const content = String(response.data || '');
        if (content.includes('<loc>') || content.includes('<sitemap>') || content.includes('<?xml')) {
          return this.buildRule('Sitemap', true, `sitemap.xml found at ${sitemapUrl} with valid content.`);
        }
      }
    } catch (_) { /* ignore */ }

    // Check 2: <link rel="sitemap"> in HTML head
    const allHtml = this.getAllHtml(crawlerData).toLowerCase();
    if (allHtml.includes('rel="sitemap"') || allHtml.includes("rel='sitemap'")) {
      return this.buildRule('Sitemap', true, 'Sitemap referenced via <link rel="sitemap"> in HTML.');
    }

    // Check 3: Crawled link URL contains "sitemap"
    const sitemapLink = (crawlerData?.links || []).find((l) => /sitemap/i.test(l.url || ''));
    if (sitemapLink) {
      return this.buildRule('Sitemap', true, `Sitemap page link found: ${sitemapLink.url}`);
    }

    // Check 4: robots.txt declares a Sitemap
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).href;
      const robotsResp = await axios.get(robotsUrl, {
        timeout: this.requestTimeout,
        validateStatus: () => true,
      });
      if (robotsResp.status === 200 && /sitemap:/i.test(String(robotsResp.data || ''))) {
        return this.buildRule('Sitemap', true, 'Sitemap URL found in robots.txt.');
      }
    } catch (_) { /* ignore */ }

    return this.buildRule('Sitemap', false, 'No sitemap.xml, <link rel="sitemap">, sitemap page link, or robots.txt Sitemap directive found.');
  }

  async evaluateSearchTool(crawlerData) {
    const websiteName = this.extractWebsiteName(crawlerData);

    if (this.serpApiKey) {
      try {
        const results = await this.searchGoogle(websiteName);
        const inTop10 = this.checkIfInTop10(results, crawlerData?.url || '');
        return {
          name: 'Find Website Using Search Tool',
          status: inTop10 ? 'PASS' : 'FAIL',
          details: inTop10
            ? `Domain found in Google TOP 10 for query "${websiteName}".`
            : `Domain not found in Google TOP 10 for query "${websiteName}".`,
          schedulerTime: this.schedulerTime,
        };
      } catch (_) { /* fall through to SEO check */ }
    }

    // Fallback: check if site is SEO-indexable
    const meta = crawlerData?.meta || {};
    const htmlBlob = this.getAllHtml(crawlerData).toLowerCase();
    const hasTitle = !!(meta.title || '').trim();
    const hasDescription = !!(meta['description'] || meta['og:description'] || '').trim();
    const isBlocked = /name=["']robots["'][^>]*noindex|name=["']googlebot["'][^>]*noindex/.test(htmlBlob);
    const hasStructuredData = htmlBlob.includes('"@context"') || htmlBlob.includes('application/ld+json');
    const pass = hasTitle && hasDescription && !isBlocked;

    try {
      return {
        name: 'Find Website Using Search Tool',
        status: pass ? 'PASS' : 'FAIL',
        details: pass
          ? `Website is SEO-indexable: has title, meta description${hasStructuredData ? ', and structured data' : ''}.`
          : `SEO issues: missing ${[!hasTitle && 'page title', !hasDescription && 'meta description', isBlocked && 'noindex blocking'].filter(Boolean).join(', ')}.`,
        schedulerTime: this.schedulerTime,
      };
    } catch (error) {
      return {
        name: 'Find Website Using Search Tool',
        status: 'FAIL',
        details: `SEO check failed: ${error.message}`,
        schedulerTime: this.schedulerTime,
      };
    }
  }

  evaluateSearchFunction(crawlerData) {
    for (const page of (crawlerData?.pages || [])) {
      const html = page?.html || '';
      if (!html) continue;
      const $ = cheerio.load(html);

      // <input type="search">
      if ($('input[type="search"]').length > 0) {
        return this.buildRule('Search Function', true, 'Found <input type="search"> element.');
      }

      // Input with search-related name / id / placeholder / aria-label
      let foundInput = false;
      $('input').each((_, el) => {
        const combined = [
          $(el).attr('name') || '',
          $(el).attr('id') || '',
          $(el).attr('placeholder') || '',
          $(el).attr('aria-label') || '',
        ].join(' ').toLowerCase();
        if (/\b(search|cari|carian|query|keyword|kata\s*kunci)\b|^q$/.test(combined)) foundInput = true;
      });
      if (foundInput) return this.buildRule('Search Function', true, 'Search input field detected (name/id/placeholder contains search keyword).');

      // Form with search action URL
      let hasSearchAction = false;
      $('form').each((_, el) => {
        if (/search|cari|carian/i.test($(el).attr('action') || '')) hasSearchAction = true;
      });
      if (hasSearchAction) return this.buildRule('Search Function', true, 'Form with search action URL found.');
    }

    const searchLink = (crawlerData?.links || []).find((l) => /[/?]search|[/?]cari|[/?]carian/i.test(l.url || ''));
    if (searchLink) return this.buildRule('Search Function', true, `Search page link found: ${searchLink.url}`);

    return this.buildRule('Search Function', false, 'No search input, search form action, or search page link found.');
  }

  evaluateW3CAccessibility(crawlerData) {
    const images = crawlerData?.images || [];
    let hasLang = false;
    let hasAriaLandmarks = false;
    let hasSkipNav = false;

    for (const page of (crawlerData?.pages || [])) {
      const html = page?.html || '';
      if (!html) continue;
      const $ = cheerio.load(html);
      if ($('html').attr('lang') || $('html').attr('xml:lang')) hasLang = true;
      if ($('[role="main"],[role="navigation"],[role="banner"],main,nav,aside[role]').length > 0) hasAriaLandmarks = true;
      if ($('a[href="#main"],a[href="#content"],a[href="#maincontent"],a[href="#wrapper"]').length > 0) hasSkipNav = true;
    }

    const totalImages = images.length;
    const imagesWithAlt = images.filter((img) => img.hasAlt).length;
    const altRatio = totalImages > 0 ? imagesWithAlt / totalImages : 1;
    const goodAltRatio = altRatio >= 0.5;

    const metCount = [hasLang, hasAriaLandmarks, goodAltRatio, hasSkipNav].filter(Boolean).length;
    const pass = metCount >= 2;

    return this.buildRule(
      'W3C Accessibility',
      pass,
      pass
        ? `W3C criteria met (${metCount}/4): ${[hasLang && 'html[lang]', hasAriaLandmarks && 'ARIA landmarks', goodAltRatio && `img alt text (${Math.round(altRatio * 100)}%)`, hasSkipNav && 'skip nav'].filter(Boolean).join(', ')}.`
        : `Only ${metCount}/4 criteria met. Missing: ${[!hasLang && 'html[lang]', !hasAriaLandmarks && 'ARIA landmarks', !goodAltRatio && `img alt text (${Math.round(altRatio * 100)}% < 50%)`, !hasSkipNav && 'skip nav link'].filter(Boolean).join(', ')}.`
    );
  }

  evaluateAdvancedSearch(crawlerData) {
    // Check for advanced search page link
    const advLink = (crawlerData?.links || []).find((l) =>
      /advanced.?search|advanced_search|carian.?lanjutan|carian_lanjutan/i.test(l.url || '')
    );
    if (advLink) return this.buildRule('Advanced Search', true, `Advanced search page found: ${advLink.url}`);

    // Check for multi-field filter forms (3+ inputs including select or date)
    for (const form of (crawlerData?.forms || [])) {
      const inputs = form.inputs || [];
      const hasText = inputs.some((i) => ['text', 'search', ''].includes((i.type || '').toLowerCase()));
      const hasFilterField = inputs.some((i) =>
        /select|date/i.test(i.type || '') ||
        /categ|type|from|to|start|end|date|jenis/i.test(i.name || '')
      );
      if (inputs.length >= 3 && hasText && hasFilterField) {
        return this.buildRule('Advanced Search', true, `Multi-field filter form detected (${inputs.length} inputs with text + select/date fields).`);
      }
    }

    // Check HTML content for advanced search patterns
    for (const page of (crawlerData?.pages || [])) {
      if (/advanced.?search|carian.?lanjutan|search.*filter|filter.*search/i.test(page?.html || '')) {
        return this.buildRule('Advanced Search', true, 'Advanced search / filter UI detected in page content.');
      }
    }

    return this.buildRule('Advanced Search', false, 'No advanced search page, multi-field filter form, or filter UI found.');
  }

  evaluateFreedomOfInformation(crawlerData) {
    const foiPattern = /freedom.of.information|maklumat.awam|kebebasan.maklumat|annual.report|laporan.tahunan|open.?data|data.terbuka|transparency|keterbukaan/i;

    // Check link URLs
    const foiLink = (crawlerData?.links || []).find((l) => foiPattern.test(l.url || ''));
    if (foiLink) return this.buildRule('Freedom of Information', true, `Transparency / FOI page found: ${foiLink.url}`);

    // Check anchor text and headings across all pages
    const textPat = /freedom of information|maklumat awam|kebebasan maklumat|laporan tahunan|annual report|open data|data terbuka|transparency|keterbukaan/i;
    for (const page of (crawlerData?.pages || [])) {
      const html = page?.html || '';
      if (!html) continue;
      const $ = cheerio.load(html);
      let found = false;
      $('a, h1, h2, h3').each((_, el) => {
        if (textPat.test($(el).text() || '') || textPat.test($(el).attr('href') || '')) found = true;
      });
      if (found) return this.buildRule('Freedom of Information', true, 'Transparency / FOI content found in page links or headings.');
    }

    return this.buildRule('Freedom of Information', false, 'No freedom of information, annual report, open data, or transparency content found.');
  }

  evaluateProcurement(crawlerData) {
    const procPattern = /procurement|tender|perolehan|sebutharga|e.?perolehan|eprocurement|bidding|kontrak/i;

    const procLink = (crawlerData?.links || []).find((l) => procPattern.test(l.url || ''));
    if (procLink) return this.buildRule('Procurement', true, `Procurement / tender page found: ${procLink.url}`);

    for (const page of (crawlerData?.pages || [])) {
      const html = page?.html || '';
      if (!html) continue;
      const $ = cheerio.load(html);
      let found = false;
      $('a, h1, h2, h3').each((_, el) => {
        if (procPattern.test($(el).text() || '') || procPattern.test($(el).attr('href') || '')) found = true;
      });
      if (found) return this.buildRule('Procurement', true, 'Procurement / tender content found in page links or headings.');
    }

    return this.buildRule('Procurement', false, 'No procurement, tender, or e-perolehan content or links found.');
  }

  evaluateOnlineEParticipation(crawlerData) {
    const partPattern = /e.?participation|participation|konsultasi|consultation|survey|maklum.?balas|public.?feedback|forum.?awam|penyertaan.?awam|aduan|complaint/i;

    const partLink = (crawlerData?.links || []).find((l) => partPattern.test(l.url || ''));
    if (partLink) return this.buildRule('Online E-Participation', true, `E-Participation / public engagement page found: ${partLink.url}`);

    for (const page of (crawlerData?.pages || [])) {
      const html = page?.html || '';
      if (!html) continue;
      const $ = cheerio.load(html);
      let found = false;
      $('a, h1, h2, h3').each((_, el) => {
        if (partPattern.test($(el).text() || '') || partPattern.test($(el).attr('href') || '')) found = true;
      });
      if (found) return this.buildRule('Online E-Participation', true, 'E-Participation / public feedback content found in page.');
    }

    return this.buildRule('Online E-Participation', false, 'No e-participation, consultation, survey, or public feedback page found.');
  }

  evaluatePrivacyPolicy(crawlerData) {
    const privacyPattern = /privacy.polic|dasar.privasi|personal.data|perlindungan.data|pdpa|privasi/i;

    // Check link URLs
    let privacyLink = (crawlerData?.links || []).find((l) => privacyPattern.test(l.url || ''));

    // Check anchor text if no URL match
    if (!privacyLink) {
      for (const page of (crawlerData?.pages || [])) {
        const html = page?.html || '';
        if (!html) continue;
        const $ = cheerio.load(html);
        $('a').each((_, el) => {
          if (!privacyLink && (privacyPattern.test($(el).text() || '') || privacyPattern.test($(el).attr('href') || ''))) {
            privacyLink = { url: $(el).attr('href') || '' };
          }
        });
        if (privacyLink) break;
      }
    }

    if (!privacyLink) {
      return this.buildRule('Privacy Policy', false, 'No privacy policy link found on any crawled page.');
    }

    const bodyText = this.getAllHtml(crawlerData).toLowerCase();
    const hasContent = /privacy policy|dasar privasi|personal data|data peribadi|perlindungan|collection of|pengumpulan|disclosure|pendedahan/i.test(bodyText);

    return this.buildRule(
      'Privacy Policy',
      true,
      hasContent
        ? 'Privacy policy link found and privacy content verified in crawled pages.'
        : `Privacy policy link found: ${privacyLink.url || '(text link)'}.`
    );
  }

  evaluateHTTPS(crawlerData) {
    const pass = (crawlerData?.url || '').startsWith('https://');
    return this.buildRule('HTTPS', pass, pass ? 'URL uses HTTPS.' : 'URL does not use HTTPS.');
  }

  evaluateFeedbackForm(crawlerData) {
    // Check forms for email + message/name combination (contact form signature)
    for (const form of (crawlerData?.forms || [])) {
      const inputs = form.inputs || [];
      const hasEmail = inputs.some((i) =>
        i.type === 'email' ||
        /email|e-mail/i.test(i.name || '') ||
        /email/i.test(i.placeholder || '')
      );
      const hasMessage = inputs.some((i) =>
        i.type === 'textarea' ||
        /message|mesej|komen|comment|feedback|maklum|content|body/i.test(i.name || '')
      );
      const hasName = inputs.some((i) => /^name$|^nama$/i.test(i.name || ''));
      if (hasEmail && (hasMessage || hasName)) {
        return this.buildRule('Feedback Form', true, 'Contact/feedback form found with email and message/name fields.');
      }
      if (hasEmail && inputs.length >= 2) {
        return this.buildRule('Feedback Form', true, 'Feedback form found with email field and multiple inputs.');
      }
    }

    // Check for dedicated feedback / contact page links
    const feedbackLink = (crawlerData?.links || []).find((l) =>
      /feedback|contact|hubungi|aduan|maklum.?balas|borang.?maklum/i.test(l.url || '')
    );
    if (feedbackLink) {
      const feedbackPage = (crawlerData?.pages || []).find((p) => p.url === feedbackLink.url);
      if (feedbackPage) {
        const $ = cheerio.load(feedbackPage.html || '');
        if ($('form').length > 0) {
          return this.buildRule('Feedback Form', true, `Feedback/contact page with form found: ${feedbackLink.url}`);
        }
      }
      return this.buildRule('Feedback Form', true, `Feedback/contact page found: ${feedbackLink.url}`);
    }

    // Check anchor text for feedback/contact links in navigation
    const feedbackTextPat = /feedback|contact us|hubungi kami|aduan|maklum balas|borang maklum/i;
    for (const page of (crawlerData?.pages || [])) {
      const html = page?.html || '';
      if (!html) continue;
      const $ = cheerio.load(html);
      let found = false;
      $('a').each((_, el) => { if (feedbackTextPat.test($(el).text() || '')) found = true; });
      if (found) return this.buildRule('Feedback Form', true, 'Feedback/contact navigation link found.');
    }

    return this.buildRule('Feedback Form', false, 'No contact/feedback form with email field or feedback page link found.');
  }

  evaluateLoadingTime(crawlerData) {
    const loadTime = crawlerData?.performance?.averageLoadTime ?? crawlerData?.loadTime ?? 0;
    const pass = loadTime <= 5000;
    return this.buildRule('Loading Time', pass, `Load time ${loadTime}ms (threshold 5000ms).`);
  }

  evaluateRedirects(crawlerData) {
    const redirects = crawlerData?.redirects ?? crawlerData?.performance?.redirects ?? 0;
    const pass = redirects <= 5;
    return this.buildRule('Redirects', pass, `Redirect count ${redirects} (threshold 5).`);
  }

  evaluateDowntime(crawlerData) {
    const downtime = Math.max(0, Number(crawlerData?.monitoring?.downtimeMinutes ?? 0));
    const percentageScore = Math.max(0, 100 - ((downtime / 1440) * 100));
    const points = Number(((percentageScore / 100) * 4).toFixed(2));
    const pass = percentageScore >= 95;

    return {
      name: 'Downtime',
      status: pass ? 'PASS' : 'FAIL',
      score: Number(percentageScore.toFixed(2)),
      points,
      details: `Downtime score: ${percentageScore.toFixed(2)}% (${downtime} min downtime of 1440 min/day).`,
    };
  }

  getAllHtml(crawlerData) {
    return (crawlerData?.pages || []).map((page) => page?.html || '').join('\n');
  }

  async searchGoogle(query) {
    const response = await axios.get(this.serpApiUrl, {
      params: {
        api_key: this.serpApiKey,
        q: query,
        engine: 'google',
      },
      timeout: this.requestTimeout,
    });
    return response.data?.organic_results || [];
  }

  checkIfInTop10(searchResults, targetUrl) {
    const targetHost = this.getHost(targetUrl);
    return searchResults.slice(0, 10).some((result) => {
      const link = result?.link || '';
      return this.getHost(link) === targetHost;
    });
  }

  extractWebsiteName(crawlerData) {
    const title = crawlerData?.meta?.title || crawlerData?.title || '';
    if (title.trim()) return title.split('|')[0].split('-')[0].trim();
    return this.getHost(crawlerData?.url || '') || 'website';
  }

  getHost(url) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch (error) {
      return '';
    }
  }

  buildRule(name, pass, details) {
    return {
      name,
      status: pass ? 'PASS' : 'FAIL',
      details,
    };
  }

  buildCategory(name, score, total, rules) {
    return {
      name,
      score: Number(score.toFixed(2)),
      total,
      rules,
    };
  }
}

const ruleEngine = new SPLaSKRuleEngine();

export default ruleEngine;
export { SPLaSKRuleEngine };