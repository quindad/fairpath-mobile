# Regenerate iOS Ad Hoc provisioning to match full app capabilities (push + Sign in with Apple).
# Run once when `development` profile builds fail with provisioning entitlement errors.
# Usage:  .\scripts\Launch-EasIosCredentialRefresh.ps1

$repo = Split-Path -Parent $PSScriptRoot
Start-Process powershell.exe -ArgumentList @(
  '-NoExit', '-NoProfile', '-Command',
  "Set-Location -LiteralPath '$repo'; npx eas-cli@'`>=24.8.0' credentials:configure-build -p ios -e development"
)
Write-Host 'Opened EAS iOS credential setup for profile development (Apple login may be required).' -ForegroundColor Green
