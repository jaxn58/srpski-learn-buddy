# 🌍 Multi-Language Migration Script (PowerShell)
# Führt die komplette Migration für bestehende User durch

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🌍 Multi-Language Migration Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ Error: .env.local file not found!" -ForegroundColor Red
    Write-Host "Please create .env.local with your CONVEX_URL" -ForegroundColor Yellow
    exit 1
}

# Check if CONVEX_URL is set
$envContent = Get-Content ".env.local" -Raw
if ($envContent -notmatch "CONVEX_URL") {
    Write-Host "❌ Error: CONVEX_URL not found in .env.local" -ForegroundColor Red
    Write-Host "Please add: VITE_CONVEX_URL=https://your-deployment.convex.cloud" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Configuration found" -ForegroundColor Green
Write-Host ""

# Step 1: Deploy new schema
Write-Host "📦 Step 1: Deploying new Convex schema..." -ForegroundColor Yellow
Write-Host "   (This adds the learningLanguage field to users table)" -ForegroundColor Gray
Write-Host ""

$deploy = Read-Host "Deploy schema now? (y/n)"
if ($deploy -eq "y" -or $deploy -eq "Y") {
    npx convex deploy
    Write-Host ""
    Write-Host "✅ Schema deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "⏳ Waiting 5 seconds for deployment to propagate..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
} else {
    Write-Host "⏭️  Skipping schema deployment" -ForegroundColor Yellow
    Write-Host "⚠️  WARNING: Make sure schema is already deployed!" -ForegroundColor Yellow
    Write-Host ""
}

# Step 2: Run migration
Write-Host "🔄 Step 2: Migrating existing users..." -ForegroundColor Yellow
Write-Host "   (This sets learningLanguage to 'en' for all existing users)" -ForegroundColor Gray
Write-Host ""

$migrate = Read-Host "Run migration now? (y/n)"
if ($migrate -eq "y" -or $migrate -eq "Y") {
    npx tsx scripts/migrate-user-language.ts
    Write-Host ""
} else {
    Write-Host "⏭️  Migration skipped" -ForegroundColor Yellow
    exit 0
}

# Step 3: Cleanup reminder
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ MIGRATION COMPLETED!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 🧹 Remove temporary migration query from convex/admin.ts:" -ForegroundColor White
Write-Host "   Delete: getAllUsersForMigration" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 🚀 Deploy cleanup:" -ForegroundColor White
Write-Host "   npx convex deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 🧪 Test the features:" -ForegroundColor White
Write-Host "   - Register a new user with German language" -ForegroundColor Gray
Write-Host "   - Check vocabulary translations" -ForegroundColor Gray
Write-Host "   - Test AI Chat in both languages" -ForegroundColor Gray
Write-Host ""
Write-Host "4. 📖 Read full guide:" -ForegroundColor White
Write-Host "   Get-Content scripts/MIGRATION_GUIDE.md" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan




















