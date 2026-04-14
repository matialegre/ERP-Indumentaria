@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║   PUBLICAR NUEVA VERSION ERP                        ║
echo ║   Rebuild + Zip + Deploy automatico                 ║
echo ╚══════════════════════════════════════════════════════╝
echo.

set BASE=D:\ERP MUNDO OUTDOOR

REM === 1. Build Frontend ===
echo [1/5] Compilando frontend React...
cd /d "%BASE%\erp\frontend"
call npx vite build --silent
if errorlevel 1 ( echo ERROR: vite build fallo & pause & exit /b 1 )
echo     OK - Frontend compilado

REM === 2. Build 3 EXEs ===
echo [2/5] Compilando EXEs Electron...

cd /d "%BASE%\erp\electron-taller"
call node_modules\.bin\electron-packager . "TallerEuro" --platform=win32 --arch=x64 --out=dist --overwrite >nul 2>&1
echo     OK - TallerEuro.exe

cd /d "%BASE%\erp\electron-montagne"
call node_modules\.bin\electron-packager . "ERP Montagne" --platform=win32 --arch=x64 --out=dist --overwrite >nul 2>&1
echo     OK - ERP Montagne.exe

cd /d "%BASE%\erp\electron-cliente"
call node_modules\.bin\electron-packager . "ERP Mundo Outdoor - Cliente" --platform=win32 --arch=x64 --out=dist --overwrite >nul 2>&1
echo     OK - ERP Mundo Outdoor - Cliente.exe

REM === 3. Copiar bundles completos a DISTRIBUIBLES ===
echo [3/5] Copiando bundles Electron completos...
if exist "%BASE%\DISTRIBUIBLES\TallerEuro - Cliente" rmdir /s /q "%BASE%\DISTRIBUIBLES\TallerEuro - Cliente"
if exist "%BASE%\DISTRIBUIBLES\ERP Montagne - Cliente" rmdir /s /q "%BASE%\DISTRIBUIBLES\ERP Montagne - Cliente"
if exist "%BASE%\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente" rmdir /s /q "%BASE%\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente"
xcopy /e /i /y "%BASE%\erp\electron-taller\dist\TallerEuro-win32-x64" "%BASE%\DISTRIBUIBLES\TallerEuro - Cliente" >nul
xcopy /e /i /y "%BASE%\erp\electron-montagne\dist\ERP Montagne-win32-x64" "%BASE%\DISTRIBUIBLES\ERP Montagne - Cliente" >nul
xcopy /e /i /y "%BASE%\erp\electron-cliente\dist\ERP Mundo Outdoor - Cliente-win32-x64" "%BASE%\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente" >nul
echo     OK

REM === 4. Generar ZIPs para auto-update ===
echo [4/5] Generando ZIPs de distribucion...
powershell -Command "Compress-Archive -Path '%BASE%\DISTRIBUIBLES\TallerEuro - Cliente\*' -DestinationPath '%BASE%\DISTRIBUIBLES\TallerEuro - Cliente.zip' -Force"
powershell -Command "Compress-Archive -Path '%BASE%\DISTRIBUIBLES\ERP Montagne - Cliente\*' -DestinationPath '%BASE%\DISTRIBUIBLES\ERP Montagne - Cliente.zip' -Force"
powershell -Command "Compress-Archive -Path '%BASE%\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente\*' -DestinationPath '%BASE%\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente.zip' -Force"
echo     OK - ZIPs listos en DISTRIBUIBLES\

REM === 5. Recordatorio: bump version ===
echo [5/5] IMPORTANTE: Subir la version en el backend
echo.
echo     Abri: %BASE%\erp\backend\app\api\v1\system.py
echo     Cambia APP_VERSION = "1.0.0" por la nueva version
echo     Reinicia uvicorn para que tome el cambio
echo.
echo ══════════════════════════════════════════════════════
echo  LISTO. Los clientes seran notificados en el proximo
echo  inicio de la app y se actualizaran solos.
echo ══════════════════════════════════════════════════════
echo.
pause
