# install-local-server.ps1
# Instalador del servidor local ERP Mundo Outdoor
# Ejecutar como Administrador en la PC del local
#
# Uso:
#   .\install-local-server.ps1 -CentralUrl "http://190.211.201.217:8000" -CentralUser "sync@mundooutdoor.com" -CentralPass "password"

param(
    [string]$CentralUrl = "http://190.211.201.217:8000",
    [string]$CentralUser = "sync_agent@mundooutdoor.com",
    [string]$CentralPass = "",
    [string]$DbName = "erp_local",
    [string]$DbUser = "erp",
    [string]$DbPass = "erp_local_pass",
    [int]$SyncInterval = 60,
    [switch]$SkipPostgres,
    [switch]$SkipPython
)

$ErrorActionPreference = "Stop"
$InstallDir = "C:\ERPMundoOutdoor"
$ServiceName = "ERPSyncAgent"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  ERP Mundo Outdoor — Instalador Servidor Local v1.0" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ── Verificar que se corra como admin ────────────────────────────────────────
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Este script debe ejecutarse como Administrador." -ForegroundColor Red
    Write-Host "Clic derecho en PowerShell -> Ejecutar como administrador" -ForegroundColor Yellow
    exit 1
}

if (-not $CentralPass) {
    $secure = Read-Host "Contraseña del usuario de servicio ($CentralUser)" -AsSecureString
    $CentralPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
}

# ── Crear directorio de instalación ──────────────────────────────────────────
Write-Host "1. Creando directorio de instalación en $InstallDir..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\logs" | Out-Null

# ── Instalar Python 3.11 ──────────────────────────────────────────────────────
if (-not $SkipPython) {
    Write-Host "2. Verificando Python..." -ForegroundColor Yellow
    $py = Get-Command python -ErrorAction SilentlyContinue
    if (-not $py) {
        Write-Host "   Descargando Python 3.11..." -ForegroundColor Gray
        $pyInstaller = "$env:TEMP\python311.exe"
        Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile $pyInstaller
        Start-Process -FilePath $pyInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Host "   Python instalado correctamente" -ForegroundColor Green
    } else {
        Write-Host "   Python ya instalado: $($py.Source)" -ForegroundColor Green
    }
} else {
    Write-Host "2. [SkipPython] Omitiendo instalación de Python" -ForegroundColor Gray
}

# ── Instalar PostgreSQL ───────────────────────────────────────────────────────
if (-not $SkipPostgres) {
    Write-Host "3. Verificando PostgreSQL..." -ForegroundColor Yellow
    $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if (-not $pgService) {
        Write-Host "   Descargando PostgreSQL 15..." -ForegroundColor Gray
        $pgInstaller = "$env:TEMP\pg15_installer.exe"
        Invoke-WebRequest -Uri "https://get.enterprisedb.com/postgresql/postgresql-15.6-1-windows-x64.exe" -OutFile $pgInstaller
        Start-Process -FilePath $pgInstaller -ArgumentList "--mode unattended --superpassword `"$DbPass`" --servicename postgresql-15 --serverport 5432" -Wait
        Write-Host "   PostgreSQL instalado correctamente" -ForegroundColor Green
    } else {
        Write-Host "   PostgreSQL ya instalado: $($pgService.Name)" -ForegroundColor Green
    }
    
    # Crear base de datos local
    Write-Host "   Creando base de datos '$DbName'..." -ForegroundColor Gray
    $pgBin = (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1)?.FullName
    if ($pgBin) {
        & $pgBin -U postgres -c "CREATE DATABASE $DbName;" 2>$null
        & $pgBin -U postgres -c "CREATE USER $DbUser WITH PASSWORD '$DbPass';" 2>$null
        & $pgBin -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;" 2>$null
        Write-Host "   Base de datos configurada" -ForegroundColor Green
    } else {
        Write-Host "   psql no encontrado — configurar DB manualmente" -ForegroundColor Yellow
    }
} else {
    Write-Host "3. [SkipPostgres] Omitiendo instalación de PostgreSQL" -ForegroundColor Gray
}

# ── Copiar archivos del backend ───────────────────────────────────────────────
Write-Host "4. Copiando archivos del servidor..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "erp\backend"
if (Test-Path $backendDir) {
    Copy-Item -Path "$backendDir\*" -Destination $InstallDir -Recurse -Force
    Write-Host "   Archivos copiados desde $backendDir" -ForegroundColor Green
} else {
    Write-Host "   AVISO: Backend no encontrado en $backendDir — copiar manualmente" -ForegroundColor Yellow
}

# ── Crear entorno virtual e instalar dependencias ────────────────────────────
Write-Host "5. Instalando dependencias Python..." -ForegroundColor Yellow
Set-Location $InstallDir
if (-not (Test-Path "$InstallDir\venv")) {
    python -m venv venv
}
& "$InstallDir\venv\Scripts\pip.exe" install -r requirements.txt --quiet
Write-Host "   Dependencias instaladas" -ForegroundColor Green

# ── Crear archivo .env ────────────────────────────────────────────────────────
Write-Host "6. Creando archivo de configuración .env..." -ForegroundColor Yellow
$dbUrl = "postgresql://${DbUser}:${DbPass}@localhost:5432/$DbName"
$envContent = @"
# ERP Mundo Outdoor — Servidor Local
DATABASE_URL=$dbUrl
CENTRAL_URL=$CentralUrl
CENTRAL_USER=$CentralUser
CENTRAL_PASS=$CentralPass
SYNC_INTERVAL=$SyncInterval
SECRET_KEY=$(([System.Guid]::NewGuid().ToString("N")) + ([System.Guid]::NewGuid().ToString("N")))
ENVIRONMENT=local
"@
Set-Content -Path "$InstallDir\.env" -Value $envContent -Encoding UTF8
Write-Host "   .env creado correctamente" -ForegroundColor Green

# ── Crear script de inicio del sync agent ────────────────────────────────────
Write-Host "7. Creando servicio de Windows para sync agent..." -ForegroundColor Yellow
$startScript = @"
@echo off
cd /d "$InstallDir"
set DOTENV_FILE=$InstallDir\.env
for /f "usebackq tokens=1,* delims==" %%a in ("$InstallDir\.env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" set %%a=%%b
)
"$InstallDir\venv\Scripts\python.exe" sync_agent.py --interval $SyncInterval >> "$InstallDir\logs\sync_agent.log" 2>&1
"@
Set-Content -Path "$InstallDir\start_sync_agent.bat" -Value $startScript -Encoding ASCII

# Crear servicio usando sc.exe
$svcExists = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svcExists) {
    Write-Host "   Deteniendo servicio existente..." -ForegroundColor Gray
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $ServiceName | Out-Null
}

# Usar NSSM si está disponible, o sc.exe directo
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssm) {
    & nssm install $ServiceName "$InstallDir\venv\Scripts\python.exe" "sync_agent.py --interval $SyncInterval"
    & nssm set $ServiceName AppDirectory $InstallDir
    & nssm set $ServiceName AppEnvironmentExtra "CENTRAL_URL=$CentralUrl" "CENTRAL_USER=$CentralUser" "CENTRAL_PASS=$CentralPass" "DATABASE_URL=$dbUrl"
    & nssm set $ServiceName AppStdout "$InstallDir\logs\sync_agent.log"
    & nssm set $ServiceName AppStderr "$InstallDir\logs\sync_agent_err.log"
    Start-Service -Name $ServiceName
    Write-Host "   Servicio NSSM creado e iniciado" -ForegroundColor Green
} else {
    # Crear tarea programada como alternativa
    $action = New-ScheduledTaskAction -Execute "$InstallDir\start_sync_agent.bat"
    $trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Seconds $SyncInterval) -Once -At (Get-Date)
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $ServiceName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force | Out-Null
    Start-ScheduledTask -TaskName $ServiceName
    Write-Host "   Tarea programada '$ServiceName' creada e iniciada" -ForegroundColor Green
}

# ── Abrir puerto 8000 en el firewall ─────────────────────────────────────────
Write-Host "8. Configurando firewall..." -ForegroundColor Yellow
$ruleName = "ERP Mundo Outdoor Local Server"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow | Out-Null
    Write-Host "   Regla de firewall creada: puerto 8000 TCP" -ForegroundColor Green
} else {
    Write-Host "   Regla de firewall ya existe" -ForegroundColor Green
}

# ── Ejecutar migraciones Alembic ──────────────────────────────────────────────
Write-Host "9. Aplicando migraciones de base de datos..." -ForegroundColor Yellow
Set-Location $InstallDir
try {
    & "$InstallDir\venv\Scripts\alembic.exe" upgrade head
    Write-Host "   Migraciones aplicadas correctamente" -ForegroundColor Green
} catch {
    Write-Host "   ERROR aplicando migraciones: $_" -ForegroundColor Red
    Write-Host "   Aplicar manualmente: cd $InstallDir && venv\Scripts\alembic upgrade head" -ForegroundColor Yellow
}

# ── Resumen ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  ✅ Instalación completada" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Directorio: $InstallDir" -ForegroundColor White
Write-Host "  Servicio:   $ServiceName" -ForegroundColor White
Write-Host "  DB local:   $dbUrl" -ForegroundColor White
Write-Host "  Central:    $CentralUrl" -ForegroundColor White
Write-Host ""
Write-Host "  Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Verificar logs en $InstallDir\logs\sync_agent.log" -ForegroundColor White
Write-Host "  2. Configurar IP de este servidor local en la licencia de PC del admin" -ForegroundColor White
Write-Host "     (ej: http://192.168.1.100:8000)" -ForegroundColor White
Write-Host "  3. Iniciar el backend FastAPI: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000" -ForegroundColor White
Write-Host ""
