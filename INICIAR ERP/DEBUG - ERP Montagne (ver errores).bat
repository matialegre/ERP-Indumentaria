@echo off
title [DEBUG] ERP Montagne - Cliente
color 0E
echo ============================================
echo  ERP Montagne - Modo DEBUG
echo  Log en: %APPDATA%\erp-montagne\erp-debug.log
echo ============================================
echo.
set ELECTRON_ENABLE_LOGGING=1
"D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Montagne - Cliente\ERP Montagne.exe" --enable-logging --log-level=0 --remote-debugging-port=9231
echo.
pause > nul
