#!/bin/bash
# SPLaSK Backend Quick Test

echo "SPLaSK Backend Quick Test"
echo "========================"
echo ""

BASE_URL="http://localhost:3000"

# Check if server is running
echo "1. Checking server health..."
HEALTH=$(curl -s $BASE_URL/health)
if [ $? -eq 0 ]; then
    echo "✓ Server is running"
    echo $HEALTH | jq . 2>/dev/null || echo $HEALTH
else
    echo "✗ Server is not running"
    echo "Please start the server with: npm run dev"
    exit 1
fi
echo ""
echo ""

# Test scan endpoint
echo "2. Testing scan endpoint..."
SCAN_RESPONSE=$(curl -s -X POST $BASE_URL/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}')

if [ $? -eq 0 ]; then
    echo "✓ Scan request successful"
    echo $SCAN_RESPONSE | jq . 2>/dev/null || echo $SCAN_RESPONSE
else
    echo "✗ Scan request failed"
fi

echo ""
echo "Test completed!"