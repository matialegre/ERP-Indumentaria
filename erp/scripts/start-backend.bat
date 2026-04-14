@echo off
title ERP Backend Server
color 0A

echo ================================
echo   ERP Sistema - Backend Server  
echo   Puerto: 8000
echo ================================
echo.

cd /d "%~dp0..\backend"

:: Verificar si ya esta corriendo
netstat -an | findstr ":8000 " | findstr LISTENING > nul
if %errorlevel% == 0 (
    echo [OK] Backend ya esta corriendo en puerto 8000
    echo      No se iniciara otra instancia.
    echo.
    pause
    exit /b 0
)

echo [INFO] Iniciando backend...
echo.

:: Activar venv e iniciar
call venv\Scripts\activate.bat
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1

pause
