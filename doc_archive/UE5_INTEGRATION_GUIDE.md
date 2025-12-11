# UE5.3 项目集成指南 - 完整实现总结

## 📋 项目概览

本文档总结了 CM-ZSB 系统与 UE5.3 无人机项目的完整集成方案，包括：
- ✅ 无人机飞行路径规划
- ✅ CM-ZSB 节点状态检测与灯光联动
- ✅ UE Remote Control API 集成
- ⏳ 像素流送 WebRTC 嵌入

---

## 🚀 快速开始

### 1. 部署 UE5.3 项目

```bash
# UE项目已解压到
/data/home/sim6g/rayCode/Linux/Project/

# 可执行文件位置
/data/home/sim6g/rayCode/Linux/Project/Binaries/Linux/Project

# 启动 UE（在 Head Node 10.30.2.11 上运行）
cd /data/home/sim6g/rayCode/Linux/Project/Binaries/Linux/
./Project -windowed
```

### 2. 启动像素流送基础设施

```bash
# 使用官方像素流送基础设施
cd ~/PixelStreamingInfrastructure/
./get_ps_servers.sh

# 或参考 UE 项目中的示例
/data/home/sim6g/rayCode/Linux/Project/Samples/PixelStreaming/WebServers/get_ps_servers.sh
```

### 3. 启动仪表板

```bash
cd /data/home/sim6g/rayCode/droneOnCampus/
# 使用前端构建系统启动
npm start
# 或直接打开
python3 -m http.server 8080
```

---

## 🎯 核心功能说明

### A. 无人机飞行路径规划

#### 文件位置
- **路径管理器**：`js/flight-path-manager.js` (800+ 行)
- **路径规划 UI**：`js/drone-path-planning-ui.js` (600+ 行)
- **样式**：`dashboard-styles.css` (新增路径规划样式)

#### 支持的路径类型

##### 1. 单点飞行（最简单）
```javascript
// UI 中直接输入坐标
const path = {
  type: 'single',
  target: { x: 100, y: 200, z: 150 },
  speed: 'normal'  // slow/normal/fast
};
```

##### 2. 顺序多点飞行
```javascript
const path = {
  type: 'sequential',
  waypoints: [
    { x: 0, y: 0, z: 100 },
    { x: 100, y: 100, z: 120 },
    { x: 200, y: 0, z: 150 }
  ],
  speed: 'normal'
};
```

##### 3. 高级飞行（支持循环、延迟、返回）
```javascript
const path = {
  type: 'advanced',
  waypoints: [
    { x: 0, y: 0, z: 100, speed: 'slow', delayBefore: 0 },
    { x: 100, y: 100, z: 120, speed: 'normal', delayBefore: 2000 }
  ],
  loopCount: 2,    // 循环 2 次
  autoReturn: true // 完成后返回起点
};
```

#### UI 使用流程
1. 选择路径类型（单点/多点/高级）
2. 编辑路径参数
3. 点击"保存路径"
4. 点击"开始飞行"
5. 查看飞行状态和路径点进度

#### API 集成
路径规划使用 `FlightPathManager` 类，该类与 `apiManager` 交互：
```javascript
// 创建管理器
const pathManager = new FlightPathManager(window.apiManager);

// 设置路径
pathManager.setPath(pathData);

// 开始飞行
await pathManager.startFlight();

// 监听事件
pathManager.on('onWaypointReached', (data) => {
  console.log(`到达路径点 ${data.index}`);
});
```

---

### B. CM-ZSB 与灯光映射

#### 文件位置
- **映射管理器**：`js/station-light-mapping.js` (500+ 行)
- **集成点**：`dashboard-manager.js` 中的 `setupStationLightMapping()`

#### 工作流程

```
CM-ZSB 节点检测 → 状态判断 → 灯光颜色映射 → UE 灯光控制
   (3个节点)     (idle/detecting/error)  (0=红/1=绿/2=黄)  (ChangeColorAPI)
```

#### 状态到颜色的映射

| 节点状态 | 灯光颜色 | 说明 |
|---------|---------|------|
| `idle` / `ready` | 绿色 (1) | 正常、就绪 |
| `detecting` / `sending` / `processing` | 黄色 (2) | 忙碌中 |
| `error` / `offline` | 红色 (0) | 异常 |

#### 配置节点检查 URL

在 `dashboard-manager.js` 的 `setupStationLightMapping()` 中修改：

```javascript
const nodeConfigs = [
  {
    nodeId: 'node-1',
    lightIndex: 1,
    checkUrl: 'http://10.30.2.11:8000/health'  // ← 修改为实际的健康检查端点
  },
  // ... 其他节点
];
```

#### 健康检查 API 格式要求

系统会向上述 URL 发送 GET 请求，期望的响应格式：

```json
{
  "status": "idle",  // 或 "detecting", "sending", "error" 等
  "cpu_usage": 25.5,
  "memory_usage": 60.2,
  "detecting": false,
  "processing": false
}
```

#### 自动监控功能

- **启动监控**：`stationLightMappingManager.startMonitoring(3000)` // 每3秒检测
- **停止监控**：`stationLightMappingManager.stopMonitoring()`
- **手动检测**：`stationLightMappingManager.checkSingleNodeStatus('node-1')`
- **更新灯光**：`stationLightMappingManager.updateSingleLight('node-1')`

#### 自定义状态映射

```javascript
// 添加自定义状态映射
stationLightMappingManager.addStatusColorMapping('running', 1);    // 绿色
stationLightMappingManager.addStatusColorMapping('warning', 2);    // 黄色
stationLightMappingManager.addStatusColorMapping('failed', 0);     // 红色
```

---

### C. UE Remote Control API 配置

#### 已更新的配置

**文件**：`api-manager.js` 第 1-20 行

```javascript
this.baseUrl = "http://10.30.2.11:30010/remote/object/call";
this.method = "POST";  // ✅ 已修正为 POST

// 关卡蓝图路径（推荐）
this.droneActorPath = "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3";
this.levelScriptActorPath = "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3";
```

#### 无人机控制接口

| 方法 | 函数 | 参数 | 用途 |
|-----|------|------|------|
| `setDroneLocation(x, y, z)` | `SetLocation` | X, Y, Z (int) | 设置目标位置 |
| `triggerDroneAction()` | `Fly` | 无 | 执行飞行 |
| `changeView()` | `ChangeView` | 无 | 切换摄像机视角 |

#### 灯光控制接口

| 方法 | 函数 | 参数 | 用途 |
|-----|------|------|------|
| `changeBaseStationLight(index, color)` | `ChangeColorAPI` | Active (0=红, 1=绿, 2=黄) | 改变灯光颜色 |
| `setBaseStationRed(index)` | `ChangeColorAPI` | Active=0 | 设为红色 |
| `setBaseStationGreen(index)` | `ChangeColorAPI` | Active=1 | 设为绿色 |
| `setBaseStationYellow(index)` | `ChangeColorAPI` | Active=2 | 设为黄色 |

#### 灯光对象路径

```
light1: /Game/NewMap.NewMap:PersistentLevel.light_C_UAID_...
light2: /Game/NewMap.NewMap:PersistentLevel.light_C_UAID_...
light3: /Game/NewMap.NewMap:PersistentLevel.light_C_UAID_...
```

---

### D. 像素流送 WebRTC（待配置）

#### 启动像素流送

```bash
# 方法1：使用 UE 官方脚本
~/PixelStreamingInfrastructure/get_ps_servers.sh

# 方法2：使用 UE 项目中的脚本
/data/home/sim6g/rayCode/Linux/Project/Samples/PixelStreaming/WebServers/get_ps_servers.sh

# 脚本会启动：
# - Cirrus 服务器 (通常 :8888)
# - TURN/STUN 服务器
# - WebRTC 基础设施
```

#### 配置 dashboard.html 中的 iframe

**文件**：`dashboard.html` 第 111-120 行

```html
<iframe
  id="pixel-streaming-viewport"
  src="http://10.30.2.11:8888"
  width="100%"
  height="600"
  style="border: 2px solid #00d4ff; border-radius: 8px;"
></iframe>
```

#### 检查像素流送配置

1. **确认 UE 应用启用了像素流送**
   - 启动参数应包含 `-PixelStreamingURL=...` 或使用默认配置
   
2. **验证网络连接**
   ```bash
   curl -v http://10.30.2.11:8888
   ```

3. **在浏览器中测试**
   - 访问 `http://10.30.2.11:8888`
   - 应能看到 UE 应用的实时画面

---

## 📂 文件结构

```
droneOnCampus/
├── dashboard.html                    # 主页面（已添加脚本引入）
├── dashboard-styles.css              # 样式（已添加路径规划样式）
├── dashboard-manager.js              # 仪表板管理（已集成路径规划和灯光映射）
├── api-manager.js                    # API 管理（已更新无人机路径）
├── ue-light-manager.js               # 灯光管理
├── js/
│   ├── flight-path-manager.js        # ✨ 新增：路径管理器
│   ├── drone-path-planning-ui.js     # ✨ 新增：路径规划 UI
│   ├── station-light-mapping.js      # ✨ 新增：灯光映射管理
│   └── pixel-streaming.js            # 像素流送管理
└── src/frontend/
    ├── dashboard.html                # 源文件版本
    └── js/                           # 对应的 JS 文件副本
```

---

## 🔧 测试步骤

### 步骤 1: 验证 UE API 连接

```bash
# 测试灯光控制
curl -X POST http://10.30.2.11:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3",
    "functionName": "ChangeColorAPI",
    "parameters": { "Active": 1 }
  }'

# 预期响应：HTTP 200
```

### 步骤 2: 测试路径规划

1. 在仪表板中打开自动驾驶场景
2. 在"无人机路径规划"卡片中：
   - 选择"单点飞行"
   - 输入坐标：X=100, Y=100, Z=150
   - 点击"保存路径"
   - 点击"开始飞行"
3. 观察无人机在 UE 中的飞行

### 步骤 3: 测试灯光映射

1. 确保 CM-ZSB 节点已启动（或模拟健康检查响应）
2. 在仪表板中点击"启动监控"
3. 观察灯光颜色随节点状态变化
4. 在浏览器控制台检查日志输出

### 步骤 4: 测试像素流送

1. 启动像素流送基础设施
2. 在仪表板中的自动驾驶场景查看 iframe
3. 应能看到实时的 UE 应用画面

---

## 📝 配置检查清单

- [ ] UE5.3 项目已启动（10.30.2.11:30010）
- [ ] Remote Control API 已启用
- [ ] 灯光对象路径已验证（NewMap_C_3）
- [ ] CM-ZSB 健康检查 URL 已配置（checkUrl）
- [ ] 像素流送已启动（Cirrus :8888）
- [ ] dashboard.html 中的脚本已引入（flight-path-manager.js, station-light-mapping.js）
- [ ] dashboard-manager.js 中已集成路径规划和灯光映射
- [ ] 仪表板可以访问（http://10.30.2.11:8080）

---

## 🐛 常见问题排查

### Q1: 灯光控制无响应
**检查项**：
1. UE 应用是否正在运行？
2. Remote Control API 地址是否正确？
3. 灯光对象路径是否正确？
4. 浏览器控制台是否有错误信息？

**解决方案**：
```bash
# 测试连接
curl -v http://10.30.2.11:30010/remote/object/call

# 查看 UE 日志
tail -f ~/ue5.log
```

### Q2: 路径规划无法开始
**检查项**：
1. `apiManager` 是否已初始化？
2. 路径是否已保存（"保存路径"按钮）？
3. 浏览器控制台日志？

**调试方法**：
```javascript
// 在浏览器控制台输入
window.flightPathManager.currentPath  // 查看当前路径
window.apiManager.setDroneLocation(100, 100, 150)  // 手动测试
```

### Q3: CM-ZSB 检测失败
**检查项**：
1. 健康检查 URL 是否正确且可访问？
2. CM-ZSB 节点是否已启动？
3. 网络连接是否正常？

**临时解决方案**：
```javascript
// 在浏览器控制台强制设置状态（仅用于测试）
window.stationLightMappingManager.forceSetStatus('node-1', 'ready');
```

### Q4: 像素流送无法连接
**检查项**：
1. Cirrus 服务器是否已启动？
2. 端口 :8888 是否开放？
3. 防火墙设置？

**测试方法**：
```bash
# 检查服务是否运行
ps aux | grep signallingserver
ps aux | grep cirrus

# 测试端口
nc -zv 10.30.2.11 8888
```

---

## 📚 相关文档

- **UE Remote Control API 官方文档**：
  https://dev.epicgames.com/documentation/zh-cn/unreal-engine/remote-control-api-http-reference-for-unreal-engine

- **像素流送文档**：
  https://dev.epicgames.com/documentation/zh-cn/unreal-engine/pixel-streaming-infrastructure

- **FlightPathManager 类文档**：
  查看 `js/flight-path-manager.js` 中的详细注释

- **StationLightMappingManager 类文档**：
  查看 `js/station-light-mapping.js` 中的详细注释

---

## 🎓 使用示例

### 例子 1: 执行校园巡逻任务

```javascript
// 在浏览器控制台执行
const pathManager = window.flightPathManager;

const patrolPath = {
  type: 'sequential',
  waypoints: [
    { x: 0, y: 0, z: 100 },        // 起点
    { x: 500, y: 400, z: 120 },    // 宿舍区
    { x: -850, y: -30, z: 62 },    // 图书馆
    { x: -200, y: 300, z: 75 },    // 食堂
    { x: 0, y: 0, z: 100 }         // 返回起点
  ],
  speed: 'normal'
};

pathManager.setPath(patrolPath);
await pathManager.startFlight();
```

### 例子 2: 监控特定节点

```javascript
const mapper = window.stationLightMappingManager;

// 立即检测节点-1
const status = await mapper.checkSingleNodeStatus('node-1');
console.log('节点状态:', mapper.getNodeStatusDescription('node-1'));

// 更新对应灯光
await mapper.updateSingleLight('node-1');
```

### 例子 3: 自定义灯光规则

```javascript
const mapper = window.stationLightMappingManager;

// 添加自定义规则：高 CPU 使用率时闪烁黄灯
mapper.addStatusColorMapping('high_load', 2);

// 强制设置节点状态
mapper.forceSetStatus('node-1', 'high_load');
```

---

## ✅ 实现状态总结

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| 无人机路径规划 | ✅ 完成 | 支持单点、多点、高级飞行 |
| 灯光映射管理 | ✅ 完成 | 自动检测节点并改变灯光 |
| UE API 集成 | ✅ 完成 | 配置已更新到关卡蓝图路径 |
| 像素流送 | ⏳ 准备中 | 需配置 Cirrus 服务器地址 |
| 端到端测试 | ⏳ 待执行 | 需要完整的测试流程 |

---

## 📞 支持

如有问题，请查看：
1. 浏览器开发者工具（F12 → Console）
2. dashboard-manager.js 的 `logToConsole()` 输出
3. UE 应用的控制台日志
4. 相关文档中的故障排查部分

---

最后更新时间：2024年12月4日
