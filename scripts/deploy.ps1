<#
.SYNOPSIS
  Guild Live — one-shot deploy of backend (Functions) + frontend (SWA).

.DESCRIPTION
  Reads connection details from Terraform outputs (infra/), then:
    1. Builds + publishes the Functions app  (func azure functionapp publish)
    2. Builds the frontend with VITE_API_BASE_URL pointing at the deployed API
    3. Deploys the built frontend to Static Web Apps (swa deploy)

  Assumes Milestone 1 `terraform apply` has already run successfully.

.PREREQUISITES
  - terraform, az (logged in), node/npm
  - Azure Functions Core Tools v4   : npm i -g azure-functions-core-tools@4
  - SWA CLI                         : npm i -g @azure/static-web-apps-cli

.EXAMPLE
  ./scripts/deploy.ps1
#>
[CmdletBinding()]
param(
  [switch]$SkipBackend,
  [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$infraDir = Join-Path $repoRoot "infra"
$apiDir   = Join-Path $repoRoot "api"
$webDir   = Join-Path $repoRoot "web"

function Get-TfOutput([string]$name) {
  Push-Location $infraDir
  try {
    $val = terraform output -raw $name 2>$null
    if ([string]::IsNullOrWhiteSpace($val)) {
      throw "Terraform output '$name' is empty. Did 'terraform apply' run?"
    }
    return $val
  } finally {
    Pop-Location
  }
}

Write-Host "==> Reading Terraform outputs from $infraDir" -ForegroundColor Cyan
$funcAppName = Get-TfOutput "function_app_name"
$apiBaseUrl  = Get-TfOutput "function_app_base_url"
$swaToken    = Get-TfOutput "static_web_app_api_key"
$swaUrl      = Get-TfOutput "static_web_app_default_hostname"

Write-Host "    Function App : $funcAppName"
Write-Host "    API base URL : $apiBaseUrl"
Write-Host "    SWA URL      : $swaUrl"

# ---- Backend ----------------------------------------------------------------
if (-not $SkipBackend) {
  Write-Host "`n==> Building + publishing Functions" -ForegroundColor Cyan
  Push-Location $apiDir
  try {
    npm install
    npm run build
    # --typescript tells Core Tools to publish the compiled output.
    func azure functionapp publish $funcAppName
  } finally {
    Pop-Location
  }
} else {
  Write-Host "`n==> Skipping backend (--SkipBackend)" -ForegroundColor Yellow
}

# ---- Frontend ---------------------------------------------------------------
if (-not $SkipFrontend) {
  Write-Host "`n==> Building frontend with VITE_API_BASE_URL=$apiBaseUrl" -ForegroundColor Cyan
  Push-Location $webDir
  try {
    npm install
    $env:VITE_API_BASE_URL = $apiBaseUrl
    npm run build

    Write-Host "`n==> Deploying frontend to Static Web Apps" -ForegroundColor Cyan
    # SWA CLI deploys the built ./dist as the app artifact (env=production).
    swa deploy ./dist --deployment-token $swaToken --env production
  } finally {
    Remove-Item Env:\VITE_API_BASE_URL -ErrorAction SilentlyContinue
    Pop-Location
  }
} else {
  Write-Host "`n==> Skipping frontend (--SkipFrontend)" -ForegroundColor Yellow
}

Write-Host "`n==> Done." -ForegroundColor Green
Write-Host "    App:  $swaUrl"
Write-Host "    Host: $swaUrl/host"
Write-Host "    Join: $swaUrl/join"
Write-Host "`n    REMEMBER: run 'terraform destroy' in infra/ after the event!" -ForegroundColor Yellow
