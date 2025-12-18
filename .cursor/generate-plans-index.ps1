# Generiert eine Übersichtsdatei mit Links zu allen Cursor-Plänen
$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Plan-Index Generator" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Pfad zum Plans-Ordner
$plansDir = "$env:USERPROFILE\.cursor\plans"
$outputFile = Join-Path $PSScriptRoot "plans-index.md"

if (-not (Test-Path $plansDir)) {
    Write-Host "Fehler: Plans-Ordner nicht gefunden: $plansDir" -ForegroundColor Red
    exit 1
}

Write-Host "Suche Plan-Dateien..." -ForegroundColor Yellow
$planFiles = Get-ChildItem -Path $plansDir -Filter "*.plan.md" | Sort-Object Name

if ($planFiles.Count -eq 0) {
    Write-Host "Keine Plan-Dateien gefunden!" -ForegroundColor Red
    exit 1
}

Write-Host "Gefunden: $($planFiles.Count) Pläne" -ForegroundColor Green
Write-Host ""

# Markdown-Inhalt erstellen
$markdown = @"
# Cursor Plans Übersicht

Diese Datei enthält Links zu allen gespeicherten Cursor-Plänen.

**Letzte Aktualisierung:** $(Get-Date -Format "dd.MM.yyyy HH:mm")

**Anzahl Pläne:** $($planFiles.Count)

---

## Alle Pläne

"@

# Für jede Plan-Datei einen Link erstellen
foreach ($planFile in $planFiles) {
    $fileName = $planFile.Name
    $filePath = $planFile.FullName
    
    # Versuche den Namen aus dem Frontmatter zu extrahieren
    $planName = $fileName
    try {
        $content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
        if ($content -match '(?m)^name:\s*(.+)$') {
            $planName = $matches[1].Trim()
        }
    } catch {
        # Falls Lesen fehlschlägt, verwende Dateinamen
    }
    
    # File-URL erstellen (Windows-kompatibel)
    $fileUrl = "file:///$($filePath.Replace('\', '/').Replace(' ', '%20'))"
    
    # Markdown-Link hinzufügen
    $markdown += "- [$planName]($fileUrl)`n"
}

$markdown += @"

---

## Hinweise

- Die Links funktionieren direkt in Cursor (Strg+Klick zum Öffnen)
- Die Dateien befinden sich in: `$plansDir`
- Um diese Liste zu aktualisieren, führe aus: `.\.cursor\generate-plans-index.ps1`

"@

# Datei schreiben
Write-Host "Schreibe Index-Datei..." -ForegroundColor Yellow
[System.IO.File]::WriteAllText($outputFile, $markdown, [System.Text.Encoding]::UTF8)

Write-Host "Index-Datei erstellt: $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Die Datei enthält $($planFiles.Count) Plan-Links." -ForegroundColor Cyan



