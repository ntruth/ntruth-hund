const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  searchFiles: (payload) => ipcRenderer.invoke('search:files', payload),
  listScripts: (directory) => ipcRenderer.invoke('scripts:list', directory),
  executeScripts: (payload) => ipcRenderer.invoke('scripts:execute', payload),
  openFile: (filePath) => ipcRenderer.invoke('path:open', filePath),
  revealFile: (filePath) => ipcRenderer.invoke('path:reveal', filePath),
  onScriptProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('scripts:progress', listener);
    return () => ipcRenderer.removeListener('scripts:progress', listener);
  }
});
