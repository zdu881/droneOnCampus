# Windows 11 快速开始

## 🚀 30 秒快速开始

### 第 1 步: 准备环境 (首次)

```powershell
# 1. 安装 Node.js
# 下载: https://nodejs.org/ (LTS 版本)
# 运行安装程序，使用默认设置

# 2. 验证安装 (重启 PowerShell 后)
node --version    # 应显示 v18+ 或 v20+
npm --version     # 应显示 8+
```

### 第 2 步: 构建应用

在项目目录打开 **PowerShell**，执行：

```powershell
# 方法 A: 使用 PowerShell 脚本 (推荐)
.\build.ps1

# 或指定类型
.\build.ps1 -Type exe    # 构建 EXE
.\build.ps1 -Type msi    # 构建 MSI + EXE
.\build.ps1 -Type clean  # 清理

# 方法 B: 使用批处理脚本
build.bat
build.bat build-exe
build.bat build-msi

# 方法 C: 手动命令
npm install
npm run build:win-exe
```

### 第 3 步: 运行应用

```powershell
# 找到生成的文件
dist\无人机像素流接收器-1.0.0.exe

# 双击运行，或在 PowerShell 中：
.\dist\无人机像素流接收器-1.0.0.exe
```

---

## 📋 完整检查清单

构建前请确认：

- [ ] Windows 11 系统
- [ ] Node.js 已安装 (v16+)
- [ ] npm 版本 8+
- [ ] 有网络连接 (下载依赖)
- [ ] 有 500MB+ 磁盘空间
- [ ] 防火墙不阻止 npm

---

## 🔧 配置 (如需修改)

编辑 `main.js`，修改这两行：

```javascript
// 第 ~147 行
const DASHBOARD_API_URL = 'http://10.30.2.11:8000';  // ← Dashboard 服务器

// 第 ~148 行
new PixelStreamManager('http://10.30.2.11:80');      // ← 像素流服务器
```

然后重新运行：
```powershell
npm run build:win-exe
```

---

## ⚡ 构建速度

| 操作 | 耗时 |
|------|------|
| npm install (首次) | 2-3 分钟 |
| npm run build:win-exe (首次) | 3-5 分钟 |
| npm run build:win-exe (后续) | 1-2 分钟 |

---

## 🎯 输出文件说明

### 便携版 EXE (推荐)

```
dist/无人机像素流接收器-1.0.0.exe
```

- ✅ 150-200MB
- ✅ 无需安装
- ✅ 双击即可运行
- ✅ U 盘可携带
- ✅ 自动检测依赖

### 安装版 MSI (可选)

```
dist/无人机像素流接收器-1.0.0.msi
```

- ✅ 80-100MB
- ✅ 支持自定义安装目录
- ✅ 自动创建快捷方式
- ✅ 完整卸载支持
- ✅ 企业级打包

---

## 🐛 常见问题速查

### "Node.js 找不到"

```powershell
# 安装 Node.js
# https://nodejs.org/ 下载 LTS 版本
# 安装后重启 PowerShell
```

### "npm install 失败"

```powershell
npm cache clean --force
npm install --global windows-build-tools
npm install
```

### "build:win-exe 命令不存在"

```powershell
# 确认在项目根目录
cd /d "C:\path\to\electron-app-template"
npm install
npm run build:win-exe
```

### "ENOENT: no such file or directory"

```powershell
# 确认文件结构
ls main.js      # 应该存在
ls src\         # 应该有 src 目录
ls package.json # 应该存在

# 如果不存在，重新下载模板
```

---

## 📦 安装与运行

### EXE 便携版

```powershell
# 直接运行
.\dist\无人机像素流接收器-1.0.0.exe

# 或复制到其他目录
Copy-Item ".\dist\无人机像素流接收器-1.0.0.exe" "C:\Apps\"
C:\Apps\无人机像素流接收器-1.0.0.exe
```

### MSI 安装版

```powershell
# 双击安装
.\dist\无人机像素流接收器-1.0.0.msi

# 或命令行安装 (自定义目录)
msiexec /i ".\dist\无人机像素流接收器-1.0.0.msi" INSTALLFOLDER="C:\MyApps"
```

---

## 🔌 应用功能验证

启动应用后检查：

1. **窗口显示** - 应该看到蓝色界面
2. **状态显示** - 应该显示 "等待无人机飞行"
3. **连接状态** - 绿色点 = 连接正常，红色 = 连接失败
4. **日志** - 控制台应该显示日志信息

**如果连接失败**:

```powershell
# 检查网络
ping 10.30.2.11

# 检查服务
curl http://10.30.2.11:8000/api/drone/status
curl http://10.30.2.11:80
```

---

## 📱 应用界面

```
┌─────────────────────────────────────┐
│ 🎬 Pixel Stream Receiver    v1.0.0 │
├─────────────────────────────────────┤
│                                     │
│  状态: ⚫ 等待无人机飞行           │
│                                     │
│  【启动流】 【停止流】 【设置】   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │    像素流预览区域           │   │
│  │    (飞行时显示视频)        │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  日志:                              │
│  ✓ CORS 代理已启动                 │
│  ✓ 监控已启动                      │
│  ⏳ 等待飞行信号...               │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚀 下一步

1. **启动应用** - 运行 EXE
2. **测试连接** - 检查状态指示器
3. **测试飞行** - 在 UE 中启动无人机
4. **确认流** - 应该自动显示像素流

---

## 📞 需要帮助？

### 查看应用日志

```powershell
# 应用数据目录
$env:APPDATA

# 完整路径
C:\Users\YourName\AppData\Roaming\无人机像素流接收器\
```

### 从命令行运行看错误

```powershell
.\dist\无人机像素流接收器-1.0.0.exe 2>&1 | Tee-Object log.txt
```

### 获取更多帮助

查看完整指南: `WINDOWS_BUILD_GUIDE.md`

---

**提示**: 
- 首次构建会比较慢 (5-10 分钟)
- 后续构建会很快 (1-2 分钟)
- 确保网络连通到 Linux 服务器
- 防火墙可能需要配置

