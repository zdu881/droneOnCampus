# 系统演示配置

## 演示场景配置

### 1. 启动系统

```bash
# Windows
start_system.bat

# Linux/macOS
./start_system.sh
```

### 2. 验证服务状态

```bash
# 检查Python后端
curl http://localhost:5000/api/vehicle/status

# 检查前端
curl http://localhost:8080
```

### 3. 演示步骤

#### 步骤 1：切换到车辆场景

1. 打开 http://localhost:8080
2. 点击顶部"自动驾驶车"按钮
3. 观察 UI 变化：显示 MEC 服务器面板和车辆控制面板

#### 步骤 2：启动车辆移动

1. 点击"城市环路"按钮开始车辆移动
2. 观察车辆位置实时更新
3. 查看 Agent 决策日志的推理过程

#### 步骤 3：观察 MEC 切换

1. 车辆移动时，左上角 MEC 面板显示当前连接状态
2. 当车辆接近不同区域时，Agent 自动进行切换决策
3. 右下角显示详细的决策推理文本

#### 步骤 4：监控性能指标

1. 观察延迟数值的变化
2. 查看切换成功率统计
3. 监控 Agent 响应时间

### 4. 测试不同路线

- **东西路线**: 触发东区 ↔ 西区 MEC 切换
- **南北路线**: 触发北区 MEC 切换
- **城市环路**: 完整的多区域切换演示

### 5. 手动测试 API

#### 测试 Agent 决策

```bash
curl -X POST http://localhost:5000/api/agent/decision \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_position": {"x": -800, "y": 100},
    "current_mec": "east"
  }'
```

#### 测试网络配置

```bash
curl -X POST http://localhost:5000/api/network/config \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update_smf",
    "target_upf": "upf-west",
    "ue_id": "vehicle-001"
  }'
```

#### 测试延迟测量

```bash
curl -X POST http://localhost:5000/api/network/latency \
  -H "Content-Type: application/json" \
  -d '{
    "target_ips": ["192.168.1.10", "192.168.1.20", "192.168.1.30"]
  }'
```

## 预期演示效果

### 视觉效果

1. **场景切换**: 清晰的 UI 变化，从无人机界面切换到车辆界面
2. **实时更新**: 车辆位置、速度、方向的实时显示
3. **状态指示**: MEC 服务器连接状态的颜色变化
4. **动态数据**: 延迟数值随 MEC 切换实时变化

### 功能演示

1. **智能决策**: Agent 根据位置自动生成切换建议
2. **推理展示**: 类似 LLM 的自然语言推理过程
3. **自动化配置**: 后台自动更新网络配置
4. **性能优化**: 切换后延迟明显改善

### 数据示例

#### 决策推理文本示例

```
"根据车辆当前坐标 (-800, 100)，我分析得出车辆位于城市西区域。
当前连接的是东区MEC，距离为894单位。
而西区MEC距离仅为224单位，更加接近。
为了获得最低的访问延迟，建议将UE会话路由到upf-west。"
```

#### 延迟变化示例

- 切换前：东区 MEC 45.2ms
- 切换后：西区 MEC 12.1ms
- 改善：33.1ms (73%提升)

## 故障排除

### 常见问题

1. **后端无法启动**: 检查 Python 依赖安装
2. **API 调用失败**: 确认后端服务运行在 5000 端口
3. **前端无法访问**: 检查 8080 端口是否被占用
4. **MEC 切换不工作**: 确认自动切换开关已启用

### 调试方法

1. 查看浏览器开发者工具的控制台
2. 检查 Python 后端的日志输出
3. 使用 curl 命令单独测试 API 接口
4. 验证网络连接和防火墙设置
