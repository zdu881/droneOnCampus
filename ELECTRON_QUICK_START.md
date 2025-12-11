# 🚀 Electron 像素流接收应用 - 快速使用指南

## 📥 获取应用

构建完成的 Windows 可执行文件位置：
```
/data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template/dist/
```

### 两个版本可选：

1. **无人机像素流接收器 Setup 1.0.0.exe** (72 MB)
   - 推荐给大多数用户
   - 自动安装到 Program Files
   - 创建开始菜单快捷方式
   - 支持自动更新

2. **无人机像素流接收器-1.0.0.exe** (72 MB)
   - 便携版，无需安装
   - 可放在 USB 随身携带
   - 直接双击运行

## ⚙️ 前置条件

### 1. Dashboard 服务
```bash
# 在 Linux 服务器上启动
cd /data/home/sim6g/rayCode/droneOnCampus
node server.js

# 输出应该显示：
# 📊 Dashboard API Server Started
# 🌐 http://localhost:8000
# 📍 Listen on: 0.0.0.0:8000
```

### 2. Dashboard 网页界面
```
打开浏览器访问: http://localhost:8081/dashboard.html
```

### 3. 网络连接
- Windows 机器必须能访问 `10.30.2.11:8000` (Dashboard API)
- Windows 机器必须能访问 `10.30.2.11:80` (像素流)
- 检查防火墙和网络设置

## 🎯 使用步骤

### 第 1 步: 安装应用

**选项 A: 使用安装程序（推荐）**
```
1. 双击: 无人机像素流接收器 Setup 1.0.0.exe
2. 按照安装向导完成
3. 在开始菜单中找到应用
```

**选项 B: 运行便携版**
```
1. 双击: 无人机像素流接收器-1.0.0.exe
2. 应用立即启动（无需安装）
```

### 第 2 步: 配置应用

应用启动后，看到以下画面：

```
┌─────────────────────────────────────────┐
│  🚁 无人机像素流接收器 v1.0.0           │
│                                         │
│  📡 等待像素流连接...                   │
│  应用将在无人机飞行时自动连接           │
│                                         │
│  [启动流] [停止流]                      │
│                                         │
│  📊 统计信息:                           │
│  • 服务器: 连接中...                   │
│  • 接收: 停止                          │
│  • 运行时: -                           │
│                                         │
│  ⚙️ 配置                                │
│  Dashboard: http://10.30.2.11:8000     │
│  流: http://10.30.2.11:80              │
│  [保存配置]                            │
└─────────────────────────────────────────┘
```

**配置说明**:
1. 点击左下角 "⚙️" 按钮展开配置面板
2. 检查以下地址是否正确：
   - **Dashboard**: `http://10.30.2.11:8000`
   - **像素流**: `http://10.30.2.11:80`
3. 如需修改，编辑输入框并点击 "保存配置"

### 第 3 步: 测试连接

**检查连接状态**:
```
应用窗口中的"📊 统计信息"部分应该显示:
✓ 服务器: 绿色 ✓ (表示已连接)
```

**如果显示红色 ✗ (连接失败)**:
1. 打开开发工具: `Ctrl + Shift + I`
2. 查看 Console 标签的错误信息
3. 检查 Dashboard API 是否运行
4. 检查网络连接和防火墙

### 第 4 步: 启动自动流接收

**完整工作流**:

```
1. 确保 Electron 应用已启动并已连接

2. 在 Dashboard 网页界面中:
   ✓ 点击 "开始飞行" 按钮

3. 等待 1-2 秒，Electron 应用会:
   ✓ 检测到飞行状态变化
   ✓ 自动启动像素流接收
   ✓ 显示"🎬 像素流已启动"
   ✓ 中央区域显示像素流画面

4. 点击 Dashboard "停止飞行" 时:
   ✓ Electron 自动停止流接收
   ✓ 显示"⏹️ 像素流已停止"
```

## 🔍 日志和诊断

### 打开开发工具

```
Ctrl + Shift + I  (或 F12)
```

### 查看重要日志

应该看到以下日志序列：

```
✅ Preload script loaded - electronAPI exposed
📍 Dashboard URL: http://10.30.2.11:8000
🎯 Starting flight monitor (polling every 500ms)
[继续轮询...]
[点击 Dashboard "开始飞行" 后]
✈️ DRONE FLIGHT STARTED
🎬 Starting pixel stream
✓ 像素流 iframe 已创建
```

### 常见错误及解决

**错误**: `❌ 错误: 无法连接到 Dashboard 服务`
- **原因**: API 服务器未运行或网络不通
- **解决**: 
  ```bash
  # 在 Linux 服务器检查
  curl http://10.30.2.11:8000/api/drone/status
  # 应该返回 JSON 响应
  ```

**错误**: `electronAPI is not defined`
- **原因**: preload.js 未正确加载
- **解决**: 重启应用，检查应用日志

**流不自动启动**:
- **原因**: Dashboard 没有更新 API 状态
- **解决**:
  ```bash
  # 在 Dashboard "开始飞行" 后，检查 API 状态
  curl http://10.30.2.11:8000/api/drone/status
  # 应该看到 "isFlying": true
  ```

## 💡 功能说明

### 自动飞行检测
- 应用每 500ms 轮询一次 Dashboard API
- 检测无人机飞行状态变化
- 自动启动/停止像素流

### 手动控制
- **启动流** 按钮: 手动启动像素流（不依赖飞行状态）
- **停止流** 按钮: 手动停止像素流

### 实时显示
- 连接状态指示器（绿色/红色）
- 流接收状态（运行中/停止）
- 流运行时间（HH:MM:SS）

### 可配置性
- Dashboard 地址可修改
- 像素流地址可修改
- 配置自动保存

## 🛠️ 高级设置

### 修改轮询间隔

编辑应用文件 `src/drone-monitor.js`:
```javascript
// 修改这一行 (默认 500ms)
this.pollInterval = 500;  // 改为其他值，单位毫秒
```

重新构建应用后生效。

### 修改重试次数

编辑 `src/drone-monitor.js`:
```javascript
// 修改这一行 (默认重试 3 次)
this.maxRetries = 3;  // 改为其他值
```

### 启用详细日志

打开 `main.js` 的开发工具：
```javascript
// 取消注释这一行
mainWindow.webContents.openDevTools();
```

## 📞 故障支持

遇到问题？检查以下几点：

### 网络诊断
```bash
# 测试网络连接（在 Windows 上运行）
ping 10.30.2.11

# 测试 API 服务器（在 Windows 上运行）
curl http://10.30.2.11:8000/api/drone/status
```

### 日志收集
1. 打开开发工具 (`Ctrl+Shift+I`)
2. 右键点击日志
3. 选择 "Save as HAR"
4. 将日志文件提交以供调试

## ✅ 完整性检查清单

应用正常运行时应满足：

- [ ] 应用启动无错误
- [ ] 连接状态显示绿色 ✓
- [ ] 能手动启动和停止流
- [ ] Dashboard "开始飞行" 后，流自动启动
- [ ] Dashboard "停止飞行" 后，流自动停止
- [ ] 开发工具中能看到完整的日志链

## 📝 版本信息

- **应用名称**: 无人机像素流接收器
- **应用版本**: 1.0.0
- **Electron 版本**: 27.3.11
- **Node.js 版本**: 18.20.8
- **支持平台**: Windows x64

---

需要更多帮助？查看完整文档：
- `ELECTRON_AUTO_FLOW_DEBUG.md` - 详细诊断指南
- `BUILD_REPORT.md` - 构建信息
- `QUICK_FIX_CHECKLIST.md` - 快速修复清单
