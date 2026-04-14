@echo off
title [DEBUG] ERP Sistema - Servidor
color 0A
echo ============================================
echo  ERP Sistema - Modo DEBUG
echo  Presiona Ctrl+C para cerrar
echo  Log tambien en: %APPDATA%\erp-sistema\erp-debug.log
echo ============================================
echo.
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_LOG_LEVEL=verbose
"D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Sistema - Servidor Admin\ERP Sistema.exe" --enable-logging --log-level=0 --remote-debugging-port=9229
echo.
echo Proceso terminado. Presiona una tecla para cerrar...
pause > nul
