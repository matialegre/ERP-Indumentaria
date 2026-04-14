const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('erpApp', {
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  saveServerUrl: (url) => ipcRenderer.invoke('save-server-url', url),
  useLocalServer: () => ipcRenderer.invoke('use-local-server'),
});
