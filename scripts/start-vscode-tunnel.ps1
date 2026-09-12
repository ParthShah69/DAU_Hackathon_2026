param(
  [int]$ApiPort = 8080,
  [int]$WebPort = 4173,
  [string]$TunnelName = 'carbonbridge-local'
)

$ErrorActionPreference = 'Stop'

# A VS Code tunnel authenticates the machine. Port visibility is selected in
# vscode.dev after the user signs in; this script deliberately does not make a
# demo service public without that explicit choice.
function Test-LocalService([int]$Port, [string]$Path) {
  try {
    Invoke-WebRequest "http://127.0.0.1:$Port$Path" -UseBasicParsing -TimeoutSec 3 | Out-Null
    return $true
  } catch {
    return $false
  }
}

$apiReady = Test-LocalService $ApiPort '/healthz'
$webReady = Test-LocalService $WebPort '/'
if ($apiReady -and $webReady) {
  Write-Host "Reusing healthy CarbonBridge services on API $ApiPort and web $WebPort."
} elseif (-not $apiReady -and -not $webReady) {
  & (Join-Path $PSScriptRoot 'start-local.ps1') -ApiPort $ApiPort -WebPort $WebPort
} else {
  throw "Only one expected service is running (API=$apiReady, web=$webReady). Stop it or start both services with scripts/start-local.ps1 before opening a tunnel."
}

if (-not (Get-Command code -ErrorAction SilentlyContinue)) {
  throw 'The VS Code command-line launcher (code) is not on PATH. In VS Code, run “Shell Command: Install code command in PATH”, then rerun this script.'
}

Write-Host ''
Write-Host 'Starting VS Code Tunnel. Complete the displayed Microsoft or GitHub device sign-in yourself.'
Write-Host "After it connects, open the tunnel in vscode.dev, go to PORTS, forward port $WebPort, and set Port Visibility to Public."
Write-Host 'Copy the generated public forwarding URL from the PORTS panel; it is created only after your authenticated visibility choice.'
& code tunnel --name $TunnelName --accept-server-license-terms
