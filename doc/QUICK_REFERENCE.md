# 快速参考卡 - 飞行状态检测 + Electron 像素流

## 🎯 核心实现路线

```
1. Dashboard (已实现) ✅
   ├─ api-manager.js: isUAVFlying() 读取 bArePropellersActive
   ├─ dashboard-manager.js: startDroneFlightMonitoring() 每500ms检查
   └─ 广播事件: drone:flight:started/stopped

2. Electron 应用 (提供了模板)
   ├─ drone-monitor.js: 轮询 /api/drone/status
   ├─ stream-manager.js: 启动/停止流
   └─ 自动同步飞行状态
```

---

## 📦 文件清单

### Dashboard 修改

| 文件 | 修改内容 | 状态 |
|------|---------|------|
| `api-manager.js` | 新增 `readDroneProperty()`, `isUAVFlying()` | ✅ 完成 |
| `dashboard-manager.js` | 新增飞行监控方法 + 自动启动 | ✅ 完成 |

### Electron 应用模板

位置: `/data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template/`

```
main.js                    # 主进程
preload.js                 # 预加载脚本
package.json              # 项目配置
src/
  ├─ index.html           # UI 界面
  ├─ renderer.js          # 渲染进程
  ├─ drone-monitor.js     # 飞行监控 (轮询 API)
  └─ stream-manager.js    # 流管理
README.md                 # 部署指南
```

### 文档

| 文件 | 内容 | 推荐度 |
|------|------|--------|
| `DRONE_FLIGHT_STATUS_API.md` | 完整 API 文档 | ⭐⭐⭐⭐⭐ |
| `FLIGHT_STATUS_IMPLEMENTATION.md` | 实现总结 | ⭐⭐⭐⭐⭐ |
| `ELECTRON_PIXEL_STREAM_SOLUTION.md` | 整体方案 | ⭐⭐⭐⭐ |

---

## 🚀 3 步快速开始

### Step 1: Dashboard 已就绪 ✅

无需额外操作，飞行监控已自动启动。

**验证**:
```javascript
// 浏览器控制台
window.dashboardManager.flightStatusCheckInterval  // 不为 null 表示已启动
window.dashboardManager.isDroneFlying              // 查看当前状态
```

### Step 2: 部署 Electron 应用

```bash
# 复制模板目录
cp -r /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template \
      /your/electron/app/path

# 进入目录
cd /your/electron/app/path

# 安装依赖
npm install

# 修改配置 (src/index.html)
# 改 config-dashboard 值为你的 Dashboard 地址
# 改 config-stream 值为你的 Pixel Streaming 地址

# 启动应用
npm start
```

### Step 3: 测试自动化流程

1. 启动 UE 项目和 Dashboard
2. 启动 Electron 应用
3. 在 Dashboard 中点击"飞行"按钮
4. 观察 Electron 应用自动启动像素流 🎬

---

## 🔌 API 速查

### Dashboard 中的飞行状态检测

```javascript
// 获取当前飞行状态
const result = await window.apiManager.isUAVFlying();
console.log(result.isFlying);  // true 或 false

// 监听飞行事件
window.addEventListener('drone:flight:started', () => {
  console.log('✈️ 开始飞行');
});

window.addEventListener('drone:flight:stopped', () => {
  console.log('🛬 停止飞行');
});

// 手动启动/停止监控
window.dashboardManager.startDroneFlightMonitoring();
window.dashboardManager.stopDroneFlightMonitoring();
```

### Electron 应用中接收飞行事件

```javascript
// 方案 A: 轮询 Dashboard API
const response = await fetch('http://10.30.2.11:8000/api/drone/status');
const { isFlying } = await response.json();

// 方案 B: WebSocket 实时推送
ws.on('message', (data) => {
  if (data.type === 'drone:flight:event') {
    // 处理飞行事件
  }
});
```

---

## 📊 状态流转图

```
User点击飞行按钮
     ↓
UE设置 bArePropellersActive = true
     ↓
Dashboard监控 (500ms周期)
     ↓
apiManager.isUAVFlying() → true
     ↓
状态变化检测到
     ↓
broadcastFlightEvent('started')
     ↓
┌────────────────────────────────────┐
├─ 全局事件: drone:flight:started    │
├─ WebSocket 消息: type='drone:...'  │
├─ UI通知: ✈️ 无人机开始飞行         │
└────────────────────────────────────┘
     ↓
Electron应用接收事件
     ↓
pixelStreamManager.startStream()
     ↓
iframe 自动加载像素流
```

---

## ⚙️ 参数配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 检查间隔 | 500ms | Dashboard 飞行监控周期 |
| 轮询间隔 | 500ms | Electron 轮询周期 |
| 重试次数 | 3 | API 失败重试次数 |
| UE API 端口 | 30010 | Remote Control |
| Dashboard 端口 | 8000 | API + WebSocket |
| 像素流端口 | 80 | Pixel Streaming |

---

## 🐛 故障排查速查表

| 症状 | 原因 | 解决方案 |
|------|------|---------|
| Dashboard 无监控 | 连接失败 | 检查 UE 项目是否运行 |
| 属性读取失败 | API 错误 | curl 测试 UE Remote Control |
| Electron 无响应 | API 404 | Dashboard 需要提供 /api/drone/status |
| 像素流不显示 | 地址错误 | 检查 Pixel Streaming 服务状态 |
| 飞行状态不同步 | 网络延迟 | 减小检查间隔或使用 WebSocket |

---

## 📱 前端集成示例

### 在现有页面中添加飞行事件监听

```html
<!-- HTML -->
<div id="flight-status">等待飞行...</div>

<script>
  // 监听飞行开始
  window.addEventListener('drone:flight:started', () => {
    document.getElementById('flight-status').textContent = '✈️ 飞行中';
    document.getElementById('flight-status').style.color = 'green';
    
    // 触发你的业务逻辑
    startPixelStreamReceiver();
  });

  // 监听飞行停止
  window.addEventListener('drone:flight:stopped', () => {
    document.getElementById('flight-status').textContent = '🛬 已停止';
    document.getElementById('flight-status').style.color = 'red';
    
    stopPixelStreamReceiver();
  });
</script>
```

---

## 🎓 学习路径

1. **快速了解**: 本文件 (5 min)
2. **详细文档**: `DRONE_FLIGHT_STATUS_API.md` (10 min)
3. **实现细节**: `FLIGHT_STATUS_IMPLEMENTATION.md` (15 min)
4. **部署指南**: `electron-app-template/README.md` (10 min)
5. **实际操作**: 部署并测试 Electron 应用 (30 min)

---

## ✅ 验证清单

- [ ] Dashboard 飞行监控已启动
- [ ] UE Remote Control API 可访问 (端口 30010)
- [ ] 飞行时 `isDroneFlying` 从 false → true
- [ ] 接收到 `drone:flight:started` 事件
- [ ] Electron 应用已部署
- [ ] Electron 可访问 Dashboard API (`/api/drone/status`)
- [ ] 飞行时 Electron 自动启动像素流
- [ ] 停止飞行时 Electron 自动关闭流

---

## 🔗 快速链接

- [完整 API 文档](DRONE_FLIGHT_STATUS_API.md)
- [实现总结](FLIGHT_STATUS_IMPLEMENTATION.md)
- [整体方案](ELECTRON_PIXEL_STREAM_SOLUTION.md)
- [Electron 模板](electron-app-template/)
- [Dashboard 代码](../api-manager.js)

---

## 📞 常见问题

**Q: 飞行监控默认启动吗？**
A: 是的，在 `connectToUE()` 成功后自动启动。

**Q: 可以修改检查间隔吗？**
A: 可以，在 `dashboard-manager.js` 中修改 500ms 参数。

**Q: Electron 应用需要 Dashboard 的哪些接口？**
A: 仅需 `GET /api/drone/status` 返回 `{ isFlying: boolean, timestamp: number }`

**Q: 支持多个 Electron 应用同时接收吗？**
A: 支持，Dashboard 可以服务多个客户端。

---

## 🎯 下一步

1. 测试 Dashboard 飞行监控
2. 部署 Electron 应用
3. 配置正确的 API 地址
4. 执行完整的飞行 → 流接收 测试
5. 根据需要调整检查间隔和错误处理

