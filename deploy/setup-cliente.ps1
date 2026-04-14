# ════════════════════════════════════════════════════════
#  ERP Mundo Outdoor — Setup Cliente
#  Crea un ícono en el escritorio que abre el ERP
#  como si fuera una app nativa (sin barra de Chrome)
#
#  Ejecutar en cada PC de los locales con:
#  powershell -ExecutionPolicy Bypass -File setup-cliente.ps1
# ════════════════════════════════════════════════════════

param(
    [string]$ServidorIP = "192.168.0.122",
    [int]$Puerto = 8000
)

$ERP_URL = "http://${ServidorIP}:${Puerto}"

Write-Host ""
Write-Host "  ERP Mundo Outdoor — Setup Cliente" -ForegroundColor Blue
Write-Host "  Servidor: $ERP_URL" -ForegroundColor Gray
Write-Host ""

# ── Buscar Chrome o Edge ──
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$browser = $null
foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        $browser = $path
        break
    }
}

if (!$browser) {
    Write-Host "  ✘ No se encontró Chrome ni Edge." -ForegroundColor Red
    Write-Host "  Instalá Chrome desde: https://www.google.com/chrome" -ForegroundColor Yellow
    Read-Host "Presioná Enter para salir"
    exit 1
}

$browserName = if ($browser -like "*chrome*") { "Chrome" } else { "Edge" }
Write-Host "  ✔ Navegador encontrado: $browserName" -ForegroundColor Green

# ── Crear shortcut en el escritorio (para todos los usuarios) ──
$desktopPaths = @(
    [Environment]::GetFolderPath("CommonDesktopDirectory"),  # todos los usuarios
    [Environment]::GetFolderPath("Desktop")                  # usuario actual
)

foreach ($desktopPath in $desktopPaths) {
    if (!(Test-Path $desktopPath)) { continue }
    
    $shortcutPath = Join-Path $desktopPath "ERP Mundo Outdoor.lnk"
    
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $shortcut = $WshShell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $browser
        # Modo --app: abre sin barra de navegador (parece app nativa)
        $shortcut.Arguments = "--app=$ERP_URL --window-size=1280,800 --disable-extensions"
        $shortcut.WorkingDirectory = Split-Path $browser
        $shortcut.Description = "ERP Mundo Outdoor"
        $shortcut.WindowStyle = 1  # Normal
        
        # Icono: intentar usar el ícono de la PWA si está disponible
        $iconPath = "D:\ERP MUNDO OUTDOOR\erp\frontend\public\icons\icon-192.png"
        if (Test-Path $iconPath) {
            # Chrome no acepta PNG directamente en shortcuts, usar el browser
            $shortcut.IconLocation = "$browser,0"
        }
        
        $shortcut.Save()
        Write-Host "  ✔ Ícono creado en: $shortcutPath" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ No se pudo crear el ícono en $desktopPath`: $_" -ForegroundColor Yellow
    }
}

# ── También crear en el menú Inicio ──
$startMenuPath = [Environment]::GetFolderPath("CommonPrograms")
$erpMenuFolder = Join-Path $startMenuPath "Mundo Outdoor"
New-Item -ItemType Directory -Path $erpMenuFolder -Force | Out-Null

try {
    $WshShell = New-Object -ComObject WScript.Shell
    $shortcut = $WshShell.CreateShortcut("$erpMenuFolder\ERP Mundo Outdoor.lnk")
    $shortcut.TargetPath = $browser
    $shortcut.Arguments = "--app=$ERP_URL --window-size=1280,800 --disable-extensions"
    $shortcut.WorkingDirectory = Split-Path $browser
    $shortcut.Description = "ERP Mundo Outdoor"
    $shortcut.Save()
    Write-Host "  ✔ Ícono creado en Menú Inicio" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ No se pudo crear en Menú Inicio: $_" -ForegroundColor Yellow
}

# ── Verificar conectividad ──
Write-Host ""
Write-Host "  Verificando conexión al servidor..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "$ERP_URL/api/v1/system/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✔ Servidor responde correctamente" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Servidor no responde (puede estar apagado o sin internet)" -ForegroundColor Yellow
    Write-Host "    El ERP funcionará offline cuando abras el ícono" -ForegroundColor Gray
}

# ── Ofrecer abrir ahora ──
Write-Host ""
$open = Read-Host "  ¿Abrir el ERP ahora? (S/N)"
if ($open -match "^[Ss]$") {
    Start-Process $browser "--app=$ERP_URL --window-size=1280,800 --disable-extensions"
}

Write-Host ""
Write-Host "  ✅ Setup completado. Usá el ícono del escritorio para abrir el ERP." -ForegroundColor Green
Write-Host ""
