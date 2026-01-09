# Installiert Git-Kurzbefehle ins PowerShell-Profil
$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Git-Kurzbefehle Installation" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Pfad zum PowerShell-Profil ermitteln
$profilePath = $PROFILE.CurrentUserCurrentHost

# Pruefen ob Profil existiert, sonst erstellen
if (-not (Test-Path $profilePath)) {
    Write-Host "Erstelle PowerShell-Profil..." -ForegroundColor Yellow
    $profileDir = Split-Path $profilePath -Parent
    if (-not (Test-Path $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }
    New-Item -ItemType File -Path $profilePath -Force | Out-Null
    Write-Host "Profil erstellt: $profilePath" -ForegroundColor Green
}

# Pfad zur git-shortcuts.ps1 Datei
$scriptDir = $PSScriptRoot
$shortcutsFile = Join-Path $scriptDir "git-shortcuts.ps1"

if (-not (Test-Path $shortcutsFile)) {
    Write-Host "Fehler: git-shortcuts.ps1 nicht gefunden!" -ForegroundColor Red
    Write-Host "   Erwarteter Pfad: $shortcutsFile" -ForegroundColor Yellow
    exit 1
}

# Pruefen ob bereits installiert
$profileContent = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
$sourceLine = ". `"$shortcutsFile`""

if ($profileContent -and $profileContent.Contains($sourceLine)) {
    Write-Host "Git-Kurzbefehle sind bereits installiert!" -ForegroundColor Yellow
    Write-Host ""
    $reinstall = Read-Host "Neu installieren? (j/n)"
    if ($reinstall -ne "j" -and $reinstall -ne "J") {
        Write-Host "Installation abgebrochen" -ForegroundColor Gray
        exit 0
    }
    
    # Bei Neuinstallation: Alte Eintraege entfernen
    Write-Host "Entferne alte Eintraege..." -ForegroundColor Yellow
    $lines = Get-Content $profilePath
    $newLines = $lines | Where-Object { 
        $_ -ne $sourceLine -and 
        $_ -ne "# Git-Kurzbefehle laden" 
    }
    Set-Content -Path $profilePath -Value $newLines
}

# Funktionen zum Profil hinzufuegen
Write-Host "Installiere Git-Kurzbefehle..." -ForegroundColor Yellow

# Leerzeile und Kommentar hinzufuegen
Add-Content -Path $profilePath -Value ""
Add-Content -Path $profilePath -Value "# Git-Kurzbefehle laden"
Add-Content -Path $profilePath -Value $sourceLine

Write-Host "Git-Kurzbefehle erfolgreich installiert!" -ForegroundColor Green
Write-Host ""
Write-Host "Verfuegbare Befehle:" -ForegroundColor Cyan
Write-Host "  gsave 'Nachricht'  - Staged alle Aenderungen und committet" -ForegroundColor White
Write-Host "  gpush              - Pusht zum aktuellen Branch" -ForegroundColor White
Write-Host "  gquick 'Nachricht' - Alles in einem: add, commit, push" -ForegroundColor White
Write-Host ""
Write-Host "Tipp: Starte PowerShell neu oder fuehre aus: . `$PROFILE" -ForegroundColor Yellow