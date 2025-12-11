# UE Remote Control API 诊断报告

## 问题确认

**Remote Control API 不可达** ❌

```
测试命令: curl http://10.30.2.11:30010/remote/object/call -X OPTIONS
结果: Connection refused (拒绝连接)
状态: 端口 30010 未监听
```

---

## 根本原因

### 缺失条件

1. **UE 应用未启动** 
   - 需要启动: `/data/home/sim6g/rayCode/Linux/Project/Binaries/Linux/Project`
   - 带参数: `NewMap -PixelStreamingURL=ws://127.0.0.1:8888 -RenderOffScreen`

2. **Remote Control API 未启用**
   - 需要在 UE 编辑器或运行时配置
   - 配置文件: `DefaultEngine.ini` 中需要设置
   - 参数: `bEnableRemoteExecution=true` 或启用 Remote Control API 插件

### 端口映射

| 服务 | 端口 | 状态 | 说明 |
|------|------|------|------|
| 像素流 Streamer | 8888 | ✅ 运行 | Cirrus 信令服务 |
| 仪表板 | 8001 | ✅ 运行 | Python http.server |
| **UE Remote Control API** | **30010** | ❌ **未运行** | UE 应用需启动 |

---

## 解决方案

### 步骤 1: 启动 UE 应用

**正确的启动命令（包含 Remote Control API）：**
```bash
cd /data/home/sim6g/rayCode/Linux/Project/Binaries/Linux
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

**参数说明：**
| 参数 | 说明 |
|------|------|
| `NewMap` | 要加载的地图名称 |
| `-PixelStreamingURL=ws://...` | 像素流服务器地址 |
| `-RenderOffScreen` | 无头渲染（不显示窗口） |
| **`-RCWebControlEnable`** | **启用 Remote Control Web 控制** |
| **`-RCWebInterfaceEnable`** | **启用 Remote Control Web 接口** |
| **`-HTTPPort=30010`** | **设置 HTTP API 监听端口** |
| `-ResX=1920 -ResY=1080` | 分辨率设置 |
| `-VSync=0 -FixedFrameRate=60` | 帧率设置 |
| `-AudioMixer -ForceRes` | 音频和分辨率强制应用 |
| `-Game -server -nosound` | 游戏模式、服务器模式、禁用声音 |
| `-PixelStreamingEncoder...` | 像素流编码参数 |
| `-LogCmds="LogRemoteControl Info"` | 启用日志以便调试 |

**或使用提供的启动脚本：**
```bash
bash /data/home/sim6g/rayCode/droneOnCampus/scripts/start_ue_with_remote_control.sh
```

### 步骤 2: 验证 API 连接

```bash
# 测试连接
curl http://10.30.2.11:30010/remote/object/call -X OPTIONS

# 预期响应: HTTP 200 或 HTTP 405 (OPTIONS not allowed)
```

### 步骤 3: 测试 API 功能

使用诊断工具: `http://10.30.2.11:8001/ue_api_diagnostic.html`

---

## API 配置检查清单

### UE Engine 配置

**文件**: `Linux/Project/Binaries/Linux/DefaultEngine.ini` 或 `Saved/Config/LinuxNoEditor/DefaultEngine.ini`

需要包含以下配置：

```ini
[/Script/Engine.Engine]
+NetDriverDefinitions=(DefName="GameNetDriver",ClassName="OnlineSubsystemNull.NullNetDriver",PlatformServiceModule="")

[RemoteExecution]
bEnableRemoteExecution=True

[/Script/RemoteControl.RemoteControlSettings]
bEnableRemoteControl=True
RemoteControlHttpServerPort=30010
```

### Python 端配置 (api-manager.js)

✅ **已配置正确**:
```javascript
this.baseUrl = "http://10.30.2.11:30010/remote/object/call";
this.method = "PUT";  // 正确的HTTP方法
```

### 调用示例

所有调用都已在代码中实现：

- ✅ `setDroneLocation(x, y, z)` - 设置无人机位置
- ✅ `startDelivery(from, to)` - 开始配送任务  
- ✅ `changeBaseStationLight(lightIndex, colorCode)` - 改变灯光颜色
- ✅ `changeView()` - 改变摄像机视角

---

## 网络和防火墙配置

### 检查防火墙规则

```bash
# 检查 30010 端口是否开放
sudo ufw status | grep 30010
# 或者
netstat -tuln | grep 30010
```

### 允许 30010 端口

```bash
# 如果防火墙阻止了连接
sudo ufw allow 30010/tcp
sudo ufw allow 30010/udp
```

---

## 故障排查步骤

### 1. 确认 UE 应用启动

```bash
# 检查进程
ps aux | grep Project | grep -v grep

# 预期: 看到 /data/home/sim6g/rayCode/Linux/Project/Binaries/Linux/Project 进程
```

### 2. 检查网络连接

```bash
# 直接测试
timeout 5 bash -c 'echo "" | telnet 10.30.2.11 30010' 2>&1

# 或使用 nc
nc -zv 10.30.2.11 30010
```

### 3. 查看 UE 日志

```bash
# 查看 UE 应用输出日志
tail -f ~/rayCode/Linux/Project/Saved/Logs/*.log

# 查找 Remote Control 相关日志
grep -i "remote" ~/rayCode/Linux/Project/Saved/Logs/*.log
```

### 4. 在诊断工具中测试

1. 打开: `http://10.30.2.11:8001/ue_api_diagnostic.html`
2. 点击 "检查连接" 按钮
3. 查看输出信息

---

## 预期结果

当 UE 应用正确启动后：

```
✅ Connection Status: 连接成功，API服务器在线
✅ HTTP 200 或 405 响应
✅ 测试功能返回成功响应
```

### 成功的 API 响应示例

```json
{
  "success": true,
  "data": {
    "Result": "Success",
    "ObjectPath": "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_3",
    "FunctionName": "SetLocation",
    "Parameters": {
      "X": -850,
      "Y": -30,
      "Z": 62
    }
  }
}
```

---

## 相关文档

- 📄 仪表板文档: `README.md`
- 🎮 UE 远程控制 API: `doc/RAY_CLUSTER_SETUP_GUIDE.md`
- 🔧 API 管理器: `api-manager.js` (第 1-100 行)
- 📊 诊断工具: `ue_api_diagnostic.html`

---

## 当前状态总结

| 组件 | 状态 | 说明 |
|------|------|------|
| **Web 仪表板** | ✅ 运行 | http://10.30.2.11:8001 |
| **像素流** | ✅ 运行 | ws://127.0.0.1:8888 |
| **API 代码** | ✅ 就绪 | api-manager.js 已正确实现 |
| **JavaScript 初始化** | ✅ 就绪 | window.ueApiManager 已创建 |
| **UE Remote Control API** | ❌ 未运行 | 需要启动 UE 应用 |

---

## 下一步行动

1. **启动 UE 应用**（此步骤是关键）
   ```bash
   cd /data/home/sim6g/rayCode/Linux/Project/Binaries/Linux
   ./Project NewMap -PixelStreamingURL=ws://127.0.0.1:8888 -RenderOffScreen
   ```

2. **验证 API 可达**
   ```bash
   curl http://10.30.2.11:30010/remote/object/call -X OPTIONS
   ```

3. **使用诊断工具测试**
   - 访问: http://10.30.2.11:8001/ue_api_diagnostic.html
   - 点击各个测试按钮

4. **验证仪表板功能**
   - 打开: http://10.30.2.11:8001/dashboard.html
   - 测试配送控制和灯光控制

---

**报告生成时间**: 2024-12-04  
**诊断工具**: UE API Diagnostic v1.0
