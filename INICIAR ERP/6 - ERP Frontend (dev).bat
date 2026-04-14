@echo off
title ERP Frontend (dev)
cd /d "D:\ERP MUNDO OUTDOOR\erp\frontend"
start http://localhost:5174
npx vite --host --port 5174
pause
