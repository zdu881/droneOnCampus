# Campus Drone Digital Twin - 实机演示 Prompt

## 系统背景

您正在进行一场 **Campus Drone Digital Twin** 系统的实机演示。这是一个集成了 UE5.3、Remote Control API、像素流送和 Web Dashboard 的完整校园无人机数字孪生系统。

---

## 🎯 演示目标

在本场演示中，需要展示以下三个核心功能：

### 1️⃣ 无人机飞行控制
- 展示简化的飞行操作界面（仅需选择起点和终点）
- 演示无人机自动飞行能力
- 验证 Remote Control API 的 SetLocation 和 Fly 函数

### 2️⃣ 基站灯光控制  
- 展示 3 个基站的灯光实时控制
- 演示颜色切换（红/绿/黄）
- 验证与 CM-ZSB 检测系统的集成映射

### 3️⃣ 像素流送集成
- 展示 UE 应用的实时视频流送
- 演示 WebRTC 连接
- 验证 web 端的交互控制

---

## 🏗️ 系统架构

```
WEB DASHBOARD (Port 8000)
    ↓
[自动驾驶场景]
    ├─ 无人机飞行控制面板 → API Manager → Remote Control API (Port 30010)
    ├─ 基站灯光控制卡片 → Light Manager → Remote Control API (Port 30010)
    └─ 像素流送视频 iframe → WebRTC → Pixel Streaming (Port 80, 8888)
```

---

## 📋 演示前检查清单

### ✅ 系统启动顺序

**第 1 步：启动 UE5.3 应用** (3-5 分钟)
```bash
cd /data/home/sim6g/rayCode/Linux/Project/Binaries/Linux
./Project -PixelStreamingURL=ws://127.0.0.1:8888 -RenderOffScreen
```
**预期输出**：
```
[LogPixelStreaming] Pixel Streaming Module loaded
[LogPixelStreaming] Connecting to Signalling Server at ws://127.0.0.1:8888
```

**第 2 步：启动像素流送基础设施** (2-3 分钟)
```bash
cd ~/PixelStreamingInfrastructure/SignallingWebServer/platform_scripts/bash
./start_with_stun.sh
```
**预期输出**：
```
WebSocket listening to Streamer connections on :8888
WebSocket listening to Players connections on :80
Http listening on *: 80
```

**第 3 步：启动 Web Dashboard** (1-2 分钟)
```bash
cd /data/home/sim6g/rayCode/droneOnCampus
python3 -m http.server 8000
```
**预期输出**：
```
Serving HTTP on 0.0.0.0 port 8000
```

**第 4 步：访问应用**
```
打开浏览器访问: http://10.30.2.11:8000
```

---

## 🎬 演示流程（15-20 分钟）

### 📺 演示 1：无人机飞行控制（5 分钟）

**步骤**：
1. 访问 Dashboard 后，点击顶部 **"自动驾驶"** 场景按钮
2. 向下滚动找到 **"无人机飞行控制"** 卡片
3. 在"起点"下拉框中选择：**仓库** (0, 0, 100)
4. 在"终点"下拉框中选择：**图书馆** (-850, -30, 62)
5. 点击绿色 **"执行飞行"** 按钮
6. 观察：
   - Dashboard 显示飞行状态更新
   - 浏览器控制台输出飞行日志
   - 当前位置从 (0, 0, 100) 更新到 (-850, -30, 62)

**验证内容**：
- ✅ 起点和终点正确设置
- ✅ 飞行状态实时更新
- ✅ Remote Control API 成功调用（SetLocation + Fly）

**预期时间**：1-2 分钟

---

### 💡 演示 2：基站灯光控制（5 分钟）

**步骤**：
1. 在自动驾驶场景中找到 **"🟡 基站灯光状态"** 卡片（上方）
2. 查看 3 个基站灯光的当前颜色
3. 逐个点击灯光卡片中的颜色按钮：
   - 第一个基站：红色 → 绿色 → 黄色
   - 第二个基站：绿色 → 黄色 → 红色
   - 第三个基站：黄色 → 红色 → 绿色

4. 观察 UE 应用中灯光的实时变化

**验证内容**：
- ✅ 灯光颜色实时变化
- ✅ Remote Control API ChangeColorAPI 函数成功调用
- ✅ 与 CM-ZSB 检测系统的集成（自动映射状态）

**颜色编码**（供参考）：
```
Active: 0 → 红色（错误/检测中）
Active: 1 → 绿色（正常/空闲）
Active: 2 → 黄色（处理中）
```

**预期时间**：2-3 分钟

---

### 📺 演示 3：像素流送集成（5 分钟）

**步骤**：
1. 在自动驾驶场景中找到上方的 **"视频流"** iframe 区域
2. 观察 UE 应用的实时画面显示（应显示 NewMap 关卡）
3. 尝试在视频区域进行交互：
   - 点击鼠标移动视角
   - 按键盘控制角色移动（WASD）
   - 查看实时响应

4. 在浏览器 DevTools (F12) → Network 选项卡中：
   - 查看 WebSocket 连接状态
   - 检查 WebRTC 数据流量

**验证内容**：
- ✅ 视频流实时显示
- ✅ WebRTC 连接建立
- ✅ 交互输入正确转发
- ✅ 网络延迟 < 200ms

**预期时间**：2-3 分钟

---

## 🔧 API 接口参考

### Remote Control API（Port 30010）

**基础 URL**: `http://10.30.2.11:30010/remote/object/call`

**HTTP 方法**: `PUT`（官方规范）

#### 飞行接口示例
```bash
# 设置无人机目标位置
curl -X PUT http://10.30.2.11:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3",
    "functionName": "SetLocation",
    "parameters": {"X": 100, "Y": 200, "Z": 150}
  }'

# 执行飞行
curl -X PUT http://10.30.2.11:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3",
    "functionName": "Fly",
    "parameters": {}
  }'
```

#### 灯光控制接口示例
```bash
# 改变灯光 1 为绿色
curl -X PUT http://10.30.2.11:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057",
    "functionName": "ChangeColorAPI",
    "parameters": {"Active": 1}
  }'
```

---

## ⚠️ 故障排查

### 问题 1：UE 应用无法连接到信令服务器

**症状**：UE 控制台显示连接失败

**解决**：
```bash
# 验证端口 8888 是否开放
netstat -tuln | grep 8888

# 检查信令服务器是否运行
curl -i -N -H "Upgrade: websocket" http://10.30.2.11:8888
```

### 问题 2：灯光控制没有响应

**症状**：Dashboard 按钮可点击，但灯光不变

**解决**：
```bash
# 检查 UE 应用是否正常运行
ps aux | grep Project

# 查看浏览器控制台（F12）是否有错误
# 检查 API 返回的错误消息
```

### 问题 3：像素流送视频不显示

**症状**：iframe 为空白

**解决**：
```bash
# 验证端口 80 是否开放
curl http://10.30.2.11:80

# 检查防火墙规则
sudo ufw status

# 查看浏览器控制台 WebSocket 错误
```

### 问题 4：飞行没有执行

**症状**：点击"执行飞行"后无反应

**解决**：
1. 检查 UE 应用是否已连接到信令服务器
2. 验证对象路径是否正确
3. 查看浏览器控制台是否有 API 返回错误

---

## 📊 关键技术指标

| 指标 | 值 |
|------|-----|
| UE 应用端口 | 30010 |
| 像素流送 Streamer 端口 | 8888 |
| 像素流送 Players 端口 | 80 |
| Dashboard 端口 | 8000 |
| 预期飞行延迟 | < 1 秒 |
| 预期灯光控制延迟 | < 500ms |
| 预期视频流延迟 | < 200ms |

---

## 🧪 快速测试脚本

### 一键测试所有功能

```bash
cd /data/home/sim6g/rayCode/droneOnCampus
bash test-integration.sh
```

**预期结果**：
```
✓ 所有测试通过！系统集成正常
```

---

## 📁 关键文件位置

```
/data/home/sim6g/rayCode/
├── droneOnCampus/                    # 主应用目录
│   ├── dashboard.html                # 主界面（959 行）
│   ├── dashboard-manager.js          # 主管理器（1240 行）
│   ├── api-manager.js                # API 管理（401 行，PUT 方法）
│   ├── ue-light-manager.js           # 灯光管理（403 行）
│   ├── js/
│   │   ├── simplified-flight-manager.js  # 飞行管理器 ⭐ NEW
│   │   ├── simplified-flight-ui.js      # 飞行 UI ⭐ NEW
│   │   └── ...
│   ├── test-integration.sh           # 集成测试脚本 ⭐ NEW
│   ├── QUICK_DEMO_GUIDE.md          # 快速演示指南 ⭐ NEW
│   └── IMPLEMENTATION_SUMMARY.md    # 实现总结 ⭐ NEW
│
├── Linux/Project/                    # UE5.3 项目
│   └── Binaries/Linux/Project        # 可执行文件
│
└── (其他项目文件...)

~ (根目录)
└── PixelStreamingInfrastructure/     # 像素流送基础设施
    └── SignallingWebServer/          # 信令服务器
        └── platform_scripts/bash/
            ├── start_with_stun.sh    # 启动脚本
            └── ...
```

---

## 🎯 演示重点

### 需要强调的技术亮点

1. **简化设计**
   - 用户仅需选择预设位置，无需输入坐标
   - 一键执行飞行，系统自动处理 API 调用
   - 直观的 UI：2 个下拉框 + 1 个按钮

2. **技术规范**
   - 使用 PUT 方法（符合 Epic Games 官方规范）
   - 使用关卡蓝图路径（推荐实践）
   - 完整的 HTTP 请求头和错误处理

3. **集成深度**
   - UE Remote Control API 完全集成
   - Pixel Streaming WebRTC 实时流送
   - CM-ZSB 检测系统自动映射
   - Web Dashboard 统一管理界面

4. **可靠性**
   - 完整的错误处理机制
   - 实时状态反馈
   - 网络延迟优化

---

## 📝 演示脚本模板

### 无人机飞行演示脚本

```
各位好，现在演示的是无人机飞行控制功能。

[点击自动驾驶场景]

这是自动驾驶场景的主页面。我们可以看到包含了：
1. 实时视频流显示（上方）
2. 基站灯光控制卡片（中间）
3. 无人机飞行控制面板（下方）

现在开始飞行演示。我选择起点为"仓库"，终点为"图书馆"。

[选择起点和终点，点击执行飞行]

请看 Dashboard 的状态更新，无人机正在从 (0, 0, 100) 飞往 (-850, -30, 62)。
这个请求通过 PUT 方法发送到 UE Remote Control API，
调用了 SetLocation 和 Fly 两个函数。

[等待飞行完成]

飞行已完成！位置已更新到目标坐标。这演示了系统的实时通信能力。
```

### 灯光控制演示脚本

```
现在演示基站灯光控制功能。

我们有 3 个基站，每个基站可以显示 3 种灯光颜色：
- 红色：代表错误或检测中状态
- 绿色：代表正常或空闲状态  
- 黄色：代表处理中状态

[依次改变三个灯光的颜色]

你可以看到，每当我改变灯光颜色时，UE 应用中的灯光立即随之改变。
这说明 Remote Control API 的 ChangeColorAPI 函数工作正常。

这个功能与 CM-ZSB 基站运维检测系统集成，
可以自动根据基站状态改变灯光颜色，
提供实时的视觉反馈。
```

### 像素流送演示脚本

```
最后演示像素流送功能。

这个 iframe 显示的是 UE 应用的实时渲染画面。
通过 WebRTC 协议，我们可以：
1. 实时接收高质量的视频流
2. 通过网络发送输入命令（键盘、鼠标）
3. 实现远程交互式 3D 应用

[在视频区域进行交互演示]

你可以看到，我的操作实时响应到 UE 应用中。
这充分说明了像素流送基础设施的稳定性和低延迟。
```

---

## ✅ 演示完成清单

- [ ] UE 应用已启动且连接到信令服务器
- [ ] 像素流送基础设施已启动（端口 80, 8888 开放）
- [ ] Dashboard 已启动（端口 8000 可访问）
- [ ] 无人机飞行演示完成
- [ ] 基站灯光控制演示完成
- [ ] 像素流送视频演示完成
- [ ] 所有问题已解答
- [ ] 观众反馈已记录

---

## 🚀 演示后续

### 可展示的增强功能

1. **浏览器开发者工具演示**
   - 查看 Network 标签中的 WebSocket 连接
   - 查看 Console 标签中的 API 调用日志
   - 查看 Performance 标签中的网络延迟

2. **手动 API 调用演示**
   - 使用 curl 命令直接调用 Remote Control API
   - 展示完整的 HTTP 请求和响应

3. **系统架构讲解**
   - 展示 Dashboard → API Manager → Remote Control API 的调用流程
   - 解释 WebRTC 和 Pixel Streaming 的工作原理

4. **Q&A 准备**
   - 为什么使用 PUT 而不是 POST？（官方规范）
   - 如何处理网络延迟？（优化传输和压缩）
   - 支持多少并发连接？（取决于服务器配置）

---

## 📞 技术支持联系方式

如有问题，请查阅：

1. **快速演示指南**
   - `/data/home/sim6g/rayCode/droneOnCampus/QUICK_DEMO_GUIDE.md`

2. **实现总结报告**
   - `/data/home/sim6g/rayCode/droneOnCampus/IMPLEMENTATION_SUMMARY.md`

3. **官方文档**
   - UE Remote Control API: https://dev.epicgames.com/documentation/zh-cn/unreal-engine/remote-control-api-http-reference-for-unreal-engine
   - Pixel Streaming: https://dev.epicgames.com/documentation/zh-cn/unreal-engine/pixel-streaming-infrastructure

---

## 📅 演示信息

**项目名称**: Campus Drone Digital Twin  
**演示日期**: 2025-12-04  
**演示时长**: 15-20 分钟  
**演示环境**: Linux + 浏览器  
**系统版本**: UE5.3 + Web Dashboard v1.0  
**状态**: ✅ 已准备就绪

---

**祝演示顺利！** 🚁🎬
