# UE 启动参数对比参考

## 📋 Usoftware 参考脚本 vs droneOnCampus

### 关键发现

**Usoftware 中的启动脚本使用的是：**
- ✅ `-RCWebControlEnable` （而不是 `-RCWebInterface`）
- ✅ `-RCWebInterfaceEnable`
- ✅ `-HTTPPort=30010`

**完整参数集：**

```bash
./Project NewMap \
  -PixelStreamingURL="ws://127.0.0.1:8888" \
  -ResX=1920 \
  -ResY=1080 \
  -VSync=0 \
  -FixedFrameRate=60 \
  -AudioMixer \
  -ForceRes \
  -Game \
  -Map=NewMap \
  -server \
  -nosound \
  -PixelStreamingEncoderMinQP=20 \
  -PixelStreamingEncoderMaxQP=30 \
  -RenderOffScreen \
  -RCWebControlEnable \
  -RCWebInterfaceEnable \
  -HTTPPort=30010 \
  -PixelStreamingWebRTCMaxBitrate=10000 \
  -PixelStreamingWebRTCMinBitrate=2000
```

---

## 🔄 参数对应关系

### Remote Control API 参数

| 用途 | Usoftware 参数 | 说明 |
|------|---------------|------|
| 启用控制功能 | `-RCWebControlEnable` | 启用 Remote Control Web 控制 |
| 启用接口 | `-RCWebInterfaceEnable` | 启用 Remote Control Web 接口 |
| 设置端口 | `-HTTPPort=30010` | HTTP API 监听端口 |

### 像素流参数

| 用途 | Usoftware 参数 | 说明 |
|------|---------------|------|
| 信号服务器 | `-PixelStreamingURL="ws://127.0.0.1:8888"` | 连接到 Cirrus 信令服务器 |
| 分辨率宽 | `-ResX=1920` | 输出分辨率宽度 |
| 分辨率高 | `-ResY=1080` | 输出分辨率高度 |
| 垂直同步 | `-VSync=0` | 禁用垂直同步 |
| 帧率限制 | `-FixedFrameRate=60` | 固定帧率 60fps |
| 最小量化参数 | `-PixelStreamingEncoderMinQP=20` | 编码质量最小 |
| 最大量化参数 | `-PixelStreamingEncoderMaxQP=30` | 编码质量最大 |
| 最高比特率 | `-PixelStreamingWebRTCMaxBitrate=10000` | 10Mbps 最高 |
| 最低比特率 | `-PixelStreamingWebRTCMinBitrate=2000` | 2Mbps 最低 |

### 运行模式参数

| 用途 | Usoftware 参数 | 说明 |
|------|---------------|------|
| 游戏模式 | `-Game` | 以游戏模式运行 |
| 服务器模式 | `-server` | 服务器模式 |
| 无头渲染 | `-RenderOffScreen` | 无头渲染（不显示窗口） |
| 禁用声音 | `-nosound` | 禁用音频输出 |
| 音频混音 | `-AudioMixer` | 启用音频混音 |
| 强制分辨率 | `-ForceRes` | 强制分辨率应用 |

---

## ✅ 已更新的文件

### droneOnCampus 中已应用的更改

1. **scripts/start_ue_with_remote_control.sh**
   - ✅ 更新启动命令参数
   - ✅ 包含所有像素流优化参数
   - ✅ 使用 `-RCWebControlEnable` 和 `-RCWebInterfaceEnable`

2. **scripts/start_complete_system.sh**
   - ✅ 更新启动命令参数
   - ✅ 一键启动所有服务
   - ✅ 按正确顺序启动服务

3. **UE_API_DIAGNOSTIC_REPORT.md**
   - ✅ 更新参数说明表
   - ✅ 包含完整的启动命令

4. **UE_REMOTE_CONTROL_QUICK_START.md**
   - ✅ 更新参数说明表
   - ✅ 更新快速启动命令

5. **SYSTEM_STARTUP_GUIDE.md**
   - ✅ 更新手动启动步骤
   - ✅ 更新故障排查清单

---

## 🎯 推荐启动方式

### 最佳实践：使用完整启动脚本

```bash
bash ~/rayCode/droneOnCampus/scripts/start_complete_system.sh
```

此脚本将：
1. ✅ 启动 Cirrus 信令服务
2. ✅ 启动 Dashboard Web 服务
3. ✅ 启动 UE 应用（含所有优化参数）

---

## 📊 参数优化总结

### 性能相关

- `-VSync=0` - 禁用垂直同步，提高帧率
- `-FixedFrameRate=60` - 固定 60fps，稳定延迟
- `-PixelStreamingEncoderMinQP=20` - 高质量编码
- `-PixelStreamingEncoderMaxQP=30` - 控制质量范围
- `-PixelStreamingWebRTCMaxBitrate=10000` - 10Mbps 高质量
- `-PixelStreamingWebRTCMinBitrate=2000` - 2Mbps 最低保证

### 稳定性相关

- `-Game` - 游戏模式
- `-server` - 服务器模式（适合无头运行）
- `-RenderOffScreen` - 无头渲染
- `-nosound` - 禁用声音（避免音频问题）

### Remote Control API 相关

- `-RCWebControlEnable` - 启用控制
- `-RCWebInterfaceEnable` - 启用接口
- `-HTTPPort=30010` - API 端口

---

## 🔗 参考来源

**参考文件：** `/data/home/sim6g/Usoftware/Linux/Project/Binaries/Linux/start.sh`

此文件中的启动参数已被验证为有效的 UE 应用启动配置。

---

**更新时间**: 2024-12-04  
**参考版本**: Usoftware start.sh  
**应用项目**: droneOnCampus
