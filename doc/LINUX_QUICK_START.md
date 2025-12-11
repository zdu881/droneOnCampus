# Linux 快速开始 - 构建 Windows 应用

## ⚡ 30 秒快速开始

### 前置条件

```bash
# 检查 Node.js (必需)
node --version  # 应该是 v12+

# 检查 npm (必需)
npm --version   # 应该是 v6+
```

### 构建应用

```bash
# 1. 进入项目目录
cd /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template

# 2. 构建 Windows EXE (选项 A - 推荐)
npm run build:win-exe
# 或
./build.sh win

# 或构建 MSI + EXE (选项 B)
npm run build:win
# 或
./build.sh win-msi

# 3. 等待完成 (5-10 分钟)

# 4. 查看输出文件
ls -lh dist/
```

---

## 📂 项目结构

```
electron-app-template/
├── build.sh                    ← 简单构建脚本
├── build-interactive.sh        ← 交互式构建脚本
├── main.js                     ← Windows CORS 代理配置
├── package.json                ← 构建配置
├── preload.js
├── src/
│   ├── index.html
│   ├── renderer.js
│   ├── drone-monitor.js
│   └── stream-manager.js
└── dist/                       ← 构建输出 (生成)
    ├── 无人机像素流接收器-1.0.0.exe
    └── 无人机像素流接收器-1.0.0.msi
```

---

## 🛠️ 构建脚本

### 方法 1: 简单脚本 (build.sh)

```bash
# 构建 EXE
./build.sh win

# 构建 MSI + EXE
./build.sh win-msi

# 清理
./build.sh clean
```

### 方法 2: 交互式脚本 (build-interactive.sh)

```bash
# 启动交互菜单
./build-interactive.sh

# 或非交互模式
./build-interactive.sh win
./build-interactive.sh msi
./build-interactive.sh clean
```

### 方法 3: 手动命令

```bash
# 安装依赖
npm install

# 构建 EXE
npm run build:win-exe

# 构建 MSI + EXE
npm run build:win

# 清理
rm -rf dist node_modules
```

---

## 📊 构建时间参考

| 操作 | 耗时 |
|------|------|
| npm install (首次) | 3-5 分钟 |
| 构建 EXE (首次) | 5-10 分钟 |
| 构建 EXE (后续) | 2-3 分钟 |
| 构建 MSI + EXE | 8-15 分钟 |

---

## 🎯 常用命令

### 快速构建

```bash
# 进入目录并构建 (推荐)
cd /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template && npm run build:win-exe

# 或一行命令
cd /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template && npm install && npm run build:win-exe
```

### 后台构建

```bash
# 在后台运行并保存日志
nohup ./build.sh win > build.log 2>&1 &

# 监看日志
tail -f build.log

# 查看进程
ps aux | grep build

# 停止构建
pkill -f "npm run"
```

### 验证输出

```bash
# 查看文件
ls -lh dist/

# 检查文件类型
file dist/*.exe
file dist/*.msi

# 计算文件大小
du -sh dist/

# 计算 MD5 (用于完整性验证)
md5sum dist/*.exe > dist/checksums.txt
cat dist/checksums.txt
```

---

## 🚀 部署到 Windows

### 选项 1: 通过 SCP (需要 SSH 访问)

```bash
# 复制 EXE 到 Windows 机器
scp dist/*.exe user@windows-ip:/c/Users/YourName/Downloads/

# 或使用 MSI
scp dist/*.msi user@windows-ip:/c/Users/YourName/Downloads/

# 在 Windows 上运行
# 打开 Downloads 文件夹，双击 .exe 或 .msi 文件
```

### 选项 2: 通过 U 盘

```bash
# 挂载 U 盘
sudo mount /dev/sdb1 /mnt/usb

# 复制文件
sudo cp dist/*.exe /mnt/usb/

# 卸载
sudo umount /mnt/usb

# 在 Windows 上插入 U 盘并运行
```

### 选项 3: 通过 FTP/HTTP 服务器

```bash
# 复制到 web 服务器
cp dist/*.exe /var/www/html/downloads/

# Windows 用户访问下载
http://linux-ip/downloads/无人机像素流接收器-1.0.0.exe
```

### 选项 4: 使用 rsync

```bash
# 同步到 Windows 共享文件夹
rsync -avz dist/*.exe /mnt/windows-share/

# 或远程同步
rsync -avz dist/*.exe user@server:/downloads/
```

---

## 🐛 故障排查

### 问题 1: "Command not found: npm"

```bash
# 检查 npm 是否安装
which npm

# 如果未找到，安装 Node.js
# Ubuntu/Debian
sudo apt-get install nodejs npm

# CentOS/RHEL
sudo yum install nodejs npm

# macOS
brew install node
```

### 问题 2: "ENOSPC: no space left on device"

```bash
# 磁盘空间不足
# 清理 npm 缓存
npm cache clean --force

# 查看磁盘使用
df -h

# 清理系统
sudo apt-get clean  # Ubuntu/Debian
sudo yum clean all  # CentOS/RHEL
```

### 问题 3: "gyp ERR! configure error"

```bash
# 缺少编译工具
# Ubuntu/Debian
sudo apt-get install build-essential python3

# CentOS/RHEL
sudo yum install gcc gcc-c++ make python3

# 重新尝试
npm install && npm run build:win-exe
```

### 问题 4: "npm ERR! code ECONNREFUSED"

```bash
# 网络连接问题
# 更换 npm 源
npm config set registry https://registry.npmmirror.com

# 重新尝试
npm install

# 恢复默认源
npm config set registry https://registry.npmjs.org/
```

### 问题 5: "Cannot find module 'electron'"

```bash
# 依赖不完整
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
npm run build:win-exe
```

---

## 📚 详细文档

更多信息请查看:
- **LINUX_BUILD_WINDOWS.md** - 完整 Linux 构建指南
- **WINDOWS_BUILD_GUIDE.md** - Windows 使用指南
- **README_WINDOWS.md** - 应用说明

---

## ✅ 验证清单

构建完成后检查：

- [ ] `dist/` 目录已创建
- [ ] `无人机像素流接收器-1.0.0.exe` 文件 > 100MB
- [ ] `无人机像素流接收器-1.0.0.msi` 文件 > 50MB (如构建)
- [ ] 文件名包含版本号
- [ ] 文件可以复制到其他目录
- [ ] 构建输出无错误信息

---

## 🎯 关键参数

**Dashboard**: http://10.30.2.11:8000  
**Pixel Stream**: http://10.30.2.11:80  
**CORS 代理**: localhost:3000  

需要修改？编辑 `main.js` 第 147-148 行。

---

## 💡 最佳实践

### 1. 在生产前构建

```bash
# 测试构建
npm run build:win-exe

# 检查输出
file dist/*.exe
```

### 2. 保留版本历史

```bash
# 为每个版本备份
mkdir -p releases
cp dist/*.exe releases/$(date +%Y%m%d)_v1.0.0.exe
```

### 3. 自动化脚本

```bash
# 创建自动化构建脚本
cat > auto-build.sh << 'EOF'
#!/bin/bash
cd /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template
npm run build:win-exe
echo "构建完成！文件在 dist/ 目录"
EOF

chmod +x auto-build.sh
./auto-build.sh
```

---

## 🌟 总结

**在 Linux 上构建 Windows 应用只需 3 步:**

1. **检查环境**
   ```bash
   node --version && npm --version
   ```

2. **运行构建**
   ```bash
   cd /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template
   npm run build:win-exe
   ```

3. **获取文件**
   ```bash
   ls -lh dist/
   ```

**就这么简单！** ✨

---

**平台**: Linux → Windows  
**构建时间**: 5-10 分钟  
**输出**: EXE + MSI  
**状态**: ✅ 准备就绪

