#!/bin/bash

# 🌍 Multi-Language Migration Script
# Führt die komplette Migration für bestehende User durch

set -e  # Exit on error

echo "============================================================"
echo "🌍 Multi-Language Migration Script"
echo "============================================================"
echo ""

# Check if Convex is configured
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found!"
    echo "Please create .env.local with your CONVEX_URL"
    exit 1
fi

# Check if CONVEX_URL is set
if ! grep -q "CONVEX_URL" .env.local; then
    echo "❌ Error: CONVEX_URL not found in .env.local"
    echo "Please add: VITE_CONVEX_URL=https://your-deployment.convex.cloud"
    exit 1
fi

echo "✅ Configuration found"
echo ""

# Step 1: Deploy new schema
echo "📦 Step 1: Deploying new Convex schema..."
echo "   (This adds the learningLanguage field to users table)"
echo ""

read -p "Deploy schema now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    npx convex deploy
    echo ""
    echo "✅ Schema deployed successfully!"
    echo ""
    echo "⏳ Waiting 5 seconds for deployment to propagate..."
    sleep 5
else
    echo "⏭️  Skipping schema deployment"
    echo "⚠️  WARNING: Make sure schema is already deployed!"
    echo ""
fi

# Step 2: Run migration
echo "🔄 Step 2: Migrating existing users..."
echo "   (This sets learningLanguage to 'en' for all existing users)"
echo ""

read -p "Run migration now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    npx tsx scripts/migrate-user-language.ts
    echo ""
else
    echo "⏭️  Migration skipped"
    exit 0
fi

# Step 3: Cleanup reminder
echo ""
echo "============================================================"
echo "✅ MIGRATION COMPLETED!"
echo "============================================================"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. 🧹 Remove temporary migration query from convex/admin.ts:"
echo "   Delete: getAllUsersForMigration"
echo ""
echo "2. 🚀 Deploy cleanup:"
echo "   npx convex deploy"
echo ""
echo "3. 🧪 Test the features:"
echo "   - Register a new user with German language"
echo "   - Check vocabulary translations"
echo "   - Test AI Chat in both languages"
echo ""
echo "4. 📖 Read full guide:"
echo "   cat scripts/MIGRATION_GUIDE.md"
echo ""
echo "============================================================"





