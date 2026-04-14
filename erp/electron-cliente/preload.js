const { contextBridge, ipcRenderer } = require('electron');

// Inyectar company_id en localStorage ANTES que React monte
// Así BrandingContext lee el company_id correcto desde el primer render
try { localStorage.setItem('erp_company_id', '3'); } catch(e) {}

contextBridge.exposeInMainWorld('__electron', {
  saveUrl: (url) => ipcRenderer.invoke('save-server-url', url),
});
