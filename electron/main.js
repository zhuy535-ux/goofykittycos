const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

// In dev, we load the Vite server. In prod, we load the built bundle.
const DEV_URL = process.env.SHARED_CALENDAR_URL || 'http://localhost:5173';
const PROD_INDEX = path.resolve(__dirname, '../frontend/dist/index.html');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#0f172a',
    title: 'Shared Calendar',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in the user's browser, not in a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (app.isPackaged) {
    win.loadFile(PROD_INDEX);
  } else {
    win.loadURL(DEV_URL);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
