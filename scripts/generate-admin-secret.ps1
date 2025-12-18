# Generate Admin Secret for Production Scripts
# This script generates a secure random secret for authenticating production scripts

Write-Host "🔐 Admin Secret Generator" -ForegroundColor Cyan
Write-Host ""

# Generate a secure random secret (32 characters)
$secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Host "✅ Generated Admin Secret:" -ForegroundColor Green
Write-Host ""
Write-Host "ADMIN_SECRET=$secret" -ForegroundColor Yellow
Write-Host ""

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Copy the secret above"
Write-Host "2. Add it to your .env file:"
Write-Host "   - Open: d:\DEVELOPMENT\Cursor\srpski-tutor-en\.env"
Write-Host "   - Add: ADMIN_SECRET=$secret"
Write-Host ""
Write-Host "3. Add it to Convex Environment Variables:"
Write-Host "   - Go to: https://dashboard.convex.dev"
Write-Host "   - Select: fleet-labrador-324"
Write-Host "   - Settings → Environment Variables"
Write-Host "   - Add: ADMIN_SECRET = $secret (Production)"
Write-Host ""
Write-Host "4. Wait 1-2 minutes for Convex to redeploy"
Write-Host ""
Write-Host "5. Test the script:"
Write-Host "   pnpm reset:audio:prod"
Write-Host ""

Write-Host "⚠️  SECURITY WARNING:" -ForegroundColor Red
Write-Host "- Keep this secret private"
Write-Host "- Never commit it to Git"
Write-Host "- Never share it publicly"
Write-Host ""
