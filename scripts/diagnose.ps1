<#
.SYNOPSIS
  Diagnose a deployed Guild Live "internal error" on Create session.
  Checks: app settings present, Cosmos DB + containers exist, live endpoint detail.
  Run from a shell where `az` and `terraform` work, after `terraform apply`.
#>
$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot
$infraDir = Join-Path $repoRoot "infra"

Push-Location $infraDir
$rg          = terraform output -raw resource_group_name
$funcName    = terraform output -raw function_app_name
$apiBase     = terraform output -raw function_app_base_url
$cosmosAcct  = terraform output -raw cosmos_account_name
$cosmosDb    = terraform output -raw cosmos_database_name
Pop-Location

Write-Host "RG=$rg  Func=$funcName  Cosmos=$cosmosAcct/$cosmosDb`n" -ForegroundColor Cyan

Write-Host "== 1. Function App settings (Cosmos/WebPubSub present?) ==" -ForegroundColor Cyan
az functionapp config appsettings list -g $rg -n $funcName `
  --query "[?name=='COSMOS_CONNECTION_STRING' || name=='COSMOS_DATABASE_NAME' || name=='WEBPUBSUB_CONNECTION_STRING' || name=='WEBPUBSUB_HUB_NAME' || name=='FUNCTIONS_WORKER_RUNTIME'].{name:name, set:(value!='')}" `
  -o table

Write-Host "`n== 2. Cosmos database exists? ==" -ForegroundColor Cyan
az cosmosdb sql database show -g $rg -a $cosmosAcct -n $cosmosDb --query "id" -o tsv 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  !! Database '$cosmosDb' NOT found" -ForegroundColor Red }

Write-Host "`n== 3. Cosmos containers exist? ==" -ForegroundColor Cyan
az cosmosdb sql container list -g $rg -a $cosmosAcct -d $cosmosDb --query "[].id" -o tsv 2>$null

Write-Host "`n== 4. Live Create session (shows real error detail) ==" -ForegroundColor Cyan
try {
  $resp = Invoke-WebRequest -Method POST -Uri "$apiBase/api/session" -UseBasicParsing
  Write-Host "  HTTP $($resp.StatusCode): $($resp.Content)" -ForegroundColor Green
} catch {
  $r = $_.Exception.Response
  if ($r) {
    $reader = New-Object System.IO.StreamReader($r.GetResponseStream())
    Write-Host "  HTTP $([int]$r.StatusCode): $($reader.ReadToEnd())" -ForegroundColor Yellow
  } else {
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
  }
}
