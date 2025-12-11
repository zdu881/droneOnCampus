# Windows 11 Electron 应用构建指南

## 📋 前置条件

### 1. 环境检查

在 PowerShell 中检查是否安装了必需工具：

```powershell
# 检查 Node.js
node --version  # 应该是 v16+ 

# 检查 npm
npm --version   # 应该是 8+

# 检查 Python (可选，某些包需要)
python --version # 3.7+
```

### 2. 如果未安装

#### 安装 Node.js (推荐 LTS 版本)
1. 访问 https://nodejs.org/
2. 下载 LTS 版本 (20.x 或 18.x)
3. 运行安装程序，使用默认设置
4. **重启 PowerShell**，验证安装

#### 安装必要的构建工具 (Windows Build Tools)
```powershell
# 以管理员身份运行 PowerShell，执行：
npm install --global windows-build-tools

# 或者分别安装
npm install --global node-gyp
npm install --global python
```

---

## 🚀 构建步骤

### 方法 1: 快速构建 (推荐)

在项目根目录打开 **PowerShell** (管理员模式最佳)：

```powershell
# 1. 进入项目目录
cd "C:\path\to\pixel-stream-receiver"

# 2. 安装依赖 (首次只需一次)
npm install

# 3. 生成 exe 可执行文件 (便携版)
npm run build:win-exe

# 或者同时生成 MSI + EXE
npm run build:win

# 4. 等待构建完成 (通常 2-5 分钟)
```

**输出位置**:
```
dist/
├── 无人机像素流接收器-1.0.0.exe      ← 便携版 (无需安装)
└── 无人机像素流接收器-1.0.0.msi      ← 安装版 (可选)
```

### 方法 2: 自定义构建

```powershell
# 仅打包不构建
npm run pack

# 完整构建
npm run dist

# 开发模式测试
npm start
```

---

## 📦 安装与运行

### 运行便携版 EXE

```powershell
# 直接运行
.\dist\无人机像素流接收器-1.0.0.exe

# 或双击文件
```

**特点**:
- ✅ 无需安装
- ✅ 可放在任意位置运行
- ✅ U 盘携带方便
- ✅ 自动寻找依赖

### 安装 MSI 版本

```powershell
# 方法 1: 双击文件
.\dist\无人机像素流接收器-1.0.0.msi

# 方法 2: 命令行安装
msiexec /i ".\dist\无人机像素流接收器-1.0.0.msi"

# 到自定义目录
msiexec /i ".\dist\无人机像素流接收器-1.0.0.msi" INSTALLFOLDER="C:\Custom\Path"
```

**特点**:
- ✅ 支持自定义安装目录
- ✅ 创建开始菜单快捷方式
- ✅ 创建桌面快捷方式
- ✅ 支持卸载功能

---

## 🔧 配置说明

### 主要配置参数

编辑 `main.js` 文件，找到以下行并修改：

```javascript
// 【重要】第 ~47 行
const DASHBOARD_API_URL = 'http://10.30.2.11:8000';

// 【重要】第 ~48 行
streamManager = new PixelStreamManager('http://10.30.2.11:80');
```

### CORS 代理配置

应用内置了 CORS 代理，运行在 `http://localhost:3000`

**特点**:
- ✅ 自动处理跨域问题
- ✅ 无需额外配置
- ✅ Windows 兼容性优化

---

## 🪟 Windows 特定功能

### 已实现

- [x] **自定义安装目录** - 安装时可选择位置
- [x] **开始菜单快捷方式** - 自动创建菜单项
- [x] **桌面快捷方式** - 桌面快速启动
- [x] **卸载程序** - 完整卸载支持
- [x] **CORS 代理** - 跨域请求处理
- [x] **进程管理** - 正确的窗口关闭和资源清理

### 未来可选功能

- [ ] 开机自启 (可选)
- [ ] 系统托盘 (可选)
- [ ] 自动更新检查 (可选)

---

## 🐛 常见问题

### 问题 1: npm install 失败

**症状**: 
```
npm ERR! gyp ERR! configure error
```

**解决**:
```powershell
# 1. 清除 npm 缓存
npm cache clean --force

# 2. 重新安装构建工具
npm install --global windows-build-tools

# 3. 重新尝试
npm install
```

### 问题 2: 构建速度很慢

**症状**: `npm run build:win` 耗时 10+ 分钟

**解决**:
- 这是正常的 (首次)，后续会更快
- 检查磁盘空间 (需要 500MB+)
- 关闭杀毒软件临时加速

### 问题 3: 应用无法连接 Dashboard

**症状**: 应用启动但显示"连接失败"

**排查步骤**:

```powershell
# 1. 测试网络连通性
ping 10.30.2.11

# 2. 测试 Dashboard 服务
curl http://10.30.2.11:8000/api/drone/status

# 3. 测试 Pixel Stream
curl http://10.30.2.11:80
```

如果都失败，检查：
- [ ] 防火墙是否阻止连接
- [ ] Dashboard 服务是否运行
- [ ] 网络是否连通 Linux 服务器

### 问题 4: "缺少 Visual Studio Build Tools"

**症状**:
```
error: 'node-gyp' failed
```

**解决**:
```powershell
# 方法 1: 自动安装 (推荐)
npm install --global windows-build-tools

# 方法 2: 手动安装
# 下载 Visual Studio Community (带 C++ 工作负载)
# https://visualstudio.microsoft.com/downloads/
```

### 问题 5: EXE 无法运行

**症状**: 双击 EXE 无反应或闪退

**排查步骤**:

```powershell
# 1. 从命令行运行看错误
.\dist\无人机像素流接收器-1.0.0.exe

# 2. 查看日志文件
Get-Content "%APPDATA%\无人机像素流接收器\logs\main.log"

# 3. 重新构建
npm run clean
npm run build:win-exe
```

---

## 📊 构建配置说明

### package.json 中的关键配置

```json
{
  "build": {
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },      // MSI 安装程序
        { "target": "portable", "arch": ["x64"] }   // 便携 EXE
      ]
    },
    "nsis": {
      "allowToChangeInstallationDirectory": true,   // 自定义安装目录
      "createDesktopShortcut": true,                // 创建桌面快捷方式
      "createStartMenuShortcut": true               // 创建菜单快捷方式
    }
  }
}
```

---

## 📈 性能优化

### 应用启动优化

```javascript
// main.js 中已优化的部分
- ✅ CORS 代理异步启动
- ✅ 窗口预加载
- ✅ 资源延迟加载
- ✅ 内存泄漏防止
```

### 构建大小

| 配置 | 大小 |
|------|------|
| 便携 EXE | ~150-200MB |
| MSI 安装包 | ~80-100MB |
| 安装后体积 | ~300-400MB |

---

## 🚀 快速启动命令

```powershell
# 完整流程 (从零开始)
cd path\to\project
npm install
npm run build:win-exe

# 只重建 (修改代码后)
npm run build:win-exe

# 测试开发版本
npm start

# 清理构建文件
rm -r dist/
rm -r node_modules/
npm install
```

---

## 📞 技术支持

### 常用文件位置

| 文件 | 位置 |
|------|------|
| 应用日志 | `%APPDATA%\无人机像素流接收器\logs\` |
| 应用数据 | `%APPDATA%\无人机像素流接收器\` |
| 配置文件 | `C:\path\to\install\config.json` |
| 临时文件 | `%TEMP%\electron-*` |

### 查看应用日志

```powershell
# 查看最新日志
Get-Content "$env:APPDATA\无人机像素流接收器\logs\main.log" -Tail 50

# 实时监听日志
Get-Content "$env:APPDATA\无人机像素流接收器\logs\main.log" -Wait
```

### 完全卸载应用

```powershell
# 方法 1: 通过控制面板 (MSI 版本)
# 设置 → 应用 → 应用和功能 → 无人机像素流接收器 → 卸载

# 方法 2: 命令行卸载
msiexec /x "无人机像素流接收器-1.0.0.msi"

# 方法 3: 清除所有数据
Remove-Item -Recurse "$env:APPDATA\无人机像素流接收器"
```

---

## ✅ 验证清单

构建完成后，请检查：

- [ ] EXE 文件大小正常 (>50MB)
- [ ] 双击 EXE 能启动应用
- [ ] 应用窗口显示正常
- [ ] 能连接到 Dashboard (10.30.2.11:8000)
- [ ] 能显示像素流预览
- [ ] 控制台无错误信息
- [ ] 飞行状态检测正常

---

**最后更新**: 2025-12-10  
**状态**: ✅ Windows 11 适配完成  
**构建工具版本**: electron@27.0.0, electron-builder@24.6.4

