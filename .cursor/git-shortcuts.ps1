# Git Shortcuts fuer PowerShell
function git-save {
    param([string]$message)
    git add .
    git commit -m $message
    Write-Host "Committed: $message" -ForegroundColor Green
}

function git-pushup {
    $branch = git branch --show-current
    git push origin $branch
    Write-Host "Pushed to: $branch" -ForegroundColor Green
}

function git-quick {
    param([string]$message)
    git add .
    git commit -m $message
    $branch = git branch --show-current
    git push origin $branch
    Write-Host "Alles erledigt!" -ForegroundColor Green
}

# Aliases setzen
Set-Alias -Name gsave -Value git-save
Set-Alias -Name gpush -Value git-pushup
Set-Alias -Name gquick -Value git-quick