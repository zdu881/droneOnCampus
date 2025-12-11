# 🎯 Linux 构建 Windows - 快速参考卡

## ⚡ 一分钟快速开始

```bash
cd /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template
npm run build:win-exe
```

**完成！** 5-10 分钟后，在 `dist/` 目录里获得 `.exe` 文件。

---

## 🛠️ 所有可用命令

```bash
# 🔵 构建 Windows EXE (推荐)
npm run build:win-exe

# 🟢 构建 Windows MSI + EXE
npm run build:win

# 🟡 构建脚本方式
./build.sh win          # EXE
./build.sh win-msi      # MSI + EXE
./build.sh clean        # 清理

# 🟣 交互式菜单
./build-interactive.sh

# 🔴 清理缓存
npm cache clean --force
rm -rf node_modules dist
```

---

## 📦 输出文件

构建完成后，在 `dist/` 目录找到：

```
无人机像素流接收器-1.0.0.exe    (150-200MB) ← 运行这个
无人机像素流接收器-1.0.0.msi    (80-100MB)  ← 或安装这个
```

---

## 🚀 部署到 Windows

### 方式 A: SCP

```bash
scp dist/*.exe user@windows-ip:/c/Users/User/Downloads/
```

### 方式 B: U 盘

```bash
sudo mount /dev/sdb1 /mnt/usb
cp dist/*.exe /mnt/usb/
sudo umount /mnt/usb
```

### 方式 C: HTTP

```bash
sudo cp dist/*.exe /var/www/html/
# 在 Windows 访问: http://linux-ip/无人机像素流接收器-1.0.0.exe
```

---

## 🐛 遇到问题？

| 问题 | 解决 |
|------|------|
| npm 未找到 | `sudo apt-get install nodejs npm` |
| 空间不足 | `npm cache clean --force` |
| 编译错误 | `sudo apt-get install build-essential python3` |
| 网络慢 | `npm config set registry https://registry.npmmirror.com` |
| 重新开始 | `rm -rf node_modules dist && npm install` |

---

## ✅ 构建检查清单

- [ ] Node.js 版本 >= v12
- [ ] npm 版本 >= v6
- [ ] 磁盘空间 > 500MB
- [ ] npm install 完成
- [ ] 构建命令执行
- [ ] dist/ 目录存在 .exe 文件
- [ ] 文件大小 > 100MB

---

## 📚 文档导航

| 文档 | 内容 | 时间 |
|------|------|------|
| **LINUX_BUILD_COMPLETE.md** | 完整总结 | 10 min |
| LINUX_BUILD_WINDOWS.md | 详细指南 | 20 min |
| LINUX_QUICK_START.md | 快速开始 | 5 min |

---

## 🎯 3 个最常用的命令

```bash
# 1️⃣ 第一次
npm install

# 2️⃣ 构建
npm run build:win-exe

# 3️⃣ 获取文件
ls -lh dist/
```

---

## 💻 系统要求

✅ Linux (任何发行版)  
✅ Node.js v12+  
✅ npm v6+  
✅ 500MB+ 磁盘空间  
✅ 网络连接  

---

## ⏱️ 时间表

| 操作 | 耗时 |
|------|------|
| npm install (首次) | 3-5 min |
| npm run build:win-exe (首次) | 5-10 min |
| npm run build:win-exe (之后) | 2-3 min |
| **总计 (首次)** | **8-15 min** |

---

## 🎁 你将获得

✅ Windows EXE 应用  
✅ 自动飞行检测  
✅ 自动像素流接收  
✅ 自动停止流  
✅ CORS 代理  
✅ 无需安装即可运行  

---

## 🌟 构建成功表现

✅ 没有红色错误信息  
✅ dist/ 目录已创建  
✅ .exe 文件大小 > 100MB  
✅ 文件名包含版本号  
✅ 完成信息显示在终端  

---

## 🎓 下一步

1. 在 Linux 上运行构建命令
2. 等待 5-10 分钟完成
3. 复制 .exe 文件到 Windows
4. 在 Windows 上双击运行
5. 应用自动检测飞行

---

## 📞 关键路径

```
项目目录:
/data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template/

输出文件:
/data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template/dist/

构建脚本:
- build.sh (简单)
- build-interactive.sh (菜单)
```

---

## 🔗 快速链接

- **文档**: LINUX_BUILD_COMPLETE.md (完整指南)
- **项目**: /data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template/
- **输出**: dist/ (构建后查看)

---

**记住**: 一条命令构建 Windows 应用！

```bash
npm run build:win-exe
```

⏱️ 5-10 分钟后准备就绪！ ✨

