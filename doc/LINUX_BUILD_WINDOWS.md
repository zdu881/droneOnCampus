# Linux 平台构建 Windows 应用指南

## 概述

在 Linux 上构建 Windows 应用非常简单！使用 `electron-builder` 可以直接生成 Windows EXE 和 MSI 安装包，无需 Windows 系统或虚拟机。

---

## 🚀 快速开始 (3 步)

### 第 1 步: 进入项目目录

```bash
cd /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template
```

### 第 2 步: 构建应用

**构建 EXE 便携版** (推荐)：
```bash
./build.sh win
# 或
./build.sh
```

**构建 MSI + EXE**：
```bash
./build.sh win-msi
```

### 第 3 步: 获取输出文件

构建完成后，输出文件在 `dist/` 目录：

```
dist/
├── 无人机像素流接收器-1.0.0.exe    ← 便携版 (推荐)
└── 无人机像素流接收器-1.0.0.msi    ← 安装版 (可选)
```

---

## 📋 环境要求

### 最低要求

- ✅ Node.js v12+ (推荐 v14 或更高)
- ✅ npm v6+
- ✅ 足够的磁盘空间 (500MB+)

### 验证环境

```bash
# 检查 Node.js
node --version  # 应该是 v12+

# 检查 npm
npm --version   # 应该是 v6+

# 检查磁盘空间
df -h | grep home
```

### 安装缺少的工具

**Ubuntu/Debian**：
```bash
# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证
node --version
npm --version
```

**CentOS/RHEL**：
```bash
# 使用 nvm 安装 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 验证
node --version
```

**macOS**：
```bash
# 使用 Homebrew
brew install node

# 或从官网下载
# https://nodejs.org/
```

---

## 🛠️ 构建脚本详解

### build.sh 脚本

位置: `./build.sh`

**功能**:
- 自动检查环境
- 自动安装依赖
- 交叉编译到 Windows
- 生成 EXE 和 MSI

**使用方法**:

```bash
# 构建 EXE (推荐)
./build.sh win

# 构建 MSI + EXE
./build.sh win-msi

# 清理构建文件
./build.sh clean

# 显示帮助
./build.sh help
```

### 手动命令

如果不想使用脚本，也可以手动运行：

```bash
# 安装依赖 (首次)
npm install

# 构建 EXE
npm run build:win-exe

# 构建 MSI
npm run build:win-msi

# 同时构建 MSI + EXE
npm run build:win
```

---

## 📊 构建时间

| 操作 | 耗时 |
|------|------|
| npm install (首次) | 3-5 分钟 |
| 构建 EXE (首次) | 5-10 分钟 |
| 构建 EXE (后续) | 2-3 分钟 |
| 构建 MSI + EXE | 8-15 分钟 |

---

## 🎯 完整示例

### 从零开始构建

```bash
# 1. 进入项目目录
cd /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template

# 2. 检查环境 (可选但推荐)
node --version
npm --version

# 3. 构建应用
./build.sh win

# 4. 等待完成 (5-10 分钟)
# 输出会显示构建进度

# 5. 查看输出文件
ls -lh dist/

# 6. 验证文件
file dist/*.exe
```

### 修改代码后重新构建

```bash
# 编辑代码
nano main.js

# 重新构建
./build.sh win

# 新的 EXE 会覆盖旧的
```

### 清理并重新构建

```bash
# 清理所有缓存
./build.sh clean

# 重新安装依赖
npm install

# 重新构建
./build.sh win
```

---

## 📦 输出文件说明

### EXE 便携版

**文件**: `无人机像素流接收器-1.0.0.exe`

**特点**:
- 无需安装可直接运行
- 自包含所有依赖
- 可放在任意位置
- 可以放入 U 盘
- 大小: 150-200MB

**使用**:
```bash
# 在 Linux 上查看
file dist/*.exe
ls -lh dist/*.exe

# 复制到 Windows
scp dist/*.exe user@windows-ip:/path/to/

# 在 Windows 上直接运行
双击 .exe 文件
```

### MSI 安装程序

**文件**: `无人机像素流接收器-1.0.0.msi`

**特点**:
- Windows 标准安装程序
- 支持自定义安装目录
- 自动创建快捷方式
- 支持卸载
- 大小: 80-100MB

**使用**:
```bash
# 在 Windows 上安装
msiexec /i "无人机像素流接收器-1.0.0.msi"

# 或双击运行
```

---

## 🐛 常见问题

### 问题 1: "Command not found: ./build.sh"

**原因**: 脚本没有执行权限

**解决**:
```bash
chmod +x build.sh
./build.sh win
```

### 问题 2: "node: command not found"

**原因**: Node.js 未安装或未在 PATH 中

**解决**:
```bash
# 检查是否安装
which node

# 如果未安装，使用包管理器安装
# Ubuntu/Debian
sudo apt-get install nodejs npm

# CentOS/RHEL
sudo yum install nodejs npm

# macOS
brew install node
```

### 问题 3: "npm: command not found"

**解决**: 同问题 2

### 问题 4: 构建失败 "gyp ERR!"

**原因**: 缺少编译工具

**解决** (Ubuntu/Debian):
```bash
sudo apt-get install build-essential python3
npm install
npm run build:win-exe
```

**解决** (CentOS/RHEL):
```bash
sudo yum install gcc gcc-c++ make python3
npm install
npm run build:win-exe
```

### 问题 5: 磁盘空间不足

**症状**: "ENOSPC: no space left on device"

**解决**:
```bash
# 清理 npm 缓存
npm cache clean --force

# 清理旧的构建文件
./build.sh clean

# 查看磁盘使用
du -sh node_modules/
du -sh dist/

# 清理磁盘
df -h
```

### 问题 6: 网络超时

**原因**: npm 包下载超时

**解决**:
```bash
# 更改 npm 源
npm config set registry https://registry.npmmirror.com

# 重试
npm install
npm run build:win-exe

# 恢复默认源 (可选)
npm config set registry https://registry.npmjs.org/
```

---

## 🚀 部署到 Windows

### 方法 1: 通过 SCP

```bash
# 从 Linux 复制到 Windows (通过 SSH)
scp dist/*.exe user@192.168.1.100:/c/Users/YourName/Downloads/

# 在 Windows 上
# 打开文件管理器，进入 Downloads
# 双击 .exe 文件运行
```

### 方法 2: U 盘

```bash
# 挂载 U 盘
sudo mount /dev/sdb1 /mnt/usb

# 复制文件
cp dist/*.exe /mnt/usb/

# 卸载 U 盘
sudo umount /mnt/usb

# 在 Windows 上插入 U 盘并运行
```

### 方法 3: 网络共享 (Samba)

```bash
# Linux 上启动 Samba (如果已安装)
sudo systemctl start smbd

# Windows 上访问
\\linux-ip\share

# 复制文件使用
```

### 方法 4: 在线传输

```bash
# 上传到服务器
scp dist/*.exe server@example.com:/www/download/

# 在 Windows 上下载
浏览器访问: http://example.com/download/
```

---

## 📊 监控构建过程

### 实时查看构建日志

```bash
# 构建 EXE 并显示详细日志
npm run build:win-exe -- --publish=never -v

# 或使用脚本
./build.sh win
```

### 后台构建

```bash
# 在后台运行
nohup ./build.sh win > build.log 2>&1 &

# 查看进度
tail -f build.log

# 找到进程
ps aux | grep build

# 停止构建
kill <PID>
```

---

## 🎓 交叉编译原理

### 工作原理

1. **electron-builder** 是跨平台的构建工具
2. 在任何系统 (Linux/Mac/Windows) 上都能构建任何平台的应用
3. 不需要 Windows 环境，只需要构建工具链
4. 使用 NSIS (Windows 安装程序创建工具) 的命令行版本

### 支持的目标平台

```bash
# 在 Linux 上可以构建:
npm run build:win       # Windows (EXE + MSI)
npm run build:linux     # Linux
npm run build:mac       # macOS

# 在 Mac 上可以构建:
npm run build:win       # Windows
npm run build:linux     # Linux
npm run build:mac       # macOS (最优)

# 在 Windows 上可以构建:
npm run build:win       # Windows (最优)
npm run build:linux     # Linux
npm run build:mac       # macOS (需要签名)
```

---

## 💡 最佳实践

### 1. 版本管理

```bash
# 修改版本 (package.json 中)
nano package.json

# 搜索: "version": "1.0.0"
# 改为: "version": "1.0.1"

# 保存并重新构建
npm run build:win-exe
```

### 2. 自动化构建 (CI/CD)

```bash
# 创建自动化脚本
cat > build-and-deploy.sh << 'EOF'
#!/bin/bash
set -e

# 构建
./build.sh win

# 上传
scp dist/*.exe user@server:/downloads/

# 通知
echo "构建完成并已上传到服务器"
EOF

chmod +x build-and-deploy.sh
```

### 3. 保留构建历史

```bash
# 为每个版本保留一份副本
mkdir -p builds
cp dist/*.exe "builds/$(date +%Y%m%d_%H%M%S)_v1.0.0.exe"

# 查看历史
ls -lh builds/
```

### 4. 验证输出文件

```bash
# 检查文件类型
file dist/*.exe
file dist/*.msi

# 检查大小
ls -lh dist/

# 计算哈希值 (用于完整性验证)
sha256sum dist/*.exe > dist/checksums.txt
cat dist/checksums.txt
```

---

## 🎯 检查清单

构建完成后检查：

- [ ] `dist/` 目录已生成
- [ ] `.exe` 文件 > 100MB
- [ ] `.msi` 文件 > 50MB (如构建)
- [ ] 文件名正确 (带版本号)
- [ ] 文件可以复制
- [ ] 没有构建错误
- [ ] 构建日志无警告

---

## 📚 相关文档

- **QUICKSTART_WINDOWS.md** - Windows 快速开始
- **WINDOWS_BUILD_GUIDE.md** - Windows 详细指南
- **README.md** - 项目说明

---

## 🔧 高级用法

### 修改构建配置

编辑 `package.json` 的 `build` 部分：

```json
{
  "build": {
    "appId": "com.example.app",
    "productName": "应用名称",
    "files": ["main.js", "src/**/*", "node_modules/**/*"],
    "win": {
      "target": ["nsis", "portable"],
      "certificateFile": null
    }
  }
}
```

### 签名应用 (可选)

```bash
# 生成自签名证书 (仅用于测试)
# 在 Windows 上执行

# 用证书签名
npm run build:win -- --certificateFile="path/to/cert.pfx"
```

---

## 📊 性能优化

### 加快构建速度

```bash
# 只构建 EXE (不构建 MSI)
npm run build:win-exe

# 清理旧文件后构建
./build.sh clean && ./build.sh win

# 使用本地 npm 源
npm config set registry https://registry.npmmirror.com
```

### 减小文件大小

编辑 `package.json`，排除不需要的文件：

```json
{
  "build": {
    "files": [
      "main.js",
      "preload.js",
      "src/**/*",
      "node_modules/**/*",
      "!node_modules/**/*.test.js",
      "!node_modules/**/*.md"
    ]
  }
}
```

---

## 🎓 示例工作流

### 完整的开发到部署流程

```bash
# 1. 在 Linux 上开发和测试
cd /path/to/project
npm start  # 开发模式

# 2. 修改代码
nano src/renderer.js

# 3. 构建 Windows 版本
./build.sh win

# 4. 验证文件
ls -lh dist/
file dist/*.exe

# 5. 上传到服务器
scp dist/*.exe user@server:/downloads/

# 6. 在 Windows 上测试
# Windows 用户可以从服务器下载并测试

# 7. 部署完成
echo "应用已部署到 Windows"
```

---

## 📞 支持和帮助

### 获取帮助

```bash
# 显示 electron-builder 帮助
npx electron-builder --help

# 显示可用的构建选项
npm run build:win-exe -- --help

# 检查构建配置
cat package.json | grep -A 20 '"build"'
```

### 查看详细日志

```bash
# 启用详细日志
DEBUG=electron-builder ./build.sh win

# 或
npm run build:win-exe -- -v

# 保存日志到文件
./build.sh win > build.log 2>&1
cat build.log
```

---

## 🌟 总结

在 Linux 上构建 Windows 应用很简单：

1. **检查环境** - Node.js + npm
2. **运行脚本** - `./build.sh win`
3. **等待完成** - 5-10 分钟
4. **获取文件** - `dist/` 目录

**就这么简单！** ✨

---

**版本**: 1.0.0  
**更新**: 2025-12-10  
**平台**: Linux → Windows  
**状态**: ✅ 准备就绪

