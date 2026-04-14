@echo off
title Mundo Outdoor ERP — Instalador
chcp 65001 > nul 2>&1

:: Lanzar el instalador PowerShell con permisos de ejecucion
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-erp.ps1"

:: Si el PS falla, mostrar error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERROR: El instalador termino con errores.
    echo  Intentalo de nuevo o contacta al administrador del sistema.
    echo.
    pause
)
