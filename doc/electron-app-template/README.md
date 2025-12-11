# Electron 像素流接收应用

自动检测无人机飞行状态，实时接收 Unreal Engine 5 像素流的 Electron 应用。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 修改配置

编辑 `src/index.html` 中的默认 URL：

```html
<input type="text" id="config-dashboard" value="http://10.30.2.11:8000">
<input type="text" id="config-stream" value="http://10.30.2.11:80">
```

改为你的实际地址。

### 3. 启动应用

```bash
npm start
```

## 🎯 工作原理

```
启动应用
    ↓
轮询 Dashboard API (/api/drone/status)
    ↓
检测无人机飞行状态
    ├─ 飞行中: 自动启动像素流 iframe
    └─ 停止: 关闭像素流接收
```

## 📋 前置条件

1. **Dashboard 服务运行**: `http://10.30.2.11:8000`
   - 需要提供 `/api/drone/status` 接口
   - 返回格式: `{ isFlying: boolean, timestamp: number }`

2. **像素流服务运行**: `http://10.30.2.11:80`
   - UE5 Pixel Streaming 服务

3. **UE5 项目运行**
   - 无人机项目已启动
   - `bArePropellersActive` 属性可读

## 🔧 配置 Dashboard API

### 方案 A: Express 后端服务

在 Dashboard 后端添加接口：

```javascript
// server.js
const express = require('express');
const app = express();

app.get('/api/drone/status', (req, res) => {
  res.json({
    isFlying: window.dashboardManager.isDroneFlying,
    timestamp: Date.now()
  });
});

app.listen(8000);
```

### 方案 B: 前端 WebSocket 转发

修改 Electron 应用连接 WebSocket：

```javascript
// main.js
const ws = new WebSocket('ws://10.30.2.11:8000/ws');

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'drone:flight:event') {
    droneMonitor.isFlying = msg.event === 'started';
  }
});
```

## 📁 项目结构

```
.
├── main.js                 # 主进程
├── preload.js             # 预加载脚本
├── package.json           # 项目配置
├── src/
│   ├── index.html         # UI
│   ├── renderer.js        # 渲染进程
│   ├── drone-monitor.js   # 飞行监控
│   └── stream-manager.js  # 流管理
└── README.md              # 本文件
```

## 🎨 功能特性

- ✅ 自动检测无人机飞行状态
- ✅ 自动启动/停止像素流接收
- ✅ 实时状态显示
- ✅ 操作日志记录
- ✅ 配置保存和恢复
- ✅ 手动控制选项
- ✅ 错误处理和重试

## 🔌 IPC 通信

### 主进程 → 渲染进程

- `stream:status` - 流状态更新
- `stream:error` - 错误通知
- `status` - 当前系统状态

### 渲染进程 → 主进程

- `stream:start` - 手动启动流
- `stream:stop` - 手动停止流
- `get:status` - 查询状态
- `config:update` - 更新配置

## 🐛 常见问题

### Q: 无法连接到 Dashboard？

A: 检查以下项：
- Dashboard 服务是否运行
- 防火墙是否允许访问 8000 端口
- API 地址是否正确

### Q: 无人机飞行状态不更新？

A: 确认：
- UE 项目是否运行
- `bArePropellersActive` 属性是否可读
- Dashboard 监控是否已启动

### Q: 像素流无法显示？

A: 检查：
- Pixel Streaming 服务 (端口 80) 是否运行
- 地址和端口是否正确
- 浏览器是否支持 iframe 嵌入

## 📚 相关文档

- [飞行状态检测 API](../DRONE_FLIGHT_STATUS_API.md)
- [完整方案说明](../ELECTRON_PIXEL_STREAM_SOLUTION.md)
- [实现详情](../FLIGHT_STATUS_IMPLEMENTATION.md)

## 🚀 构建可执行文件

### Windows

```bash
npm run build:win
```

### macOS

```bash
npm run build:mac
```

### Linux

```bash
npm run build:linux
```

## 📝 许可证

MIT

