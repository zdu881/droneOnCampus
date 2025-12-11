# Electron 应用流控制调试指南

## 原始流程

```
Electron 应用启动
  ↓
1. main.js 初始化
   ├─ 创建 DroneFlightMonitor（监控 http://10.30.2.11:8000）
   ├─ 创建 PixelStreamManager
   └─ 启动轮询监控

2. DroneFlightMonitor.start()
   └─ 每 500ms 查询一次 /api/drone/status

3. 状态变化检测
   ├─ 检测 isFlying: false → true
   │   └─ 发出 'flight:started' 事件
   │       └─ main.js 监听并调用 streamManager.startStream()
   │           └─ 发送 'stream:status' 给渲染进程
   │               └─ renderer.js 接收并调用 startDisplayingStream()
   │                   └─ 创建 <iframe src="http://10.30.2.11:80">
   │                       └─ 显示像素流
   │
   ├─ 检测 isFlying: true → false
   │   └─ 发出 'flight:stopped' 事件
   │       └─ 停止流
```

## 常见问题排查

### 问题 1: Electron 应用启动时 Dashboard API Server 不存在

**症状**: 应用启动后一直显示"无法连接到 Dashboard"

**原因**: 
- Electron 应用启动时，Dashboard API Server (8000) 还没有启动
- DroneFlightMonitor 首次连接失败，进入重试循环

**解决方案**:
1. 确保启动顺序正确:
   ```bash
   # 先启动 Dashboard API Server
   node server.js &
   sleep 2
   
   # 然后启动 Electron 应用
   npm start
   ```

2. 或者修改 DroneFlightMonitor 的重试逻辑
3. 使用 start_complete_system.sh 脚本确保正确的启动顺序

### 问题 2: Dashboard 更新了 API 状态，但 Electron 应用没有反应

**症状**: 点击"开始飞行"后，Dashboard 中能看到飞行状态变化，但 Electron 流没有启动

**可能原因**:

a) **API 地址不匹配**
   - Electron 应用查询: `http://10.30.2.11:8000`
   - Dashboard 更新: `http://localhost:8000`
   - 这两个地址在网络上可能不同！

   **解决方案**: 
   - 确保 Dashboard 的 api-manager.js 更新的也是同一个服务器
   - 或者让 Electron 应用连接到局域网 IP

b) **DroneFlightMonitor 没有启动**
   - main.js 中 `droneMonitor.start()` 没有被调用
   - 或者被调用时出错了

   **排查方法**:
   ```bash
   # 查看 Electron 应用的控制台日志
   # 应该看到: "🎯 Starting flight monitor (polling every 500ms)"
   # 以及定期的: "[timestamp] GET /api/drone/status"
   ```

c) **renderjs 没有接收到 stream:status 消息**
   - preload.js 的 IPC 通道配置有问题
   - 或者 ipcRenderer.on('stream:status', callback) 没有正确注册

d) **iframe 创建失败**
   - 像素流地址无法访问
   - iframe 的 src 配置错误

### 问题 3: 流启动了但看不到画面

**可能原因**:
- 像素流服务器未运行 (http://10.30.2.11:80)
- 网络不通
- iframe src 地址错误

**解决方案**:
1. 检查像素流服务: `curl -I http://10.30.2.11:80`
2. 检查网络连接: `ping 10.30.2.11`
3. 在浏览器中直接访问: `http://10.30.2.11:80`

## 调试步骤

### 1. 验证 Dashboard API Server

```bash
# 检查健康状态
curl -s http://localhost:8000/api/health | jq .

# 检查当前飞行状态
curl -s http://localhost:8000/api/drone/status | jq .

# 手动设置飞行状态（模拟 Dashboard 操作）
curl -s -X PUT http://localhost:8000/api/drone/status \
  -H "Content-Type: application/json" \
  -d '{"isFlying": true, "status": "flying"}' | jq .

# 等待 30 秒，观察状态是否自动重置
sleep 35
curl -s http://localhost:8000/api/drone/status | jq .
```

### 2. 验证 Electron 应用网络

```bash
# 从 Electron 应用的主机上测试
curl -s http://10.30.2.11:8000/api/drone/status | jq .

# 如果出错，检查网络
ping 10.30.2.11
netstat -an | grep 8000
```

### 3. 检查 Electron 应用日志

```bash
# 启动时打开开发工具看控制台日志
# main.js 中有以下关键日志:
# - "🎯 Starting flight monitor"
# - "[timestamp] GET /api/drone/status"
# - "✈️ DRONE FLIGHT STARTED"
# - "🎬 Starting pixel stream"
```

### 4. 修改 api-manager.js 确保地址一致

**当前问题**: dashboard 的 api-manager.js 使用 `http://localhost:8000`，但 Electron 使用 `http://10.30.2.11:8000`

**解决方案**: 修改 api-manager.js 中的 fetch URL

```javascript
// 在 triggerDroneAction() 中，改为
await fetch('http://10.30.2.11:8000/api/drone/status', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    isFlying: true,
    status: 'flying'
  })
});
```

## 完整工作流清单

- [ ] Dashboard API Server 在 8000 端口运行
- [ ] Static File Server 在 8081 端口运行
- [ ] dashboard.html 能访问: http://localhost:8081/dashboard.html
- [ ] API 端点能响应: http://localhost:8000/api/health
- [ ] Electron 应用已编译
- [ ] Electron 应用启动日志显示: "Starting flight monitor"
- [ ] Dashboard 点击"开始飞行"后，查询 API 显示 isFlying: true
- [ ] 观察 Electron 控制台看到 "DRONE FLIGHT STARTED"
- [ ] 流自动开启显示像素视频
- [ ] 30 秒后流自动关闭

## 快速启动指令

```bash
# 1. 启动所有服务
cd /data/home/sim6g/rayCode/droneOnCampus
bash start_complete_system.sh

# 2. 打开 dashboard（新窗口）
firefox http://localhost:8081/dashboard.html

# 3. 启动 Electron 应用（新窗口）
cd /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template
npm start

# 4. 在 dashboard 中点击"开始飞行"
# 5. 观察 Electron 应用自动启动流
```
