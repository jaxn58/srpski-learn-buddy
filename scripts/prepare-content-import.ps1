# Script to remove _id fields from JSONL files for clean import
# This prevents ID conflicts when importing from Dev to Prod

Write-Host "Preparing content tables for import..." -ForegroundColor Cyan
Write-Host ""

$tables = @(
    "emailTemplates",
    "unitMetadata",
    "unitContent",
    "courseVocabulary",
    "moduleMetadata",
    "unitInteractiveTests"
)

foreach ($table in $tables) {
    $inputFile = "dev-backup/$table/documents.jsonl"
    $outputFile = "dev-backup/$table/documents-no-ids.jsonl"
    
    if (Test-Path $inputFile) {
        Write-Host "Processing $table..." -ForegroundColor Yellow
        
        Get-Content $inputFile | ForEach-Object {
            $obj = $_ | ConvertFrom-Json
            $obj.PSObject.Properties.Remove('_id')
            $obj | ConvertTo-Json -Compress -Depth 100
        } | Set-Content $outputFile
        
        Write-Host "  Created $outputFile" -ForegroundColor Green
    }
    else {
        Write-Host "  $inputFile not found, skipping..." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "All files prepared!" -ForegroundColor Green





