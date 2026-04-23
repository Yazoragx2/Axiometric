const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chatRelay: (payload) => ipcRenderer.invoke('chat-relay', payload),
  getModels: () => ipcRenderer.invoke('get-models'),
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),
  checkApiKey: () => ipcRenderer.invoke('check-api-key'),
  checkUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback({ type: 'available', info }));
    ipcRenderer.on('update-progress', (event, percent) => callback({ type: 'progress', percent }));
    ipcRenderer.on('update-downloaded', (event, info) => callback({ type: 'downloaded', info }));
    ipcRenderer.on('update-error', (event, message) => callback({ type: 'error', message }));
  }
});
