const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Store para configuración persistente
let Store;
let store;

// Proceso del backend
let backendProcess = null;
let mainWindow = null;
let splashWindow = null;

const BACKEND_PORT = 8001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Resolver la raíz del proyecto (funciona tanto en dev como empaquetado)
// En dev: __dirname = erp/electron/  → ROOT = erp/
// En packaged: exe está en dist-electron/ERP Sistema-win32-x64/ → ROOT = erp/
const ROOT_DIR = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), '..', '..', '..')
  : path.join(__dirname, '..');

// ─── Configuración persistente ───────────────────────────────────────────────

function getStore() {
  if (!store) {
    try {
      Store = require('electron-store');
      store = new Store();
    } catch (e) {
      // Fallback a archivo JSON simple
      store = {
        _file: path.join(app.getPath('userData'), 'config.json'),
        _data: null,
        _load() {
          if (!this._data) {
            try { this._data = JSON.parse(fs.readFileSync(this._file, 'utf8')); }
            catch { this._data = {}; }
          }
          return this._data;
        },
        get(key, def) { return this._load()[key] ?? def; },
        set(key, val) { this._load()[key] = val; fs.writeFileSync(this._file, JSON.stringify(this._data, null, 2)); }
      };
    }
  }
  return store;
}

// ─── Splash screen ───────────────────────────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

// ─── Ventana principal ────────────────────────────────────────────────────────

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: true,
    autoHideMenuBar: true,
    title: 'ERP Sistema',
    icon: app.isPackaged
      ? path.join(ROOT_DIR, 'frontend', 'public', 'icons', 'icon-192.png')
      : path.join(__dirname, '..', 'frontend', 'public', 'icons', 'icon-192.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,  // Siempre habilitado para debug (F12)
      webSecurity: false,  // Permite crypto.subtle en HTTP (Electron app, no browser)
    }
  });

  // Sin barra de menú en producción
  mainWindow.setMenuBarVisibility(false);

  // Bloquear navegación fuera de la app
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (!navUrl.startsWith(url.replace(/\/$/, ''))) {
      event.preventDefault();
    }
  });

  // Bloquear ventanas nuevas (links externos)
  mainWindow.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    shell.openExternal(newUrl);
    return { action: 'deny' };
  });

  // Deshabilitar menú contextual del browser en producción
  if (app.isPackaged) {
    mainWindow.webContents.on('context-menu', (e) => e.preventDefault());
  }

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopBackend();
    app.quit();
  });
}

// ─── Backend Python ───────────────────────────────────────────────────────────

function findPython() {
  const candidates = [
    path.join(ROOT_DIR, 'erp', 'backend', 'venv', 'Scripts', 'python.exe'), // DISTRIBUIBLES
    path.join(ROOT_DIR, 'backend', 'venv', 'Scripts', 'python.exe'),         // dist-electron
    path.join(__dirname, '..', '..', 'backend', 'venv', 'Scripts', 'python.exe'), // dev
    'python',
    'python3',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
  ];
  for (const p of candidates) {
    if (p.startsWith(path.sep) || p.includes(path.sep)) {
      if (fs.existsSync(p)) { console.log('[Python] Encontrado:', p); return p; }
    } else {
      return p;
    }
  }
  return 'python';
}

// Verificar si un puerto TCP está en uso (más rápido que HTTP)
function isPortInUse(port) {
  const net = require('net');
  return new Promise((resolve) => {
    const tester = net.createConnection({ port, host: '127.0.0.1' });
    tester.once('connect', () => { tester.destroy(); resolve(true); });
    tester.once('error', () => { tester.destroy(); resolve(false); });
    setTimeout(() => { tester.destroy(); resolve(false); }, 500);
  });
}

async function startBackend() {
  // Si ya hay un proceso escuchando en el puerto, no iniciar otro
  const portOccupied = await isPortInUse(BACKEND_PORT);
  if (portOccupied) {
    console.log('[Backend] Puerto 8000 ya en uso, reutilizando instancia existente');
    return;
  }

  return new Promise((resolve, reject) => {
    // Buscar la carpeta del backend en múltiples ubicaciones posibles
    const backendCandidates = [
      path.join(ROOT_DIR, 'erp', 'backend'),   // cuando EXE está en DISTRIBUIBLES/
      path.join(ROOT_DIR, 'backend'),            // cuando EXE está en erp/electron/dist/
      path.join(__dirname, '..', '..', 'backend'), // dev
    ];
    const backendDir = backendCandidates.find(p => fs.existsSync(path.join(p, 'app'))) || backendCandidates[0];
    const python = findPython();

    const logMsg = `[Backend] Dir: ${backendDir}\n[Backend] Python: ${python}`;
    console.log(logMsg);
    try { fs.appendFileSync(path.join(app.getPath('userData'), 'erp-debug.log'), logMsg + '\n'); } catch {}

    if (!fs.existsSync(backendDir)) {
      const err = new Error(`No se encontró la carpeta del backend.\nBuscado en:\n${backendCandidates.join('\n')}`);
      dialog.showErrorBox('Backend no encontrado', err.message);
      return reject(err);
    }

    backendProcess = spawn(python, [
      '-m', 'uvicorn', 'app.main:app',
      '--host', '0.0.0.0',
      '--port', String(BACKEND_PORT),
      '--workers', '1',
    ], {
      cwd: backendDir,
      env: { ...process.env },
      windowsHide: true,
    });

    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[Backend]', msg.trim());
      if (msg.includes('Application startup complete')) {
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      console.error('[Backend ERR]', msg.trim());
      if (msg.includes('Application startup complete') || msg.includes('Uvicorn running')) {
        resolve();
      }
    });

    backendProcess.on('error', (err) => {
      console.error('[Backend] Error al iniciar:', err);
      reject(err);
    });

    backendProcess.on('exit', (code) => {
      console.log(`[Backend] Proceso terminó con código ${code}`);
    });

    // Timeout de seguridad — si no inicia en 30s, continuar igual
    setTimeout(() => resolve(), 30000);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('[Backend] Deteniendo...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

// ─── Verificar si el backend está listo ──────────────────────────────────────

function waitForBackend(retries = 30, delay = 1000, baseUrl = BACKEND_URL) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(`${baseUrl}/api/v1/system/health`, (res) => {
        if (res.statusCode === 200) resolve(true);
        else retry();
      }).on('error', () => retry());
    };
    const retry = () => {
      attempts++;
      if (attempts >= retries) reject(new Error('Backend no responde'));
      else setTimeout(check, delay);
    };
    check();
  });
}

// ─── Pantalla de configuración (modo cliente) ─────────────────────────────────

function createConfigWindow() {
  const configWin = new BrowserWindow({
    width: 500,
    height: 400,
    frame: true,
    resizable: false,
    center: true,
    autoHideMenuBar: true,
    title: 'Configurar conexión',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });
  configWin.setMenuBarVisibility(false);
  configWin.loadFile(path.join(__dirname, 'config-screen.html'));
  return configWin;
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

const DEFAULT_SERVER_URL = 'http://190.211.201.217:8001';

ipcMain.handle('get-server-url', () => {
  return getStore().get('serverUrl', DEFAULT_SERVER_URL);
});

ipcMain.handle('save-server-url', (event, url) => {
  getStore().set('serverUrl', url);
  getStore().set('mode', 'client');
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('use-local-server', () => {
  getStore().set('mode', 'server');
  app.relaunch();
  app.exit(0);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Auto-iniciar con Windows (cuando esté empaquetado)
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  const cfg = getStore();
  const mode = cfg.get('mode', 'server');
  const savedUrl = cfg.get('serverUrl', DEFAULT_SERVER_URL);

  createSplash();

  // Timeout duro: si en 50 segundos no abrió, mostrar error
  const hardTimeout = setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    dialog.showErrorBox('No se pudo iniciar',
      'El sistema tardó demasiado en iniciar.\n\n' +
      '• Verificá que PostgreSQL esté corriendo (puerto 2048)\n' +
      '• Verificá que Python/venv esté disponible\n' +
      '• Intentá abrir manualmente: start-backend.bat');
    app.quit();
  }, 50000);

  try {
    // Primero intentar arrancar backend local
    console.log('[App] Intentando backend local...');
    let localOk = false;

    // Verificar si ya hay algo corriendo en el puerto
    const portBusy = await isPortInUse(BACKEND_PORT);
    
    if (portBusy) {
      // Ya hay un backend corriendo — usar directamente
      console.log('[App] Backend ya corriendo en puerto 8000, conectando...');
      localOk = true;
    } else {
      // Intentar arrancar backend propio
      try {
        await startBackend();
        await waitForBackend(20, 1000);
        localOk = true;
        console.log('[App] Backend local iniciado OK');
      } catch (err) {
        console.log('[App] Backend local no disponible:', err.message);
      }
    }

    if (localOk) {
      clearTimeout(hardTimeout);
      createMainWindow(BACKEND_URL);
    } else {
      clearTimeout(hardTimeout);
      // Ningún backend local — mostrar pantalla de configuración
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      createConfigWindow();
    }
  } catch (err) {
    console.error('[App] Error fatal:', err);
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    dialog.showErrorBox('Error', `No se pudo iniciar el sistema:\n${err.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});
