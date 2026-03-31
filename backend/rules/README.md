# SPLaSK Rule Engine

A comprehensive compliance evaluation engine for SPLaSK that assesses websites across 6 categories with 15 specific rules.

## Overview

The SPLaSK Rule Engine evaluates websites based on government compliance standards, checking for accessibility, ease of use, content quality, privacy/security, responsiveness, and reliability.

## Categories & Rules

### 1. ACCESSIBILITY (10 points)
- **Sitemap** (5 pts): Checks for `<splwpk-sitemap>` tag without `<i>` elements
- **Find Website Using Search Tool** (5 pts): Uses SerpAPI to verify website appears in Google top 10 results (scheduled at 11:15 PM)

### 2. EASE OF USE (10 points)
- **Search Function** (3 pts): Checks for `<form>` and `<splwpk-search-function>` tags
- **W3C Accessibility** (3 pts): Checks for `<splwpk-w3c>` tag and accessibility controls (font-size, font-family, background-color)
- **Advanced Search** (4 pts): Checks for `<splwpk-advanced-search-function>` and `<form>` tags

### 3. QUALITY OF CONTENT (10 points)
- **Freedom of Information** (3 pts): Checks for `<splwpk-freedom>` tag with valid URL (status 200)
- **Procurement** (3 pts): Checks for `<splwpk-procurement>` tag without `<i>` elements
- **Online E-Participation** (4 pts): Checks for `<splwpk-online-e-participation>` without `<i>` and detects policy/guideline text

### 4. PRIVACY/SECURITY (10 points)
- **Privacy Policy** (6 pts): Checks for privacy policy link and page with H1 and privacy keywords
- **HTTPS** (4 pts): Verifies URL starts with `https://`

### 5. RESPONSIVENESS (10 points)
- **Feedback Form** (10 pts): Checks for `<splwpk-feedback-form>` and `<form>` tags

### 6. RELIABILITY (10 points)
- **Loading Time** (3 pts): Checks if load time ≤ 5000ms
- **Redirects** (3 pts): Checks if redirects ≤ 5
- **Downtime (SIMULATION)** (4 pts): Calculates score based on simulated downtime formula

## Usage

### Basic Evaluation

```javascript
import ruleEngine from './rules/ruleEngine.js';

// Evaluate website compliance
const result = await ruleEngine.evaluate(crawlerData);

console.log(`Overall Score: ${result.percentage}%`);
console.log(`Categories: ${result.categories.length}`);
```

### Custom Configuration

```javascript
import { SPLaSKRuleEngine } from './rules/ruleEngine.js';

// Create custom rule engine instance
const customEngine = new SPLaSKRuleEngine({
  serpApiKey: 'your-api-key-here'
});

const result = await customEngine.evaluate(crawlerData);
```

### Category-Specific Evaluation

```javascript
// Evaluate single category
const accessibilityResult = await ruleEngine.evaluateCategory('ACCESSIBILITY', crawlerData);
console.log(`${accessibilityResult.name}: ${accessibilityResult.score}/${accessibilityResult.total}`);
```

### Compliance Service Integration

```javascript
import { runComplianceRules, getComplianceSummary } from './services/complianceRulesService.js';

// Full compliance evaluation
const complianceResult = await runComplianceRules(crawlerData);
const summary = getComplianceSummary(complianceResult);

console.log(`Status: ${summary.status}`);
console.log(`Score: ${summary.overall}%`);
```

## Input Data Format

The rule engine expects crawler data in the following format:

```javascript
{
  url: "https://example.com",
  statusCode: 200,
  title: "Website Title",
  pages: [
    {
      // Page-specific data including SPLaSK tags
      sitemapTagExists: true,
      searchFunctionTagExists: true,
      // ... other tag checks
    }
  ],
  links: [{ url: "...", isBroken: false }],
  forms: [{ action: "...", method: "GET", inputs: [...] }],
  images: [{ src: "...", alt: "...", hasAlt: true }],
  meta: { title: "...", description: "...", ... },
  performance: { loadTime: 1200, redirects: 1, averageLoadTime: 1200 }
}
```

## Output Data Structure

```javascript
{
  success: true,
  categories: [
    {
      name: "ACCESSIBILITY",
      score: 5,
      total: 10,
      rules: [
        {
          name: "Sitemap",
          status: "PASS",
          details: "Valid sitemap tag found"
        },
        {
          name: "Find Website Using Search Tool",
          status: "SKIP",
          details: "Not scheduled time (11:15 PM)"
        }
      ]
    }
    // ... other categories
  ],
  totalScore: 46,
  totalPossible: 60,
  percentage: 77,
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

## Rule Status Values

- **PASS**: Rule requirement met
- **FAIL**: Rule requirement not met
- **SKIP**: Rule not applicable (e.g., scheduling constraints)
- **ERROR**: Rule evaluation failed due to errors

## Configuration

### Environment Variables

- `SERP_API_KEY`: SerpAPI key for Google search functionality

### Constructor Options

```javascript
const engine = new SPLaSKRuleEngine({
  serpApiKey: 'your-api-key',     // SerpAPI key
  // Future options can be added here
});
```

## Testing

Run the test script to verify functionality:

```bash
# Test rule engine with mock data
node test-rule-engine.js

# Test with custom data
node test-rule-engine.js https://your-website.com
```

## Integration

The rule engine integrates seamlessly with:

- **Crawler Service**: Processes crawler output
- **Compliance Service**: Provides backward-compatible API
- **Database Service**: Stores evaluation results
- **API Routes**: Exposes evaluation endpoints

## Error Handling

The rule engine includes comprehensive error handling:

- Individual rule failures don't stop evaluation
- Network timeouts are handled gracefully
- Missing data is handled with defaults
- Detailed error messages for debugging

## Performance

- **Evaluation Time**: Typically < 500ms for basic rules
- **Network Calls**: Minimal external API usage
- **Memory Usage**: Efficient data processing
- **Scalability**: Designed for concurrent evaluations

## Future Enhancements

- Additional compliance categories
- Custom rule definitions
- Historical trend analysis
- Automated scheduling
- Advanced reporting features