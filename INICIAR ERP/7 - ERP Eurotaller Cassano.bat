@echo off
title ERP Eurotaller Cassano
color 6F
cd /d "D:\ERP MUNDO OUTDOOR\eurotaller-cassano"
echo ============================================
echo  ERP Eurotaller Cassano
echo  http://localhost:5175
echo  Login: admin / admin
echo ============================================
echo.
start http://localhost:5175
npx vite preview --port 5175 --host 0.0.0.0
pause
