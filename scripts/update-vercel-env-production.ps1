# Clerk Production Environment Variables Update Script
# Dieses Script hilft dir, die Clerk Production Keys in Vercel zu setzen

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Clerk Production Keys → Vercel Update" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Prüfe ob Vercel CLI installiert ist
Write-Host "Prüfe Vercel CLI Installation..." -ForegroundColor Yellow
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI ist nicht installiert!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installiere Vercel CLI mit:" -ForegroundColor Yellow
    Write-Host "  npm install -g vercel" -ForegroundColor White
    Write-Host "  oder" -ForegroundColor White
    Write-Host "  pnpm add -g vercel" -ForegroundColor White
    exit 1
}
Write-Host "✅ Vercel CLI gefunden" -ForegroundColor Green
Write-Host ""

# Prüfe ob Projekt mit Vercel verbunden ist
Write-Host "Prüfe Vercel Projekt-Verbindung..." -ForegroundColor Yellow
if (-not (Test-Path ".vercel\project.json")) {
    Write-Host "❌ Projekt ist nicht mit Vercel verbunden!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verbinde dein Projekt mit:" -ForegroundColor Yellow
    Write-Host "  vercel link" -ForegroundColor White
    exit 1
}

$projectConfig = Get-Content ".vercel\project.json" | ConvertFrom-Json
Write-Host "✅ Projekt verbunden: $($projectConfig.projectName)" -ForegroundColor Green
Write-Host "   Project ID: $($projectConfig.projectId)" -ForegroundColor Gray
Write-Host "   Org ID: $($projectConfig.orgId)" -ForegroundColor Gray
Write-Host ""

# Clerk Production Keys abfragen
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Schritt 1: Clerk Production Keys" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bitte gehe zu:" -ForegroundColor Yellow
Write-Host "  https://clerk.com/dashboard" -ForegroundColor White
Write-Host ""
Write-Host "1. Wähle dein Projekt aus" -ForegroundColor Yellow
Write-Host "2. Wechsle zum PRODUCTION Environment (oben rechts)" -ForegroundColor Yellow
Write-Host "3. Navigiere zu 'API Keys'" -ForegroundColor Yellow
Write-Host "4. Kopiere die Keys" -ForegroundColor Yellow
Write-Host ""

# Publishable Key abfragen
Write-Host "Gib deinen Clerk Production Publishable Key ein" -ForegroundColor Cyan
Write-Host "(beginnt mit pk_live_...):" -ForegroundColor Gray
$publishableKey = Read-Host "VITE_CLERK_PUBLISHABLE_KEY"

if (-not $publishableKey) {
    Write-Host "❌ Kein Key eingegeben. Abbruch." -ForegroundColor Red
    exit 1
}

if (-not $publishableKey.StartsWith("pk_live_")) {
    Write-Host "⚠️  WARNUNG: Der Key beginnt nicht mit 'pk_live_'" -ForegroundColor Yellow
    Write-Host "   Bist du sicher, dass das der Production Key ist?" -ForegroundColor Yellow
    $confirm = Read-Host "Trotzdem fortfahren? (j/n)"
    if ($confirm -ne "j" -and $confirm -ne "J") {
        Write-Host "Abbruch." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Secret Key abfragen
Write-Host "Gib deinen Clerk Production Secret Key ein" -ForegroundColor Cyan
Write-Host "(beginnt mit sk_live_...):" -ForegroundColor Gray
$secretKey = Read-Host "CLERK_SECRET_KEY" -AsSecureString
$secretKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretKey))

if (-not $secretKeyPlain) {
    Write-Host "❌ Kein Key eingegeben. Abbruch." -ForegroundColor Red
    exit 1
}

if (-not $secretKeyPlain.StartsWith("sk_live_")) {
    Write-Host "⚠️  WARNUNG: Der Key beginnt nicht mit 'sk_live_'" -ForegroundColor Yellow
    Write-Host "   Bist du sicher, dass das der Production Key ist?" -ForegroundColor Yellow
    $confirm = Read-Host "Trotzdem fortfahren? (j/n)"
    if ($confirm -ne "j" -and $confirm -ne "J") {
        Write-Host "Abbruch." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Schritt 2: Environment auswählen" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Für welche Environments sollen die Keys gesetzt werden?" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Nur Production (empfohlen)" -ForegroundColor White
Write-Host "2. Production + Preview" -ForegroundColor White
Write-Host "3. Nur Preview (für Tests)" -ForegroundColor White
Write-Host ""
$envChoice = Read-Host "Wähle (1-3)"

$environments = @()
switch ($envChoice) {
    "1" { $environments = @("production") }
    "2" { $environments = @("production", "preview") }
    "3" { $environments = @("preview") }
    default {
        Write-Host "❌ Ungültige Auswahl. Abbruch." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Schritt 3: Bestätigung" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Die folgenden Environment Variables werden gesetzt:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Variable: VITE_CLERK_PUBLISHABLE_KEY" -ForegroundColor White
Write-Host "  Wert: $($publishableKey.Substring(0, 20))..." -ForegroundColor Gray
Write-Host "  Environments: $($environments -join ', ')" -ForegroundColor Gray
Write-Host ""
Write-Host "  Variable: CLERK_SECRET_KEY" -ForegroundColor White
Write-Host "  Wert: $($secretKeyPlain.Substring(0, 20))..." -ForegroundColor Gray
Write-Host "  Environments: $($environments -join ', ')" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "Fortfahren? (j/n)"
if ($confirm -ne "j" -and $confirm -ne "J") {
    Write-Host "Abbruch." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Schritt 4: Environment Variables setzen" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Environment Variables setzen
foreach ($env in $environments) {
    Write-Host "Setze Keys für Environment: $env" -ForegroundColor Yellow
    
    # Publishable Key
    Write-Host "  → VITE_CLERK_PUBLISHABLE_KEY..." -ForegroundColor Gray
    $result = vercel env add VITE_CLERK_PUBLISHABLE_KEY $env --force 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Erfolgreich" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  Fehler: $result" -ForegroundColor Yellow
        Write-Host "    Versuche manuell zu setzen..." -ForegroundColor Yellow
    }
    
    # Secret Key
    Write-Host "  → CLERK_SECRET_KEY..." -ForegroundColor Gray
    $result = vercel env add CLERK_SECRET_KEY $env --force 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Erfolgreich" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  Fehler: $result" -ForegroundColor Yellow
        Write-Host "    Versuche manuell zu setzen..." -ForegroundColor Yellow
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Schritt 5: Deployment triggern" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Die Environment Variables wurden gesetzt!" -ForegroundColor Green
Write-Host ""
Write-Host "Möchtest du jetzt ein neues Deployment triggern?" -ForegroundColor Yellow
Write-Host "(Notwendig, damit die neuen Keys verwendet werden)" -ForegroundColor Gray
Write-Host ""
$deployNow = Read-Host "Deployment starten? (j/n)"

if ($deployNow -eq "j" -or $deployNow -eq "J") {
    Write-Host ""
    Write-Host "Erstelle leeren Commit..." -ForegroundColor Yellow
    git commit --allow-empty -m "chore: update Clerk to Production keys"
    
    Write-Host "Pushe zu Remote..." -ForegroundColor Yellow
    git push origin main
    
    Write-Host ""
    Write-Host "✅ Deployment wurde getriggert!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Überwache den Deployment-Status:" -ForegroundColor Yellow
    Write-Host "  https://vercel.com/dashboard" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Deployment übersprungen." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Triggere das Deployment später manuell mit:" -ForegroundColor Yellow
    Write-Host "  git commit --allow-empty -m 'Trigger deployment'" -ForegroundColor White
    Write-Host "  git push origin main" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Nächste Schritte" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Clerk Allowed Origins konfigurieren:" -ForegroundColor Yellow
Write-Host "   → https://clerk.com/dashboard" -ForegroundColor White
Write-Host "   → Domains → Allowed Origins" -ForegroundColor White
Write-Host "   → Füge deine Vercel-URL hinzu" -ForegroundColor White
Write-Host ""
Write-Host "2. Deployment überwachen:" -ForegroundColor Yellow
Write-Host "   → https://vercel.com/dashboard" -ForegroundColor White
Write-Host ""
Write-Host "3. Funktionstest durchführen:" -ForegroundColor Yellow
Write-Host "   → Öffne deine Production-URL" -ForegroundColor White
Write-Host "   → Teste Registrierung & Login" -ForegroundColor White
Write-Host "   → Prüfe Browser-Konsole auf pk_live_ Key" -ForegroundColor White
Write-Host ""
Write-Host "Vollständige Anleitung: docs\CLERK_PRODUCTION_MIGRATION.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Fertig!" -ForegroundColor Green





