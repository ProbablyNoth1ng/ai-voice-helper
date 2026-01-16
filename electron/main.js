const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let tray;
let backendProcess;

const isDev = process.env.NODE_ENV === 'development' || 
              process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true
    }
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'microphone', 'audioCapture'];
    
    if (allowedPermissions.includes(permission)) {
      console.log(`✅ Allowing permission: ${permission}`);
      callback(true);
    } else {
      console.log(`❌ Denying permission: ${permission}`);
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const allowedPermissions = ['media', 'microphone', 'audioCapture'];
    
    if (allowedPermissions.includes(permission)) {
      return true;
    }
    return false;
  });

  if (isDev) {
    console.log('📡 Loading from dev server...');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const frontendPath = path.join(__dirname, '../dist-frontend/index.html');
    console.log('📦 Loading from:', frontendPath);
    mainWindow.loadFile(frontendPath);
  }

  mainWindow.setContentProtection(true);

  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Failed to load:', errorDescription);
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer] ${message}`);
  });

  console.log('✅ Window created');
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/icon.png');

  try {
    if (require('fs').existsSync(iconPath)) {
      tray = new Tray(iconPath);
      
      const contextMenu = Menu.buildFromTemplate([
        { label: 'Show/Hide', click: () => toggleWindow() },
        { type: 'separator' },
        { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
      ]);

      tray.setToolTip('AI Voice Assistant');
      tray.setContextMenu(contextMenu);
      tray.on('click', () => toggleWindow());
    }
  } catch (e) {
    console.log('⚠️ Tray creation failed:', e.message);
  }
}

function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function registerHotkeys() {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    console.log('🔥 Hotkey: Ctrl+Shift+Space');
    mainWindow.webContents.send('hotkey-pressed');
  });

  globalShortcut.register('CommandOrControl+Shift+H', () => {
    console.log('👁️ Hotkey: Toggle visibility');
    toggleWindow();
  });

  globalShortcut.register('CommandOrControl+Shift+S', () => {
    console.log('⚙️ Hotkey: Settings');
    mainWindow.webContents.send('toggle-settings');
  });

  console.log('✅ Hotkeys registered');
}

function startBackend() {
  if (isDev) {
    console.log('📡 Dev mode: Start backend manually with "npm run dev:backend"');
    return;
  }

  const backendPath = path.join(__dirname, '../dist/main.js');
  console.log('📡 Starting backend from:', backendPath);

  try {
    backendProcess = spawn('node', [backendPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString().trim()}`);
    });

    backendProcess.on('error', (err) => {
      console.error('❌ Backend failed:', err);
    });

    console.log('✅ Backend process started');
  } catch (e) {
    console.error('❌ Failed to start backend:', e);
  }
}

// App lifecycle
app.whenReady().then(() => {
  console.log('🚀 Starting AI Voice Assistant...');
  console.log('   Mode:', isDev ? 'DEVELOPMENT' : 'PRODUCTION');

  startBackend();

  const delay = isDev ? 0 : 3000;
  
  setTimeout(() => {
    createWindow();
    createTray();
    registerHotkeys();
  }, delay);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('hide-window', () => mainWindow.hide());
ipcMain.on('show-window', () => mainWindow.show());
ipcMain.on('set-always-on-top', (_, value) => mainWindow.setAlwaysOnTop(value));
ipcMain.on('set-opacity', (_, value) => mainWindow.setOpacity(value));