'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('navConfig', {
  hacer: (accion, d) => ipcRenderer.invoke('nav-config', accion, d),
});
