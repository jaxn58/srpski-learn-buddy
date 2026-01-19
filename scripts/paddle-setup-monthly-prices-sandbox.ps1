$ErrorActionPreference = "Stop"

<#
Paddle Sandbox: Create Monthly Recurring Prices (PowerShell)

Prerequisites:
  - PowerShell 7+ recommended (Windows PowerShell 5.1 usually works too)
  - Environment variable PADDLE_API_KEY set to your Paddle SANDBOX API key

Usage (PowerShell):
  $env:PADDLE_API_KEY = "<your-sandbox-api-key>"
  pwsh -File scripts/paddle-setup-monthly-prices-sandbox.ps1

Notes:
  - This script targets Paddle Sandbox API: https://sandbox-api.paddle.com
  - It creates MONTHLY recurring prices in EUR with fixed monthly amounts:
      Intensive: 25.99
      Balanced:  14.99
      Standard:  11.99
      Relaxed:   10.99
#>

$PaddleApiKey = $env:PADDLE_API_KEY
if ([string]::IsNullOrWhiteSpace($PaddleApiKey)) {
  Write-Error "PADDLE_API_KEY environment variable is not set. In PowerShell: `$env:PADDLE_API_KEY = '<your-sandbox-api-key>'"
}

$BaseUrl = "https://sandbox-api.paddle.com"

function Invoke-PaddleApi {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("GET","POST")][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $false)]$Body
  )

  $headers = @{
    "Authorization" = "Bearer $PaddleApiKey"
    "Accept"        = "application/json"
  }

  $uri = "$BaseUrl$Path"

  if ($Method -eq "GET") {
    return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
  }

  $json = $null
  if ($null -ne $Body) {
    $json = ($Body | ConvertTo-Json -Depth 10)
  }

  return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body $json
}

Write-Host "Fetching active products from Paddle Sandbox..." -ForegroundColor Yellow
$productsResp = Invoke-PaddleApi -Method "GET" -Path "/products?status=active"

if ($null -eq $productsResp -or $null -eq $productsResp.data) {
  Write-Error "Unexpected response from /products. Raw response: $($productsResp | ConvertTo-Json -Depth 10)"
}

$products = @($productsResp.data)
if ($products.Count -eq 0) {
  Write-Error "No active products found in Paddle Sandbox. Create products first in Paddle Dashboard."
}

Write-Host ""
Write-Host "Active products:" -ForegroundColor Green
$products | ForEach-Object {
  Write-Host "  $($_.id) - $($_.name)"
}

Write-Host ""
Write-Host "Enter the 4 Product IDs to attach monthly prices to:" -ForegroundColor Yellow
$ProductIdIntensive = Read-Host "Intensive Product ID (pro_...)"
$ProductIdBalanced  = Read-Host "Balanced Product ID (pro_...)"
$ProductIdStandard  = Read-Host "Standard Product ID (pro_...)"
$ProductIdRelaxed   = Read-Host "Relaxed Product ID (pro_...)"

function Create-MonthlyPrice {
  param(
    [Parameter(Mandatory = $true)][string]$ProductId,
    [Parameter(Mandatory = $true)][string]$Amount, # e.g. "25.99"
    [Parameter(Mandatory = $true)][string]$Description
  )

  $payload = @{
    product_id    = $ProductId
    description   = $Description
    billing_cycle = @{
      interval  = "month"
      frequency = 1
    }
    unit_price    = @{
      amount        = $Amount
      currency_code = "EUR"
    }
    quantity      = @{
      minimum = 1
      maximum = 1
    }
  }

  $resp = Invoke-PaddleApi -Method "POST" -Path "/prices" -Body $payload

  $priceId = $resp.data.id
  if ([string]::IsNullOrWhiteSpace($priceId)) {
    Write-Error "Failed to create price for '$Description'. Raw response: $($resp | ConvertTo-Json -Depth 10)"
  }

  Write-Host "[OK] Created: $Description" -ForegroundColor Green
  Write-Host "  Price ID: $priceId"
  Write-Host "  Amount:  $Amount EUR / month"
  Write-Host ""

  return $priceId
}

Write-Host ""
Write-Host "Creating monthly recurring prices (EUR)..." -ForegroundColor Yellow
Write-Host ""

$PriceIdIntensive = Create-MonthlyPrice -ProductId $ProductIdIntensive -Amount "25.99" -Description "Intensive - Monthly (3 months)"
$PriceIdBalanced  = Create-MonthlyPrice -ProductId $ProductIdBalanced  -Amount "14.99" -Description "Balanced - Monthly (6 months)"
$PriceIdStandard  = Create-MonthlyPrice -ProductId $ProductIdStandard  -Amount "11.99" -Description "Standard - Monthly (9 months)"
$PriceIdRelaxed   = Create-MonthlyPrice -ProductId $ProductIdRelaxed   -Amount "10.99" -Description "Relaxed - Monthly (12 months)"

Write-Host "========================================" -ForegroundColor Green
Write-Host "[OK] All monthly prices created successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Add these to Convex Dev environment variables (reminiscent-panda-57):" -ForegroundColor Yellow
Write-Host ""
Write-Host "PADDLE_PRODUCT_INTENSIVE_MONTHLY=$PriceIdIntensive"
Write-Host "PADDLE_PRODUCT_BALANCED_MONTHLY=$PriceIdBalanced"
Write-Host "PADDLE_PRODUCT_STANDARD_MONTHLY=$PriceIdStandard"
Write-Host "PADDLE_PRODUCT_RELAXED_MONTHLY=$PriceIdRelaxed"
Write-Host ""
