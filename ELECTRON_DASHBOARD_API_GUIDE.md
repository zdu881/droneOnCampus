# Electron 应用 + Dashboard API 集成指南

## 问题诊断

**症状**:
- Electron 应用启动后显示"无法连接到 dashboard"
- 但手动在浏览器中可以看到像素流

**根本原因**:
- Electron 应用需要调用 `/api/drone/status` API 来检测无人机飞行状态
- 此端点在原始 Dashboard 中不存在
- 导致 electron 应用无法正确检测飞行状态，从而无法自动启动像素流

---

## 解决方案架构

### 三层服务架构

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Dashboard API Server (Node.js, port 8000)                    │
│    - 提供 REST API 接口给 Electron 应用                         │
│    - 管理无人机飞行状态                                         │
│    - 处理 CORS 请求                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                    API communication
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Electron 应用                                                │
│    - 轮询 /api/drone/status 检测飞行状态                        │
│    - 根据飞行状态自动启动/停止像素流接收                        │
│    - 显示实时像素流视频                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Pixel stream (HTTP/WebRTC)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Pixel Streaming Server (UE, port 80)                        │
│    - 来自 Unreal Engine 的像素流                                │
│    - 包含实时摄像头画面和场景                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 文件说明

### 新增文件

#### 1. `server.js` - Dashboard API Server
**功能**: 为 Electron 应用提供 REST API

**关键端点**:
```
GET  /api/drone/status    - 获取无人机飞行状态
                            返回: { isFlying, status, position, timestamp }

PUT  /api/drone/status    - 更新无人机飞行状态
                            体: { isFlying, status, position }

GET  /api/health          - 健康检查
                            返回: { status, uptime, timestamp }

GET  /api/config          - 获取系统配置
                            返回: { dashboardUrl, streamUrl, apiVersion }
```

**全局状态对象**:
```javascript
droneState = {
  isFlying: false,        // 是否在飞行
  lastUpdate: Date.now(), // 最后更新时间
  position: { x, y, z },  // 无人机位置
  status: 'idle'          // 当前状态 (idle, flying, landing, error)
}
```

#### 2. `start_complete_system.sh` - 完整系统启动脚本
**功能**: 启动整个系统的所有必要服务

**启动顺序**:
1. Dashboard API Server (port 8000)
2. 静态文件服务器 (port 8080)
3. Vehicle MEC Agent (port 5000) - 可选

**使用方法**:
```bash
chmod +x start_complete_system.sh
./start_complete_system.sh
```

---

## 使用流程

### 启动完整系统

```bash
# 1. 进入项目目录
cd /data/home/sim6g/rayCode/droneOnCampus

# 2. 启动完整系统（Dashboard API + 其他服务）
./start_complete_system.sh

# 输出应该显示:
# ✓ Dashboard API Server started (port 8000)
# ✓ Static file server started (port 8080)
# ✓ System Started Successfully
```

### 启动 Electron 应用

```bash
# 1. 导航到 Electron 应用目录
cd doc/electron-app-template

# 2. 安装依赖（首次）
npm install

# 3. 启动应用
npm start
```

### Electron 应用启动流程

```
1. Electron main.js 启动
   ↓
2. 创建浏览器窗口
   ↓
3. 初始化 DroneFlightMonitor
   ↓
4. Monitor 开始轮询 http://localhost:8000/api/drone/status
   ↓
5. 等待 isFlying = true
   ↓
6. 检测到飞行 → 自动启动像素流接收
   ↓
7. 显示实时视频
```

---

## 状态转换流程

### 无人机飞行触发流程

```
┌─────────────┐
│   Idle      │  - 无人机未飞行
│ isFlying=F  │
└──────┬──────┘
       │ 用户点击"开始飞行"或 UE 自动飞行
       ↓
┌─────────────────────┐
│   Flying            │  - 更新 /api/drone/status
│   isFlying=T        │    { isFlying: true }
│   status="flying"   │
└──────┬──────────────┘
       │ Electron 轮询检测到状态变化
       ↓
┌─────────────────────┐
│  Streaming          │  - 自动启动像素流接收
│  status="streaming" │  - 显示实时视频
└──────┬──────────────┘
       │ 无人机着陆或停止飞行
       ↓
┌─────────────────────┐
│  Landing/Idle       │  - 更新 /api/drone/status
│  isFlying=F         │    { isFlying: false }
│  status="idle"      │
└──────┬──────────────┘
       │ Electron 检测到状态变化
       ↓
┌─────────────────────┐
│  Stopped            │  - 停止像素流接收
│  status="idle"      │  - 等待下一次飞行
└─────────────────────┘
```

---

## API 调用示例

### 1. 检查服务健康状态

```bash
curl http://localhost:8000/api/health
# 返回:
# { "status": "ok", "timestamp": 1234567890, "uptime": 123.45 }
```

### 2. 获取无人机飞行状态

```bash
curl http://localhost:8000/api/drone/status
# 返回:
# {
#   "isFlying": false,
#   "status": "idle",
#   "position": { "x": 0, "y": 0, "z": 0 },
#   "timestamp": 1234567890
# }
```

### 3. 更新无人机飞行状态（模拟飞行开始）

```bash
curl -X PUT http://localhost:8000/api/drone/status \
  -H "Content-Type: application/json" \
  -d '{
    "isFlying": true,
    "status": "flying",
    "position": { "x": 100, "y": 200, "z": 500 }
  }'
# 返回:
# { "success": true, "state": { ... } }
```

### 4. 更新为着陆状态

```bash
curl -X PUT http://localhost:8000/api/drone/status \
  -H "Content-Type: application/json" \
  -d '{ "isFlying": false, "status": "idle" }'
```

---

## 与 UE/Dashboard 集成

### 选项 1: 直接在 UE 中调用 API

```csharp
// 在 UE Level Blueprint 中，当飞行开始时：
HTTP PUT /api/drone/status
Body: { "isFlying": true, "status": "flying" }

// 当飞行停止时：
HTTP PUT /api/drone/status
Body: { "isFlying": false, "status": "idle" }
```

### 选项 2: 从 Dashboard 前端调用

```javascript
// 当用户点击"开始飞行"按钮时
async function startFlight() {
  const response = await fetch('http://localhost:8000/api/drone/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      isFlying: true,
      status: 'flying'
    })
  });
  const data = await response.json();
  console.log('Flight started:', data);
}
```

### 选项 3: 手动 CLI 更新

```bash
# 开始飞行
./update_flight_status.sh start

# 停止飞行
./update_flight_status.sh stop
```

---

## 故障排除

### 问题 1: Electron 仍显示"无法连接到 dashboard"

**检查**:
1. Dashboard API Server 是否在运行
   ```bash
   curl http://localhost:8000/api/health
   ```

2. Electron 日志中的错误信息
   ```bash
   # 查看 Electron 控制台输出
   # 应该显示: "📍 Dashboard URL: http://10.30.2.11:8000"
   ```

3. IP 地址是否正确
   - Electron 使用 `http://10.30.2.11:8000`（硬编码）
   - 如需改为 localhost：修改 `doc/electron-app-template/main.js` 第 145 行

### 问题 2: 像素流正常但 Electron 不自动启动

**原因**: Monitor 轮询正常运行但飞行状态 API 未更新

**解决**:
1. 手动更新飞行状态
   ```bash
   curl -X PUT http://localhost:8000/api/drone/status \
     -H "Content-Type: application/json" \
     -d '{ "isFlying": true }'
   ```

2. 检查 Monitor 日志
   - 应该显示: "✈️ DRONE FLIGHT STARTED"

### 问题 3: 端口冲突

**症状**: "Port 8000 is already in use"

**解决**:
```bash
# 查找占用端口的进程
lsof -i :8000

# 杀死进程
kill -9 <PID>

# 或更改端口（在 start_complete_system.sh 中）
PORT=9000 node server.js
```

---

## 性能考虑

### 轮询间隔
- 默认: 500ms
- 可在 `DroneFlightMonitor` 中调整
- 更短 → 更快响应，但 CPU 更高
- 更长 → 更省资源，但响应延迟

### 连接超时
- 默认: 5000ms (5 秒)
- 如果网络慢，可增加此值

### 重试次数
- 最多重试 3 次后报错
- 可在 `DroneFlightMonitor` 中调整

---

## 扩展说明

### 添加更多 API 端点

在 `server.js` 中添加：

```javascript
if (pathname === '/api/drone/telemetry' && req.method === 'GET') {
  // 返回详细的遥测数据
  res.writeHead(200);
  res.end(JSON.stringify({
    position: droneState.position,
    velocity: { x: 0, y: 0, z: 0 },
    batteryLevel: 95,
    gpsStatus: 'locked',
    signalStrength: 85
  }));
  return;
}
```

### 集成数据库

```javascript
const database = require('./database');

if (pathname === '/api/drone/status' && req.method === 'PUT') {
  // 保存到数据库
  database.saveDroneState(droneState);
  // ... 返回响应
}
```

---

## 监控和日志

### 启用详细日志

修改 `server.js`：

```javascript
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log(`[DEBUG] Request body:`, body);
  console.log(`[DEBUG] Updated state:`, droneState);
}
```

运行：
```bash
DEBUG=true node server.js
```

### 使用 PM2 保持服务运行

```bash
# 全局安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name "dashboard-api"

# 查看日志
pm2 logs dashboard-api

# 自动重启
pm2 startup
pm2 save
```

---

## 总结

现在系统架构为:

1. **Dashboard API Server** (port 8000) - 状态管理
2. **Electron 应用** - UI 和像素流接收
3. **Pixel Streaming Server** (UE, port 80) - 实时视频
4. **静态文件服务器** (port 8080) - Dashboard 前端

**完整启动流程**:
```bash
./start_complete_system.sh  # 启动所有服务
# 然后启动 Electron 应用
npm start  # 在 doc/electron-app-template 目录
```

这样 Electron 应用就能正确检测飞行状态并自动启动像素流了！
