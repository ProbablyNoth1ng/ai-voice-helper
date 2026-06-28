const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
 
  onHotkeyPressed: (callback) => { 
    ipcRenderer.removeAllListeners('hotkey-pressed');
    ipcRenderer.on('hotkey-pressed', () => {
      console.log('[Preload] Received hotkey-pressed');
      callback();
    });
  },
 
  onToggleSettings: (callback) => {
 
    ipcRenderer.removeAllListeners('toggle-settings');
    ipcRenderer.on('toggle-settings', () => {
      console.log('[Preload] Received toggle-settings');
      callback();
    });
  },

  onCodingHotkeyPressed: (callback) => {
    ipcRenderer.removeAllListeners('coding-hotkey-pressed');
    ipcRenderer.on('coding-hotkey-pressed', () => {
      console.log('[Preload] Received coding-hotkey-pressed');
      callback();
    });
  },

 
  hideWindow: () => ipcRenderer.send('hide-window'),
  showWindow: () => ipcRenderer.send('show-window'),
  setAlwaysOnTop: (value) => ipcRenderer.send('set-always-on-top', value),
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),
  captureCodingScreenshot: () => ipcRenderer.invoke('capture-coding-screenshot'),

  isElectron: true
});

console.log('[Preload] ElectronAPI exposed');
