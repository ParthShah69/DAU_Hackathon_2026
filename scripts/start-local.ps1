param(
  [int]$ApiPort = 8080,
  [int]$WebPort = 4173,
  [ValidateSet('ollama', 'heuristic')]
  [string]$AssistantProvider = 'ollama',
  [string]$OllamaModel = 'qwen3:4b',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $repoRoot 'tmp'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Test-ListeningPort([int]$Port) {
  return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

foreach ($port in @($ApiPort, $WebPort)) {
  if ((Test-ListeningPort $port) -and -not $Force) {
    throw "Port $port is already in use. Stop its process or choose another port (for example -ApiPort 8081)."
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 20 or newer is required but was not found on PATH.'
}

$previousPort = $env:PORT
$previousApiOrigin = $env:API_ORIGIN
$previousAssistantProvider = $env:ASSISTANT_PROVIDER
$previousOllamaModel = $env:OLLAMA_MODEL
$previousOllamaTimeout = $env:OLLAMA_TIMEOUT_MS
try {
  $env:PORT = "$ApiPort"
  $env:ASSISTANT_PROVIDER = $AssistantProvider
  $env:OLLAMA_MODEL = $OllamaModel
  $env:OLLAMA_TIMEOUT_MS = '45000'
  $api = Start-Process -FilePath node -ArgumentList 'apps/api/src/server.js' -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'api-local.log') -RedirectStandardError (Join-Path $runtimeDir 'api-local.err.log') -PassThru

  $env:PORT = "$WebPort"
  $env:API_ORIGIN = "http://127.0.0.1:$ApiPort"
  $web = Start-Process -FilePath node -ArgumentList 'apps/web/server.mjs' -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'web-local.log') -RedirectStandardError (Join-Path $runtimeDir 'web-local.err.log') -PassThru
} finally {
  $env:PORT = $previousPort
  $env:API_ORIGIN = $previousApiOrigin
  $env:ASSISTANT_PROVIDER = $previousAssistantProvider
  $env:OLLAMA_MODEL = $previousOllamaModel
  $env:OLLAMA_TIMEOUT_MS = $previousOllamaTimeout
}

Start-Sleep -Milliseconds 700
try {
  Invoke-WebRequest "http://127.0.0.1:$ApiPort/healthz" -UseBasicParsing -TimeoutSec 5 | Out-Null
  Invoke-WebRequest "http://127.0.0.1:$WebPort/marketplace?api=/api/v1&user=user-buyer" -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {
  throw "A local process did not become healthy. See $runtimeDir for logs. $($_.Exception.Message)"
}

Write-Host "API process: $($api.Id)  http://127.0.0.1:$ApiPort"
Write-Host "Web process: $($web.Id)  http://127.0.0.1:$WebPort"
Write-Host "Assistant: $AssistantProvider ($OllamaModel when Ollama is available; deterministic fallback otherwise)"
Write-Host "Open: http://127.0.0.1:$WebPort/marketplace?api=/api/v1&user=user-buyer"
