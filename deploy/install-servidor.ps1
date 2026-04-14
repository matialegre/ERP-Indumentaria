#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instalador automático del ERP Mundo Outdoor — PC Servidor
    
.DESCRIPTION
    Instala todas las dependencias y configura el ERP para correr 
    automáticamente en la PC servidor (la que tiene la base de datos).
    
    Ejecutar con: PowerShell como Administrador
    
.NOTES
    Requisitos: Windows 10/11, 8GB+ RAM, conexión a internet para descargar
#>

$ErrorActionPreference = "Stop"

# ═══════════════════════════════════════════════════════
#  CONFIGURACIÓN
# ═══════════════════════════════════════════════════════
$ERP_DIR    = "D:\ERP MUNDO OUTDOOR"
$BACKEND    = "$ERP_DIR\erp\backend"
$FRONTEND   = "$ERP_DIR\erp\frontend"
$LOG_FILE   = "$ERP_DIR\deploy\install.log"
$PG_PORT    = 2048
$PG_DB      = "erp_mundooutdoor"
$PG_USER    = "erp_user"
$PG_PASS    = "MundoOutdoor2026!"
$API_PORT   = 8000

# Versiones requeridas
$NODE_VERSION = "22.13.1"
$PG_VERSION   = "16"

# ═══════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════
function Write-Step($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "`n[$ts] ► $msg" -ForegroundColor Cyan
    "[$ts] $msg" | Out-File $LOG_FILE -Append
}

function Write-OK($msg) {
    Write-Host "  ✔ $msg" -ForegroundColor Green
    "  OK: $msg" | Out-File $LOG_FILE -Append
}

function Write-Warn($msg) {
    Write-Host "  ⚠ $msg" -ForegroundColor Yellow
    "  WARN: $msg" | Out-File $LOG_FILE -Append
}

function Write-Fail($msg) {
    Write-Host "  ✘ $msg" -ForegroundColor Red
    "  ERROR: $msg" | Out-File $LOG_FILE -Append
    throw $msg
}

function Test-Command($cmd) {
    return !!(Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Download-File($url, $dest) {
    Write-Host "    Descargando $(Split-Path $url -Leaf)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
}

# ═══════════════════════════════════════════════════════
#  INICIO
# ═══════════════════════════════════════════════════════
Clear-Host
Write-Host @"
╔═══════════════════════════════════════════════════════╗
║      ERP MUNDO OUTDOOR — Instalador del Servidor      ║
║      Versión 1.0 — Requiere Administrador             ║
╚═══════════════════════════════════════════════════════╝
"@ -ForegroundColor Blue

New-Item -ItemType Directory -Path (Split-Path $LOG_FILE) -Force | Out-Null
"=== Instalación iniciada $(Get-Date) ===" | Out-File $LOG_FILE

# ═══════════════════════════════════════════════════════
#  PASO 1: Verificar/instalar Chocolatey
# ═══════════════════════════════════════════════════════
Write-Step "1/8 — Gestor de paquetes (Chocolatey)"
if (!(Test-Command choco)) {
    Write-Host "  Instalando Chocolatey..." -ForegroundColor Gray
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    # Refrescar PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    Write-OK "Chocolatey instalado"
} else {
    Write-OK "Chocolatey ya instalado ($(choco --version))"
}

# ═══════════════════════════════════════════════════════
#  PASO 2: Verificar/instalar Python 3.12
# ═══════════════════════════════════════════════════════
Write-Step "2/8 — Python 3.12"
$pythonOK = $false
try {
    $pyVer = python --version 2>&1
    if ($pyVer -match "3\.(1[2-9]|[2-9]\d)") {
        Write-OK "Python ya instalado: $pyVer"
        $pythonOK = $true
    }
} catch {}

if (!$pythonOK) {
    choco install python312 -y --no-progress
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    Write-OK "Python 3.12 instalado"
}

# ═══════════════════════════════════════════════════════
#  PASO 3: Verificar/instalar Node.js
# ═══════════════════════════════════════════════════════
Write-Step "3/8 — Node.js"
$nodeOK = $false
try {
    $nodeVer = node --version 2>&1
    if ($nodeVer -match "v(1[6-9]|[2-9]\d)") {
        Write-OK "Node.js ya instalado: $nodeVer"
        $nodeOK = $true
    }
} catch {}

if (!$nodeOK) {
    choco install nodejs-lts -y --no-progress
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    Write-OK "Node.js instalado"
}

# ═══════════════════════════════════════════════════════
#  PASO 4: Verificar/instalar PostgreSQL
# ═══════════════════════════════════════════════════════
Write-Step "4/8 — PostgreSQL (puerto $PG_PORT)"
$pgOK = $false
try {
    $pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if ($pgSvc) {
        Write-OK "PostgreSQL servicio encontrado: $($pgSvc.Name)"
        $pgOK = $true
    }
} catch {}

if (!$pgOK) {
    Write-Host "  Instalando PostgreSQL 16..." -ForegroundColor Gray
    choco install postgresql16 --params "/Password:$PG_PASS /Port:$PG_PORT" -y --no-progress
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    Start-Sleep -Seconds 5
    Write-OK "PostgreSQL instalado en puerto $PG_PORT"
}

# Agregar psql al PATH si no está
$pgBin = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter "bin" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgBin -and $env:PATH -notlike "*$($pgBin.FullName)*") {
    $env:PATH += ";$($pgBin.FullName)"
    [Environment]::SetEnvironmentVariable("PATH", $env:PATH, "Machine")
}

# ═══════════════════════════════════════════════════════
#  PASO 5: Crear base de datos y usuario
# ═══════════════════════════════════════════════════════
Write-Step "5/8 — Base de datos PostgreSQL"
$env:PGPASSWORD = $PG_PASS

try {
    # Esperar que PostgreSQL arranque
    $retries = 0
    do {
        Start-Sleep -Seconds 2
        $pgReady = psql -h localhost -p $PG_PORT -U postgres -c "SELECT 1" 2>&1
        $retries++
    } while ($pgReady -notmatch "1 row" -and $retries -lt 10)

    # Crear usuario si no existe
    $userExists = psql -h localhost -p $PG_PORT -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" 2>&1
    if ($userExists -notmatch "1") {
        psql -h localhost -p $PG_PORT -U postgres -c "CREATE USER $PG_USER WITH PASSWORD '$PG_PASS';" 2>&1 | Out-Null
        Write-OK "Usuario '$PG_USER' creado"
    } else {
        Write-OK "Usuario '$PG_USER' ya existe"
    }

    # Crear base de datos si no existe
    $dbExists = psql -h localhost -p $PG_PORT -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" 2>&1
    if ($dbExists -notmatch "1") {
        psql -h localhost -p $PG_PORT -U postgres -c "CREATE DATABASE $PG_DB OWNER $PG_USER;" 2>&1 | Out-Null
        psql -h localhost -p $PG_PORT -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $PG_DB TO $PG_USER;" 2>&1 | Out-Null
        Write-OK "Base de datos '$PG_DB' creada"
    } else {
        Write-OK "Base de datos '$PG_DB' ya existe"
    }
} catch {
    Write-Warn "No se pudo configurar la BD automáticamente: $_"
    Write-Warn "Configurá manualmente la BD con el usuario 'postgres'"
}

# ═══════════════════════════════════════════════════════
#  PASO 6: Instalar dependencias Python + correr migraciones
# ═══════════════════════════════════════════════════════
Write-Step "6/8 — Dependencias Python y migraciones"

Set-Location $BACKEND

if (!(Test-Path ".\venv")) {
    python -m venv venv
    Write-OK "Virtualenv creado"
} else {
    Write-OK "Virtualenv ya existe"
}

# Instalar dependencias
& ".\venv\Scripts\pip.exe" install -r requirements.txt --quiet
Write-OK "Dependencias Python instaladas"

# Correr migraciones Alembic
try {
    & ".\venv\Scripts\python.exe" -m alembic upgrade head 2>&1 | Tee-Object -Variable alembicOut
    if ($alembicOut -match "error" -and $alembicOut -notmatch "already up to date") {
        Write-Warn "Revisá las migraciones: $alembicOut"
    } else {
        Write-OK "Migraciones aplicadas"
    }
} catch {
    Write-Warn "Error en migraciones: $_"
}

# ═══════════════════════════════════════════════════════
#  PASO 7: Build del frontend
# ═══════════════════════════════════════════════════════
Write-Step "7/8 — Build del frontend"

Set-Location $FRONTEND

if (!(Test-Path ".\node_modules")) {
    Write-Host "  Instalando paquetes npm..." -ForegroundColor Gray
    npm install --silent
    Write-OK "npm install completado"
} else {
    Write-OK "node_modules ya existe"
}

npm run build 2>&1 | Tee-Object -Variable buildOut
if ($LASTEXITCODE -eq 0) {
    Write-OK "Frontend compilado exitosamente"
} else {
    Write-Fail "Error en build del frontend: $buildOut"
}

# ═══════════════════════════════════════════════════════
#  PASO 8: Crear servicio Windows para auto-start
# ═══════════════════════════════════════════════════════
Write-Step "8/8 — Servicio Windows para arranque automático"

# Crear script de arranque
$startScript = @"
@echo off
cd /d "$BACKEND"
call venv\Scripts\activate
start /min uvicorn main:app --host 0.0.0.0 --port $API_PORT
"@
$startScript | Out-File "$ERP_DIR\deploy\start-erp.bat" -Encoding ASCII

# Intentar usar NSSM para crear servicio Windows
if (!(Test-Command nssm)) {
    choco install nssm -y --no-progress 2>&1 | Out-Null
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
}

try {
    $svcName = "ERP-MundoOutdoor"
    $existingSvc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    
    if ($existingSvc) {
        nssm stop $svcName 2>&1 | Out-Null
        nssm remove $svcName confirm 2>&1 | Out-Null
    }
    
    $pythonExe = Resolve-Path "$BACKEND\venv\Scripts\python.exe"
    nssm install $svcName $pythonExe "-m uvicorn main:app --host 0.0.0.0 --port $API_PORT"
    nssm set $svcName AppDirectory $BACKEND
    nssm set $svcName DisplayName "ERP Mundo Outdoor"
    nssm set $svcName Description "Sistema ERP Mundo Outdoor - Backend API"
    nssm set $svcName Start SERVICE_AUTO_START
    nssm set $svcName AppStdout "$ERP_DIR\deploy\erp.log"
    nssm set $svcName AppStderr "$ERP_DIR\deploy\erp-error.log"
    nssm start $svcName
    Write-OK "Servicio '$svcName' creado y arrancado — iniciará automáticamente con Windows"
} catch {
    Write-Warn "No se pudo crear el servicio Windows: $_"
    Write-Warn "Usá start-erp.bat en su lugar"
    
    # Crear shortcut en startup como fallback
    $WshShell = New-Object -ComObject WScript.Shell
    $startupFolder = [Environment]::GetFolderPath("CommonStartup")
    $shortcut = $WshShell.CreateShortcut("$startupFolder\ERP Mundo Outdoor.lnk")
    $shortcut.TargetPath = "$ERP_DIR\deploy\start-erp.bat"
    $shortcut.WindowStyle = 7  # minimizado
    $shortcut.Description = "ERP Mundo Outdoor"
    $shortcut.Save()
    Write-OK "Shortcut de inicio automático creado en Startup"
}

# ═══════════════════════════════════════════════════════
#  RESUMEN FINAL
# ═══════════════════════════════════════════════════════
Set-Location $ERP_DIR

# Detectar IP local
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\." } | Select-Object -First 1).IPAddress

Write-Host "`n" + ("═" * 55) -ForegroundColor Green
Write-Host "  ✅ INSTALACIÓN COMPLETADA" -ForegroundColor Green
Write-Host ("═" * 55) -ForegroundColor Green
Write-Host ""
Write-Host "  📍 Servidor: http://$localIP`:$API_PORT" -ForegroundColor White
Write-Host "  🌐 API:      http://$localIP`:$API_PORT/api/v1" -ForegroundColor White
Write-Host "  📋 Log:      $LOG_FILE" -ForegroundColor Gray
Write-Host ""
Write-Host "  Para los locales (otras PCs en la red):" -ForegroundColor Yellow
Write-Host "  → Abrí Chrome en http://$localIP`:$API_PORT" -ForegroundColor Yellow
Write-Host "  → Instalá como PWA con el botón en la barra de Chrome" -ForegroundColor Yellow
Write-Host ""

"=== Instalación completada $(Get-Date) ===" | Out-File $LOG_FILE -Append
