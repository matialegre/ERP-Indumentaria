#Requires -Version 5.0
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$LAN_IP      = "192.168.0.122"
$PUBLIC_IP   = "190.211.201.217"
$SERVER_PORT = 9980
$script:SERVER_URL = "http://${LAN_IP}:${SERVER_PORT}"
$APP_NAME    = "Mundo Outdoor ERP"
$WINDOW_SIZE = "1440,900"

# ---- Detectar navegador ----
$candidates = @(
    [PSCustomObject]@{ Name = "Google Chrome";       Path = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" },
    [PSCustomObject]@{ Name = "Google Chrome (x86)"; Path = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" },
    [PSCustomObject]@{ Name = "Microsoft Edge";       Path = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" },
    [PSCustomObject]@{ Name = "Microsoft Edge (x86)"; Path = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" }
)
$browser = $null
foreach ($b in $candidates) { if (Test-Path $b.Path) { $browser = $b; break } }

# ---- Verificar conectividad (LAN y pública) ----
function Test-Port($ip, $port) {
    try {
        $tcp    = New-Object System.Net.Sockets.TcpClient
        $result = $tcp.BeginConnect($ip, $port, $null, $null)
        $ok     = $result.AsyncWaitHandle.WaitOne(3000, $false)
        if ($ok) { try { $tcp.EndConnect($result) } catch {} }
        $tcp.Close()
        return $ok
    } catch { return $false }
}

$lanOK    = Test-Port $LAN_IP    $SERVER_PORT
$publicOK = Test-Port $PUBLIC_IP $SERVER_PORT

# Auto-seleccionar modo: LAN si está en la red, Internet si no
$script:modoInternet = -not $lanOK
$connected = if ($script:modoInternet) { $publicOK } else { $lanOK }
$script:SERVER_URL = if ($script:modoInternet) { "http://${PUBLIC_IP}:${SERVER_PORT}" } else { "http://${LAN_IP}:${SERVER_PORT}" }

# ==============================================================
#  VENTANA PRINCIPAL
# ==============================================================
$form = New-Object System.Windows.Forms.Form
$form.Text            = "Mundo Outdoor ERP - Instalador"
$form.Size            = New-Object System.Drawing.Size(520, 670)
$form.StartPosition   = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox     = $false
$form.BackColor       = [System.Drawing.Color]::FromArgb(245, 247, 250)
$form.Font            = New-Object System.Drawing.Font("Segoe UI", 9)

# ---- Header ----
$header = New-Object System.Windows.Forms.Panel
$header.Size      = New-Object System.Drawing.Size(520, 90)
$header.Location  = New-Object System.Drawing.Point(0, 0)
$header.BackColor = [System.Drawing.Color]::FromArgb(30, 64, 175)
$form.Controls.Add($header)

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text      = "Mundo Outdoor ERP"
$lblTitle.Font      = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::White
$lblTitle.Location  = New-Object System.Drawing.Point(20, 12)
$lblTitle.Size      = New-Object System.Drawing.Size(480, 38)
$header.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text      = "Instalador de acceso directo"
$lblSub.Font      = New-Object System.Drawing.Font("Segoe UI", 10)
$lblSub.ForeColor = [System.Drawing.Color]::FromArgb(190, 210, 255)
$lblSub.Location  = New-Object System.Drawing.Point(22, 52)
$lblSub.Size      = New-Object System.Drawing.Size(480, 24)
$header.Controls.Add($lblSub)

# ---- Panel estado del servidor ----
$panelServer = New-Object System.Windows.Forms.Panel
$panelServer.Size      = New-Object System.Drawing.Size(476, 60)
$panelServer.Location  = New-Object System.Drawing.Point(22, 108)
$panelServer.BackColor = if ($connected) { [System.Drawing.Color]::FromArgb(220, 252, 231) } else { [System.Drawing.Color]::FromArgb(254, 226, 226) }
$panelServer.BorderStyle = "FixedSingle"
$form.Controls.Add($panelServer)

$lblServerIcon = New-Object System.Windows.Forms.Label
$lblServerIcon.Text     = if ($connected) { "OK" } else { "!" }
$lblServerIcon.Font     = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$lblServerIcon.ForeColor = if ($connected) { [System.Drawing.Color]::FromArgb(21, 128, 61) } else { [System.Drawing.Color]::FromArgb(185, 28, 28) }
$lblServerIcon.Location = New-Object System.Drawing.Point(12, 8)
$lblServerIcon.Size     = New-Object System.Drawing.Size(35, 24)
$panelServer.Controls.Add($lblServerIcon)

$lblServerLine1 = New-Object System.Windows.Forms.Label
$lblServerLine1.Text      = if ($connected) { "Servidor encontrado correctamente" } else { "No se pudo conectar al servidor" }
$lblServerLine1.Font      = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$lblServerLine1.ForeColor = if ($connected) { [System.Drawing.Color]::FromArgb(21, 128, 61) } else { [System.Drawing.Color]::FromArgb(185, 28, 28) }
$lblServerLine1.Location  = New-Object System.Drawing.Point(50, 8)
$lblServerLine1.Size      = New-Object System.Drawing.Size(420, 20)
$panelServer.Controls.Add($lblServerLine1)

$lblServerLine2 = New-Object System.Windows.Forms.Label
$lblServerLine2.Text      = $script:SERVER_URL
$lblServerLine2.Font      = New-Object System.Drawing.Font("Consolas", 8)
$lblServerLine2.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
$lblServerLine2.Location  = New-Object System.Drawing.Point(50, 30)
$lblServerLine2.Size      = New-Object System.Drawing.Size(420, 18)
$panelServer.Controls.Add($lblServerLine2)

if (-not $connected) {
    $lblServerLine3 = New-Object System.Windows.Forms.Label
    $lblServerLine3.Text      = if ($script:modoInternet) { "No se pudo alcanzar el servidor. Verificá tu conexión a internet." } else { "No se pudo conectar al servidor. Podes instalar igual." }
    $lblServerLine3.Font      = New-Object System.Drawing.Font("Segoe UI", 8)
    $lblServerLine3.ForeColor = [System.Drawing.Color]::FromArgb(185, 28, 28)
    $lblServerLine3.Location  = New-Object System.Drawing.Point(50, 46)
    $lblServerLine3.Size      = New-Object System.Drawing.Size(420, 16)
    $panelServer.Controls.Add($lblServerLine3)
    $panelServer.Size = New-Object System.Drawing.Size(476, 72)
}

# ---- Panel navegador ----
$yOff = if ($connected) { 180 } else { 192 }

$panelBrowser = New-Object System.Windows.Forms.Panel
$panelBrowser.Size      = New-Object System.Drawing.Size(476, 48)
$panelBrowser.Location  = New-Object System.Drawing.Point(22, $yOff)
$panelBrowser.BackColor = if ($browser) { [System.Drawing.Color]::FromArgb(239, 246, 255) } else { [System.Drawing.Color]::FromArgb(254, 226, 226) }
$panelBrowser.BorderStyle = "FixedSingle"
$form.Controls.Add($panelBrowser)

$lblBrowserStatus = New-Object System.Windows.Forms.Label
$lblBrowserStatus.Text      = if ($browser) { "Navegador: $($browser.Name)" } else { "No se encontro Chrome ni Edge. Instala uno primero." }
$lblBrowserStatus.Font      = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$lblBrowserStatus.ForeColor = if ($browser) { [System.Drawing.Color]::FromArgb(29, 78, 216) } else { [System.Drawing.Color]::FromArgb(185, 28, 28) }
$lblBrowserStatus.Location  = New-Object System.Drawing.Point(12, 8)
$lblBrowserStatus.Size      = New-Object System.Drawing.Size(450, 20)
$panelBrowser.Controls.Add($lblBrowserStatus)

if ($browser) {
    $lblBrowserPath = New-Object System.Windows.Forms.Label
    $lblBrowserPath.Text      = $browser.Path
    $lblBrowserPath.Font      = New-Object System.Drawing.Font("Consolas", 7)
    $lblBrowserPath.ForeColor = [System.Drawing.Color]::FromArgb(107, 114, 128)
    $lblBrowserPath.Location  = New-Object System.Drawing.Point(12, 28)
    $lblBrowserPath.Size      = New-Object System.Drawing.Size(450, 16)
    $panelBrowser.Controls.Add($lblBrowserPath)
}

# ---- Modo de acceso (LAN / Internet) ----
$modeY = $yOff + 66

$lblModo = New-Object System.Windows.Forms.Label
$lblModo.Text      = "Modo de acceso:"
$lblModo.Font      = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$lblModo.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$lblModo.Location  = New-Object System.Drawing.Point(22, $modeY)
$lblModo.Size      = New-Object System.Drawing.Size(476, 22)
$form.Controls.Add($lblModo)

$rbLAN = New-Object System.Windows.Forms.RadioButton
$rbLAN.Text     = "Red local (LAN)  --  $LAN_IP"
$rbLAN.Font     = New-Object System.Drawing.Font("Segoe UI", 9)
$rbLAN.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$rbLAN.Location = New-Object System.Drawing.Point(30, ($modeY + 26))
$rbLAN.Size     = New-Object System.Drawing.Size(440, 22)
$rbLAN.Checked  = (-not $script:modoInternet)
$form.Controls.Add($rbLAN)

$rbInternet = New-Object System.Windows.Forms.RadioButton
$rbInternet.Text     = "Acceso remoto (Internet)  --  $PUBLIC_IP"
$rbInternet.Font     = New-Object System.Drawing.Font("Segoe UI", 9)
$rbInternet.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$rbInternet.Location = New-Object System.Drawing.Point(30, ($modeY + 50))
$rbInternet.Size     = New-Object System.Drawing.Size(440, 22)
$rbInternet.Checked  = $script:modoInternet
$form.Controls.Add($rbInternet)

$lblModoDesc = New-Object System.Windows.Forms.Label
$lblModoDesc.Text      = "   LAN: PCs dentro de la empresa.  Internet: acceso desde cualquier lugar."
$lblModoDesc.Font      = New-Object System.Drawing.Font("Segoe UI", 7.5)
$lblModoDesc.ForeColor = [System.Drawing.Color]::FromArgb(107, 114, 128)
$lblModoDesc.Location  = New-Object System.Drawing.Point(30, ($modeY + 74))
$lblModoDesc.Size      = New-Object System.Drawing.Size(460, 16)
$form.Controls.Add($lblModoDesc)

# Helper que actualiza el panel de estado según el modo elegido
function Update-ServerStatus($ip) {
    $ok = Test-Port $ip $SERVER_PORT
    $panelServer.BackColor     = if ($ok) { [System.Drawing.Color]::FromArgb(220, 252, 231) } else { [System.Drawing.Color]::FromArgb(254, 226, 226) }
    $lblServerIcon.Text        = if ($ok) { "OK" } else { "!" }
    $lblServerIcon.ForeColor   = if ($ok) { [System.Drawing.Color]::FromArgb(21, 128, 61) } else { [System.Drawing.Color]::FromArgb(185, 28, 28) }
    $lblServerLine1.Text       = if ($ok) { "Servidor encontrado correctamente" } else { "No se pudo conectar al servidor" }
    $lblServerLine1.ForeColor  = $lblServerIcon.ForeColor
    $form.Refresh()
}

$rbLAN.Add_CheckedChanged({
    if ($rbLAN.Checked) {
        $script:SERVER_URL   = "http://${LAN_IP}:${SERVER_PORT}"
        $lblServerLine2.Text = $script:SERVER_URL
        Update-ServerStatus $LAN_IP
    }
})
$rbInternet.Add_CheckedChanged({
    if ($rbInternet.Checked) {
        $script:SERVER_URL   = "http://${PUBLIC_IP}:${SERVER_PORT}"
        $lblServerLine2.Text = $script:SERVER_URL
        Update-ServerStatus $PUBLIC_IP
    }
})

# ---- Opciones de instalacion ----
$yOff2 = $yOff + 172

$lblOpciones = New-Object System.Windows.Forms.Label
$lblOpciones.Text     = "Que queres instalar?"
$lblOpciones.Font     = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$lblOpciones.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$lblOpciones.Location = New-Object System.Drawing.Point(22, $yOff2)
$lblOpciones.Size     = New-Object System.Drawing.Size(400, 24)
$form.Controls.Add($lblOpciones)

$chkDesktop = New-Object System.Windows.Forms.CheckBox
$chkDesktop.Text     = "Acceso directo en el Escritorio"
$chkDesktop.Font     = New-Object System.Drawing.Font("Segoe UI", 10)
$chkDesktop.Location = New-Object System.Drawing.Point(30, ($yOff2 + 32))
$chkDesktop.Size     = New-Object System.Drawing.Size(440, 26)
$chkDesktop.Checked  = $true
$form.Controls.Add($chkDesktop)

$lblDesktopDesc = New-Object System.Windows.Forms.Label
$lblDesktopDesc.Text      = "   El icono del ERP aparece directo en tu escritorio para abrirlo con doble clic."
$lblDesktopDesc.Font      = New-Object System.Drawing.Font("Segoe UI", 8)
$lblDesktopDesc.ForeColor = [System.Drawing.Color]::FromArgb(107, 114, 128)
$lblDesktopDesc.Location  = New-Object System.Drawing.Point(30, ($yOff2 + 56))
$lblDesktopDesc.Size      = New-Object System.Drawing.Size(460, 18)
$form.Controls.Add($lblDesktopDesc)

$chkStartMenu = New-Object System.Windows.Forms.CheckBox
$chkStartMenu.Text     = "Acceso en el Menu Inicio"
$chkStartMenu.Font     = New-Object System.Drawing.Font("Segoe UI", 10)
$chkStartMenu.Location = New-Object System.Drawing.Point(30, ($yOff2 + 80))
$chkStartMenu.Size     = New-Object System.Drawing.Size(440, 26)
$chkStartMenu.Checked  = $false
$form.Controls.Add($chkStartMenu)

$chkOpenNow = New-Object System.Windows.Forms.CheckBox
$chkOpenNow.Text     = "Abrir el ERP al terminar"
$chkOpenNow.Font     = New-Object System.Drawing.Font("Segoe UI", 10)
$chkOpenNow.Location = New-Object System.Drawing.Point(30, ($yOff2 + 112))
$chkOpenNow.Size     = New-Object System.Drawing.Size(440, 26)
$chkOpenNow.Checked  = $true
$form.Controls.Add($chkOpenNow)

# ---- Barra de progreso ----
$yOff3 = $yOff2 + 156

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Size     = New-Object System.Drawing.Size(476, 18)
$progress.Location = New-Object System.Drawing.Point(22, $yOff3)
$progress.Minimum  = 0
$progress.Maximum  = 100
$progress.Value    = 0
$progress.Style    = "Continuous"
$form.Controls.Add($progress)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text      = "Listo para instalar."
$lblStatus.Font      = New-Object System.Drawing.Font("Segoe UI", 8)
$lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
$lblStatus.Location  = New-Object System.Drawing.Point(22, ($yOff3 + 22))
$lblStatus.Size      = New-Object System.Drawing.Size(476, 18)
$form.Controls.Add($lblStatus)

# ---- Botones ----
$yOff4 = $yOff3 + 52

$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text      = "INSTALAR"
$btnInstall.Font      = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnInstall.Size      = New-Object System.Drawing.Size(200, 44)
$btnInstall.Location  = New-Object System.Drawing.Point(22, $yOff4)
$btnInstall.BackColor = [System.Drawing.Color]::FromArgb(30, 64, 175)
$btnInstall.ForeColor = [System.Drawing.Color]::White
$btnInstall.FlatStyle = "Flat"
$btnInstall.FlatAppearance.BorderSize = 0
$btnInstall.Cursor    = [System.Windows.Forms.Cursors]::Hand
$btnInstall.Enabled   = ($browser -ne $null)
$form.Controls.Add($btnInstall)

$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text      = "Cancelar"
$btnCancel.Font      = New-Object System.Drawing.Font("Segoe UI", 10)
$btnCancel.Size      = New-Object System.Drawing.Size(120, 44)
$btnCancel.Location  = New-Object System.Drawing.Point(234, $yOff4)
$btnCancel.BackColor = [System.Drawing.Color]::FromArgb(229, 231, 235)
$btnCancel.ForeColor = [System.Drawing.Color]::FromArgb(55, 65, 81)
$btnCancel.FlatStyle = "Flat"
$btnCancel.Cursor    = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnCancel)

$lblInfo = New-Object System.Windows.Forms.Label
$lblInfo.Text      = "Las actualizaciones del sistema son automaticas.`nSi el ERP cambia, todas las PCs lo ven al instante."
$lblInfo.Font      = New-Object System.Drawing.Font("Segoe UI", 8)
$lblInfo.ForeColor = [System.Drawing.Color]::FromArgb(107, 114, 128)
$lblInfo.Location  = New-Object System.Drawing.Point(22, ($yOff4 + 50))
$lblInfo.Size      = New-Object System.Drawing.Size(476, 36)
$form.Controls.Add($lblInfo)

# ==============================================================
#  LOGICA DE INSTALACION
# ==============================================================
$btnCancel.Add_Click({ $form.Close() })

$btnInstall.Add_Click({
    $btnInstall.Enabled = $false
    $btnCancel.Enabled  = $false
    $desktopPath        = [Environment]::GetFolderPath("Desktop")
    $shortcutFile       = Join-Path $desktopPath "$APP_NAME.lnk"
    $installed          = @()
    $errors             = @()

    # Paso 1: acceso directo escritorio
    $progress.Value = 20
    $lblStatus.Text = "Creando acceso directo..."
    $form.Refresh()

    if ($chkDesktop.Checked) {
        try {
            $wsh = New-Object -ComObject WScript.Shell
            $sc  = $wsh.CreateShortcut($shortcutFile)
            $sc.TargetPath       = $browser.Path
            $sc.Arguments        = "--app=$($script:SERVER_URL) --window-size=$WINDOW_SIZE"
            $sc.WorkingDirectory = Split-Path $browser.Path
            $sc.Description      = "Mundo Outdoor ERP - Sistema de Gestion"
            $sc.Save()
            $installed += "Acceso directo en Escritorio"
        } catch {
            $errors += "No se pudo crear el acceso en el Escritorio: $_"
        }
    }

    # Paso 2: menu inicio
    $progress.Value = 60
    $lblStatus.Text = "Configurando Menu Inicio..."
    $form.Refresh()

    if ($chkStartMenu.Checked) {
        try {
            $startMenuPath = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\$APP_NAME.lnk"
            $wsh2 = New-Object -ComObject WScript.Shell
            $sc2  = $wsh2.CreateShortcut($startMenuPath)
            $sc2.TargetPath  = $browser.Path
            $sc2.Arguments   = "--app=$($script:SERVER_URL) --window-size=$WINDOW_SIZE"
            $sc2.Description = "Mundo Outdoor ERP"
            $sc2.Save()
            $installed += "Entrada en Menu Inicio"
        } catch {
            $errors += "No se pudo agregar al Menu Inicio."
        }
    }

    $progress.Value = 100
    $lblStatus.Text = "Instalacion completada."
    $form.Refresh()

    # Abrir ERP
    if ($chkOpenNow.Checked) {
        Start-Process $browser.Path "--app=$($script:SERVER_URL) --window-size=$WINDOW_SIZE"
    }

    # Mensaje final
    $msg = if ($installed.Count -gt 0) {
        "Instalacion exitosa!`n`nSe instalo:`n  - " + ($installed -join "`n  - ") +
        "`n`nPodes abrir el ERP haciendo doble clic en el icono del Escritorio." +
        "`n`nRecorda: las actualizaciones son automaticas en todas las PCs."
    } else {
        "No se selecciono nada para instalar."
    }

    if ($errors.Count -gt 0) {
        $msg += "`n`nAvisos:`n" + ($errors -join "`n")
    }

    $icon = if ($errors.Count -gt 0) { [System.Windows.Forms.MessageBoxIcon]::Warning } else { [System.Windows.Forms.MessageBoxIcon]::Information }
    [System.Windows.Forms.MessageBox]::Show($msg, "Mundo Outdoor ERP", [System.Windows.Forms.MessageBoxButtons]::OK, $icon)

    # Abrir el escritorio para que vea el icono
    if ($chkDesktop.Checked -and $installed -contains "Acceso directo en Escritorio") {
        Start-Process explorer.exe $desktopPath
    }

    $form.Close()
})

# ==============================================================
#  MOSTRAR VENTANA
# ==============================================================
[System.Windows.Forms.Application]::Run($form)