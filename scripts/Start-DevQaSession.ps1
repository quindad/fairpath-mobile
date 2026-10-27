# Load DEV QA credentials into the CURRENT PowerShell session only (never writes secrets to disk).
# Usage:  . .\scripts\Start-DevQaSession.ps1
# Then:   node scripts/probe-dev-auth-personas.mjs
#         node scripts/qa-dev-jobs-housing-smoke.mjs --confirm-dev --use-documented-dev-accounts
#
# Optional: add SUPABASE_SERVICE_ROLE_KEY to .env.local for read-only probe + seed script only.
# Mutating harness qa-dev-new-member-journey.mjs still requires $env:SUPABASE_SERVICE_ROLE_KEY here.

$ErrorActionPreference = 'Stop'
Write-Host 'FairPath DEV QA — session env (secrets stay in this window only).' -ForegroundColor Cyan

function Read-SecretPlain {
  param([string]$Prompt)
  $sec = Read-Host $Prompt -AsSecureString
  [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  )
}

if (-not $env:QA_DEV_FREE_PASSWORD) {
  $env:QA_DEV_FREE_PASSWORD = Read-SecretPlain 'QA password for dev-free1@fairpath.test'
}
if (-not $env:QA_DEV_PLUS_PASSWORD) {
  $env:QA_DEV_PLUS_PASSWORD = Read-SecretPlain 'QA password for dev-plus2@fairpath.test'
}
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
  $env:SUPABASE_SERVICE_ROLE_KEY = Read-SecretPlain 'DEV SUPABASE service_role key (paste from Supabase dashboard)'
}

Write-Host 'Set QA_DEV_FREE_PASSWORD, QA_DEV_PLUS_PASSWORD, SUPABASE_SERVICE_ROLE_KEY for this session.' -ForegroundColor Green
Write-Host 'Next: node scripts/Run-DevAuthenticatedQa.mjs --confirm-dev --use-documented-dev-accounts' -ForegroundColor Yellow
