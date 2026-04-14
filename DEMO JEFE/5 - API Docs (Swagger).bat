@echo off
title API Docs — Swagger
echo Abriendo documentacion de la API...
timeout /t 1 /nobreak >nul
start "" "http://localhost:8000/docs"
