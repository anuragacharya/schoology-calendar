const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const SchoologyScraper = require('./services/schoology-scraper');
const SyncService = require('./services/sync-service');

// Initialize electron-store for persistent data
const store = new Store();

let mainWindow;
let tray;
let syncService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false // Don't show until ready
  });

  // Load Angular app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/schoology-calendar/browser/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../public/favicon.ico'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Sync Now',
      click: async () => {
        if (syncService) {
          await syncService.syncNow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Schoology Calendar');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.show();
  });
}

// App lifecycle events
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Initialize sync service
  syncService = new SyncService(store, mainWindow);

  // Check if credentials exist and start auto-sync
  const credentials = store.get('credentials');
  if (credentials) {
    syncService.startAutoSync();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (syncService) {
    syncService.stopAutoSync();
  }
});

// ==================== IPC HANDLERS ====================

// Save credentials (encrypted)
ipcMain.handle('save-credentials', async (event, credentials) => {
  try {
    // Store credentials (electron-store handles encryption)
    store.set('credentials', credentials);

    // Start auto-sync
    if (syncService) {
      syncService.startAutoSync();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get stored credentials
ipcMain.handle('get-credentials', async () => {
  try {
    const credentials = store.get('credentials');
    return { success: true, credentials };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete credentials
ipcMain.handle('delete-credentials', async () => {
  try {
    store.delete('credentials');
    if (syncService) {
      syncService.stopAutoSync();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Manual sync trigger
ipcMain.handle('sync-now', async () => {
  try {
    if (!syncService) {
      return { success: false, error: 'Sync service not initialized' };
    }
    const result = await syncService.syncNow();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get sync status
ipcMain.handle('get-sync-status', async () => {
  try {
    if (!syncService) {
      return { success: false, error: 'Sync service not initialized' };
    }
    const status = syncService.getSyncStatus();
    return { success: true, status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set sync interval
ipcMain.handle('set-sync-interval', async (event, minutes) => {
  try {
    if (!syncService) {
      return { success: false, error: 'Sync service not initialized' };
    }
    syncService.setSyncInterval(minutes);
    store.set('syncInterval', minutes);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get app version
ipcMain.handle('get-app-version', async () => {
  return { success: true, version: app.getVersion() };
});

// Log message from renderer
ipcMain.on('log', (event, message) => {
  console.log('[Renderer]:', message);
});
