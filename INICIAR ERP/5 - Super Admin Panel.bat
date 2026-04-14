@echo off
title Super Admin Panel - SOLO MATIAS
color 4F
echo ============================================
echo  SUPER ADMIN PANEL - Solo para el duenio
echo  http://localhost:5180
echo ============================================
echo.
echo  Cerrando preview anterior...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$procIds = Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($procId in $procIds) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }"
cd /d "D:\ERP MUNDO OUTDOOR\super-admin"
echo  Recompilando Super Admin...
call npm run build
if errorlevel 1 goto :error
start "Super Admin Preview" cmd /k "cd /d D:\ERP MUNDO OUTDOOR\super-admin && npm run preview -- --port 5180 --host 127.0.0.1"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5180/?v=%RANDOM%"
exit /b 0

:error
echo.
echo  ERROR: no se pudo compilar Super Admin.
pause
