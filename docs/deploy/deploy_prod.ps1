param(
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$EnvFile = ".env.production",
  [string]$HealthUrl = "https://nodus.linku.tech/api/health",
  [int]$HealthRetries = 20,
  [int]$HealthRetryDelaySeconds = 3
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[deploy] $Message"
}

if (!(Test-Path $ComposeFile)) {
  throw "Compose file not found: $ComposeFile"
}

if (!(Test-Path $EnvFile)) {
  $template = ".env.production.template"
  if (Test-Path $template) {
    Copy-Item $template $EnvFile
    throw "Missing $EnvFile. Template copied from $template. Fill required values and rerun."
  }
  throw "Missing $EnvFile. Create it before deploy."
}

Write-Step "Checking docker availability"
$null = docker --version
$null = docker compose version

Write-Step "Starting stack with build"
docker compose -f $ComposeFile --env-file $EnvFile up -d --build

Write-Step "Waiting for health endpoint: $HealthUrl"
$ok = $false
for ($i = 1; $i -le $HealthRetries; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 10
    if ($resp.StatusCode -eq 200) {
      $ok = $true
      break
    }
  }
  catch {
    Start-Sleep -Seconds $HealthRetryDelaySeconds
  }
}

if (-not $ok) {
  Write-Step "Health check failed after retries"
  docker compose -f $ComposeFile ps
  docker compose -f $ComposeFile logs --tail=120
  throw "Deployment did not become healthy"
}

Write-Step "Deployment healthy"
docker compose -f $ComposeFile ps
Write-Step "Done"
