const { contextBridge, ipcRenderer } = require('electron');

try { localStorage.setItem('erp_company_id', '6'); } catch(e) {}

contextBridge.exposeInMainWorld('__electron', {
  saveUrl: (url) => ipcRenderer.invoke('save-server-url', url),
});
