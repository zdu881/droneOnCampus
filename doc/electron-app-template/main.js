// 完整的 Electron 应用样板 - 像素流自动接收 (Windows 优化版)
// 文件: main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const DroneFlightMonitor = require('./src/drone-monitor');
const PixelStreamManager = require('./src/stream-manager');

let mainWindow;
let droneMonitor;
let streamManager;
let corsProxy; // CORS 代理服务器

// Windows 平台检测
const isWindows = process.platform === 'win32';

app.on('ready', () => {
  // 启动 CORS 代理服务器 (用于处理跨域问题)
  startCorsProxy();

  // 创建窗口 - Windows 优化
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    icon: isWindows ? path.join(__dirname, 'assets', 'icon.ico') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      enableRemoteModule: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Windows 特定配置
      ...(isWindows && {
        webSecurity: true,
        // 允许 file:// 协议
        allowRunningInsecureContent: false
      })
    }
  });

  // 加载 HTML
  mainWindow.loadFile('src/index.html');

  // 打开开发工具 (可选)
  // mainWindow.webContents.openDevTools();

  // 初始化监控和流管理
  initializeMonitoring();

  // Windows 特定处理：窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 停止 CORS 代理
    if (corsProxy) {
      corsProxy.close();
    }
    app.quit();
  }
});

// CORS 代理服务器 - 用于跨域请求
function startCorsProxy() {
  corsProxy = http.createServer((req, res) => {
    // 设置 CORS 响应头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // 提供配置信息的接口
    if (req.url === '/config') {
      res.writeHead(200);
      res.end(JSON.stringify({
        dashboardUrl: 'http://10.30.2.11:8000',
        streamUrl: 'http://10.30.2.11:80',
        proxyPort: 3000
      }));
      return;
    }

    // 代理请求到目标服务器
    if (req.url.startsWith('/proxy')) {
      const target = req.url.substring(7); // 移除 /proxy/ 前缀
      const targetUrl = new URL(target);
      
      const proxyReq = http.request({
        hostname: targetUrl.hostname,
        port: targetUrl.port || 80,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          'host': targetUrl.host
        }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (error) => {
        console.error('Proxy error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      });

      req.pipe(proxyReq);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  corsProxy.listen(3000, 'localhost', () => {
    console.log('🌐 CORS proxy server started on http://localhost:3000');
  });

  corsProxy.on('error', (error) => {
    if (error.code !== 'EADDRINUSE') {
      console.error('CORS proxy error:', error);
    }
  });
}

// 初始化飞行监控和流管理
function initializeMonitoring() {
  // 【重要】配置要监听的 Dashboard 地址
  const DASHBOARD_API_URL = 'http://10.30.2.11:8000';
  
  // 创建监控器实例
  droneMonitor = new DroneFlightMonitor(DASHBOARD_API_URL);
  streamManager = new PixelStreamManager('http://10.30.2.11:80');

  // 监听飞行开始事件
  droneMonitor.on('flight:started', () => {
    console.log('✈️ Drone flight started - Starting pixel stream');
    
    // 通知渲染进程开始流
    mainWindow.webContents.send('stream:status', {
      status: 'streaming',
      message: '正在接收像素流...',
      timestamp: Date.now()
    });

    // 启动流接收
    streamManager.startStream();
  });

  // 监听飞行停止事件
  droneMonitor.on('flight:stopped', () => {
    console.log('🛑 Drone flight stopped - Stopping pixel stream');
    
    // 通知渲染进程停止流
    mainWindow.webContents.send('stream:status', {
      status: 'idle',
      message: '等待无人机飞行...',
      timestamp: Date.now()
    });

    // 停止流接收
    streamManager.stopStream();
  });

  // 监听错误事件
  droneMonitor.on('error', (error) => {
    console.error('❌ Monitor error:', error.message);
    mainWindow.webContents.send('stream:error', {
      message: error.message,
      timestamp: Date.now()
    });
  });

  // 启动监控
  console.log('🎯 Starting drone flight monitoring...');
  droneMonitor.start();
}

// IPC 处理 - 手动启动/停止流
ipcMain.on('stream:start', () => {
  console.log('📡 Manual stream start request');
  streamManager.startStream();
  mainWindow.webContents.send('stream:status', {
    status: 'streaming',
    message: '手动启动像素流接收'
  });
});

ipcMain.on('stream:stop', () => {
  console.log('⏹️ Manual stream stop request');
  streamManager.stopStream();
  mainWindow.webContents.send('stream:status', {
    status: 'idle',
    message: '手动停止像素流接收'
  });
});

// IPC 处理 - 获取当前状态
ipcMain.on('status:request', (event) => {
  console.log('📊 Status request from renderer');
  event.reply('status', {
    isStreaming: streamManager.isActive,
    isFlying: droneMonitor.isFlying,
    serverUrl: 'http://10.30.2.11:80',
    timestamp: Date.now()
  });
});

// IPC 处理 - 更新配置
ipcMain.on('config:update', (event, config) => {
  console.log('⚙️ Updating configuration:', config);
  
  if (config.dashboardUrl) {
    droneMonitor.serverUrl = config.dashboardUrl;
    console.log(`✅ Dashboard URL updated to: ${config.dashboardUrl}`);
  }
  if (config.streamUrl) {
    streamManager.streamUrl = config.streamUrl;
    console.log(`✅ Stream URL updated to: ${config.streamUrl}`);
  }
  
  event.reply('config:updated', { success: true });
});

// 应用退出时清理资源
app.on('quit', () => {
  if (droneMonitor) {
    droneMonitor.stop();
  }
  if (streamManager) {
    streamManager.stopStream();
  }
});

module.exports = { mainWindow, droneMonitor, streamManager };
