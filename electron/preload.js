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

 
  hideWindow: () => ipcRenderer.send('hide-window'),
  showWindow: () => ipcRenderer.send('show-window'),
  setAlwaysOnTop: (value) => ipcRenderer.send('set-always-on-top', value),
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),

  isElectron: true
});

console.log('[Preload] ElectronAPI exposed');