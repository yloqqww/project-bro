@echo off
title Laguna Medical Center Web Portal
echo ========================================================
echo   LAGUNA MEDICAL CENTER - HOSPITAL WEB PORTAL
echo ========================================================
echo.

cd /d "%~dp0apps\web"
set "PATH=C:\Users\Ylo\AppData\Local\hermes\node;%PATH%"
set "DATABASE_URL=postgresql://postgres.gglthwyfrevnbjfcvtms:N%%2F2p3f76Je%%3FVnNn@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
set "NEXT_IGNORE_INCORRECT_LOCKFILE=1"

echo Starting Next.js Web Server on http://localhost:3001 with Node 22 LTS...
echo.

"C:\Users\Ylo\AppData\Local\hermes\node\node.exe" ".\node_modules\next\dist\bin\next" dev -p 3001
pause
