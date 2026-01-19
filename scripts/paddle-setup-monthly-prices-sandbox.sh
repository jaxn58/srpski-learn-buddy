#!/bin/bash
set -e

# =========================================
# Paddle Sandbox: Create Monthly Recurring Prices
# =========================================
# This script creates 4 recurring monthly subscription prices in Paddle Sandbox
# for the installment payment feature.
#
# Requirements:
# - PADDLE_API_KEY environment variable (Sandbox API key)
# - Existing Product IDs in Paddle Sandbox (you'll need to provide these)
#
# Usage:
#   export PADDLE_API_KEY="your-sandbox-api-key"
#   bash scripts/paddle-setup-monthly-prices-sandbox.sh

# =========================================
# Configuration
# =========================================
PADDLE_API_BASE="https://sandbox-api.paddle.com"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# =========================================
# Validate API Key
# =========================================
if [ -z "$PADDLE_API_KEY" ]; then
  echo -e "${RED}Error: PADDLE_API_KEY environment variable is not set${NC}"
  echo "Please set it with your Paddle Sandbox API key:"
  echo "  export PADDLE_API_KEY='your-sandbox-api-key'"
  exit 1
fi

echo -e "${GREEN}✓ API Key found${NC}"

# =========================================
# Get Product IDs
# =========================================
echo ""
echo -e "${YELLOW}Fetching existing products from Paddle Sandbox...${NC}"

PRODUCTS_RESPONSE=$(curl -s -X GET \
  "$PADDLE_API_BASE/products?status=active" \
  -H "Authorization: Bearer $PADDLE_API_KEY" \
  -H "Content-Type: application/json")

# Check if curl succeeded
if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Failed to fetch products${NC}"
  exit 1
fi

# Parse product IDs (assuming you have products named or you'll select them)
echo -e "${GREEN}Products fetched successfully${NC}"
echo "$PRODUCTS_RESPONSE" | jq -r '.data[] | "\(.id) - \(.name)"'

echo ""
echo -e "${YELLOW}Please enter your Product IDs:${NC}"
echo -n "Intensive Product ID (pro_...): "
read PRODUCT_ID_INTENSIVE
echo -n "Balanced Product ID (pro_...): "
read PRODUCT_ID_BALANCED
echo -n "Standard Product ID (pro_...): "
read PRODUCT_ID_STANDARD
echo -n "Relaxed Product ID (pro_...): "
read PRODUCT_ID_RELAXED

# =========================================
# Create Monthly Prices
# =========================================
echo ""
echo -e "${YELLOW}Creating monthly recurring prices...${NC}"

# Function to create a price
create_price() {
  local PRODUCT_ID=$1
  local AMOUNT=$2
  local DESCRIPTION=$3
  
  local RESPONSE=$(curl -s -X POST \
    "$PADDLE_API_BASE/prices" \
    -H "Authorization: Bearer $PADDLE_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "product_id": "'"$PRODUCT_ID"'",
      "description": "'"$DESCRIPTION"'",
      "billing_cycle": {
        "interval": "month",
        "frequency": 1
      },
      "unit_price": {
        "amount": "'"$AMOUNT"'",
        "currency_code": "EUR"
      },
      "quantity": {
        "minimum": 1,
        "maximum": 1
      }
    }')
  
  # Extract price ID
  local PRICE_ID=$(echo "$RESPONSE" | jq -r '.data.id')
  
  if [ "$PRICE_ID" = "null" ] || [ -z "$PRICE_ID" ]; then
    echo -e "${RED}Error creating price for $DESCRIPTION${NC}"
    echo "Response: $RESPONSE"
    return 1
  fi
  
  echo -e "${GREEN}✓ Created: $DESCRIPTION${NC}"
  echo "  Price ID: $PRICE_ID"
  echo "  Amount: €$(echo "scale=2; $AMOUNT/100" | bc)/month"
  echo ""
  
  echo "$PRICE_ID"
}

# Create prices (amounts in cents)
echo ""
PRICE_ID_INTENSIVE=$(create_price "$PRODUCT_ID_INTENSIVE" "2599" "Intensive - Monthly (3 months)")
PRICE_ID_BALANCED=$(create_price "$PRODUCT_ID_BALANCED" "1499" "Balanced - Monthly (6 months)")
PRICE_ID_STANDARD=$(create_price "$PRODUCT_ID_STANDARD" "1199" "Standard - Monthly (9 months)")
PRICE_ID_RELAXED=$(create_price "$PRODUCT_ID_RELAXED" "1099" "Relaxed - Monthly (12 months)")

# =========================================
# Summary
# =========================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All monthly prices created successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Add these to your Convex Environment Variables:"
echo "→ Convex Dashboard: https://dashboard.convex.dev"
echo "→ Deployment: reminiscent-panda-57 (Dev)"
echo "→ Settings → Environment Variables"
echo ""
echo "PADDLE_PRODUCT_INTENSIVE_MONTHLY=$PRICE_ID_INTENSIVE"
echo "PADDLE_PRODUCT_BALANCED_MONTHLY=$PRICE_ID_BALANCED"
echo "PADDLE_PRODUCT_STANDARD_MONTHLY=$PRICE_ID_STANDARD"
echo "PADDLE_PRODUCT_RELAXED_MONTHLY=$PRICE_ID_RELAXED"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Copy the environment variables above"
echo "2. Add them to Convex Dev (reminiscent-panda-57)"
echo "3. Restart your dev server (npx convex dev)"
echo "4. Test the checkout on localhost:5173"
echo ""
