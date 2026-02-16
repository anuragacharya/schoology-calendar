const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Credentials management
  saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),

  // Sync operations
  syncNow: () => ipcRenderer.invoke('sync-now'),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  setSyncInterval: (minutes) => ipcRenderer.invoke('set-sync-interval', minutes),

  // Sync events from main process
  onSyncStart: (callback) => {
    ipcRenderer.on('sync-start', () => callback());
  },
  onSyncComplete: (callback) => {
    ipcRenderer.on('sync-complete', (event, data) => callback(data));
  },
  onSyncError: (callback) => {
    ipcRenderer.on('sync-error', (event, error) => callback(error));
  },
  onDataUpdated: (callback) => {
    ipcRenderer.on('data-updated', (event, data) => callback(data));
  },

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Logging
  log: (message) => ipcRenderer.send('log', message)
});
