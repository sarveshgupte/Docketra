#!/bin/bash
# PR #44 Manual Testing Script
# Tests xID ownership guardrails

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API Base URL (update as needed)
API_URL="${API_URL:-http://localhost:5000}"

# Test user xID (update with valid xID from your system)
TEST_XID="${TEST_XID:-X123456}"

echo "========================================="
echo "PR #44: xID Ownership Guardrails Tests"
echo "========================================="
echo "API URL: $API_URL"
echo "Test xID: $TEST_XID"
echo ""

# Test 1: Create case without authentication
echo -e "${YELLOW}Test 1: Case creation without authentication${NC}"
echo "Expected: 401 Unauthorized"
response=$(curl -s -X POST "$API_URL/api/cases" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Case",
    "description": "Test Description",
    "categoryId": "507f1f77bcf86cd799439011",
    "subcategoryId": "sub1",
    "slaDueDate": "2026-02-01T00:00:00Z"
  }')
echo "Response: $response"
if echo "$response" | grep -q "Authentication required"; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
fi
echo ""

# Test 2: Attempt to use createdByEmail field
echo -e "${YELLOW}Test 2: Attempt to use createdByEmail field${NC}"
echo "Expected: 400 Bad Request with forbidden field error"
response=$(curl -s -X POST "$API_URL/api/cases" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_XID" \
  -d '{
    "title": "Test Case",
    "description": "Test Description",
    "categoryId": "507f1f77bcf86cd799439011",
    "subcategoryId": "sub1",
    "slaDueDate": "2026-02-01T00:00:00Z",
    "createdByEmail": "hacker@example.com"
  }')
echo "Response: $response"
if echo "$response" | grep -q "Email-based ownership fields are not supported"; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
fi
echo ""

# Test 3: Attempt to assign using email address
echo -e "${YELLOW}Test 3: Attempt to assign case using email address${NC}"
echo "Expected: 400 Bad Request with email rejection error"
response=$(curl -s -X POST "$API_URL/api/cases" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_XID" \
  -d '{
    "title": "Test Case",
    "description": "Test Description",
    "categoryId": "507f1f77bcf86cd799439011",
    "subcategoryId": "sub1",
    "slaDueDate": "2026-02-01T00:00:00Z",
    "assignedTo": "user@example.com"
  }')
echo "Response: $response"
if echo "$response" | grep -q "Cannot assign cases using email addresses"; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
fi
echo ""

# Test 4: Attempt to use invalid xID format
echo -e "${YELLOW}Test 4: Attempt to use invalid xID format${NC}"
echo "Expected: 400 Bad Request with format validation error"
response=$(curl -s -X POST "$API_URL/api/cases" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_XID" \
  -d '{
    "title": "Test Case",
    "description": "Test Description",
    "categoryId": "507f1f77bcf86cd799439011",
    "subcategoryId": "sub1",
    "slaDueDate": "2026-02-01T00:00:00Z",
    "assignedTo": "X12345"
  }')
echo "Response: $response"
if echo "$response" | grep -q "Invalid xID format"; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
fi
echo ""

# Test 5: Attempt to override createdByXID in payload
echo -e "${YELLOW}Test 5: Attempt to override createdByXID in payload${NC}"
echo "Expected: 400 Bad Request"
response=$(curl -s -X POST "$API_URL/api/cases" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_XID" \
  -d '{
    "title": "Test Case",
    "description": "Test Description",
    "categoryId": "507f1f77bcf86cd799439011",
    "subcategoryId": "sub1",
    "slaDueDate": "2026-02-01T00:00:00Z",
    "createdByXID": "X999999"
  }')
echo "Response: $response"
if echo "$response" | grep -q "Cannot specify createdByXID in request payload"; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
fi
echo ""

# Test 6: Valid case creation with xID (requires valid category and auth)
echo -e "${YELLOW}Test 6: Valid case creation with proper xID${NC}"
echo "Expected: 201 Created (may fail if category doesn't exist)"
response=$(curl -s -X POST "$API_URL/api/cases" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_XID" \
  -d '{
    "title": "Test Case",
    "description": "Test Description",
    "categoryId": "507f1f77bcf86cd799439011",
    "subcategoryId": "sub1",
    "slaDueDate": "2026-02-01T00:00:00Z"
  }')
echo "Response: $response"
if echo "$response" | grep -q "success"; then
  echo -e "${GREEN}✅ PASS (or valid error if category doesn't exist)${NC}"
else
  echo -e "${YELLOW}⚠️  Expected error if category/auth invalid${NC}"
fi
echo ""

# Test 7: Valid case assignment with xID format
echo -e "${YELLOW}Test 7: Valid assignment with xID format${NC}"
echo "Expected: Passes validation (201 Created or valid error)"
response=$(curl -s -X POST "$API_URL/api/cases" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_XID" \
  -d '{
    "title": "Test Case",
    "description": "Test Description",
    "categoryId": "507f1f77bcf86cd799439011",
    "subcategoryId": "sub1",
    "slaDueDate": "2026-02-01T00:00:00Z",
    "assignedTo": "X654321"
  }')
echo "Response: $response"
# Should not contain validation errors about email or format
if echo "$response" | grep -q "Cannot assign cases using email"; then
  echo -e "${RED}❌ FAIL - Should accept xID format${NC}"
elif echo "$response" | grep -q "Invalid xID format"; then
  echo -e "${RED}❌ FAIL - Should accept valid xID${NC}"
else
  echo -e "${GREEN}✅ PASS - Validation accepted xID format${NC}"
fi
echo ""

echo "========================================="
echo "Test Summary"
echo "========================================="
echo "All tests completed. Review results above."
echo ""
echo "NOTE: Tests 6 and 7 may show database errors if:"
echo "  - MongoDB is not running"
echo "  - Test user ($TEST_XID) doesn't exist"
echo "  - Category ID doesn't exist"
echo "These are expected and don't indicate guardrail failures."
echo ""
echo "The key tests are 1-5, which validate guardrails work correctly."
