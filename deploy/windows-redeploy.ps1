param(
  [Parameter(Mandatory = $true)]
  [string]$DockerHubImage,

  [int]$WebPort = 8088,

  [string]$DeployDir = "C:\xueke-practice",

  [string]$SessionDataDir = "C:/xueke-practice/session-data"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "docker was not found in PATH."
}

$composeSource = Join-Path $PSScriptRoot "docker-compose.lan.yml"
$composeTarget = Join-Path $DeployDir "docker-compose.yml"

New-Item -ItemType Directory -Force -Path $DeployDir | Out-Null
New-Item -ItemType Directory -Force -Path $SessionDataDir | Out-Null
Copy-Item -LiteralPath $composeSource -Destination $composeTarget -Force

$env:DOCKERHUB_IMAGE = $DockerHubImage
$env:WEB_PORT = [string]$WebPort
$env:SESSION_DATA_DIR = $SessionDataDir.Replace("\", "/")

Push-Location $DeployDir
try {
  docker compose pull
  docker compose up -d --remove-orphans
  docker image prune -f
  docker compose ps

  $uri = "http://127.0.0.1:$WebPort/"
  $res = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Uri $uri
  if ($res.StatusCode -lt 200 -or $res.StatusCode -ge 500) {
    throw "health check failed: $uri returned $($res.StatusCode)"
  }
  Write-Host "Deployed: $uri"
} finally {
  Pop-Location
}
