# Windows 构建快速参考卡

## ⚡ 30 秒启动

```powershell
cd electron-app-template
.\build.ps1
.\dist\*.exe
```

---

## 📋 命令速查

### 检查环境
```powershell
.\check-env.ps1              # 自动诊断
```

### 构建应用
```powershell
.\build.ps1                  # 构建 EXE (推荐)
.\build.ps1 -Type msi        # 构建 MSI + EXE
.\build.ps1 -Type clean      # 清理缓存
.\build.ps1 -Type start      # 开发模式

# 或使用批处理
build.bat
build.bat build-exe
build.bat build-msi
```

### 手动命令
```powershell
npm install                  # 首次安装依赖
npm run build:win-exe       # 构建便携版
npm run build:win           # 构建 MSI + EXE
npm start                   # 开发模式
```

---

## 🎯 快速问题排查

### "找不到 Node.js"
```powershell
# 下载安装: https://nodejs.org/
# 重启 PowerShell 后重试
node --version
```

### "npm install 失败"
```powershell
npm cache clean --force
npm install --global windows-build-tools
npm install
```

### "build 失败"
```powershell
.\check-env.ps1              # 自动检查问题
```

### "EXE 无法运行"
```powershell
# 以管理员运行 PowerShell
npm run build:win-exe
```

---

## 📂 关键文件位置

| 文件 | 位置 | 用途 |
|------|------|------|
| 快速开始 | QUICKSTART_WINDOWS.md | 5 分钟入门 |
| 完整指南 | WINDOWS_BUILD_GUIDE.md | 详细说明 |
| 环境检查 | check-env.ps1 | 诊断问题 |
| 自动构建 | build.ps1 | 一键构建 |
| 配置修改 | main.js (L147-148) | 修改地址 |
| 输出文件 | dist/ | 生成的应用 |

---

## ⚙️ 配置地址修改

编辑 `main.js` 第 147-148 行：

```javascript
// Dashboard 服务器
const DASHBOARD_API_URL = 'http://10.30.2.11:8000';

// 像素流服务器
new PixelStreamManager('http://10.30.2.11:80');
```

然后重新构建：
```powershell
npm run build:win-exe
```

---

## 📊 构建时间表

| 操作 | 首次 | 后续 |
|------|------|------|
| npm install | 2-3 min | - |
| build:win-exe | 3-5 min | 1-2 min |
| **总计** | 5-10 min | 1-2 min |

---

## 🎮 应用运行

### EXE 便携版 (推荐)
```powershell
.\dist\无人机像素流接收器-1.0.0.exe
```

### MSI 安装版
```powershell
# 标准安装
msiexec /i ".\dist\无人机像素流接收器-1.0.0.msi"

# 自定义目录
msiexec /i ".\dist\*.msi" INSTALLFOLDER="C:\MyApps"
```

---

## 📌 核心功能

✅ **自动飞行检测** - 读取 bArePropellersActive  
✅ **自动启动流** - 飞行时接收像素流  
✅ **自动停止流** - 着陆时停止流  
✅ **CORS 代理** - 跨域自动处理  
✅ **便携运行** - EXE 无需安装  
✅ **标准安装** - MSI 支持自定义目录  

---

## 🔍 诊断工具

```powershell
# 完整环境检查
.\check-env.ps1

# 检查 Node.js
node --version

# 检查 npm
npm --version

# 测试网络
ping 10.30.2.11

# 测试 API
curl http://10.30.2.11:8000

# 查看日志
cat "$env:APPDATA\无人机像素流接收器\logs\main.log"
```

---

## 📦 输出文件

```
dist/
├── 无人机像素流接收器-1.0.0.exe (150-200MB)
└── 无人机像素流接收器-1.0.0.msi (80-100MB)
```

---

## 🚀 三步启动

```powershell
# 1. 检查
.\check-env.ps1

# 2. 构建
.\build.ps1

# 3. 运行
.\dist\*.exe
```

---

## 📞 获取帮助

| 问题 | 文档 |
|------|------|
| 快速开始 | QUICKSTART_WINDOWS.md |
| 构建失败 | WINDOWS_BUILD_GUIDE.md |
| 环境问题 | check-env.ps1 |
| 详细说明 | README_WINDOWS.md |

---

## ✨ 最常用命令

```powershell
# 最常见的使用流程
cd electron-app-template       # 进入目录
.\check-env.ps1               # 检查环境
.\build.ps1                   # 构建应用
.\dist\*.exe                  # 运行应用
```

---

**记住这个页面，90% 的问题都能解决！** 💡

版本: 1.0.0 | 平台: Windows 11 | 状态: ✅ 就绪
