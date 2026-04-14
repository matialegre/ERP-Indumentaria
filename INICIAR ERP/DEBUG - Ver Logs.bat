@echo off
title Ver Logs del ERP
echo Abriendo logs...
if exist "%APPDATA%\erp-sistema\erp-debug.log" (
    start notepad "%APPDATA%\erp-sistema\erp-debug.log"
) else (
    echo Log del servidor no encontrado todavia
)
if exist "%APPDATA%\erp-mundo-outdoor\erp-debug.log" (
    start notepad "%APPDATA%\erp-mundo-outdoor\erp-debug.log"
)
if exist "%APPDATA%\erp-montagne\erp-debug.log" (
    start notepad "%APPDATA%\erp-montagne\erp-debug.log"
)
pause
