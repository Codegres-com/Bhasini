const { contextBridge, ipcRenderer } = require('electron');

// Exposed to the Bhasini editor (see src/Bhasini.Web/wwwroot/js/editor.js, bhasini.desktop).
contextBridge.exposeInMainWorld('bhasiniDesktop', {
  globalKeyboard: {
    getState: () => ipcRenderer.invoke('global-keyboard:get-state'),
    toggle: () => ipcRenderer.send('global-keyboard:toggle'),
    setLanguage: (code) => ipcRenderer.send('global-keyboard:set-language', code),
    setMethod: (method) => ipcRenderer.send('global-keyboard:set-method', method),
    onStateChanged: (callback) => {
      ipcRenderer.on('global-keyboard:state', (_event, state) => callback(state));
    },
  },
});
