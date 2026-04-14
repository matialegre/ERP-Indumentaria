const { app, BrowserWindow, dialog, ipcMain, shell, nativeImage } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
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
const APP_NAME   = 'TallerEuro';

// Config persistente (JSON simple)
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return {}; }
}
function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
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
      input:focus{border-color:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.1)}
      .btn{background:#dc2626;color:white;border:none;padding:10px 28px;border-radius:8px;
           font-size:14px;cursor:pointer;font-weight:500}
      .btn:hover{background:#b91c1c}
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
function createMainWindow(url, offlineServerUrl = null) {
  log(`Creating main window → ${url}`);

  // IMPORTANTE: Crear ventana principal ANTES de cerrar splash
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
        localStorage.setItem('erp_company_id', '7');
        if (${JSON.stringify(offlineServerUrl || null)}) {
          localStorage.setItem('erp_server_url', ${JSON.stringify(offlineServerUrl || '')});
          localStorage.setItem('erp_offline_mode', 'true');
        } else {
          localStorage.removeItem('erp_offline_mode');
        }
        // If there's a saved token, check it belongs to company 7 — if not, clear it
        const token = localStorage.getItem('token');
        if (!token) return Promise.resolve(null);
        return fetch('/api/v1/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
          .then(r => r.json())
          .then(u => {
            if (u.company_id && u.company_id !== 7) {
              // Token from wrong company — clear session so user must re-login as taller user
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
function checkServer(url, retries = 5, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      log(`Health check ${url} attempt ${attempts + 1}/${retries}`);
      const req = http.get(`${url}/api/v1/system/health`, (res) => {
        if (res.statusCode === 200) { log(`OK: ${url}`); resolve(url); }
        else retry();
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
    return await checkServer('http://127.0.0.1:8000', 2, 500);
  } catch {
    return await checkServer(configuredUrl, 5, 1500);
  }
}

// ─── Servidor HTTP local para modo offline ─────────────────────────────
const OFFLINE_PORT = 8001;
let _offlineServer = null;

function startLocalServer(serverUrl) {
  return new Promise((resolve, reject) => {
    const distPath = path.join(__dirname, 'frontend-dist');
    if (!fs.existsSync(distPath)) {
      reject(new Error('frontend-dist/ no encontrado. Ejecutá el script de deploy para copiarlo.'));
      return;
    }
    const MIME = {
      '.html': 'text/html', '.js': 'application/javascript',
      '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
    };
    const srv = require('http').createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      let filePath = path.join(distPath, urlPath === '/' ? 'index.html' : urlPath);
      if (!fs.existsSync(filePath)) filePath = path.join(distPath, 'index.html');
      try {
        const data = fs.readFileSync(filePath);
        const mime = MIME[path.extname(filePath)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
        res.end(data);
      } catch {
        const idx = fs.readFileSync(path.join(distPath, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(idx);
      }
    });
    srv.on('error', reject);
    srv.listen(OFFLINE_PORT, '127.0.0.1', () => {
      _offlineServer = srv;
      log(`Modo offline: servidor local en puerto ${OFFLINE_PORT}, API → ${serverUrl}`);
      resolve(`http://127.0.0.1:${OFFLINE_PORT}`);
    });
  });
} ──────────────────────────────────────────────────────────────────────
ipcMain.handle('save-server-url', (event, url) => {
  saveConfig({ serverUrl: url });
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

while ((Get-Process -Id $pid -ErrorAction SilentlyContinue) -and $timeout -gt 0) {
  Start-Sleep -Milliseconds 500
  $timeout--
}
Start-Sleep -Seconds 1

if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
Expand-Archive -LiteralPath $zipPath -DestinationPath $tempExtract -Force

$children = Get-ChildItem $tempExtract
if ($children.Count -eq 1 -and $children[0].PSIsContainer) {
  $sourceDir = $children[0].FullName
} else {
  $sourceDir = $tempExtract
}

Copy-Item "$sourceDir\\*" $installDir -Recurse -Force -ErrorAction SilentlyContinue
Start-Process $exePath

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
});

app.whenReady().then(async () => {
  log(`App ready. Packaged: ${app.isPackaged}`);

  showSplash();

  const cfg = loadConfig();
  const serverUrl = cfg.serverUrl || SERVER_URL;
  log(`Server URL: ${serverUrl}`);

  try {
    const resolvedUrl = await resolveServerUrl(serverUrl);
    createMainWindow(resolvedUrl);
    checkForUpdates(resolvedUrl).then(updateInfo => {
      if (updateInfo) promptAndApplyUpdate(resolvedUrl, updateInfo);
    }).catch(() => {});
  } catch (err) {
    log(`Servidor no disponible: ${err.message} — intentando modo offline...`);
    try {
      const localUrl = await startLocalServer(serverUrl);
      createMainWindow(localUrl, serverUrl);
    } catch (localErr) {
      log(`Modo offline no disponible: ${localErr.message}`);
      showConnectionError(serverUrl);
    }
  }
}).catch((err) => {
  log(`FATAL: ${err.stack || err.message}`);
  dialog.showErrorBox('Error fatal', err.message);
  app.quit();
});

