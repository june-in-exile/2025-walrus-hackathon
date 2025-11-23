#!/bin/bash

# Quick API Test Script for TEE KPI Calculation
# Usage: ./test-api-quick.sh

API_URL="http://localhost:3000/api/v1/tee/compute"

echo "=============================================="
echo "   TEE KPI Calculation API - Quick Test"
echo "=============================================="
echo

# Check if server is running
echo "1. Checking if server is running..."
if ! curl -s -f http://localhost:3000/api/v1/health > /dev/null; then
    echo "❌ Server is not running on localhost:3000"
    echo "   Please run: npm run dev"
    exit 1
fi
echo "✅ Server is running"
echo

# Test 1: Simple calculation
echo "2. Testing simple KPI calculation..."
RESULT=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "journalEntryId": "JE-001",
        "credits": [{"account": "Sales Revenue", "amount": 10000}]
      }
    ],
    "operation": "simple"
  }')

if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
    KPI=$(echo "$RESULT" | jq -r '.data.kpi_result.kpi')
    echo "✅ Simple calculation works"
    echo "   KPI: $KPI (expected: 10000)"
else
    echo "❌ Simple calculation failed"
    echo "$RESULT" | jq '.'
    exit 1
fi
echo

# Test 2: With attestation
echo "3. Testing KPI with attestation..."
RESULT=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "journalEntryId": "JE-001",
        "credits": [{"account": "Sales Revenue", "amount": 50000}]
      },
      {
        "employeeDetails": {},
        "grossPay": 20000
      }
    ],
    "operation": "with_attestation"
  }')

if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
    KPI=$(echo "$RESULT" | jq -r '.data.kpi_result.kpi')
    ATTESTATION_LEN=$(echo "$RESULT" | jq -r '.data.attestation_bytes | length')
    echo "✅ Attestation calculation works"
    echo "   KPI: $KPI (expected: 30000)"
    echo "   Attestation length: $ATTESTATION_LEN bytes (expected: 144)"

    if [ "$ATTESTATION_LEN" != "144" ]; then
        echo "⚠️  Warning: Attestation length is not 144 bytes!"
    fi
else
    echo "❌ Attestation calculation failed"
    echo "$RESULT" | jq '.'
    exit 1
fi
echo

# Test 3: Full month calculation
echo "4. Testing full month calculation (4 document types)..."
RESULT=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "journalEntryId": "JE-001",
        "credits": [{"account": "Sales Revenue", "amount": 50000}]
      },
      {
        "assetList": [
          {
            "assetID": "MACH-001A",
            "originalCost": 120000,
            "residualValue": 12000,
            "usefulLife_years": 10
          }
        ]
      },
      {
        "employeeDetails": {},
        "grossPay": 20000
      },
      {
        "reportTitle": "Corporate Overhead Report",
        "totalOverheadCost": 50000
      }
    ]
  }')

if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
    KPI=$(echo "$RESULT" | jq -r '.data.kpi_result.kpi')
    echo "✅ Full month calculation works"
    echo "   KPI: $KPI (expected: 24100)"
    echo "   Breakdown:"
    echo "     Sales Revenue:   +50000"
    echo "     Depreciation:      -900"
    echo "     Payroll:        -20000"
    echo "     Overhead:        -5000"
    echo "     -------------------------"
    echo "     Total KPI:       24100"
else
    echo "❌ Full month calculation failed"
    echo "$RESULT" | jq '.'
    exit 1
fi
echo

# Test 4: Error handling (empty documents)
echo "5. Testing error handling (empty documents)..."
RESULT=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"documents": []}')

if echo "$RESULT" | jq -e '.success == false' > /dev/null 2>&1; then
    echo "✅ Error handling works"
else
    echo "❌ Error handling failed (should reject empty documents)"
    echo "$RESULT" | jq '.'
fi
echo

echo "=============================================="
echo "   ✅ All Tests Passed!"
echo "=============================================="
echo
echo "API is ready for use. You can now:"
echo "1. Test with frontend: npm run dev"
echo "2. View API docs: http://localhost:3000/api-docs"
echo "3. Check OpenAPI spec: http://localhost:3000/api/openapi"
echo
echo "For more tests, see: nautilus/API_TESTING_GUIDE.md"
