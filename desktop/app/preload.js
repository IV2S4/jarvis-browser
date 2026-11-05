'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nav', {
  hacer: (accion, d) => ipcRenderer.invoke('nav', accion, d),
  en: (canal, fn) => ipcRenderer.on(canal, (_e, d) => fn(d)),
});
