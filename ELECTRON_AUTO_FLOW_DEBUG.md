# Electron 自动流启动 - 修复和验证指南

## 问题诊断

用户报告：Electron 应用启动后不能自动开启流，虽然不再报"无法连接 Dashboard"错误。

### 根本原因

自动流启动涉及完整的链条，任何环节出问题都会导致失败：

```
Dashboard 点击"开始飞行" 
  → api-manager.js 调用 UE Fly() 函数
  → api-manager.js 更新 API 状态 (PUT /api/drone/status)
  → Electron drone-monitor 轮询检测 (GET /api/drone/status)
  → 检测到 isFlying: false → true 状态变化
  → 发送 'flight:started' 事件
  → IPC 通知 renderer 进程
  → renderer 创建 iframe 显示像素流
```

## 修复清单

### ✅ 已完成修复

#### 1. **网络地址一致性修复** (已完成)
- ✅ 修改 `/data/home/sim6g/rayCode/droneOnCampus/api-manager.js`
  - `triggerDroneAction()` 使用 `http://10.30.2.11:8000`
  - `startDelivery()` 使用 `http://10.30.2.11:8000`

- ✅ 修改 `/data/home/sim6g/rayCode/droneOnCampus/src/frontend/js/api-manager.js`
  - 两个函数都使用 `http://10.30.2.11:8000`

**为什么**: Dashboard 必须通过网络地址更新 API，而不是 localhost，这样 Electron 才能在同一个 API 实例上读取状态。

#### 2. **Electron fetch 超时修复** (已完成)
- ✅ 修改 `/data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template/src/drone-monitor.js`
  - 用 `AbortController` 替换不支持的 `timeout` 选项
  - 改进错误处理，区分超时错误

**为什么**: Node.js 的原生 fetch 不支持 `timeout` 参数，需要用 AbortController + setTimeout 实现。

#### 3. **Electron IPC 通信修复** (已完成)
- ✅ 创建 `/data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template/src/preload.js`
  - 正确暴露 `electronAPI` 到渲染进程
  - 提供所有必要的 IPC 方法

- ✅ 修改 `/data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template/main.js`
  - 修复 preload 脚本路径: `path.join(__dirname, 'src', 'preload.js')`
  - 完善 IPC 监听器: `status:request`, `stream:start`, `stream:stop`, `config:update`

**为什么**: 没有 preload.js，渲染进程无法与主进程通信，导致无法接收 'stream:status' 事件。

### 🔄 验证清单

#### 验证 1: API 服务器运行
```bash
# 检查 API 服务器是否运行
curl http://10.30.2.11:8000/api/drone/status

# 预期响应
{
  "isFlying": false,
  "status": "idle",
  "position": {"x": 0, "y": 0, "z": 0},
  "timestamp": 1702298400000
}
```

#### 验证 2: 状态更新
```bash
# Dashboard 模拟向 API 发送飞行状态
curl -X PUT http://10.30.2.11:8000/api/drone/status \
  -H "Content-Type: application/json" \
  -d '{"isFlying": true, "status": "flying"}'

# 立即查询，应该返回 isFlying: true
curl http://10.30.2.11:8000/api/drone/status
```

#### 验证 3: Electron 轮询
在 Electron 应用的开发工具中检查：
```javascript
// 应该看到日志
[HH:MM:SS] 📍 Dashboard URL: http://10.30.2.11:8000
[HH:MM:SS] 🎯 Starting flight monitor
[HH:MM:SS] GET /api/drone/status → isFlying: true
[HH:MM:SS] ✈️ DRONE FLIGHT STARTED
```

#### 验证 4: IPC 通信
在 Electron 应用日志中检查：
```javascript
// renderer 应该收到事件
[HH:MM:SS] 🎬 像素流已启动
[HH:MM:SS] 📊 状态: streaming - 正在接收像素流...
```

#### 验证 5: 完整流程测试
运行测试脚本：
```bash
cd /data/home/sim6g/rayCode/droneOnCampus
bash test-auto-flow.sh
```

## 端到端流程图

```
┌─────────────────────────────────────────────────────────────┐
│                   Dashboard (Browser)                        │
│  用户点击"开始飞行" → dashboard-manager.startDroneFlight()  │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────────┐
        │  api-manager.js            │
        │  triggerDroneAction()      │
        │  - 调用 UE Fly()           │
        │  - PUT api-drone/status    │  ← 关键：使用 10.30.2.11
        └────────┬───────────────────┘
                 │
                 ↓
    ┌────────────────────────────┐
    │   Dashboard API Server     │
    │   /api/drone/status        │
    │   isFlying: false → true   │  ← 状态更新点
    └────────┬───────────────────┘
             │
             ↓
    ┌──────────────────────────────┐
    │  Electron Application        │
    │  drone-monitor.js            │
    │  轮询 GET /api/drone/status  │  ← 关键：轮询同一实例
    └────────┬─────────────────────┘
             │
             ↓
    ┌──────────────────────────────┐
    │  状态变化检测                  │
    │  isFlying: false → true      │
    │  emit('flight:started')      │
    └────────┬─────────────────────┘
             │
             ↓
    ┌──────────────────────────────┐
    │  IPC 通信                     │
    │  mainWindow.send()            │
    │  'stream:status' event       │
    └────────┬─────────────────────┘
             │
             ↓
    ┌──────────────────────────────┐
    │  Renderer 进程                │
    │  renderer.js                 │
    │  startDisplayingStream()     │
    │  创建 iframe 加载像素流      │
    └──────────────────────────────┘
```

## 故障排查

### 问题 1: 仍看到"无法连接 Dashboard"错误

**原因**: drone-monitor.js 的轮询失败

**解决**:
1. 检查 API 服务器是否运行: `curl http://10.30.2.11:8000/api/health`
2. 检查网络连接: `ping 10.30.2.11`
3. 检查 Electron 日志中的 `Dashboard URL` 地址是否正确

### 问题 2: Electron 连接正常，但流不自动启动

**原因**: 可能以下几种：
1. Dashboard 没有成功更新 API 状态
2. drone-monitor 检测不到状态变化
3. IPC 事件没有传递到 renderer

**诊断步骤**:

```bash
# Step 1: 检查 Dashboard API 是否更新
curl http://10.30.2.11:8000/api/drone/status | jq '.isFlying'

# 在 Dashboard 中点击"开始飞行"，然后立即运行上述命令
# 应该返回 true
```

```javascript
// Step 2: 在 Electron 开发工具中检查 drone-monitor 日志
// 打开开发工具: mainWindow.webContents.openDevTools()
// 查找"✈️ DRONE FLIGHT STARTED"日志
```

```bash
# Step 3: 检查 server.js 中的 droneState
# 在 server.js 中添加日志
console.log('PUT 请求收到，更新状态:', newState);
```

### 问题 3: API 服务器监听在 localhost 但不能从 10.30.2.11 访问

**原因**: 网络接口配置或防火墙

**解决**:
```bash
# 检查 server.js 监听地址
netstat -tlnp | grep 8000
# 应该显示 0.0.0.0:8000 或 :::8000

# 如果显示 127.0.0.1:8000，需要修改 server.js
# 将 server.listen(PORT, '127.0.0.1') 改为 server.listen(PORT, '0.0.0.0')
```

## 完整的验证步骤

1. **启动 API 服务器**
```bash
cd /data/home/sim6g/rayCode/droneOnCampus
node server.js
```

2. **启动 Dashboard**
```bash
# 在另一个终端
cd /data/home/sim6g/rayCode/droneOnCampus
# 启动静态服务器或打开 dashboard.html
```

3. **启动 Electron 应用**
```bash
cd doc/electron-app-template
npm start
```

4. **在 Dashboard 中点击"开始飞行"按钮**
   - Dashboard 应该调用 `api-manager.js:triggerDroneAction()`
   - 这应该执行 UE 的 Fly() 函数
   - 同时更新 API: `PUT http://10.30.2.11:8000/api/drone/status {isFlying: true}`

5. **观察 Electron 应用**
   - 应该在开发工具中看到"✈️ DRONE FLIGHT STARTED"
   - 像素流 iframe 应该自动出现

6. **验证日志**
   - Dashboard 控制台：看到 API 更新日志
   - API 服务器：看到 PUT 请求日志
   - Electron 开发工具：看到 drone-monitor 日志和 stream:status 事件

## 重要配置总结

| 配置项 | 值 | 说明 |
|--------|-----|------|
| API 服务器 | `http://10.30.2.11:8000` | Dashboard 和 Electron 都通过这个地址访问 |
| Dashboard URL | `http://10.30.2.11:8000` | api-manager.js 中的 fetch 目标 |
| Pixel Stream URL | `http://10.30.2.11:80` | 像素流来源地址 |
| 轮询间隔 | 500ms | drone-monitor 的检查频率 |
| 超时时间 | 5000ms | 单次请求的超时时间 |

## 关键代码位置

- **Dashboard 更新 API**: `api-manager.js:triggerDroneAction()` 和 `startDelivery()`
- **API 服务器**: `server.js`
- **Electron 监控**: `doc/electron-app-template/src/drone-monitor.js`
- **Electron 主进程**: `doc/electron-app-template/main.js`
- **Electron 渲染进程**: `doc/electron-app-template/src/renderer.js`
- **IPC 通信**: `doc/electron-app-template/src/preload.js`
