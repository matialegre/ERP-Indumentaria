@echo off
title DEMO — Abrir Todo de una vez
color 0E
cls
echo.
echo  ==========================================
echo   DEMO ERP — ABRIENDO TODO
echo  ==========================================
echo.
echo  [1/4] Iniciando Backend...
start "Backend" cmd /k "cd /d D:\ERP MUNDO OUTDOOR\erp\backend && call venv\Scripts\activate && python -m uvicorn main:app --host 0.0.0.0 --port 8000"
timeout /t 5 /nobreak >nul

echo  [2/4] Abriendo ERP Mundo Outdoor...
start "" "D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente\ERP Mundo Outdoor - Cliente.exe"
timeout /t 2 /nobreak >nul

echo  [3/4] Abriendo ERP Montagne...
start "" "D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Montagne - Cliente\ERP Montagne.exe"
timeout /t 2 /nobreak >nul

echo  [3b] Abriendo TallerEuro...
start "" "D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\TallerEuro - Cliente\TallerEuro.exe"
timeout /t 2 /nobreak >nul

echo  [4/4] Abriendo Super Admin...
start "" cmd /c ""D:\ERP MUNDO OUTDOOR\DEMO JEFE\4 - Super Admin (Panel Maestro).bat""
timeout /t 5 /nobreak >nul

echo.
echo  ==========================================
echo   TODO ABIERTO
echo   
echo   ERP Mundo Outdoor: admin / admin
echo   ERP Montagne:      montagne / admin
echo   ERP TallerEuro:    taller / admin
echo   Super Admin:       admin1 / admin
echo   API Docs:          http://localhost:8000/docs
echo  ==========================================
pause
