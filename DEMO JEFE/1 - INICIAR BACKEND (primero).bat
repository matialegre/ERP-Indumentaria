@echo off
title 🔧 ERP Backend — Puerto 8000
color 0A
echo ============================================
echo  PASO 1: BACKEND (dejar esta ventana abierta)
echo  http://localhost:8000/docs
echo ============================================
echo.

REM Matar cualquier proceso previo en el puerto 8000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

cd /d "D:\ERP MUNDO OUTDOOR\erp\backend"
call venv\Scripts\activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
