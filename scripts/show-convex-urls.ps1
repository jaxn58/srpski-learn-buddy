# Helper script to show Convex URLs from configuration files
Write-Host "🔍 Searching for Convex URLs..." -ForegroundColor Cyan
Write-Host ""

# Check .env.local
if (Test-Path ".env.local") {
    Write-Host "📄 From .env.local:" -ForegroundColor Yellow
    Get-Content ".env.local" | Select-String "VITE_CONVEX_URL" | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Green
    }
    Write-Host ""
}

# Check .env
if (Test-Path ".env") {
    Write-Host "📄 From .env:" -ForegroundColor Yellow
    Get-Content ".env" | Select-String "VITE_CONVEX_URL" | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Green
    }
    Write-Host ""
}

# Check .env.production
if (Test-Path ".env.production") {
    Write-Host "📄 From .env.production:" -ForegroundColor Yellow
    Get-Content ".env.production" | Select-String "VITE_CONVEX_URL" | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Green
    }
    Write-Host ""
}

# Check convex.json (if exists)
if (Test-Path "convex.json") {
    Write-Host "📄 From convex.json:" -ForegroundColor Yellow
    Get-Content "convex.json" | Select-String "deployment" | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Green
    }
    Write-Host ""
}

Write-Host "💡 Tipp: Die Dev-URL findest du auch im Terminal wo 'npx convex dev' läuft" -ForegroundColor Cyan
Write-Host "💡 Oder im Convex Dashboard: https://dashboard.convex.dev" -ForegroundColor Cyan




