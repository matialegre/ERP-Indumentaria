@echo off
chcp 65001 >nul
title AUTO-DEPLOY Watcher — ERP Mundo Outdoor
color 0B
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║    AUTO-DEPLOY WATCHER — ERP Mundo Outdoor          ║
echo ║    Detecta cambios en frontend y despliega solo     ║
echo ╚══════════════════════════════════════════════════════╝
echo.
echo  Dejá esta ventana abierta mientras Copilot trabaja.
echo  Cuando el agente termine de editar archivos,
echo  el deploy se dispara automáticamente en ~12 segundos.
echo.
echo  Ctrl+C para detener.
echo.
cd /d "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\python.exe "D:\ERP MUNDO OUTDOOR\auto_deploy.py"
pause
