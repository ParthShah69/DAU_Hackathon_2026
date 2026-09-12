param(
  [int]$ApiPort = 8080,
  [int]$WebPort = 4173,
  [string]$TunnelName = 'carbonbridge-local'
)

$ErrorActionPreference = 'Stop'

# A VS Code tunnel authenticates the machine. Port visibility is selected in
# vscode.dev after the user signs in; this script deliberately does not make a
# demo service public without that explicit choice.
& (Join-Path $PSScriptRoot 'start-local.ps1') -ApiPort $ApiPort -WebPort $WebPort

if (-not (Get-Command code -ErrorAction SilentlyContinue)) {
  throw 'The VS Code command-line launcher (code) is not on PATH. In VS Code, run “Shell Command: Install code command in PATH”, then rerun this script.'
}

Write-Host ''
Write-Host 'Starting VS Code Tunnel. Complete the displayed Microsoft or GitHub device sign-in yourself.'
Write-Host "After it connects, open the tunnel in vscode.dev, go to PORTS, forward port $WebPort, and set Port Visibility to Public."
Write-Host 'Copy the generated public forwarding URL from the PORTS panel; it is created only after your authenticated visibility choice.'
& code tunnel --name $TunnelName --accept-server-license-terms
