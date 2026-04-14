# ════════════════════════════════════════════════════════
#  ERP Mundo Outdoor — Generador de APK Android
#
#  Usa TWA (Trusted Web Activity) para empaquetar la PWA
#  en un .apk real que se instala sin Play Store.
#
#  Resultado: un .apk que abre el ERP sin barra de Chrome,
#  con ícono en el home, como si fuera una app nativa.
#
#  Ejecutar en la PC servidor (donde corre el ERP)
#  con: powershell -ExecutionPolicy Bypass -File build-android.ps1
# ════════════════════════════════════════════════════════

param(
    [string]$ServidorIP   = "192.168.0.122",
    [int]$Puerto          = 8000,
    [string]$KeyPassword  = "MundoOutdoor2026!"
)

$ErrorActionPreference = "Stop"
$ANDROID_DIR = "$PSScriptRoot"
$ERP_URL = "http://${ServidorIP}:${Puerto}"

Write-Host ""
Write-Host "  ERP Mundo Outdoor — Generador APK Android" -ForegroundColor Blue
Write-Host "  URL del servidor: $ERP_URL" -ForegroundColor Gray
Write-Host ""

# ── Verificar Node.js ──
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  ✘ Node.js no está instalado. Instalalo desde https://nodejs.org" -ForegroundColor Red
    exit 1
}

# ── Verificar/instalar JDK (necesario para firmar el APK) ──
$javaOK = !!(Get-Command java -ErrorAction SilentlyContinue)
if (!$javaOK) {
    Write-Host "  Instalando JDK 17..." -ForegroundColor Gray
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install temurin17 -y --no-progress
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + $env:PATH
    } else {
        Write-Host "  ✘ Instalá Java JDK 17 desde: https://adoptium.net" -ForegroundColor Red
        Write-Host "    Luego volvé a ejecutar este script" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "  ✔ Java: $(java -version 2>&1 | Select-Object -First 1)" -ForegroundColor Green

# ── Instalar Bubblewrap CLI (herramienta oficial de Google para TWA) ──
Write-Host "  Instalando Bubblewrap CLI..." -ForegroundColor Gray
npm install -g @bubblewrap/cli --silent 2>&1 | Out-Null
Write-Host "  ✔ Bubblewrap instalado" -ForegroundColor Green

# ── Actualizar IP en twa-config.json ──
$configPath = "$ANDROID_DIR\twa-config.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$config.host = $ServidorIP
$config.fullScopeUrl = "$ERP_URL/"
$config.iconUrl = "$ERP_URL/icons/icon-512.png"
$config.maskableIconUrl = "$ERP_URL/icons/icon-512.png"
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath
Write-Host "  ✔ Config actualizada con IP: $ServidorIP" -ForegroundColor Green

# ── Generar keystore para firmar el APK (si no existe) ──
$keystorePath = "$ANDROID_DIR\mundooutdoor-release-key.keystore"
if (!(Test-Path $keystorePath)) {
    Write-Host "  Generando certificado de firma..." -ForegroundColor Gray
    
    $keytoolArgs = @(
        "-genkey", "-v",
        "-keystore", $keystorePath,
        "-alias", "mundooutdoor-erp",
        "-keyalg", "RSA",
        "-keysize", "2048",
        "-validity", "10000",
        "-storepass", $KeyPassword,
        "-keypass", $KeyPassword,
        "-dname", "CN=Mundo Outdoor ERP, OU=IT, O=Mundo Outdoor, L=Argentina, S=Argentina, C=AR"
    )
    
    & keytool @keytoolArgs 2>&1 | Out-Null
    Write-Host "  ✔ Certificado generado: $keystorePath" -ForegroundColor Green
    Write-Host "  ⚠ GUARDÁ este archivo .keystore — sin él no podrás actualizar la app" -ForegroundColor Yellow
} else {
    Write-Host "  ✔ Certificado ya existe" -ForegroundColor Green
}

# ── Inicializar y compilar el proyecto TWA ──
Set-Location $ANDROID_DIR

Write-Host ""
Write-Host "  Compilando APK (esto puede tardar 5-10 minutos)..." -ForegroundColor Gray
Write-Host ""

# Init con config existente
if (!(Test-Path "$ANDROID_DIR\app")) {
    bubblewrap init --manifest "$ERP_URL/manifest.json" --directory $ANDROID_DIR 2>&1
}

# Build del APK
bubblewrap build --skipPwaValidation 2>&1

# Buscar el APK generado
$apkPath = Get-ChildItem -Path $ANDROID_DIR -Filter "*.apk" -Recurse | Select-Object -First 1

if ($apkPath) {
    # Copiar a lugar fácil de encontrar
    $finalApk = "$ANDROID_DIR\MundoOutdoor-ERP.apk"
    Copy-Item $apkPath.FullName $finalApk -Force
    
    Write-Host ""
    Write-Host "  ✅ APK generado exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  📱 Archivo: $finalApk" -ForegroundColor White
    Write-Host "  📦 Tamaño: $([math]::Round($apkPath.Length / 1MB, 1)) MB" -ForegroundColor White
    Write-Host ""
    Write-Host "  ══ Cómo instalar en tablets/celulares Android ══" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1. Mandá MundoOutdoor-ERP.apk por WhatsApp/cable USB" -ForegroundColor White
    Write-Host "  2. En el celular: Ajustes → Seguridad → 'Fuentes desconocidas' ON" -ForegroundColor White
    Write-Host "  3. Abrí el archivo .apk en el celular → Instalar" -ForegroundColor White
    Write-Host "  4. La app aparece en el home con el ícono de Mundo Outdoor" -ForegroundColor White
    Write-Host ""
    Write-Host "  ⚠ Asegurate que el celular esté en la misma WiFi que el servidor" -ForegroundColor Yellow
    Write-Host "    O configurá acceso externo con DuckDNS para acceso remoto" -ForegroundColor Yellow
    
    # Abrir carpeta con el APK
    Start-Process explorer.exe $ANDROID_DIR
} else {
    Write-Host "  ✘ No se encontró el APK. Revisá los errores arriba." -ForegroundColor Red
    Write-Host "    Intentá correr manualmente: bubblewrap build" -ForegroundColor Yellow
}
