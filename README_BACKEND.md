# SPLaSK Backend - Node.js + Express

A modern, modular Node.js + Express backend for the SPLaSK website compliance scanning system.

## Features

- ✅ REST API with express
- ✅ MySQL database integration
- ✅ Website crawler with cheerio
- ✅ 6-category compliance evaluation engine
- ✅ Modular architecture
- ✅ Error handling & logging
- ✅ Clean code structure

## Prerequisites

- Node.js 16+
- npm or yarn
- MySQL 8.0+

## Installation

1. **Navigate to project:**
```bash
cd C:\xampp\htdocs\SPLaSK_4.0
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
Edit `.env` file with your settings:
```
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=splask_db
```

4. **Setup database:**
- Open phpMyAdmin
- Create database: `splask_db`
- Import `sql/splask_database.sql`

## Running the Server

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Server will run on: `http://localhost:3000`

## API Endpoints

### Health Check
```http
GET /health
```

### Scan Website
```http
POST /api/scan
Content-Type: application/json

{
  "url": "https://example.com"
}
```

Response (202 Accepted):
```json
{
  "success": true,
  "message": "Scan initiated",
  "data": {
    "scan_id": 1,
    "website_id": 1,
    "url": "https://example.com",
    "status": "PROCESSING"
  }
}
```

## Database Schema

### websites
- id, name, url (unique), serp_api_token, created_at, updated_at

### scan_results
- id, website_id (FK), scores (7 categories), status, created_at

### rule_results
- id, scan_result_id (FK), rule_name, status, score, message, created_at

## Compliance Categories

SPLaSK evaluates websites across 6 categories:

1. **Accessibility** - alt text, labels, hierarchy
2. **Ease of Use** - navigation, viewport, speed
3. **Content Quality** - descriptions, structure, OG tags
4. **Security** - HTTPS, robots, headers
5. **Responsiveness** - mobile, layout, images
6. **Reliability** - links, availability, cache

## Project Structure

```
SPLaSK_4.0/
├── backend/
│   ├── server.js                    # Main Express app
│   ├── routes/
│   │   └── scanRoutes.js           # API routes
│   ├── controllers/
│   │   └── scanController.js       # Business logic
│   ├── services/
│   │   ├── crawlerService.js       # Web crawler
│   │   └── complianceRulesService.js # Evaluation engine
│   ├── database/
│   │   └── db.js                   # MySQL connection
│   ├── crawler/                    # Crawler utilities
│   ├── rules/                      # Custom rules
│   └── monitor/                    # Monitoring
├── sql/
│   └── splask_database.sql         # Database schema
├── package.json                    # Dependencies
└── .env                           # Configuration
```

## Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### Scan Website
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## License

MIT