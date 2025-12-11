// 预加载脚本 - 安全的 IPC 通信
// 文件: preload.js

const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的 IPC 通道
contextBridge.exposeInMainWorld('electronAPI', {
  // 流控制
  startStream: () => ipcRenderer.send('stream:start'),
  stopStream: () => ipcRenderer.send('stream:stop'),
  
  // 状态查询
  getStatus: (callback) => ipcRenderer.on('status', callback),
  requestStatus: () => ipcRenderer.send('get:status'),
  
  // 配置更新
  updateConfig: (config) => ipcRenderer.send('config:update', config),
  onConfigUpdated: (callback) => ipcRenderer.on('config:updated', callback),
  
  // 流状态监听
  onStreamStatus: (callback) => ipcRenderer.on('stream:status', callback),
  onStreamError: (callback) => ipcRenderer.on('stream:error', callback),
  
  // 移除监听
  removeStreamStatusListener: () => ipcRenderer.removeAllListeners('stream:status'),
  removeErrorListener: () => ipcRenderer.removeAllListeners('stream:error')
});
