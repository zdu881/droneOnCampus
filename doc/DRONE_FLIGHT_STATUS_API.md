# 无人机飞行状态检测 API 文档

## 📌 快速开始

### 核心方法

```javascript
// 在 api-manager.js 中
const result = await window.apiManager.isUAVFlying();

// 返回值
{
  success: true,
  isFlying: true,          // 无人机是否在飞行
  propellerActive: true    // 螺旋桨是否激活
}
```

### 在 Dashboard 中使用

```javascript
// 自动启动监控 (已在 connectToUE 中实现)
dashboardManager.startDroneFlightMonitoring();

// 手动启动
dashboardManager.startDroneFlightMonitoring();

// 停止监控
dashboardManager.stopDroneFlightMonitoring();

// 监听飞行事件
window.addEventListener('drone:flight:started', (event) => {
  console.log('✈️ Drone started flying');
  // 触发相关逻辑，例如启动像素流接收
});

window.addEventListener('drone:flight:stopped', (event) => {
  console.log('🛬 Drone stopped flying');
  // 停止相关逻辑，例如关闭像素流接收
});
```

---

## 🔧 API 详解

### 1. `isUAVFlying()` - 检测飞行状态

**描述**: 读取无人机的 `bArePropellersActive` 属性，判断是否在飞行

**调用方式**:
```javascript
const result = await window.apiManager.isUAVFlying();
```

**返回值**:
```javascript
{
  success: true,                    // 操作是否成功
  isFlying: true,                   // 无人机是否在飞行
  propellerActive: true             // 螺旋桨原始值
}
```

**错误处理**:
```javascript
const result = await window.apiManager.isUAVFlying();
if (!result.success) {
  console.error('Failed to check flight status:', result.error);
}
```

---

### 2. `readDroneProperty(propertyName)` - 读取任意属性

**描述**: 通过 UE Remote Control API 读取无人机的任意属性

**调用方式**:
```javascript
const result = await window.apiManager.readDroneProperty('bArePropellersActive');
```

**支持的属性**:
- `bArePropellersActive` - 螺旋桨是否激活 (boolean)
- `Velocity` - 速度向量 (vector)
- `Location` - 位置坐标 (vector)
- 其他 UE 属性...

**返回值**:
```javascript
{
  success: true,
  propertyName: 'bArePropellersActive',
  value: true
}
```

---

### 3. `startDroneFlightMonitoring()` - 启动监控

**描述**: 启动实时飞行状态监控循环，每 500ms 检查一次

**调用方式**:
```javascript
dashboardManager.startDroneFlightMonitoring();
```

**工作原理**:
1. 每 500ms 调用 `isUAVFlying()`
2. 检测状态变化
3. 状态改变时广播事件

**事件**:
- `drone:flight:started` - 无人机开始飞行
- `drone:flight:stopped` - 无人机停止飞行

---

### 4. `broadcastFlightEvent(eventType, data)` - 广播飞行事件

**描述**: 在状态变化时广播事件，支持多种方式

**调用方式**:
```javascript
dashboardManager.broadcastFlightEvent('started', {
  timestamp: Date.now(),
  propellerActive: true
});
```

**广播方式**:
1. 全局事件: `window.dispatchEvent()`
2. WebSocket: 发送至 `ws://10.30.2.11:8000/ws`
3. UI 通知: 显示浮动消息

---

## 📊 数据流

### 飞行状态变化流程

```
[用户点击飞行按钮]
        ↓
[UE 设置 bArePropellersActive = true]
        ↓
[Dashboard 监控周期检测 (500ms)]
        ↓
[apiManager.isUAVFlying() 返回 true]
        ↓
[状态从 false → true 变化检测到]
        ↓
[broadcastFlightEvent('started')]
        ↓
┌─────────────────────────────────────┐
│ 1. window.dispatchEvent()            │
│ 2. WebSocket 发送                   │
│ 3. 显示 UI 通知                      │
└─────────────────────────────────────┘
        ↓
[Electron 应用接收事件]
        ↓
[启动像素流接收]
```

---

## 🎯 Electron 应用集成

### 方案 1: HTTP 轮询

```javascript
// src/drone-monitor.js
async checkFlightStatus() {
  try {
    const response = await fetch('http://10.30.2.11:8000/api/drone/status');
    const data = await response.json();
    const isFlying = data.isFlying;  // 从 Dashboard 获取状态

    if (isFlying && !this.wasFlying) {
      this.emit('flight:started');
    } else if (!isFlying && this.wasFlying) {
      this.emit('flight:stopped');
    }

    this.wasFlying = isFlying;
  } catch (error) {
    console.error('Error checking flight status:', error);
  }

  setTimeout(() => this.checkFlightStatus(), 500);
}
```

**需要条件**: Dashboard 后端提供 `/api/drone/status` 接口

```javascript
// 在 Dashboard 后端或 window 全局对象中暴露
window.getDroneFlightStatus = () => ({
  isFlying: window.dashboardManager.isDroneFlying,
  timestamp: Date.now()
});
```

### 方案 2: WebSocket 实时监听

```javascript
// src/ws-listener.js
const ws = new WebSocket('ws://10.30.2.11:8000/ws');

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'drone:flight:event') {
    if (message.event === 'started') {
      console.log('✈️ Flight started');
      streamManager.startStream();
    } else if (message.event === 'stopped') {
      console.log('🛬 Flight stopped');
      streamManager.stopStream();
    }
  }
});
```

---

## ⚙️ 配置

### 默认参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 检查间隔 | 500ms | Dashboard 飞行监控周期 |
| UE API 端口 | 30010 | UE Remote Control |
| Dashboard API | 8000 | CastRay API 服务 |
| WebSocket | 8000/ws | 实时事件推送 |
| Pixel Streaming | 80 | 像素流服务 |

### 自定义配置

```javascript
// 修改检查间隔
dashboardManager.flightStatusCheckInterval = setInterval(() => {
  // ...
}, 1000); // 改为 1 秒

// 修改 API 路径
window.apiManager.droneActorPath = "/Game/...";
```

---

## 🐛 故障排查

### 问题 1: 属性读取失败

**症状**: `result.success === false`

**检查项**:
```bash
# 1. 检查 UE Remote Control 服务
curl -X GET http://10.30.2.11:30010/remote/object/property \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "/Game/NewMap.NewMap:PersistentLevel.FbxScene_Drone_C_UAID_107C61AAC641276C02_1958446408",
    "propertyName": "bArePropellersActive",
    "access": "READ_ACCESS"
  }'

# 2. 检查无人机对象路径是否正确
# 3. 确认 UE 项目已启动

# 4. 查看浏览器控制台错误日志
```

### 问题 2: 监控循环未启动

**症状**: 没有收到 `drone:flight:started/stopped` 事件

**检查项**:
```javascript
// 在浏览器控制台验证
console.log(window.dashboardManager.isDroneFlying);     // 查看状态
console.log(window.dashboardManager.flightStatusCheckInterval); // 查看监控是否启动
```

### 问题 3: 飞行状态不准确

**症状**: 飞行状态与实际不符

**原因和解决**:
- 检查间隔太长 → 改小 interval 值
- UE 属性未及时更新 → 重启 UE 项目
- 属性值类型错误 → 检查返回值类型 (bool/int/string)

---

## 📚 代码示例

### 完整示例: 监听飞行事件并启动流

```javascript
// main.js (Electron)
const { ipcMain } = require('electron');

class DroneStreamManager {
  constructor() {
    this.isFlying = false;
    this.streamActive = false;
  }

  startMonitoring(mainWindow) {
    // 连接到 Dashboard WebSocket
    const ws = new WebSocket('ws://10.30.2.11:8000/ws');

    ws.on('message', (data) => {
      const message = JSON.parse(data);

      if (message.type === 'drone:flight:event') {
        if (message.event === 'started' && !this.isFlying) {
          this.isFlying = true;
          this.startPixelStream(mainWindow);
        } else if (message.event === 'stopped' && this.isFlying) {
          this.isFlying = false;
          this.stopPixelStream(mainWindow);
        }
      }
    });
  }

  startPixelStream(mainWindow) {
    console.log('🎬 Starting pixel stream...');
    mainWindow.webContents.send('stream:start');
    this.streamActive = true;
  }

  stopPixelStream(mainWindow) {
    console.log('⏹️ Stopping pixel stream...');
    mainWindow.webContents.send('stream:stop');
    this.streamActive = false;
  }
}

// 使用
const manager = new DroneStreamManager();
app.on('ready', () => {
  mainWindow = new BrowserWindow({ /* ... */ });
  manager.startMonitoring(mainWindow);
});
```

---

## ✅ 验证清单

- [ ] Dashboard 中 `startDroneFlightMonitoring()` 已调用
- [ ] UE Remote Control 服务运行正常 (端口 30010)
- [ ] 浏览器控制台无错误信息
- [ ] 点击飞行按钮后 `isDroneFlying` 状态改变
- [ ] 接收到 `drone:flight:started/stopped` 事件
- [ ] Electron 应用可以接收事件并启动/停止流

