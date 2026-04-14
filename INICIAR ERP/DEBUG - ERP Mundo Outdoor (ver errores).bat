@echo off
title [DEBUG] ERP Mundo Outdoor - Cliente
color 0B
echo ============================================
echo  ERP Mundo Outdoor - Modo DEBUG
echo  Log en: %APPDATA%\erp-mundo-outdoor\erp-debug.log
echo ============================================
echo.
set ELECTRON_ENABLE_LOGGING=1
"D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente\ERP Mundo Outdoor.exe" --enable-logging --log-level=0 --remote-debugging-port=9230
echo.
pause > nul
