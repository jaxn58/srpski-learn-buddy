# Git Shortcuts fuer PowerShell
function Save-GitChanges {
    param([string]$message)
    git add .
    git commit -m $message
    Write-Host "Committed: $message" -ForegroundColor Green
}

function Push-GitBranch {
    $branch = git branch --show-current
    git push origin $branch
    Write-Host "Pushed to: $branch" -ForegroundColor Green
}

function Invoke-GitQuick {
    param([string]$message)
    git add .
    git commit -m $message
    $branch = git branch --show-current
    git push origin $branch
    Write-Host "Alles erledigt!" -ForegroundColor Green
}

# Aliases setzen
Set-Alias -Name gsave -Value Save-GitChanges
Set-Alias -Name gpush -Value Push-GitBranch
Set-Alias -Name gquick -Value Invoke-GitQuick