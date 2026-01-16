const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onHotkeyPressed: (callback) => {
    ipcRenderer.on('hotkey-pressed', () => callback());
  },
  onToggleSettings: (callback) => {
    ipcRenderer.on('toggle-settings', () => callback());
  },
  
  hideWindow: () => ipcRenderer.send('hide-window'),
  showWindow: () => ipcRenderer.send('show-window'),
  setAlwaysOnTop: (value) => ipcRenderer.send('set-always-on-top', value),
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),
  
  isElectron: true
});