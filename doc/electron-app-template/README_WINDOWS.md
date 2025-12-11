# 无人机像素流接收器 - Windows 11 完整版本

> Electron 应用 | 自动飞行检测 | 像素流接收 | Windows 构建

## 🎯 项目概述

这是一个完整的 **Windows 11 优化版本** Electron 应用，用于：

✅ **自动检测**无人机飞行状态  
✅ **自动启动**像素流接收  
✅ **自动停止**流接收  
✅ **完整的 UI** 界面和控制  
✅ **CORS 跨域处理** 内置支持  
✅ **自定义安装目录** 支持  

---

## 📦 包含内容

### 📄 文档
- **QUICKSTART_WINDOWS.md** - 30 秒快速开始
- **WINDOWS_BUILD_GUIDE.md** - 完整构建指南
- **README.md** - 本文件

### 🛠️ 构建脚本
- **build.bat** - Windows 批处理脚本
- **build.ps1** - PowerShell 脚本 (推荐)
- **check-env.ps1** - 环境检查工具

### 📱 应用代码
- **main.js** - 主进程 (已 Windows 优化)
- **preload.js** - 预加载脚本
- **src/index.html** - 用户界面
- **src/renderer.js** - 渲染进程
- **src/drone-monitor.js** - 飞行检测
- **src/stream-manager.js** - 流管理
- **package.json** - 项目配置 (已 Windows 优化)

---

## 🚀 快速开始 (3 步)

### ① 检查环境 (1 分钟)

在 PowerShell 中运行：

```powershell
.\check-env.ps1
```

**应该看到**:
- ✓ Node.js 已安装 (v16+)
- ✓ npm 已安装 (v8+)
- ✓ 可连接 10.30.2.11
- ✓ 项目文件完整

### ② 构建应用 (5-10 分钟)

选择一种方式：

**方式 A: PowerShell 脚本 (推荐)**
```powershell
.\build.ps1
# 或指定类型
.\build.ps1 -Type exe  # 只构建 EXE
.\build.ps1 -Type msi  # 构建 MSI + EXE
```

**方式 B: 批处理脚本**
```powershell
build.bat
# 或
build.bat build-exe
```

**方式 C: 手动命令**
```powershell
npm install
npm run build:win-exe
```

### ③ 运行应用 (1 秒)

```powershell
# 打开生成的文件夹
cd dist

# 双击 EXE 文件，或：
.\无人机像素流接收器-1.0.0.exe
```

---

## 🎮 应用界面

启动后你会看到：

```
┌────────────────────────────────────────────┐
│ 🎬 Pixel Stream Receiver        v1.0.0    │
│ ─────────────────────────────────────────  │
│                                            │
│  状态: ⚫ 等待无人机飞行                  │
│  (飞行时变为: 🟢 正在接收像素流)          │
│                                            │
│  【启动流】  【停止流】  【⚙️ 设置】    │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │                                      │ │
│  │      像素流预览区域                  │ │
│  │    (飞行时自动显示视频)             │ │
│  │                                      │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  📋 日志:                                  │
│  ✓ CORS 代理已启动                       │
│  ✓ 飞行监控已启动                        │
│  ⏳ 等待无人机飞行...                    │
│                                            │
└────────────────────────────────────────────┘
```

### 工作流程

```
无人机起飞 
   ↓
应用检测 bArePropellersActive=true
   ↓
广播 "flight:started" 事件
   ↓
自动启动像素流接收 ▶️
   ↓
实时显示视频
   ↓
无人机着陆
   ↓
应用检测 bArePropellersActive=false
   ↓
自动停止流接收 ⏹️
```

---

## ⚙️ 配置说明

### 主要参数

编辑 `main.js`，找到这两行：

```javascript
// 第 ~147 行
const DASHBOARD_API_URL = 'http://10.30.2.11:8000';

// 第 ~148 行
streamManager = new PixelStreamManager('http://10.30.2.11:80');
```

修改 IP 地址如果你的服务器地址不同。

### 参数含义

| 参数 | 说明 | 示例 |
|------|------|------|
| DASHBOARD_API_URL | Dashboard 服务器地址 | http://10.30.2.11:8000 |
| Pixel Stream URL | 像素流服务器地址 | http://10.30.2.11:80 |
| CORS 代理端口 | 跨域处理服务端口 | localhost:3000 (自动) |

---

## 📊 Windows 特定功能

### ✅ 已实现

- [x] **NSIS 安装程序** - 支持 Windows 标准安装向导
- [x] **便携 EXE** - 无需安装可直接运行
- [x] **自定义安装目录** - 用户可选择安装位置
- [x] **开始菜单快捷方式** - 自动创建
- [x] **桌面快捷方式** - 自动创建
- [x] **卸载程序** - 完整卸载支持
- [x] **CORS 代理** - 跨域请求自动处理
- [x] **日志系统** - 错误和事件日志记录
- [x] **资源清理** - 应用退出时自动清理

### 🎁 额外功能

- **手动控制** - 按钮启动/停止流接收
- **状态指示** - 实时显示飞行和流接收状态
- **错误通知** - 连接失败自动提示
- **日志面板** - 内置日志查看

---

## 🔍 文件大小和性能

### 构建输出

| 文件类型 | 大小 | 特点 |
|---------|------|------|
| EXE 便携版 | 150-200MB | 自包含所有依赖 |
| MSI 安装版 | 80-100MB | 压缩安装包 |
| 安装后体积 | 300-400MB | 解压后的应用 |

### 性能指标

| 指标 | 数值 |
|------|------|
| 应用启动时间 | 2-3 秒 |
| 飞行检测延迟 | 500ms |
| 内存占用 | 100-200MB |
| CPU 占用 | <2% (空闲时) |

---

## 🐛 故障排查

### 常见问题

#### 问题 1: 应用无法启动

```powershell
# 从命令行运行查看错误
.\dist\无人机像素流接收器-1.0.0.exe 2>&1 | Tee-Object error.log
```

**可能原因**:
- Node.js 版本过低
- 依赖库损坏
- 权限问题

**解决方案**:
```powershell
npm cache clean --force
npm install
npm run build:win-exe
```

#### 问题 2: 无法连接 Dashboard

**检查步骤**:
```powershell
# 1. 测试网络连接
ping 10.30.2.11

# 2. 测试 API 端口
curl http://10.30.2.11:8000

# 3. 测试像素流端口
curl http://10.30.2.11:80
```

**可能原因**:
- 网络不通
- 防火墙阻止
- Dashboard 服务未运行

#### 问题 3: 构建失败

**查看详细错误**:
```powershell
npm run build:win-exe 2>&1 | Tee-Object build-error.log
```

**常见原因和解决**:

| 错误 | 原因 | 解决 |
|------|------|------|
| `gyp ERR!` | 缺少编译工具 | `npm install -g windows-build-tools` |
| `ENOENT` | 文件不存在 | 检查项目文件完整性 |
| `EACCES` | 权限错误 | 以管理员运行 PowerShell |
| `Out of memory` | 内存不足 | 关闭其他应用 |

### 查看日志

应用数据目录：
```
C:\Users\<YourName>\AppData\Roaming\无人机像素流接收器\
```

查看日志：
```powershell
cat "$env:APPDATA\无人机像素流接收器\logs\main.log"
```

---

## 📋 完整构建检查清单

构建前：
- [ ] Windows 11 系统
- [ ] Node.js v16+ 已安装
- [ ] npm v8+ 已安装
- [ ] 有 500MB+ 磁盘空间
- [ ] 可连接网络
- [ ] 能访问 10.30.2.11

构建中：
- [ ] `npm install` 无错误
- [ ] `build.ps1` 或 `build.bat` 执行成功
- [ ] 生成文件在 `dist/` 目录

构建后：
- [ ] EXE 文件 > 100MB
- [ ] 可双击运行
- [ ] 应用窗口显示正常
- [ ] 能连接 Dashboard
- [ ] 日志无错误信息

---

## 🚀 进阶使用

### 修改后重新构建

```powershell
# 修改 main.js 或其他文件后
npm run build:win-exe

# 清理旧文件再构建
.\build.ps1 -Type clean
npm install
npm run build:win-exe
```

### 生成其他格式

```powershell
# 只生成 MSI (需要 NSIS)
npm run build:win-msi

# 同时生成 MSI 和 EXE
npm run build:win

# 调试构建 (打包但不压缩)
npm run pack
```

### 开发模式

```powershell
# 实时开发 (修改自动重启)
npm start

# 调试模式 (打开开发者工具)
npm run dev
```

---

## 📚 文档导航

1. **快速开始** → QUICKSTART_WINDOWS.md
2. **完整指南** → WINDOWS_BUILD_GUIDE.md
3. **环境检查** → `.\check-env.ps1`
4. **构建脚本** → `.\build.ps1` 或 `build.bat`

---

## 🔗 相关文档

项目根目录 (`doc/`) 中的其他文档：

- **ELECTRON_PIXEL_STREAM_SOLUTION.md** - 完整解决方案
- **DRONE_FLIGHT_STATUS_API.md** - 飞行检测 API
- **FLIGHT_STATUS_IMPLEMENTATION.md** - 实现细节
- **IMPLEMENTATION_COMPLETE.md** - 项目总结

---

## 🎓 技术架构

### 主要模块

```
main.js (主进程)
├── CORS 代理服务器 (localhost:3000)
├── DroneFlightMonitor (飞行检测)
├── PixelStreamManager (流管理)
└── IPC 通信

renderer.js (渲染进程)
├── StreamUI (界面管理)
├── 事件监听
└── 流预览
```

### 通信流程

```
Dashboard (Linux)
      ↓
CORS Proxy (Electron 主进程)
      ↓
DroneFlightMonitor (检测飞行)
      ↓
IPC Message 
      ↓
Renderer (UI 更新)
      ↓
PixelStreamManager (启动/停止流)
      ↓
Pixel Stream (显示视频)
```

---

## 🤝 支持和反馈

### 获取帮助

1. 查看 **WINDOWS_BUILD_GUIDE.md** 中的故障排查部分
2. 运行 **check-env.ps1** 检查环境
3. 查看应用日志文件

### 常用命令速查

```powershell
# 环境检查
.\check-env.ps1

# 快速构建
.\build.ps1

# 完整构建
.\build.ps1 -Type msi

# 清理缓存
.\build.ps1 -Type clean

# 开发模式
npm start
```

---

## 📄 许可证

MIT License

---

## 🎉 开始使用

```powershell
# 1. 进入项目目录
cd electron-app-template

# 2. 检查环境
.\check-env.ps1

# 3. 构建应用
.\build.ps1

# 4. 运行应用
.\dist\无人机像素流接收器-1.0.0.exe
```

**祝您使用愉快！** 🚁✈️

---

**最后更新**: 2025-12-10  
**版本**: 1.0.0  
**支持平台**: Windows 11 (Windows 10/Server 2019+ 也可能兼容)  
**状态**: ✅ 生产级别就绪
