# Start Laguna Medical Center Patient Mobile App
# Run this with: .\start-mobile.ps1

Set-Location $PSScriptRoot

Write-Host "Starting Laguna Medical Center Patient Mobile App..." -ForegroundColor Cyan

$node22 = "C:\Users\Ylo\AppData\Local\hermes\node\node.exe"

if (Test-Path $node22) {
    $env:PATH = "C:\Users\Ylo\AppData\Local\hermes\node;" + $env:PATH
}

$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.8"

Write-Host "Running Expo Metro Bundler on Wi-Fi (192.168.1.8)..." -ForegroundColor Green
Write-Host "In Expo Go: Scan QR code or enter URL: exp://192.168.1.8:8081" -ForegroundColor Yellow

npx expo start apps/mobile --host lan
