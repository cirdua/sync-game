<#
.SYNOPSIS
  Generate api/local.settings.json from Terraform outputs so the backend can run
  locally against the real Azure Cosmos + Web PubSub (Milestone 2 local testing).

.EXAMPLE
  ./scripts/setup-local.ps1
#>
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$infraDir = Join-Path $repoRoot "infra"
$target   = Join-Path $repoRoot "api/local.settings.json"

Push-Location $infraDir
try {
  $json = terraform output -raw functions_local_settings
  if ([string]::IsNullOrWhiteSpace($json)) {
    throw "terraform output 'functions_local_settings' is empty. Run 'terraform apply' first."
  }
  $json | Out-File -FilePath $target -Encoding utf8 -NoNewline
  Write-Host "Wrote $target" -ForegroundColor Green
} finally {
  Pop-Location
}
