# SPLaSK Professional Crawler

A comprehensive, production-ready web crawler built for SPLaSK website scanning system.

## Features

- **Multi-page crawling**: Crawls homepage + up to 20 internal pages
- **Comprehensive data extraction**: HTML, links, forms, meta tags, headings, images
- **Broken link detection**: Identifies links with status codes other than 200
- **Performance monitoring**: Measures load times and redirect counts
- **Domain isolation**: Ignores external domains for focused crawling
- **URL normalization**: Prevents duplicate crawling with smart URL deduplication
- **Error resilience**: Continues crawling even when individual pages fail
- **Configurable timeouts**: 5-second default timeout with customizable options

## Usage

### Basic Usage

```javascript
import crawler from './crawler/crawler.js';

// Crawl a website
const result = await crawler.crawl('https://example.com');

console.log(result);
```

### Custom Configuration

```javascript
import { SPLaSKCrawler } from './crawler/crawler.js';

// Create custom crawler instance
const customCrawler = new SPLaSKCrawler({
  timeout: 10000,      // 10 seconds
  maxPages: 10,        // Max 10 pages
  maxRedirects: 3,     // Max 3 redirects
  userAgent: 'MyBot/1.0'
});

const result = await customCrawler.crawl('https://example.com');
```

## Return Data Structure

```javascript
{
  success: true,
  pages: [
    {
      url: "https://example.com/",
      title: "Example Domain",
      statusCode: 200,
      loadTime: 574,
      redirects: 0,
      contentLength: 1256,
      headings: {
        h1: ["Example Domain"],
        h2: [],
        h3: [],
        h4: [],
        h5: [],
        h6: []
      }
    }
  ],
  links: [
    {
      url: "https://example.com/page1",
      isBroken: false
    }
  ],
  forms: [
    {
      action: "https://example.com/contact",
      method: "POST",
      inputs: [
        {
          type: "text",
          name: "name",
          required: true,
          placeholder: "Your name"
        }
      ],
      inputCount: 3
    }
  ],
  images: [
    {
      src: "https://example.com/logo.png",
      alt: "Company Logo",
      title: "",
      width: "200",
      height: "100",
      hasAlt: true
    }
  ],
  meta: {
    title: "Example Domain",
    description: "Example website description",
    canonical: "https://example.com/",
    favicon: "https://example.com/favicon.ico"
  },
  loadTime: 574,
  redirects: 0,
  summary: {
    totalPages: 1,
    totalLinks: 0,
    brokenLinks: 0,
    totalForms: 0,
    totalImages: 0,
    averageLoadTime: 574
  }
}
```

## Testing

Run the test script to verify crawler functionality:

```bash
# Test with example.com
node test-crawler.js https://example.com

# Test with custom URL
node test-crawler.js https://your-website.com
```

## Integration

The crawler is integrated with the SPLaSK backend through `crawlerService.js`:

```javascript
import { crawlWebsite } from './services/crawlerService.js';

const websiteData = await crawlWebsite('https://example.com');
// Data is automatically transformed for compliance analysis
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `timeout` | 5000 | Request timeout in milliseconds |
| `maxPages` | 20 | Maximum pages to crawl |
| `maxRedirects` | 5 | Maximum redirects to follow |
| `userAgent` | 'SPLaSK-Crawler/1.0' | User agent string |

## Error Handling

The crawler is designed to be error-safe:
- Individual page failures don't stop the entire crawl
- Invalid URLs are skipped gracefully
- Network timeouts are handled automatically
- Malformed HTML is processed with fallbacks

## Dependencies

- `axios`: HTTP client with timeout and redirect handling
- `cheerio`: jQuery-like HTML parsing and manipulation

## Architecture

- **SPLaSKCrawler Class**: Main crawler with configurable options
- **Singleton Export**: Default crawler instance for simple usage
- **Modular Design**: Separate methods for different extraction tasks
- **Queue-based Crawling**: Breadth-first crawling with deduplication
- **Batch Processing**: Efficient broken link checking with concurrency control