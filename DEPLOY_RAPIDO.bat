@echo off
chcp 65001 >nul
title DEPLOY RAPIDO — ERP Mundo Outdoor
color 0A

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║         DEPLOY RAPIDO — ERP Mundo Outdoor           ║
echo ╚══════════════════════════════════════════════════════╝
echo.

REM === Cerrar instancias del ERP que estén corriendo ===
echo [0/4] Cerrando ERP si está abierto...
powershell -NoProfile -Command "$ids = Get-Process | Where-Object { $_.Name -like '*ERP Mundo*' } | Select-Object -ExpandProperty Id; foreach($id in $ids){ Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }; Start-Sleep 1"
echo     OK

REM === Build frontend ===
echo [1/4] Compilando frontend React...
cd /d "D:\ERP MUNDO OUTDOOR\erp\frontend"
call npx vite build
if errorlevel 1 (
    echo.
    echo ERROR: vite build fallo. Revisa los errores arriba.
    pause
    exit /b 1
)
echo     OK - Frontend compilado

REM === Empaquetar Electron ===
echo [2/4] Empaquetando Electron ERP Mundo Outdoor...
cd /d "D:\ERP MUNDO OUTDOOR\erp\electron-cliente"
call node_modules\.bin\electron-packager . "ERP Mundo Outdoor - Cliente" --platform=win32 --arch=x64 --out=dist --overwrite >nul 2>&1
if errorlevel 1 (
    echo ERROR: electron-packager fallo
    pause
    exit /b 1
)
echo     OK - EXE generado

REM === Copiar a DISTRIBUIBLES ===
echo [3/4] Copiando a DISTRIBUIBLES...
set SRC=D:\ERP MUNDO OUTDOOR\erp\electron-cliente\dist\ERP Mundo Outdoor - Cliente-win32-x64
set DST=D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente
set ZIP=D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente.zip

if exist "%DST%" rmdir /s /q "%DST%"
xcopy /e /i /q "%SRC%" "%DST%" >nul
echo     OK - Carpeta actualizada

REM === Generar ZIP ===
echo [4/4] Generando ZIP para distribucion...
if exist "%ZIP%" del /f /q "%ZIP%"
powershell -NoProfile -Command "Compress-Archive -Path '%DST%\*' -DestinationPath '%ZIP%' -Force"
echo     OK - ZIP generado

REM === Reabrir ERP ===
echo.
echo Reabriendo ERP...
start "" "%DST%\ERP Mundo Outdoor - Cliente.exe"

REM === Marcar mejoras como desplegadas (notifica a los autores) ===
echo Notificando mejoras desplegadas...
powershell -NoProfile -Command "try { $body = @{secret='automator_interno_2026'; message='Tu mejora fue implementada y desplegada.'} | ConvertTo-Json; Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/api/v1/improvement-notes/internal/mark-all-deployed' -ContentType 'application/json' -Body $body | Out-Null; Write-Host '    OK - Autores notificados' } catch { Write-Host '    (Backend no disponible, se notificara luego)' }"

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  LISTO. ERP actualizado y disponible para distribuir ║
echo ╚══════════════════════════════════════════════════════╝
echo.
echo    ZIP: D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente.zip
echo.
timeout /t 5 /nobreak >nul
