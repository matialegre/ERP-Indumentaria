@echo off
:: ════════════════════════════════════════════════════════
::  ERP Mundo Outdoor — Arranque Manual del Servidor
::  Solo ejecutar en la PC SERVIDOR
:: ════════════════════════════════════════════════════════

title ERP Mundo Outdoor - Servidor

cd /d "D:\ERP MUNDO OUTDOOR\erp\backend"

echo.
echo  Iniciando ERP Mundo Outdoor...
echo  Puerto: 8000
echo.
echo  Para detener: cerrar esta ventana
echo  ────────────────────────────────────────
echo.

call venv\Scripts\activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000

echo.
echo  El servidor se detuvo.
pause
