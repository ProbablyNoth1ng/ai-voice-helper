const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Receive hotkey-pressed from main process
  onHotkeyPressed: (callback) => {
    // Remove any existing listeners first
    ipcRenderer.removeAllListeners('hotkey-pressed');
    ipcRenderer.on('hotkey-pressed', () => {
      console.log('[Preload] Received hotkey-pressed');
      callback();
    });
  },

  // Receive toggle-settings from main process
  onToggleSettings: (callback) => {
    // Remove any existing listeners first
    ipcRenderer.removeAllListeners('toggle-settings');
    ipcRenderer.on('toggle-settings', () => {
      console.log('[Preload] Received toggle-settings');
      callback();
    });
  },

  // Send to main process
  hideWindow: () => ipcRenderer.send('hide-window'),
  showWindow: () => ipcRenderer.send('show-window'),
  setAlwaysOnTop: (value) => ipcRenderer.send('set-always-on-top', value),
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),

  isElectron: true
});

console.log('[Preload] ElectronAPI exposed');