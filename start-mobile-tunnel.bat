@echo off
title Laguna Medical Center Patient Mobile App (Tunnel Mode)
echo ========================================================
echo   LAGUNA MEDICAL CENTER - PATIENT MOBILE APP (TUNNEL)
echo ========================================================
echo.
echo Tunnel mode bypasses Windows Firewall and works even on Mobile Data (4G/5G)!
echo.

cd /d "%~dp0"
set "PATH=C:\Users\Ylo\AppData\Local\hermes\node;%PATH%"

"C:\Users\Ylo\AppData\Local\hermes\node\node.exe" ".\node_modules\expo\bin\cli" start apps/mobile --tunnel
pause
