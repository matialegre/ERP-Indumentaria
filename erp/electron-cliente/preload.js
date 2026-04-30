const { contextBridge, ipcRenderer } = require('electron');

// Inyectar company_id en localStorage ANTES que React monte
try { localStorage.setItem('erp_company_id', '3'); } catch(e) {}

// Si esta ventana fue abierta como sub-ventana, inyectar token en sessionStorage
// ANTES que React monte, usando IPC sincrónico para evitar race conditions.
try {
  const params = new URLSearchParams(window.location.search);
  const wid = params.get('_wid');
  if (wid) {
    const token = ipcRenderer.sendSync('get-window-token', wid);
    if (token) sessionStorage.setItem('token', token);
  }
} catch(e) {}

contextBridge.exposeInMainWorld('__electron', {
  saveUrl: (url) => ipcRenderer.invoke('save-server-url', url),
  saveLicenseKey: (key) => ipcRenderer.invoke('save-license-key', key),
  clearLicense: () => ipcRenderer.invoke('clear-license'),
  requestLicense: () => ipcRenderer.invoke('request-license'),
  pollLicense: () => ipcRenderer.invoke('poll-license'),
  openWindow: (path, title) => ipcRenderer.invoke('open-window', path, title, sessionStorage.getItem('token')),
});
