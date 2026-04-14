@echo off
title ERP Backend (FastAPI)
cd /d "D:\ERP MUNDO OUTDOOR\erp\backend"
call venv\Scripts\activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
