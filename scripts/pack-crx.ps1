$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $projectRoot "dist"
$pemPath = Join-Path $projectRoot "dist.pem"

if (-not (Test-Path $distDir)) {
  throw "Missing dist folder. Run npm run build:dist first."
}
if (-not (Test-Path $pemPath)) {
  throw "Missing dist.pem key file at: $pemPath"
}

$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)

$chromeExe = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chromeExe) {
  throw "Could not find chrome.exe in standard install paths."
}

Write-Host "Packing CRX with: $chromeExe"
& $chromeExe "--pack-extension=$distDir" "--pack-extension-key=$pemPath" | Out-Null

$distCrx = Join-Path $projectRoot "dist.crx"
$builtCrx = Join-Path $projectRoot "dist.crx"
if (-not (Test-Path $builtCrx)) {
  throw "Chrome pack finished but dist.crx was not found."
}

Write-Host "Signed CRX ready: $distCrx"
