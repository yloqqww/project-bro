# Start Development Server with Node 22 LTS
# Run this with: .\start-dev.ps1

Write-Host "🚀 Starting Clinic Management Web Portal..." -ForegroundColor Cyan
Write-Host ""

$node22 = "C:\Users\Ylo\AppData\Local\hermes\node\node.exe"

if (Test-Path $node22) {
    Write-Host "✅ Using Node 22 LTS ($node22)" -ForegroundColor Green
    $env:PATH = "C:\Users\Ylo\AppData\Local\hermes\node;" + $env:PATH
} else {
    $node22 = "node"
}

# Next.js and Prisma load DATABASE_URL from the project .env file.
$env:NEXT_IGNORE_INCORRECT_LOCKFILE = "1"

Write-Host ""
Write-Host "Web Portal will be ready at:" -ForegroundColor Yellow
Write-Host "  - Web Portal: http://localhost:3001" -ForegroundColor Cyan
Write-Host "  - Login:      http://localhost:3001/login" -ForegroundColor Cyan
Write-Host ""

# Run from the workspace root because dependencies are hoisted there.
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot
& npm.cmd run dev --workspace=@clinic/web

