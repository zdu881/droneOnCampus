// Preload 脚本 - 在主进程和渲染进程之间建立安全通信
// 文件: src/preload.js

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 暴露 electronAPI 到渲染进程
 * 这些是渲染进程可以调用的方法
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 启动流
   */
  startStream: () => {
    ipcRenderer.send('stream:start');
  },

  /**
   * 停止流
   */
  stopStream: () => {
    ipcRenderer.send('stream:stop');
  },

  /**
   * 更新配置
   */
  updateConfig: (config) => {
    ipcRenderer.send('config:update', config);
  },

  /**
   * 请求当前状态
   */
  requestStatus: () => {
    ipcRenderer.send('status:request');
  },

  /**
   * 监听流状态变化
   * @param {Function} callback - 回调函数，接收 (event, data) 两个参数
   */
  onStreamStatus: (callback) => {
    ipcRenderer.on('stream:status', callback);
  },

  /**
   * 监听错误
   */
  onStreamError: (callback) => {
    ipcRenderer.on('stream:error', callback);
  },

  /**
   * 监听飞行状态变化
   */
  onFlightStatus: (callback) => {
    ipcRenderer.on('flight:status', callback);
  },

  /**
   * 监听配置更新完成
   */
  onConfigUpdated: (callback) => {
    ipcRenderer.on('config:updated', callback);
  },

  /**
   * 移除监听器
   */
  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
});

console.log('✅ Preload script loaded - electronAPI exposed');
