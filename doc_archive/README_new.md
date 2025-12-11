# 5G Campus Network Control - Multi-Scenario

多场景 5G 校园网络控制系统，支持无人机配送和自动驾驶汽车场景。

## 🚀 新增功能

### 场景二：自动驾驶汽车 MEC 智能切换

基于 LLM Agent 的智能决策系统，实现车辆在城市中行驶时的自动 MEC 服务器切换。

#### 核心特性

- **智能 Agent 决策**: 基于 LLM 推理的 MEC 切换决策
- **实时位置追踪**: 车辆位置实时更新和可视化
- **网络配置自动化**: 自动更新 SMF 配置和 UPF 路由
- **延迟优化**: 实时测量和优化网络延迟
- **可视化界面**: 动态显示车辆轨迹和 MEC 连接状态

#### 实现流程

1. **UE 引擎**: 汽车沿预设路线行驶，每秒发送位置坐标
2. **Python Agent**: 接收位置数据，使用 LLM 进行智能决策分析
3. **决策推理**: "汽车当前位于西部区域，距离西区 MEC 最近，建议切换"
4. **网络重配**: 自动生成新的 smf.yaml 并重启 SMF 服务
5. **性能验证**: 测量新连接的延迟，确认切换效果
6. **反馈更新**: 更新 UI 显示当前连接状态和延迟信息

## 🏗️ 系统架构

```
Frontend (JavaScript)     Backend (Python)        UE Engine
┌─────────────────┐      ┌──────────────────┐     ┌─────────────┐
│ 场景切换控制    │      │ Agent决策引擎    │     │ 车辆/无人机 │
│ 车辆状态显示    │ ←→   │ MEC切换逻辑      │ ←→  │ 位置更新    │
│ MEC服务器监控   │      │ 网络配置管理     │     │ 视角切换    │
│ 实时延迟显示    │      │ 延迟测量服务     │     │ 状态反馈    │
└─────────────────┘      └──────────────────┘     └─────────────┘
```

## 📋 场景说明

### 场景一：无人机配送（原有功能）

- 校园内无人机自动配送
- 预设地点间的路径规划
- 实时视频流传输
- 网络质量监控

### 场景二：自动驾驶汽车 MEC 切换（新增）

- 城市道路自动驾驶
- 三个 MEC 服务器（东、西、北区）
- 基于位置的智能 MEC 切换
- 实时延迟优化

## 🛠️ 安装和运行

### 环境要求

- Python 3.7+
- 现代 Web 浏览器
- UE5 引擎（用于可视化）

### 快速启动

#### Windows

```cmd
# 双击运行启动脚本
start_system.bat

# 或手动启动
python vehicle_mec_agent.py
python -m http.server 8080
```

#### Linux/macOS

```bash
# 使用启动脚本
chmod +x start_system.sh
./start_system.sh

# 或手动启动
python3 vehicle_mec_agent.py &
python3 -m http.server 8080
```

### 访问系统

- 前端界面: http://localhost:8080
- Agent API: http://localhost:5000

## 📊 API 接口

### Agent 决策

```http
POST /api/agent/decision
Content-Type: application/json

{
  "vehicle_position": {"x": 100, "y": 200},
  "current_mec": "east"
}
```

### 网络配置更新

```http
POST /api/network/config
Content-Type: application/json

{
  "action": "update_smf",
  "target_upf": "upf-west",
  "ue_id": "vehicle-001"
}
```

### 延迟测量

```http
POST /api/network/latency
Content-Type: application/json

{
  "target_ips": ["192.168.1.10", "192.168.1.20", "192.168.1.30"]
}
```

## 🎮 使用说明

### 场景切换

1. 点击顶部的"无人机配送"或"自动驾驶车"按钮
2. 系统自动切换 UI 和功能模块

### 车辆控制

1. 选择"自动驾驶车"场景
2. 点击路线按钮开始车辆移动：
   - 城市环路：环形路线
   - 东西路线：东西向直线
   - 南北路线：南北向直线
3. 观察 MEC 切换过程和延迟变化

### MEC 状态监控

- 左上角显示三个 MEC 服务器状态
- 绿色指示器表示当前连接的 MEC
- 实时显示到各 MEC 的延迟

### Agent 决策日志

- 右下角显示 Agent 的决策过程
- 查看推理文本和决策结果
- 监控切换成功率和响应时间

## 🔧 配置说明

### MEC 服务器配置

```javascript
mecServers: {
  east: { ip: '192.168.1.10', position: { x: 1000, y: 0 } },
  west: { ip: '192.168.1.20', position: { x: -1000, y: 0 } },
  north: { ip: '192.168.1.30', position: { x: 0, y: 1000 } }
}
```

### 决策规则

```javascript
decisionRules: {
  mecSwitchThreshold: 300,        // 距离阈值
  latencyImprovementThreshold: 20, // 延迟改善阈值(ms)
  decisionCooldown: 10000         // 决策冷却时间(ms)
}
```

## 📁 文件结构

```
droneOnCampus/
├── index.html              # 主页面
├── styles.css              # 样式文件
├── app.js                  # 主应用逻辑
├── vehicle-manager.js      # 车辆场景管理
├── agent-manager.js        # Agent决策管理
├── vehicle_mec_agent.py    # Python后端服务
├── api-manager.js          # UE API接口
├── network-manager.js      # 网络管理
├── start_system.bat        # Windows启动脚本
├── start_system.sh         # Linux启动脚本
└── README.md              # 说明文档
```

## 🚀 技术特色

- **AI 驱动决策**: 使用 LLM 风格的推理进行 MEC 切换决策
- **实时可视化**: 动态显示车辆轨迹和网络连接状态
- **自动化配置**: 自动生成和部署网络配置文件
- **性能优化**: 实时延迟测量和网络优化
- **模块化设计**: 支持多场景切换和扩展

## 🔍 演示效果

1. **车辆移动**: 在 UE 中看到汽车沿城市道路行驶
2. **智能决策**: Agent 分析位置并生成切换决策
3. **可视化反馈**: 连接线动态指向当前 MEC，延迟实时更新
4. **性能提升**: 切换后延迟从 50ms 降至 10ms（示例）

## 📞 开发说明

### 主要组件

1. **场景管理器** (`vehicle-manager.js`)

   - 处理场景切换逻辑
   - 管理车辆移动和状态更新
   - 调用 Agent 决策和网络配置

2. **Agent 决策引擎** (`agent-manager.js`)

   - 实现 LLM 风格的推理界面
   - 记录和显示决策历史
   - 提供决策置信度和统计信息

3. **Python 后端** (`vehicle_mec_agent.py`)
   - 智能决策算法实现
   - 网络配置自动化
   - 延迟测量和性能监控

### 扩展指南

添加新的 MEC 服务器：

1. 在 `vehicle-manager.js` 中添加服务器配置
2. 在 `vehicle_mec_agent.py` 中更新服务器列表
3. 在 HTML 中添加对应的 UI 元素

添加新的路线：

1. 在 `routes` 对象中定义路径点
2. 在 HTML 中添加对应的按钮
3. 在 UE 中实现对应的移动逻辑

## 🤝 贡献

欢迎提交 Pull Request 和 Issue 来帮助改进项目。

---

如有问题或建议，请联系开发团队。
