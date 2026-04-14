@echo off
:: ════════════════════════════════════════════════════════
::  ERP Mundo Outdoor — Acceso Cliente
::  Ejecutar en las PCs de los locales (NO el servidor)
::  Solo abre Chrome con la dirección correcta del ERP
:: ════════════════════════════════════════════════════════

title ERP Mundo Outdoor

:: ── Configurar dirección del servidor ──
:: Cambiá esta IP por la del servidor donde está instalado el ERP
set SERVIDOR_IP=192.168.0.122
set SERVIDOR_PUERTO=8000
set ERP_URL=http://%SERVIDOR_IP%:%SERVIDOR_PUERTO%

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       ERP MUNDO OUTDOOR                  ║
echo  ║       Conectando al servidor...          ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Verificar conectividad al servidor
ping -n 1 -w 2000 %SERVIDOR_IP% >nul 2>&1
if %errorlevel% == 0 (
    echo  ✔ Servidor encontrado en %SERVIDOR_IP%
    echo  Abriendo ERP...
    echo.
) else (
    echo  ⚠ No se encontró el servidor en %SERVIDOR_IP%
    echo.
    echo  El ERP puede funcionar en MODO OFFLINE con datos del cache.
    echo  Asegurate de que el servidor esté encendido para sincronizar datos.
    echo.
    pause
)

:: Buscar Chrome instalado
set CHROME=""
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"
)

:: Buscar Edge como alternativa
if %CHROME%=="" (
    if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
        set CHROME="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
    )
)

if %CHROME%=="" (
    echo  ✘ No se encontró Chrome ni Edge.
    echo  Instalá Google Chrome desde: https://www.google.com/chrome
    pause
    exit /b 1
)

:: Abrir en modo "app" (sin barra de Chrome) — se ve como app nativa
start "" %CHROME% --app=%ERP_URL% --window-size=1280,800 --disable-extensions

echo  ✔ ERP abierto
timeout /t 2 >nul
