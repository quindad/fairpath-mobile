# Metro for FairPath iOS development client (expo-location native module).
# Usage:  .\scripts\Start-ExpoDevClient.ps1
# iPhone: same Wi-Fi → scan QR or open exp:// URL from terminal.

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host 'Starting Expo dev client Metro on port 8083 (LAN)...' -ForegroundColor Cyan
npx expo start --dev-client --lan --port 8083
