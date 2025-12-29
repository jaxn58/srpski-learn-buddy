# Development Server mit TTS Support
# Startet sowohl Vite (Frontend) als auch Express (Backend mit TTS)

Write-Host "Starting Development Servers..." -ForegroundColor Green
Write-Host "- Express (Backend/TTS): http://localhost:3001" -ForegroundColor Cyan
Write-Host "- Vite (Frontend): http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

# Start Express Server in a new process
$expressProcess = Start-Process -FilePath "pnpm" -ArgumentList "dev:server" -PassThru -NoNewWindow

# Wait for Express to start
Write-Host "Waiting for Express server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Check if Express is running
$portOpen = Test-NetConnection -ComputerName localhost -Port 3001 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($portOpen) {
    Write-Host "✓ Express server started successfully on port 3001" -ForegroundColor Green
} else {
    Write-Host "✗ Express server failed to start on port 3001" -ForegroundColor Red
    Write-Host "  Please check the error messages above" -ForegroundColor Yellow
}

Write-Host ""

# Start Vite in foreground (this blocks)
try {
    pnpm dev
} finally {
    # Cleanup: Stop Express server when Vite stops
    Write-Host "`nStopping Express server..." -ForegroundColor Yellow
    if ($expressProcess -and !$expressProcess.HasExited) {
        Stop-Process -Id $expressProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "All servers stopped." -ForegroundColor Green
}






