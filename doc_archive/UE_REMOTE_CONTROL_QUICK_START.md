# UE Remote Control API - 快速启动指南

## ⚡ 快速启动 (30秒)

### 方式 1: 使用启动脚本 (推荐)

```bash
bash ~/rayCode/droneOnCampus/scripts/start_ue_with_remote_control.sh
```

### 方式 2: 手动启动

```bash
cd ~/rayCode/Linux/Project/Binaries/Linux

./Project NewMap \
  -PixelStreamingURL=ws://127.0.0.1:8888 \
  -RenderOffScreen \
  -RCWebControlEnable \
  -RCWebInterfaceEnable \
  -HTTPPort=30010 \
  -ResX=1920 \
  -ResY=1080 \
  -VSync=0 \
  -FixedFrameRate=60 \
  -AudioMixer \
  -ForceRes \
  -Game \
  -server \
  -nosound \
  -PixelStreamingEncoderMinQP=20 \
  -PixelStreamingEncoderMaxQP=30 \
  -PixelStreamingWebRTCMaxBitrate=10000 \
  -PixelStreamingWebRTCMinBitrate=2000 \
  -LogCmds="LogRemoteControl Info"
```

---

## 🔑 关键参数解释

| 参数 | 值 | 必需 | 说明 |
|------|-----|------|------|
| `Map Name` | `NewMap` | ✅ | 要加载的地图 |
| `-PixelStreamingURL` | `ws://127.0.0.1:8888` | ✅ | 像素流服务器 |
| `-RenderOffScreen` | N/A | ✅ | 无头渲染 |
| **`-RCWebControlEnable`** | **N/A** | **✅** | **启用 Web 控制** |
| **`-RCWebInterfaceEnable`** | **N/A** | **✅** | **启用 Web 接口** |
| **`-HTTPPort`** | **`30010`** | **✅** | **API 监听端口** |
| `-ResX -ResY` | `1920 1080` | ❌ | 分辨率 |
| `-VSync -FixedFrameRate` | `0 60` | ❌ | 帧率设置 |
| `-AudioMixer -ForceRes` | N/A | ❌ | 音频和分辨率强制 |
| `-Game -server -nosound` | N/A | ❌ | 游戏模式、服务器模式 |
| `-PixelStreamingEncoder...` | `20-30` | ❌ | 编码参数 |
| `-LogCmds` | `LogRemoteControl Info` | ❌ | 调试日志 |

---

## ✅ 验证启动成功

### 1. 检查进程

```bash
ps aux | grep Project | grep -v grep
```

预期输出：看到 Project 进程正在运行

### 2. 测试 API 连接

```bash
curl http://10.30.2.11:30010/remote/object/call -X OPTIONS -v
```

预期响应：HTTP 200 或 405（OPTIONS 方法通常不被支持，但表示服务在线）

### 3. 使用诊断工具

访问：`http://10.30.2.11:8001/ue_api_diagnostic.html`

点击 "检查连接" 按钮，应显示 ✅ 连接成功

---

## 🎮 完整启动流程 (3步)

### 步骤 1: 启动像素流服务

```bash
cd ~/PixelStreamingInfrastructure/SignallingWebServer/platform_scripts/bash
bash run_local.sh
```

等待看到：`INFO: Listening on port 80...`

### 步骤 2: 启动 Dashboard 服务

```bash
cd ~/rayCode/droneOnCampus
python3 -m http.server 8001 &
```

或

```bash
bash start_dashboard.bat
```

### 步骤 3: 启动 UE 应用（此步启用 Remote Control API）

```bash
cd ~/rayCode/Linux/Project/Binaries/Linux

./Project NewMap \
  -PixelStreamingURL=ws://127.0.0.1:8888 \
  -RenderOffScreen \
  -RCWebInterface \
  -HTTPPort=30010
```

---

## 🧪 功能测试

启动完成后，访问测试页面：

```
http://10.30.2.11:8001/ue_api_diagnostic.html
```

可以测试以下功能：

✅ 获取无人机位置  
✅ 设置无人机位置  
✅ 开始配送任务  
✅ 改变灯光颜色  
✅ 测试灯光闪烁  

---

## 📊 系统检查清单

启动前确认：

- [ ] 像素流服务已启动（端口 8888）
- [ ] Dashboard 服务已启动（端口 8001）
- [ ] 无人机模型在 NewMap 中存在
- [ ] 基站灯光对象已配置
- [ ] 网络连接正常（10.30.2.11 可达）

---

## 🐛 常见问题

### Q: API 连接失败，显示 "Connection refused"

**A:** UE 应用未启动或缺少 `-RCWebInterface` 参数

```bash
# 检查是否启动
ps aux | grep Project

# 确保使用正确的参数启动
./Project NewMap -PixelStreamingURL=ws://127.0.0.1:8888 -RenderOffScreen -RCWebInterface -HTTPPort=30010
```

### Q: 端口 30010 被占用

**A:** 杀死占用端口的进程

```bash
# 查看占用端口的进程
lsof -i :30010

# 杀死进程
kill -9 <PID>
```

### Q: 灯光控制不起效

**A:** 检查灯光对象路径是否正确

在 `api-manager.js` 中验证：
```javascript
getBaseStationLightPaths() {
  return {
    light1: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_...",
    light2: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_...",
    light3: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_..."
  };
}
```

### Q: 配送任务不执行

**A:** 检查目标位置是否在 locations 中定义

```javascript
this.locations = {
  Warehouse: { x: 0, y: 0, z: 100 },
  Library: { x: -850, y: -30, z: 62 },
  Dormitory: { x: 500, y: 400, z: 80 },
  Cafeteria: { x: -200, y: 300, z: 75 },
};
```

---

## 📚 相关文件

| 文件 | 说明 |
|------|------|
| `scripts/start_ue_with_remote_control.sh` | UE 启动脚本 |
| `api-manager.js` | Remote Control API 实现 |
| `dashboard-manager.js` | 仪表板管理器 |
| `ue_api_diagnostic.html` | API 诊断工具 |
| `UE_API_DIAGNOSTIC_REPORT.md` | 完整诊断报告 |

---

## 🔗 相关链接

- 📺 仪表板: http://10.30.2.11:8001/dashboard.html
- 🔧 诊断工具: http://10.30.2.11:8001/ue_api_diagnostic.html
- 📖 完整报告: `UE_API_DIAGNOSTIC_REPORT.md`

---

**最后更新**: 2024-12-04  
**版本**: 1.0
