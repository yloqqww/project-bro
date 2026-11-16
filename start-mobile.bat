@echo off
title Laguna Medical Center Patient Mobile App
echo ========================================================
echo   LAGUNA MEDICAL CENTER - PATIENT MOBILE APP
echo ========================================================
echo.

cd /d "%~dp0"
set "PATH=C:\Users\Ylo\AppData\Local\hermes\node;%PATH%"
set "REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.8"

echo Starting Expo Metro Bundler on Wi-Fi (192.168.1.8)...
echo   - Phone URL: exp://192.168.1.8:8081
echo   - Scan QR code or Enter URL Manually in Expo Go
echo.

"C:\Users\Ylo\AppData\Local\hermes\node\node.exe" ".\node_modules\expo\bin\cli" start apps/mobile --host lan
pause
