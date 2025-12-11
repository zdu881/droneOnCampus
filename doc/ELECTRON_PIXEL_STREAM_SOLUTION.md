# Electron 像素流自动接收方案

## 📋 需求分析

**目标**: 构建独立于本机的 Electron 应用，自动检测无人机飞行状态，在飞行开始时接收像素流，飞行停止后终止接收。

**关键指标**:
- 无人机飞行状态检测方式：✅ **通过 UE Remote Control 读取 `bArePropellersActive` 属性**
- 像素流接收启动/停止机制
- 远程部署独立运行

---

## 🎯 飞行状态检测方案 (已实现✅)

### 核心方法: 读取 `bArePropellersActive` 属性

无人机在飞行时，UE5 中的 `bArePropellersActive` 属性为 `true`，停止时为 `false`。

**实现位置**: `api-manager.js`

```javascript
// 【核心】检测无人机是否在飞行 - 通过读取 bArePropellersActive 属性
async isUAVFlying() {
  try {
    const result = await this.readDroneProperty("bArePropellersActive");
    
    if (result.success) {
      const isFlying = result.value === true || result.value === 1 || result.value === "true";
      console.log(`无人机飞行状态: ${isFlying ? '✈️ 飞行中' : '🛑 停止'}`);
      
      return {
        success: true,
        isFlying: isFlying,
        propellerActive: result.value
      };
    }
  } catch (error) {
    console.error('检测飞行状态失败:', error);
    return { success: false, isFlying: false };
  }
}

// 读取无人机属性
async readDroneProperty(propertyName) {
  const payload = {
    objectPath: this.droneActorPath,
    propertyName: propertyName,
    access: "READ_ACCESS"  // 【关键】告诉 UE 我是来"读"数据的
  };

  const response = await fetch("http://10.30.2.11:30010/remote/object/property", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  return {
    success: true,
    propertyName: propertyName,
    value: data.value
  };
}
```

**优点**:
- ✅ 精确度最高（直接读取螺旋桨状态）
- ✅ 延迟最低（单个属性读取）
- ✅ 无需轮询函数，只读取属性
- ✅ 内存开销小

---

## 🏗️ 架构设计

### 系统组件

```
┌─────────────────────────────────────────────────────────────┐
│                    当前系统 (主控机)                         │
├─────────────────────────────────────────────────────────────┤
│  Dashboard (Web) - 已实现飞行监控                           │
│  ├─ 飞行状态监控: 每500ms检测一次 bArePropellersActive    │
│  ├─ 状态变化时广播事件: drone:flight:started/stopped       │
│  ├─ 发送 WebSocket 事件                                     │
│  └─ 显示通知: ✈️/🛬                                        │
│                                                             │
│  API Manager (api-manager.js)                              │
│  ├─ readDroneProperty() - 读取 UE 属性                    │
│  ├─ isUAVFlying() - 检测飞行状态                         │
│  └─ UE Remote Control 端口: 30010                         │
│                                                             │
│  Pixel Streaming Server (端口 80)                          │
│  └─ UE5 像素流输出                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓ WebSocket / HTTP
┌─────────────────────────────────────────────────────────────┐
│           Electron 像素流接收应用 (其他机器)               │
├─────────────────────────────────────────────────────────────┤
│  Main Process                                               │
│  ├─ DroneFlightMonitor (监听飞行状态变化)                 │
│  │  └─ 轮询 API: http://10.30.2.11:8000/api/drone/status  │
│  │     (Dashboard 提供的 HTTP 接口)                        │
│  ├─ PixelStreamManager (启动/停止流)                      │
│  └─ IPC 通信 ↔ Renderer                                    │
│                                                             │
│  Renderer Process                                           │
│  ├─ 像素流显示 (iframe 自动连接)                          │
│  ├─ 实时状态指示器                                        │
│  └─ 操作日志面板                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 飞行状态检测方案 - 已实现 ✅

### 核心实现: 通过 `bArePropellersActive` 属性检测

**优点**:
- ✅ **已在 Dashboard 中实现** 
- ✅ 精确度最高（直接读取螺旋桨状态）
- ✅ 延迟最低（每 500ms 检查一次）
- ✅ 自动广播飞行事件

**工作流程**:

```
1. 连接 UE 成功
   ↓
2. Dashboard 启动 startDroneFlightMonitoring()
   ↓
3. 每 500ms 调用 apiManager.isUAVFlying()
   ↓
4. 读取 bArePropellersActive 属性
   ↓
5. 状态变化时广播事件:
   - drone:flight:started (✈️ 开始飞行)
   - drone:flight:stopped (🛬 停止飞行)
   ↓
6. 事件发送至 WebSocket (可被 Electron 应用接收)
```

**Dashboard 中的实现** (`dashboard-manager.js`):

```javascript
// 【核心】启动无人机飞行状态实时监控
startDroneFlightMonitoring() {
  console.log('🎯 Starting drone flight status monitoring...');
  
  // 每 500ms 检查一次飞行状态
  this.flightStatusCheckInterval = setInterval(async () => {
    try {
      if (window.apiManager) {
        const result = await window.apiManager.isUAVFlying();
        
        if (result.success) {
          const nowFlying = result.isFlying;
          
          // 状态变化时触发事件
          if (nowFlying && !this.isDroneFlying) {
            this.isDroneFlying = true;
            console.log('✈️ DRONE FLIGHT STARTED');
            this.broadcastFlightEvent('started', result);
          } else if (!nowFlying && this.isDroneFlying) {
            this.isDroneFlying = false;
            console.log('🛑 DRONE FLIGHT STOPPED');
            this.broadcastFlightEvent('stopped', result);
          }
        }
      }
    } catch (error) {
      console.error('Error checking flight status:', error);
    }
  }, 500); // 检查间隔：500ms
}

// 广播飞行事件
broadcastFlightEvent(eventType, data = {}) {
  // 事件 1: 发送至全局窗口事件
  const event = new CustomEvent(`drone:flight:${eventType}`, {
    detail: {
      type: eventType,
      timestamp: Date.now(),
      data: data
    }
  });
  window.dispatchEvent(event);

  // 事件 2: WebSocket 远程广播
  if (window.wsManager) {
    window.wsManager.send({
      type: 'drone:flight:event',
      event: eventType,
      data: data,
      timestamp: Date.now()
    });
  }

  // 事件 3: 显示通知
  this.showFlightNotification(eventType);
}
```

---

## 🚀 Electron 应用接收飞行事件

### 方案 1: 通过 HTTP 轮询 (推荐 - 简单易行)

Electron 应用定期轮询 Dashboard 提供的 API 接口。

**步骤 1: Dashboard 提供 HTTP 接口** (`dashboard-manager.js` 或后端服务):

```javascript
// 可以在 window 全局对象上暴露飞行状态
window.getDroneFlightStatus = () => {
  return {
    isFlying: window.dashboardManager.isDroneFlying,
    timestamp: Date.now()
  };
};

// 或通过 Express 后端暴露:
// GET /api/drone/status
// {
//   "isFlying": true,
//   "propellerActive": true,
//   "timestamp": 1670000000
// }
```

**步骤 2: Electron 轮询接口** (`src/drone-monitor.js`):

```javascript
// 修改后的轮询逻辑
async checkFlightStatus() {
  try {
    // 从 Dashboard 后端或 WebSocket 获取飞行状态
    const response = await fetch('http://10.30.2.11:8000/api/drone/status', {
      timeout: 5000
    });
    
    const data = await response.json();
    // data.isFlying 来自 Dashboard 的 isDroneFlying 状态
    const nowFlying = data.isFlying;

    if (nowFlying && !this.isFlying) {
      this.isFlying = true;
      this.emit('flight:started', { timestamp: Date.now() });
    } else if (!nowFlying && this.isFlying) {
      this.isFlying = false;
      this.emit('flight:stopped', { timestamp: Date.now() });
    }
  } catch (error) {
    console.error('Failed to check flight status:', error);
  }

  // 继续轮询
  this.timeout = setTimeout(() => this.checkFlightStatus(), 500);
}
```

### 方案 2: 通过 WebSocket 实时接收 (最快)

Electron 应用连接 Dashboard 的 WebSocket，实时接收飞行事件。

**Electron 主进程** (`main.js`):

```javascript
const WebSocket = require('ws');

class DashboardWSListener {
  constructor(wsUrl = 'ws://10.30.2.11:8000/ws') {
    this.wsUrl = wsUrl;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('✅ Connected to Dashboard WebSocket');
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        event: 'drone:flight:event'
      }));
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        
        if (message.type === 'drone:flight:event') {
          console.log(`🚁 Flight event: ${message.event}`);
          // 触发主窗口事件
          if (message.event === 'started') {
            mainWindow.webContents.send('drone:flight:started');
          } else if (message.event === 'stopped') {
            mainWindow.webContents.send('drone:flight:stopped');
          }
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('⚠️ WebSocket disconnected');
      setTimeout(() => this.connect(), 3000);
    });
  }
}

// 在 app.on('ready') 中使用
const wsListener = new DashboardWSListener();
wsListener.connect();
```

---

## 🔌 旧方案 (仅供参考)

### 方案 A: WebSocket 事件监听 (已改进)

**原理**: Dashboard 中已有 WebSocket 连接，可以发布飞行事件

**优点**:
- 实时性最高
- 无需轮询
- 已有基础设施

**实现步骤**:

1. **修改 Dashboard 中的飞行控制** (`dashboard-manager.js`):

```javascript
// 在 startDroneFlight 中添加事件发布
async startDroneFlight() {
  try {
    this.logToConsole("Starting drone flight...", "info");
    
    if (window.apiManager) {
      const result = await window.apiManager.triggerDroneAction();
      if (result.success) {
        // ✅ 发送飞行开始事件
        this.broadcastEvent('drone:flight:started', {
          timestamp: Date.now(),
          status: 'flying'
        });
        
        this.logToConsole("Drone flight started successfully", "success");
      }
    }
  } catch (error) {
    this.logToConsole(`Failed to start drone flight: ${error.message}`, "error");
  }
}

// 添加飞行停止检测 (需要结合 UE 的飞行状态回调)
async monitorDroneFlightStatus() {
  // 定期轮询或通过 UE 回调检测飞行状态
  this.flightStatusInterval = setInterval(async () => {
    if (window.apiManager) {
      try {
        const status = await window.apiManager.getDroneFlightStatus();
        if (!status.isFlying && this.isDroneFlying) {
          // 从飞行状态转为非飞行状态
          this.broadcastEvent('drone:flight:stopped', {
            timestamp: Date.now(),
            status: 'idle'
          });
          this.isDroneFlying = false;
        } else if (status.isFlying) {
          this.isDroneFlying = true;
        }
      } catch (err) {
        console.error('Failed to check flight status:', err);
      }
    }
  }, 1000); // 每秒检查一次
}

// 广播事件方法
broadcastEvent(eventName, data) {
  if (window.wsManager) {
    window.wsManager.send({
      type: 'drone:event',
      event: eventName,
      data: data,
      timestamp: Date.now()
    });
  }
}
```

2. **在 API Manager 中添加飞行状态查询**:

```javascript
// api-manager.js
async getDroneFlightStatus() {
  try {
    const response = await fetch(`${this.baseUrl}/api/drone/status`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      isFlying: data.status === 'flying',
      position: data.position,
      velocity: data.velocity
    };
  } catch (error) {
    console.error('Failed to get drone status:', error);
    return { isFlying: false };
  }
}
```

---

### 方案 B: HTTP 轮询 (备选)

**原理**: Electron 应用定期轮询飞行状态 API

**优点**:
- 无需修改主控机代码
- 实现简单

**缺点**:
- 延迟较高 (取决于轮询频率)
- 增加服务器负担

**实现**:

```javascript
// electron-main.js
class DroneFlightMonitor {
  constructor(serverUrl = 'http://10.30.2.11:8000') {
    this.serverUrl = serverUrl;
    this.isFlying = false;
    this.pollInterval = null;
  }

  start() {
    this.pollInterval = setInterval(() => this.checkFlightStatus(), 1000);
  }

  async checkFlightStatus() {
    try {
      const response = await fetch(`${this.serverUrl}/api/drone/status`);
      const data = await response.json();
      const nowFlying = data.status === 'flying';

      if (nowFlying && !this.isFlying) {
        // 飞行开始
        this.onFlightStarted();
      } else if (!nowFlying && this.isFlying) {
        // 飞行停止
        this.onFlightStopped();
      }

      this.isFlying = nowFlying;
    } catch (error) {
      console.error('Failed to check flight status:', error);
    }
  }

  onFlightStarted() {
    console.log('✈️ Drone flight started');
    this.broadcastToRenderer('drone:flight:started');
  }

  onFlightStopped() {
    console.log('✈️ Drone flight stopped');
    this.broadcastToRenderer('drone:flight:stopped');
  }

  broadcastToRenderer(event) {
    // 发送至 Renderer 进程
    if (this.window) {
      this.window.webContents.send(event);
    }
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
```

---

### 方案 C: UE5 直接反馈 (最精确，但需要开发)

**原理**: 无人机飞行时 UE5 发送事件至 Electron 应用

**优点**:
- 最精确的状态
- 零延迟

**缺点**:
- 需要 UE5 项目修改
- 需要额外的通信渠道

**实现流程**:

1. 在 UE5 中添加委托事件：
```cpp
// NewMap_C.h
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDroneFlightStatusChanged, bool, bIsFlying);

UPROPERTY(BlueprintAssignable)
FOnDroneFlightStatusChanged OnDroneFlightStatusChanged;
```

2. 添加远程事件发送：
```cpp
// 飞行启动时
if (OnDroneFlightStatusChanged.IsBound()) {
  OnDroneFlightStatusChanged.Broadcast(true);
}
// 发送 HTTP 请求至 Electron 应用
FHttpModule::Get().GetHttpManager().AddRequest(...);
```

3. Electron 侦听事件：
```javascript
const { ipcMain } = require('electron');

ipcMain.on('drone:flight:event', (event, data) => {
  if (data.isFlying) {
    pixelStreamManager.startStream();
  } else {
    pixelStreamManager.stopStream();
  }
});
```

---

## 💻 Electron 应用实现

### 1. 项目结构

```
electron-pixel-stream-app/
├── main.js                    # 主进程
├── preload.js                 # 预加载脚本
├── src/
│   ├── renderer.js           # 渲染进程脚本
│   ├── index.html            # UI 页面
│   ├── stream-manager.js     # 像素流管理
│   └── drone-monitor.js      # 飞行状态监控
├── package.json
└── README.md
```

### 2. Main Process (main.js)

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const DroneFlightMonitor = require('./src/drone-monitor');
const PixelStreamManager = require('./src/stream-manager');

let mainWindow;
let droneMonitor;
let streamManager;

app.on('ready', () => {
  // 创建窗口
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('src/index.html');

  // 初始化监控器
  droneMonitor = new DroneFlightMonitor('http://10.30.2.11:8000');
  streamManager = new PixelStreamManager('http://10.30.2.11:80');

  // 设置事件处理
  droneMonitor.on('flight:started', () => {
    console.log('🚁 Flight started - Starting stream');
    streamManager.startStream();
    mainWindow.webContents.send('stream:status', { 
      status: 'streaming', 
      message: 'Receiving pixel stream...'
    });
  });

  droneMonitor.on('flight:stopped', () => {
    console.log('🛑 Flight stopped - Stopping stream');
    streamManager.stopStream();
    mainWindow.webContents.send('stream:status', { 
      status: 'idle', 
      message: 'Waiting for drone flight...'
    });
  });

  // 启动监控
  droneMonitor.start();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 处理
ipcMain.on('stream:start', () => {
  streamManager.startStream();
});

ipcMain.on('stream:stop', () => {
  streamManager.stopStream();
});

ipcMain.on('get:status', (event) => {
  event.reply('status', {
    isStreaming: streamManager.isActive,
    isFlying: droneMonitor.isFlying,
    serverUrl: 'http://10.30.2.11:80'
  });
});
```

### 3. Drone Monitor (src/drone-monitor.js)

```javascript
const EventEmitter = require('events');

class DroneFlightMonitor extends EventEmitter {
  constructor(serverUrl = 'http://10.30.2.11:8000') {
    super();
    this.serverUrl = serverUrl;
    this.isFlying = false;
    this.pollInterval = 1000; // 轮询间隔 (毫秒)
    this.timeout = null;
  }

  start() {
    console.log('🎯 Starting flight status monitor');
    this.checkFlightStatus();
  }

  async checkFlightStatus() {
    try {
      const response = await fetch(`${this.serverUrl}/api/drone/status`, {
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const nowFlying = data.status === 'flying' || 
                       (data.action && data.action !== 'idle');

      // 状态变化检测
      if (nowFlying && !this.isFlying) {
        this.isFlying = true;
        console.log('✈️ DRONE FLIGHT STARTED');
        this.emit('flight:started', { timestamp: Date.now() });
      } else if (!nowFlying && this.isFlying) {
        this.isFlying = false;
        console.log('🛑 DRONE FLIGHT STOPPED');
        this.emit('flight:stopped', { timestamp: Date.now() });
      }

    } catch (error) {
      console.error('❌ Flight status check failed:', error.message);
    }

    // 继续轮询
    this.timeout = setTimeout(() => this.checkFlightStatus(), this.pollInterval);
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    console.log('🎯 Flight monitor stopped');
  }
}

module.exports = DroneFlightMonitor;
```

### 4. Stream Manager (src/stream-manager.js)

```javascript
const EventEmitter = require('events');

class PixelStreamManager extends EventEmitter {
  constructor(streamUrl = 'http://10.30.2.11:80') {
    super();
    this.streamUrl = streamUrl;
    this.isActive = false;
    this.iframe = null;
    this.recordingStream = null;
  }

  startStream() {
    if (this.isActive) {
      console.log('⚠️ Stream already active');
      return;
    }

    this.isActive = true;
    console.log('🎬 Starting pixel stream:', this.streamUrl);

    // 发送事件至渲染进程启动流
    this.emit('stream:started', {
      url: this.streamUrl,
      timestamp: Date.now()
    });

    // 可选: 启动本地录制
    this.startRecording();
  }

  stopStream() {
    if (!this.isActive) {
      console.log('⚠️ Stream already stopped');
      return;
    }

    this.isActive = false;
    console.log('⏹️ Stopping pixel stream');

    // 发送事件至渲染进程停止流
    this.emit('stream:stopped', {
      timestamp: Date.now()
    });

    // 停止录制
    this.stopRecording();
  }

  startRecording() {
    // 实现本地录制逻辑 (可选)
    // 使用 FFmpeg 或其他视频库
    console.log('🎥 Recording started');
  }

  stopRecording() {
    console.log('🎥 Recording stopped');
  }
}

module.exports = PixelStreamManager;
```

### 5. Renderer Process (src/renderer.js)

```javascript
const { ipcRenderer } = require('electron');

class StreamUI {
  constructor() {
    this.statusElement = document.getElementById('status');
    this.streamContainer = document.getElementById('stream-container');
    this.logElement = document.getElementById('log');
    this.isStreaming = false;
  }

  init() {
    // 监听主进程事件
    ipcRenderer.on('stream:status', (event, data) => {
      this.updateStatus(data.status, data.message);
    });

    // 设置按钮事件
    document.getElementById('start-btn').addEventListener('click', () => {
      ipcRenderer.send('stream:start');
    });

    document.getElementById('stop-btn').addEventListener('click', () => {
      ipcRenderer.send('stream:stop');
    });

    // 初始状态查询
    ipcRenderer.send('get:status');
    ipcRenderer.once('status', (data) => {
      console.log('Current status:', data);
    });

    this.log('🚀 Pixel Stream Receiver initialized');
  }

  updateStatus(status, message) {
    this.statusElement.textContent = message;
    this.statusElement.className = `status ${status}`;
    this.log(`📊 Status: ${status} - ${message}`);

    if (status === 'streaming') {
      this.startDisplayingStream();
      this.isStreaming = true;
    } else {
      this.stopDisplayingStream();
      this.isStreaming = false;
    }
  }

  startDisplayingStream() {
    const iframe = document.createElement('iframe');
    iframe.src = 'http://10.30.2.11:80';
    iframe.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
      background: #000;
    `;
    this.streamContainer.innerHTML = '';
    this.streamContainer.appendChild(iframe);
    this.log('✅ Pixel stream display started');
  }

  stopDisplayingStream() {
    this.streamContainer.innerHTML = '';
    this.log('❌ Pixel stream display stopped');
  }

  log(message) {
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    entry.className = 'log-entry';
    this.logElement.appendChild(entry);
    this.logElement.scrollTop = this.logElement.scrollHeight;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const ui = new StreamUI();
  ui.init();
});
```

### 6. Index.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pixel Stream Receiver</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0a0e27;
      color: #fff;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    #header {
      background: #1a1f3a;
      padding: 15px;
      border-bottom: 2px solid #00d4ff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    h1 {
      font-size: 18px;
      color: #00d4ff;
    }

    #status {
      font-size: 14px;
      padding: 8px 16px;
      border-radius: 4px;
      background: #2a2f4a;
      color: #ffa500;
    }

    #status.streaming {
      background: #0d4620;
      color: #00ff00;
    }

    #status.idle {
      background: #4a2a2a;
      color: #ff6b6b;
    }

    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    button {
      padding: 8px 16px;
      background: #00d4ff;
      border: none;
      color: #0a0e27;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s;
    }

    button:hover {
      background: #00f0ff;
      transform: scale(1.05);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #stream-container {
      flex: 1;
      position: relative;
      background: #000;
      overflow: hidden;
    }

    #log {
      background: #1a1f3a;
      border-top: 1px solid #00d4ff;
      height: 150px;
      overflow-y: auto;
      padding: 10px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
    }

    .log-entry {
      padding: 4px;
      border-bottom: 1px solid #2a2f4a;
      color: #00d4ff;
    }

    .log-entry:last-child {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <div id="header">
    <div>
      <h1>🎬 Pixel Stream Receiver</h1>
      <p style="font-size: 12px; color: #888; margin-top: 5px;">
        Electron App - Auto-detection Mode
      </p>
    </div>
    <div id="status" class="idle">Waiting for drone flight...</div>
    <div class="controls">
      <button id="start-btn">▶️ Start Stream</button>
      <button id="stop-btn">⏹️ Stop Stream</button>
    </div>
  </div>

  <div id="stream-container">
    <div style="
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #666;
    ">
      <p style="font-size: 18px; margin-bottom: 10px;">📡 Waiting for pixel stream...</p>
      <p style="font-size: 12px;">Application will auto-connect when drone starts flying</p>
    </div>
  </div>

  <div id="log"></div>

  <script src="renderer.js"></script>
</body>
</html>
```

### 7. Package.json

```json
{
  "name": "pixel-stream-receiver",
  "version": "1.0.0",
  "description": "Electron app for receiving Pixel Streaming from Unreal Engine",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --debug",
    "build": "electron-builder"
  },
  "dependencies": {
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest"
  }
}
```

---

## 🚀 部署步骤

### 步骤 1: 主控机修改 (可选但推荐)

在 `dashboard-manager.js` 中添加飞行状态发布:

```javascript
// 在 constructor 中初始化
this.isDroneFlying = false;

// 在 initDroneControlPage 中启动状态监控
this.monitorDroneFlightStatus();

// 添加状态监控方法
async monitorDroneFlightStatus() {
  setInterval(async () => {
    try {
      if (window.apiManager) {
        // 调用 UE API 获取飞行状态
        const response = await fetch('http://10.30.2.11:30010/remote/object/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            objectPath: '/Game/NewMap.NewMap:PersistentLevel.NewMap_C_3',
            functionName: 'GetFlightStatus',
            parameters: {}
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const isNowFlying = data.isFlying;
          
          if (isNowFlying && !this.isDroneFlying) {
            this.isDroneFlying = true;
            this.broadcastFlightEvent('started');
          } else if (!isNowFlying && this.isDroneFlying) {
            this.isDroneFlying = false;
            this.broadcastFlightEvent('stopped');
          }
        }
      }
    } catch (error) {
      console.error('Error checking flight status:', error);
    }
  }, 1000);
}

broadcastFlightEvent(event) {
  // 发送至 WebSocket 订阅者
  if (window.wsManager) {
    window.wsManager.broadcast({
      type: 'drone:flight',
      event: event,
      timestamp: Date.now()
    });
  }
}
```

### 步骤 2: Electron 应用部署

```bash
# 在其他机器上
cd /path/to/electron-pixel-stream-app

# 安装依赖
npm install

# 修改配置指向主控机地址
# 在 src/drone-monitor.js 中修改:
const serverUrl = 'http://10.30.2.11:8000'; // 改为实际主控机 IP

# 运行应用
npm start

# 或构建可执行文件
npm run build
```

### 步骤 3: 配置网络

```bash
# 确保从 Electron 应用机器可以访问主控机
ping 10.30.2.11
curl http://10.30.2.11:80  # 像素流服务器
curl http://10.30.2.11:8000  # API 服务器
```

---

## 🔧 高级配置

### 自动启动录制

```javascript
// stream-manager.js 中
const { spawn } = require('child_process');

startRecording() {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const outputFile = `./recordings/stream_${timestamp}.mp4`;

  this.ffmpegProcess = spawn('ffmpeg', [
    '-i', this.streamUrl,
    '-c:v', 'libx264',
    '-c:a', 'aac',
    outputFile
  ]);

  this.ffmpegProcess.on('error', (err) => {
    console.error('Recording error:', err);
  });

  console.log(`🎥 Recording to ${outputFile}`);
}

stopRecording() {
  if (this.ffmpegProcess) {
    this.ffmpegProcess.kill('SIGINT');
    console.log('🎥 Recording stopped');
  }
}
```

### 性能优化

```javascript
// 在 electron main.js 中
app.commandLine.appendSwitch('remote-debugging-port', '9222');
app.commandLine.appendSwitch('disable-features', 'TranslateUI');

mainWindow = new BrowserWindow({
  webPreferences: {
    offscreen: false, // 启用硬件加速
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true
  }
});

// 禁用浏览器同源策略 (开发环境)
mainWindow.webPreferences.webSecurity = false;
```

### 错误恢复

```javascript
// drone-monitor.js
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async checkFlightStatus() {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      const response = await fetch(`${this.serverUrl}/api/drone/status`, {
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        // 处理...
        retries = 0; // 重置重试计数
      }
    } catch (error) {
      retries++;
      if (retries < MAX_RETRIES) {
        console.log(`Retry attempt ${retries}/${MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      } else {
        console.error('Max retries exceeded');
        this.emit('connection:failed');
      }
    }
  }
}
```

---

## 📊 监控和调试

### 状态监控面板

```bash
# 查看 Electron 应用日志
npm start -- --debug

# 在浏览器中打开开发者工具
electron-main.js 中添加:
mainWindow.webContents.openDevTools();
```

### 故障排查清单

- [ ] 检查主控机 API 服务状态 (`curl http://10.30.2.11:8000/api/drone/status`)
- [ ] 验证像素流服务 (`curl -I http://10.30.2.11:80`)
- [ ] 确认网络连通性 (`ping 10.30.2.11`)
- [ ] 查看 Electron 进程日志 (`console.log` 输出)
- [ ] 验证 UE5 项目飞行状态 API 可用性

---

## 📋 完整清单

- [ ] 选择飞行状态检测方案 (推荐方案 A - WebSocket)
- [ ] 修改 Dashboard 中的飞行控制代码 (可选)
- [ ] 创建 Electron 项目目录结构
- [ ] 编写主进程代码 (main.js)
- [ ] 编写 UI 代码 (html + renderer.js)
- [ ] 配置监控器 (drone-monitor.js)
- [ ] 配置流管理器 (stream-manager.js)
- [ ] 修改配置指向主控机 IP
- [ ] 安装依赖 (`npm install`)
- [ ] 测试应用 (`npm start`)
- [ ] 验证自动检测功能
- [ ] 构建可执行文件 (可选)

---

## 🔗 相关资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [UE5 Pixel Streaming 文档](https://docs.unrealengine.com/5.0/en-US/pixel-streaming-in-unreal-engine/)
- [WebSocket 通信](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

