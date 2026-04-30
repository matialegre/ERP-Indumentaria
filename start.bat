@echo off
chcp 65001 > nul
title ERP Mundo Outdoor — Arranque del sistema

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║         ERP MUNDO OUTDOOR — Iniciando sistema            ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM ── Verificar que PostgreSQL esté accesible ────────────────────────────────
echo [1/4] Verificando PostgreSQL en puerto 2048...
powershell -NoProfile -Command "try { $tcp = New-Object Net.Sockets.TcpClient; $tcp.Connect('localhost', 2048); $tcp.Close(); Write-Host '       OK - PostgreSQL responde' -ForegroundColor Green } catch { Write-Host '       ERROR - PostgreSQL no responde en :2048. Asegurate de que el servicio esté corriendo.' -ForegroundColor Red; pause; exit 1 }"

echo.

REM ── Levantar Backend ──────────────────────────────────────────────────────
echo [2/4] Levantando backend FastAPI en puerto 8001...

REM Verificar si ya está corriendo en 8001
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8001/api/v1/health' -TimeoutSec 2 -UseBasicParsing; Write-Host '       Ya estaba corriendo en :8001 — OK' -ForegroundColor Yellow } catch { Write-Host '       Iniciando nuevo proceso en :8001...' -ForegroundColor Cyan; Start-Process cmd -ArgumentList '/k title Backend ERP :8001 ^& cd /d ""D:\ERP MUNDO OUTDOOR\erp\backend"" ^& .\venv\Scripts\activate ^& python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001' -WindowStyle Normal }"

REM Esperar a que el backend esté listo (hasta 15s)
echo       Esperando que el backend responda...
powershell -NoProfile -Command "
$ok = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:8001/api/v1/health' -TimeoutSec 1 -UseBasicParsing
        Write-Host '       Backend listo!' -ForegroundColor Green
        $ok = $true
        break
    } catch {}
}
if (-not $ok) { Write-Host '       ADVERTENCIA: backend tardó más de 15s' -ForegroundColor Yellow }
"

echo.

REM ── Levantar Frontend ERP ─────────────────────────────────────────────────
echo [3/4] Levantando frontend ERP (React/Vite)...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5174/' -TimeoutSec 1 -UseBasicParsing; Write-Host '       Ya estaba corriendo en :5174 — OK' -ForegroundColor Yellow } catch { try { $r = Invoke-WebRequest -Uri 'http://localhost:5173/' -TimeoutSec 1 -UseBasicParsing; Write-Host '       Ya estaba corriendo en :5173 — OK' -ForegroundColor Yellow } catch { Write-Host '       Iniciando en segundo plano...' -ForegroundColor Cyan; Start-Process cmd -ArgumentList '/k title Frontend ERP :5174 ^& cd /d ""D:\ERP MUNDO OUTDOOR\erp\frontend"" ^& node_modules\.bin\vite --port 5174 --host' -WindowStyle Normal } }"

echo.

REM ── Esperar un momento y abrir el browser ─────────────────────────────────
echo [4/4] Abriendo browser...
timeout /t 3 /nobreak > nul

REM Intentar abrir en el puerto donde esté corriendo el frontend
powershell -NoProfile -Command "
$port = 5174
try { Invoke-WebRequest -Uri 'http://localhost:5174/' -TimeoutSec 1 -UseBasicParsing > $null } catch { $port = 5173 }
Start-Process ""http://localhost:$port""
Write-Host ""       Browser abierto en http://localhost:$port"" -ForegroundColor Green
"

REM ── Mostrar resumen ───────────────────────────────────────────────────────
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                   SISTEMA INICIADO                       ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║  Backend API    →  http://localhost:8001                 ║
echo ║  Swagger/Docs   →  http://localhost:8001/docs            ║
echo ║  Frontend ERP   →  http://localhost:5174                 ║
echo ║                                                          ║
echo ║  Usuario admin: admin / MundoAdmin2026!                  ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║  Para tests:                                             ║
echo ║    cd erp\backend                                        ║
echo ║    .\venv\Scripts\activate                               ║
echo ║    .\venv\Scripts\pytest tests_minimal.py -v             ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Presioná cualquier tecla para cerrar esta ventana...
echo (el backend y frontend siguen corriendo en sus ventanas)
pause > nul
