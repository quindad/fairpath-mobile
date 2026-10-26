# Opens a dedicated interactive PowerShell window for DEV QA credentials + full authenticated suite.
# Secrets stay in that window only (not written to disk).
# Usage (from any terminal):  .\scripts\Launch-DevQaCredentialWindow.ps1

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$inner = @"
Set-Location -LiteralPath '$repo'
Write-Host 'FairPath DEV QA — enter credentials when prompted (nothing saved to disk).' -ForegroundColor Cyan
. .\scripts\Start-DevQaSession.ps1
node scripts/Run-DevAuthenticatedQa.mjs --confirm-dev --use-documented-dev-accounts
Write-Host ''
Write-Host 'Authenticated QA finished. Result JSON files are in the repo root (qa-dev-*.json).' -ForegroundColor Green
Write-Host 'Leave this window open if you will run EAS/Metro from here next.' -ForegroundColor Yellow
"@

Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit', '-NoProfile', '-Command', $inner
Write-Host 'Opened a new PowerShell window for secure DEV QA. Complete the three prompts there.' -ForegroundColor Green
