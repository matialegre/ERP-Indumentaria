const { app, BrowserWindow, dialog, ipcMain, shell, nativeImage, session } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const APP_VERSION = '1.0.0';

// ─── Error global handlers ───────────────────────────────────────────────────
let startupComplete = false;
const LOG_FILE = path.join(app.getPath('userData'), 'erp-debug.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}
process.on('uncaughtException', (err) => {
  log(`UNCAUGHT: ${err.stack || err.message}`);
  dialog.showErrorBox('Error inesperado', err.message);
});
process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED REJECTION: ${reason}`);
});

// ─── Configuración ────────────────────────────────────────────────────────────
const SERVER_URL = 'http://190.211.201.217:8000';
const APP_NAME   = 'ERP Mundo Outdoor';

// Config persistente (JSON simple)
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return {}; }
}
function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// ─── Machine ID ────────────────────────────────────────────────────────────────
function getMachineId() {
  const cfg = loadConfig();
  if (!cfg.machineId) {
    cfg.machineId = crypto.randomBytes(16).toString('hex');
    saveConfig(cfg);
    log(`Generated new machineId: ${cfg.machineId}`);
  }
  return cfg.machineId;
}

// ─── Licencia por PC ──────────────────────────────────────────────────────────
const LICENSE_FILE = path.join(app.getPath('userData'), 'license.key');

function readLicenseKey() {
  try {
    const key = fs.readFileSync(LICENSE_FILE, 'utf8').trim();
    return key || null;
  } catch { return null; }
}

function saveLicenseKey(key) {
  fs.writeFileSync(LICENSE_FILE, key.trim(), 'utf8');
}

function validateLicense(serverUrl, key, machineId) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ key, machine_id: machineId });
    const urlObj = new URL(`${serverUrl}/api/v1/pc-licenses/validate`);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ valid: false, message: 'Respuesta inválida del servidor' }); }
      });
    });
    req.on('error', () => resolve({ valid: false, message: 'No se pudo contactar el servidor para validar la licencia' }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ valid: false, message: 'Timeout validando licencia' }); });
    req.write(body);
    req.end();
  });
}

function showLicenseEntry() {
  if (splashWin && !splashWin.isDestroyed()) splashWin.close();
  const licWin = new BrowserWindow({
    width: 500, height: 420, frame: true, resizable: false, center: true,
    autoHideMenuBar: true, title: APP_NAME,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  licWin.setMenuBarVisibility(false);
  licWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,sans-serif;background:#0f172a;color:#f1f5f9;
           display:flex;flex-direction:column;align-items:center;justify-content:center;
           height:100vh;gap:20px;padding:40px}
      .icon{font-size:52px;line-height:1}
      h2{font-size:20px;font-weight:700;color:#fff;text-align:center}
      p{font-size:13px;color:#94a3b8;text-align:center;max-width:360px;line-height:1.6}
      textarea{width:100%;padding:12px 14px;background:#1e293b;border:1.5px solid #334155;
               border-radius:10px;font-size:13px;font-family:monospace;color:#e2e8f0;
               resize:none;height:72px;outline:none;letter-spacing:.05em}
      textarea:focus{border-color:#7c3aed}
      .btn{background:#7c3aed;color:white;border:none;padding:12px 32px;border-radius:10px;
           font-size:15px;cursor:pointer;font-weight:600;width:100%}
      .btn:hover{background:#6d28d9}
      .btn:disabled{opacity:.5;cursor:not-allowed}
      .err{color:#f87171;font-size:12px;text-align:center}
    </style></head>
    <body>
      <div class=icon>🔑</div>
      <h2>Activar ERP</h2>
      <p>Esta instalación requiere una licencia. Ingresá la clave que te proporcionó tu administrador:</p>
      <textarea id=key placeholder="PC-XXXX-XXXX-XXXX-XXXX" spellcheck="false"></textarea>
      <div class=err id=err></div>
      <button class=btn id=btn onclick=activate()>Activar</button>
      <script>
        async function activate(){
          const key = document.getElementById('key').value.trim();
          if(!key){document.getElementById('err').textContent='Ingresá una clave';return;}
          document.getElementById('btn').disabled=true;
          document.getElementById('btn').textContent='Activando...';
          document.getElementById('err').textContent='';
          try{
            await window.__electron?.saveLicenseKey(key);
          }catch(e){
            document.getElementById('err').textContent=e?.message||'Error';
            document.getElementById('btn').disabled=false;
            document.getElementById('btn').textContent='Activar';
          }
        }
        document.getElementById('key').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey)activate();});
      </script>
    </body></html>
  `)}`);
  licWin.once('ready-to-show', () => { licWin.show(); startupComplete = true; });
}

function showLicenseError(message) {
  if (splashWin && !splashWin.isDestroyed()) splashWin.close();
  const errWin = new BrowserWindow({
    width: 480, height: 380, frame: true, resizable: false, center: true,
    autoHideMenuBar: true, title: APP_NAME,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  errWin.setMenuBarVisibility(false);
  const safeMsg = message.replace(/'/g, "\\'");
  errWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,sans-serif;background:#0f172a;color:#f1f5f9;
           display:flex;flex-direction:column;align-items:center;justify-content:center;
           height:100vh;gap:16px;padding:40px}
      .icon{font-size:52px}
      h2{font-size:19px;font-weight:700;color:#fff;text-align:center}
      p{font-size:13px;color:#94a3b8;text-align:center;max-width:340px;line-height:1.6}
      .msg{background:#1e293b;border:1px solid #dc2626;border-radius:10px;padding:14px 18px;
           font-size:13px;color:#fca5a5;text-align:center;width:100%;max-width:380px}
      .btn{background:#1e293b;color:#94a3b8;border:1px solid #334155;padding:10px 24px;
           border-radius:8px;font-size:13px;cursor:pointer;margin-top:4px}
      .btn:hover{color:#fff;border-color:#475569}
    </style></head>
    <body>
      <div class=icon>🚫</div>
      <h2>Licencia inválida</h2>
      <div class=msg>${message}</div>
      <p>Contactá a tu administrador para obtener una nueva licencia.</p>
      <button class=btn onclick="window.__electron?.clearLicense()">Ingresar otra clave</button>
    </body></html>
  `)}`);
  errWin.once('ready-to-show', () => { errWin.show(); startupComplete = true; });
}

// ─── Pantalla de carga ────────────────────────────────────────────────────────
let splashWin = null;
function showSplash() {
  splashWin = new BrowserWindow({
    width: 460, height: 320, frame: false, transparent: true,
    alwaysOnTop: true, resizable: false, center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
  log('Splash shown');
}

// ─── Pantalla de error de conexión ────────────────────────────────────────────
function showConnectionError(serverUrl) {
  if (splashWin && !splashWin.isDestroyed()) splashWin.close();
  const errWin = new BrowserWindow({
    width: 480, height: 360, frame: true, resizable: false, center: true,
    autoHideMenuBar: true, title: APP_NAME,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  errWin.setMenuBarVisibility(false);
  errWin.loadURL(`data:text/html;charset=utf-8,
    <html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,sans-serif;background:#f8fafc;display:flex;
           flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;padding:32px}
      .icon{font-size:48px}
      h2{font-size:18px;color:#1e293b;text-align:center}
      p{font-size:13px;color:#64748b;text-align:center;max-width:320px}
      input{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;
            font-size:14px;outline:none}
      input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1)}
      .btn{background:#2563eb;color:white;border:none;padding:10px 28px;border-radius:8px;
           font-size:14px;cursor:pointer;font-weight:500}
      .btn:hover{background:#1d4ed8}
      .url{font-size:11px;color:#94a3b8;margin-top:-8px}
    </style></head>
    <body>
      <div class=icon>🔌</div>
      <h2>No se puede conectar al servidor</h2>
      <p>Verificá que el servidor esté encendido o ingresá otra dirección IP:</p>
      <div class=url>Servidor actual: <strong id=cur>${serverUrl}</strong></div>
      <input id=url type=text placeholder='http://192.168.x.x:8000' value='${serverUrl}'/>
      <button class=btn onclick='connect()'>Conectar</button>
      <script>
        function connect(){
          const url = document.getElementById('url').value.trim();
          if(url) window.__electron?.saveUrl(url) || location.assign(url);
        }
        document.getElementById('url').addEventListener('keydown', e => { if(e.key==='Enter') connect(); });
      </script>
    </body></html>`);
  startupComplete = true;
}

// ─── Ventana principal ────────────────────────────────────────────────────────
let mainWin = null;
function createMainWindow(url) {
  log(`Creating main window → ${url}`);

  // IMPORTANTE: Crear ventana principal ANTES de cerrar splash
  // para evitar que window-all-closed mate la app
  mainWin = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 900, minHeight: 600,
    show: false, frame: true,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      devTools: true,  // F12 para debug
    }
  });

  // Ahora sí cerramos splash (ya existe mainWin)
  if (splashWin && !splashWin.isDestroyed()) splashWin.close();
  splashWin = null;

  mainWin.setMenuBarVisibility(false);

  mainWin.webContents.on('will-navigate', (event, navUrl) => {
    if (!navUrl.startsWith(url.replace(/\/$/, ''))) event.preventDefault();
  });
  mainWin.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    shell.openExternal(newUrl);
    return { action: 'deny' };
  });

  mainWin.loadURL(url);
  // Limpiar historial de navegación del renderer para que al reabrir
  // siempre empiece en "/" y no en el último módulo visitado
  mainWin.webContents.once('did-finish-load', () => {
    mainWin.webContents.clearHistory();
  });

  // Try to set dynamic company icon on startup
  fetchCompanyIcon(url).then(iconPath => {
    if (iconPath && mainWin && !mainWin.isDestroyed()) {
      try {
        const img = nativeImage.createFromPath(iconPath);
        if (!img.isEmpty()) {
          mainWin.setIcon(img);
          log('Window icon updated from company branding');
        }
      } catch (err) {
        log(`Icon set failed: ${err.message}`);
      }
    }
  });
  mainWin.webContents.on('did-finish-load', () => {
    // Set client mode and company id, then verify the stored session belongs to this company
    mainWin.webContents.executeJavaScript(`
      (function() {
        localStorage.setItem('erp_client_mode', 'true');
        localStorage.setItem('erp_company_id', '3');
        const token = localStorage.getItem('token');
        if (!token) return Promise.resolve(null);
        return fetch('/api/v1/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
          .then(r => r.json())
          .then(u => {
            if (u.company_id && u.company_id !== 3) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.reload();
              return null;
            }
            return u.company_id;
          })
          .catch(() => null);
      })()
    `).then(companyId => {
      log('Page loaded, erp_client_mode set');
    }).catch(() => {});

    // Fetch company icon after page loads (user may be logged in)
    mainWin.webContents.executeJavaScript(`
      (function() {
        try {
          const token = localStorage.getItem('token');
          if (token) {
            return fetch('/api/v1/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
              .then(r => r.json())
              .then(u => u.company_id)
              .catch(() => null);
          }
        } catch(e) {}
        return null;
      })()
    `).then(companyId => {
      if (companyId) {
        const iconUrl = `${url}/api/v1/branding/icon/${companyId}`;
        log(`Fetching icon for company ${companyId}`);
        http.get(iconUrl, (res) => {
          if (res.statusCode === 200) {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                if (json.icon_data && json.icon_data.startsWith('data:')) {
                  const base64Data = json.icon_data.split(',')[1];
                  if (base64Data) {
                    fs.writeFileSync(ICON_CACHE, Buffer.from(base64Data, 'base64'));
                    const img = nativeImage.createFromPath(ICON_CACHE);
                    if (!img.isEmpty() && mainWin && !mainWin.isDestroyed()) {
                      mainWin.setIcon(img);
                      log('Window icon updated from company branding');
                    }
                  }
                }
              } catch(e) { log(`Icon parse error: ${e.message}`); }
            });
          }
        }).on('error', () => {});
      }
    }).catch(() => {});
  });

  mainWin.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    log(`Page load failed: ${errorCode} ${errorDesc}`);
    // ERR_ABORTED (-3) es normal durante navegación — ignorar
    if (errorCode === -3) return;
    // Para otros errores, mostrar la ventana de error de conexión si aún no se mostró
    if (!startupComplete) {
      mainWin.close();
      showConnectionError(url);
    }
  });

  mainWin.webContents.on('render-process-gone', (event, details) => {
    log(`Renderer crashed: reason=${details.reason} exitCode=${details.exitCode}`);
    dialog.showErrorBox('El ERP se cerró inesperadamente', `Motivo: ${details.reason}\n\nReiniciá la aplicación.`);
    app.quit();
  });

  mainWin.once('ready-to-show', () => {
    mainWin.maximize();
    mainWin.show();
    mainWin.focus();
    startupComplete = true;
    log('Window ready and shown');
  });
  mainWin.on('closed', () => { mainWin = null; });
}

// ─── Verificar conectividad ───────────────────────────────────────────────────
/**
 * Verifica que el servidor responda Y tenga el frontend buildeado.
 * Lee la respuesta JSON y valida has_frontend === true (campo agregado al health endpoint).
 * Si el backend es viejo (sin has_frontend), lo acepta igual para compatibilidad.
 */
function checkServer(url, retries = 5, delay = 1000, requireFrontend = false) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      log(`Health check ${url} attempt ${attempts + 1}/${retries}`);
      let body = '';
      const req = http.get(`${url}/api/v1/system/health`, (res) => {
        if (res.statusCode !== 200) { retry(); return; }
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (requireFrontend) {
            try {
              const json = JSON.parse(body);
              if (json.has_frontend === false) {
                log(`${url} respondió pero SIN frontend buildeado — descartando`);
                reject(new Error(`Sin frontend: ${url}`));
                return;
              }
            } catch { /* backend viejo sin has_frontend — aceptar igual */ }
          }
          log(`OK: ${url}`);
          resolve(url);
        });
      });
      req.on('error', () => retry());
      req.setTimeout(3000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      attempts++;
      if (attempts >= retries) reject(new Error(`Servidor no responde: ${url}`));
      else setTimeout(check, delay);
    };
    check();
  });
}

async function resolveServerUrl(configuredUrl) {
  try {
    // Intentar localhost solo si TAMBIÉN tiene el frontend buildeado
    return await checkServer('http://127.0.0.1:8000', 2, 500, true);
  } catch {
    return await checkServer(configuredUrl, 5, 1500);
  }
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.handle('save-server-url', (event, url) => {
  saveConfig({ serverUrl: url });
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('save-license-key', (event, key) => {
  saveLicenseKey(key);
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('clear-license', () => {
  try { fs.unlinkSync(LICENSE_FILE); } catch {}
  app.relaunch();
  app.exit(0);
});

// ─── Auto-Update ──────────────────────────────────────────────────────────────
function checkForUpdates(serverUrl) {
  return new Promise((resolve) => {
    const url = `${serverUrl}/api/v1/system/version`;
    log(`Checking updates at ${url}`);

    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          if (info.version && info.version !== APP_VERSION) {
            log(`Update available: ${APP_VERSION} → ${info.version}`);
            resolve(info);
          } else {
            log(`Up to date: ${APP_VERSION}`);
            resolve(null);
          }
        } catch { resolve(null); }
      });
    });
    req.on('error', () => { log('Update check failed (network)'); resolve(null); });
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

async function promptAndApplyUpdate(serverUrl, updateInfo) {
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Actualización disponible',
    message: `Nueva versión ${updateInfo.version} disponible`,
    detail: updateInfo.changelog || 'Mejoras y correcciones.',
    buttons: ['Actualizar ahora', 'Más tarde'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    const progressWin = new BrowserWindow({
      width: 400, height: 200, frame: false, transparent: true,
      alwaysOnTop: true, resizable: false, center: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    progressWin.loadURL(`data:text/html;charset=utf-8,
      <html><head><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,sans-serif;background:rgba(15,23,42,.95);
             display:flex;flex-direction:column;align-items:center;justify-content:center;
             height:100vh;gap:16px;border-radius:16px;color:white;padding:32px}
        h3{font-size:16px;font-weight:600}
        .bar-bg{width:100%;height:8px;background:rgba(255,255,255,.15);border-radius:4px;overflow:hidden}
        .bar{height:100%;background:#3b82f6;border-radius:4px;width:0%25;transition:width .3s}
        #pct{font-size:13px;color:rgba(255,255,255,.7)}
      </style></head>
      <body>
        <h3>Descargando actualización...</h3>
        <div class=bar-bg><div class=bar id=bar></div></div>
        <div id=pct>0%25</div>
      </body></html>`);

    try {
      const zipName = encodeURIComponent(APP_NAME + ' - Cliente.zip');
      const downloadUrl = `${serverUrl}/api/v1/system/download/${zipName}`;
      const tempZip = path.join(app.getPath('temp'), 'erp-update.zip');

      log(`Downloading update from ${downloadUrl}`);

      await new Promise((resolve, reject) => {
        const req = http.get(downloadUrl, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: HTTP ${res.statusCode}`));
            return;
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloaded = 0;
          const file = fs.createWriteStream(tempZip);

          res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalBytes > 0) {
              const pct = Math.round((downloaded / totalBytes) * 100);
              progressWin.webContents.executeJavaScript(
                `document.getElementById('bar').style.width='${pct}%';document.getElementById('pct').textContent='${pct}%';`
              ).catch(() => {});
            }
          });

          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
          file.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(120000, () => { req.destroy(); reject(new Error('Download timeout')); });
      });

      log('Download complete. Launching auto-updater...');

      if (!progressWin.isDestroyed()) {
        progressWin.webContents.executeJavaScript(
          `document.querySelector('h3').textContent='Instalando...';document.getElementById('bar').style.width='100%';document.getElementById('pct').textContent='Aplicando actualización...'`
        ).catch(() => {});
      }

      // PowerShell auto-updater: espera que el proceso cierre, extrae ZIP, reemplaza EXE y relanza
      const exePath = process.execPath;
      const installDir = path.dirname(exePath);
      const currentPid = process.pid;
      const psScript = path.join(app.getPath('temp'), 'erp-updater.ps1');

      const psContent = `
$pid = ${currentPid}
$exePath = '${exePath.replace(/\\/g, '\\\\')}'
$zipPath = '${tempZip.replace(/\\/g, '\\\\')}'
$installDir = '${installDir.replace(/\\/g, '\\\\')}'
$tempExtract = "$env:TEMP\\erp-update-extract"

# Esperar que la app cierre
$timeout = 30
while ((Get-Process -Id $pid -ErrorAction SilentlyContinue) -and $timeout -gt 0) {
  Start-Sleep -Milliseconds 500
  $timeout--
}
Start-Sleep -Seconds 1

# Extraer ZIP
if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
Expand-Archive -LiteralPath $zipPath -DestinationPath $tempExtract -Force

# Si hay una sola carpeta adentro (estructura electron-packager), entrar en ella
$children = Get-ChildItem $tempExtract
if ($children.Count -eq 1 -and $children[0].PSIsContainer) {
  $sourceDir = $children[0].FullName
} else {
  $sourceDir = $tempExtract
}

# Copiar archivos nuevos al directorio de instalación
Copy-Item "$sourceDir\\*" $installDir -Recurse -Force -ErrorAction SilentlyContinue

# Relanzar la app
Start-Process $exePath

# Limpiar
Start-Sleep -Seconds 2
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
`;

      fs.writeFileSync(psScript, psContent, 'utf8');

      if (!progressWin.isDestroyed()) progressWin.close();

      await dialog.showMessageBox({
        type: 'info',
        title: 'Listo para actualizar',
        message: `Actualización ${updateInfo.version} descargada`,
        detail: 'La app se cerrará y se actualizará automáticamente. Se reabrirá sola.',
        buttons: ['Actualizar y reiniciar'],
        defaultId: 0,
      });

      // Lanzar PowerShell updater (detached) y cerrar la app
      spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', psScript], {
        detached: true,
        stdio: 'ignore',
      }).unref();

      app.quit();

    } catch (err) {
      log(`Update download failed: ${err.message}`);
      if (!progressWin.isDestroyed()) progressWin.close();
      dialog.showErrorBox('Error de actualización', `No se pudo descargar: ${err.message}`);
    }
  }
}

// ─── Dynamic Icon ─────────────────────────────────────────────────────────────
const ICON_CACHE = path.join(app.getPath('userData'), 'company-icon.png');

function fetchCompanyIcon(serverUrl) {
  return new Promise((resolve) => {
    // First try cached icon
    if (fs.existsSync(ICON_CACHE)) {
      log('Using cached icon');
      resolve(ICON_CACHE);
    }

    // Try to fetch from API in background
    const url = `${serverUrl}/api/v1/branding/icon-file`;
    log(`Fetching company icon from ${url}`);

    const req = http.get(url, (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.icon_data && json.icon_data.startsWith('data:')) {
              const base64Data = json.icon_data.split(',')[1];
              if (base64Data) {
                fs.writeFileSync(ICON_CACHE, Buffer.from(base64Data, 'base64'));
                log('Icon cached successfully');
                resolve(ICON_CACHE);
                return;
              }
            }
          } catch {}
          resolve(null);
        });
      } else {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  if (startupComplete) app.quit();
  // Durante startup NO quitar — splash se cierra antes de crear mainWin
});

// ─── Single Instance Lock ─────────────────────────────────────────────────────
// Evita que se abran múltiples ventanas si el usuario hace doble/triple click
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // Ya hay una instancia corriendo → salir silenciosamente
  app.quit();
} else {
  // Si el usuario abre otra instancia, traer la ventana existente al frente
  app.on('second-instance', () => {
    const wins = require('electron').BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.whenReady().then(async () => {
  log(`App ready. Packaged: ${app.isPackaged}`);

  // Deshabilitar cache HTTP — siempre cargar versión fresca del servidor
  session.defaultSession.clearCache().catch(() => {});
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    details.requestHeaders['Pragma'] = 'no-cache';
    callback({ requestHeaders: details.requestHeaders });
  });

  showSplash();

  const cfg = loadConfig();
  const serverUrl = cfg.serverUrl || SERVER_URL;
  log(`Server URL: ${serverUrl}`);

  // ── Verificar licencia ──────────────────────────────────────────────────
  const licenseKey = readLicenseKey();
  if (!licenseKey && app.isPackaged) {
    log('No license key found — showing license entry screen');
    showLicenseEntry();
    return;
  }
  if (licenseKey) log(`License key found: ${licenseKey.substring(0, 7)}...`);
  else log('Dev mode — skipping license check');

  try {
    const resolvedUrl = await resolveServerUrl(serverUrl);

    // Validar licencia contra el servidor
    if (licenseKey && app.isPackaged) {
      const machineId = getMachineId();
      log(`Validating license with machineId: ${machineId.substring(0, 8)}...`);
      const validation = await validateLicense(resolvedUrl, licenseKey, machineId);
      log(`License validation result: valid=${validation.valid}, message=${validation.message}`);

      if (!validation.valid) {
        showLicenseError(validation.message);
        return;
      }
    }

    createMainWindow(resolvedUrl);

    // Limpiar caché de Chromium para garantizar que siempre se carga la versión más reciente
    session.defaultSession.clearCache().catch(() => {});

    // Check for updates in background (non-blocking)
    checkForUpdates(resolvedUrl).then(updateInfo => {
      if (updateInfo) promptAndApplyUpdate(resolvedUrl, updateInfo);
    }).catch(() => {});
  } catch (err) {
    log(`Server unavailable: ${err.message}`);
    showConnectionError(serverUrl);
  }
}).catch((err) => {
  log(`FATAL: ${err.stack || err.message}`);
  dialog.showErrorBox('Error fatal', err.message);
  app.quit();
});
