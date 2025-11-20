# CM-ZSB 与 droneOnCampus Ray集群集成方案

## 概述

本文档描述如何将CM-ZSB边缘节点监控系统集成到droneOnCampus的Ray集群管理界面中,实现实时显示每个节点的工作状态(空闲/检测中/服务端检测中)。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    droneOnCampus Dashboard                  │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │        Ray Cluster Manager (前端)                   │   │
│  │  - 显示节点资源使用情况                              │   │
│  │  - 显示节点工作状态指示灯 (新增)                     │   │
│  │    ● 绿灯: 空闲                                      │   │
│  │    ● 蓝灯: 本地检测中                                │   │
│  │    ● 红灯: 服务端检测中                              │   │
│  └────────────────────────────────────────────────────┘   │
│                          ↓ WebSocket/HTTP                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │       CastRay Service (后端 main.py)                │   │
│  │  - 聚合Ray状态                                       │   │
│  │  - 查询CM-ZSB监控状态 (新增)                        │   │
│  │  - 合并数据返回前端                                  │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTP GET
┌─────────────────────────────────────────────────────────────┐
│                    CM-ZSB 监控服务                          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │    monitoring_service.py (端口 8000)                │   │
│  │  - GET /api/status 返回当前节点状态                  │   │
│  │    {status: "idle"|"detecting"|"sending"}           │   │
│  │  - GET /api/nodes/{node_ip}/status                  │   │
│  └────────────────────────────────────────────────────┘   │
│                          ↑                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │    predict_and_send.py (推理脚本)                   │   │
│  │  - 通过 status_reporter 上报状态                    │   │
│  │  - POST /api/update_status                          │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 实施步骤

### 步骤1: 扩展CM-ZSB监控服务API

在每个Ray节点上部署CM-ZSB监控服务,并添加节点状态查询API。

**文件**: `CM-ZSB/experiment/scripts/monitoring_service.py`

添加新端点:

```python
@app.get("/api/nodes/{node_identifier}/status")
async def get_node_status(node_identifier: str):
    """
    获取特定节点的工作状态
    
    参数:
        node_identifier: 节点标识符(IP或节点名称)
    
    返回:
        {
            "node_id": "M3",
            "status": "idle",  # idle, detecting, sending
            "timestamp": "2025-11-20T10:30:00",
            "details": {...}
        }
    """
    current_state = state_manager.get_current_state()
    return {
        "node_id": node_identifier,
        "status": current_state["status"],
        "timestamp": current_state["timestamp"],
        "details": current_state.get("latest_state")
    }

@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "service": "CM-ZSB监控"}
```

### 步骤2: 修改CastRay后端服务

在droneOnCampus的后端添加查询CM-ZSB状态的功能。

**文件**: `droneOnCampus/services/castray/main.py`

```python
import asyncio
import aiohttp

# 配置CM-ZSB监控服务端口
CM_ZSB_MONITOR_PORT = 8000

async def _get_node_work_status(node_ip: str) -> str:
    """
    从CM-ZSB监控服务获取节点工作状态
    
    Args:
        node_ip: 节点IP地址
    
    Returns:
        工作状态: 'idle', 'detecting', 'sending', 'unknown'
    """
    try:
        url = f"http://{node_ip}:{CM_ZSB_MONITOR_PORT}/api/status"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=1)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get('status', 'idle')
    except Exception as e:
        logger.debug(f"无法获取节点 {node_ip} 的CM-ZSB状态: {e}")
    return 'idle'  # 默认为空闲

async def _batch_get_work_statuses(node_ips: list) -> dict:
    """
    批量获取多个节点的工作状态
    
    Args:
        node_ips: 节点IP列表
    
    Returns:
        {ip: status} 字典
    """
    tasks = [_get_node_work_status(ip) for ip in node_ips]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    status_map = {}
    for ip, result in zip(node_ips, results):
        if isinstance(result, str):
            status_map[ip] = result
        else:
            status_map[ip] = 'idle'
    
    return status_map
```

修改 `_parse_ray_nodes_to_frontend_format` 函数:

```python
def _parse_ray_nodes_to_frontend_format(ray_nodes: list, cluster_resources: dict, 
                                        available_resources: dict, 
                                        usage_map: dict = None,
                                        work_status_map: dict = None):
    parsed_nodes = []
    usage_map = usage_map or {}
    work_status_map = work_status_map or {}
    
    for node in ray_nodes:
        # ...existing code...
        node_ip = node.get('node_ip', '')
        
        parsed_node = {
            # ...existing fields...
            "workStatus": work_status_map.get(node_ip, 'idle'),
            "workStatusTimestamp": datetime.now().isoformat(),
        }
        parsed_nodes.append(parsed_node)
    
    return parsed_nodes
```

修改 `/api/ray-dashboard` 端点:

```python
@app.get("/api/ray-dashboard")
async def get_ray_dashboard_data(dashboard_url: Optional[str] = None):
    """返回前端期望的Ray Dashboard数据格式"""
    try:
        dash = dashboard_url or os.environ.get('RAY_DASHBOARD_URL', 'http://10.30.2.11:8265')
        
        # 获取Ray节点和资源
        # ...existing code to get ray_nodes, cluster_resources, available_resources...
        
        # 获取节点使用率
        usage_map = _get_real_node_usage(dash)
        
        # 批量获取CM-ZSB工作状态
        node_ips = [node.get('node_ip') for node in ray_nodes if node.get('node_ip')]
        work_status_map = await _batch_get_work_statuses(node_ips)
        
        # 解析节点
        frontend_nodes = _parse_ray_nodes_to_frontend_format(
            ray_nodes, cluster_resources, available_resources, 
            usage_map, work_status_map
        )
        
        return {"data": {"nodes": frontend_nodes, "summary": summary_data}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 步骤3: 前端已完成

前端代码已在本次修改中完成:
- ✅ 节点卡片添加状态指示灯UI
- ✅ CSS样式和动画效果
- ✅ 状态更新逻辑 `updateWorkStatus()`

### 步骤4: 部署CM-ZSB监控服务

在每个Ray节点上部署CM-ZSB:

```bash
# 在每个Ray节点上执行
cd /data/home/sim6g/rayCode/CM-ZSB/experiment/scripts

# 启动监控服务
./start_monitoring.sh

# 验证服务
curl http://localhost:8000/api/health
curl http://localhost:8000/api/status
```

### 步骤5: 配置systemd服务(可选)

为CM-ZSB监控创建systemd服务,实现自动启动:

**文件**: `/etc/systemd/system/cm-zsb-monitor.service`

```ini
[Unit]
Description=CM-ZSB Edge Node Monitoring Service
After=network.target

[Service]
Type=simple
User=sim6g
WorkingDirectory=/data/home/sim6g/rayCode/CM-ZSB/experiment/scripts
ExecStart=/usr/bin/python3 /data/home/sim6g/rayCode/CM-ZSB/experiment/scripts/monitoring_service.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

启用服务:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cm-zsb-monitor
sudo systemctl start cm-zsb-monitor
sudo systemctl status cm-zsb-monitor
```

### 步骤6: 配置防火墙

确保8000端口可以被droneOnCampus服务访问:

```bash
# 如果使用firewalld
sudo firewall-cmd --add-port=8000/tcp --permanent
sudo firewall-cmd --reload

# 如果使用ufw
sudo ufw allow 8000/tcp
```

## 数据流示例

### 场景1: 节点空闲状态

```
1. predict_and_send.py 未运行或等待数据
   └─> 无状态上报

2. CM-ZSB monitoring_service 
   └─> 默认状态: idle

3. CastRay 查询 http://node_ip:8000/api/status
   └─> 返回: {"status": "idle"}

4. 前端显示: 绿灯亮起
```

### 场景2: 本地检测中

```
1. predict_and_send.py 检测到新数据
   └─> POST /api/update_status {"status": "detecting"}

2. CM-ZSB monitoring_service
   └─> 更新状态为 detecting

3. CastRay 查询获取最新状态
   └─> 返回: {"status": "detecting"}

4. 前端显示: 蓝灯亮起,并带有脉冲动画
```

### 场景3: 发送服务端检测

```
1. predict_and_send.py 发现低置信度
   └─> POST /api/update_status {"status": "sending"}
   └─> 发送数据到服务器

2. CM-ZSB monitoring_service
   └─> 更新状态为 sending
   └─> 添加告警记录

3. CastRay 查询获取最新状态
   └─> 返回: {"status": "sending"}

4. 前端显示: 红灯亮起,快速脉冲动画
```

## API参考

### CM-ZSB监控服务API

#### GET /api/status
返回当前节点状态

**响应**:
```json
{
  "status": "idle",
  "timestamp": "2025-11-20T10:30:00",
  "latest_state": {
    "status": "idle",
    "timestamp": "2025-11-20T10:30:00",
    "current_task": "等待数据输入"
  },
  "stats": {
    "total_processed": 1234,
    "low_confidence_count": 56,
    "sent_to_server": 12
  }
}
```

#### GET /api/health
健康检查

**响应**:
```json
{
  "status": "healthy",
  "service": "CM-ZSB监控"
}
```

### droneOnCampus CastRay API

#### GET /api/ray-dashboard
返回Ray集群节点数据(包含工作状态)

**响应**:
```json
{
  "data": {
    "nodes": [
      {
        "name": "M3",
        "nodeIp": "10.30.2.11",
        "cpu": 0.7,
        "memory": 95.4,
        "workStatus": "detecting",
        "workStatusTimestamp": "2025-11-20T10:30:00"
      }
    ],
    "summary": {...}
  }
}
```

## 故障排查

### 问题1: 状态指示灯不亮

**检查**:
```bash
# 1. 确认CM-ZSB监控服务运行
curl http://node_ip:8000/api/health

# 2. 检查CastRay日志
tail -f /tmp/castray.log | grep "CM-ZSB"

# 3. 检查浏览器控制台
# 打开 F12 -> Console,查看错误信息
```

### 问题2: 状态更新延迟

CM-ZSB状态更新是实时的,但droneOnCampus通过WebSocket每3秒推送一次。

**优化方案**:
- 减少WebSocket推送间隔(在`broadcast_cluster_update`函数中)
- 或者让前端使用轮询更频繁地查询

### 问题3: 部分节点状态获取失败

这是正常现象。CastRay会自动处理超时和错误,失败的节点默认显示为`idle`状态。

## 性能考虑

1. **并发查询**: 使用`asyncio.gather`并发查询多个节点,超时时间设为1秒
2. **缓存策略**: 可以考虑在CastRay中缓存CM-ZSB状态30秒,减少HTTP请求
3. **降级策略**: 如果CM-ZSB服务不可用,不影响Ray集群监控的其他功能

## 扩展功能

### 1. 添加历史状态图表

可以在前端添加节点状态历史图表,显示节点在过去1小时内的工作状态变化。

### 2. 告警通知

集成CM-ZSB的告警系统,当节点频繁发送到服务端时发送通知。

### 3. 性能统计

展示每个节点的推理性能统计:
- 平均推理时间
- 低置信度比例
- 服务端请求频率

## 总结

本集成方案实现了CM-ZSB边缘推理状态与droneOnCampus Ray集群监控的无缝集成,为管理员提供了统一的可视化界面,可以同时监控:
- 节点资源使用情况(CPU/内存/GPU)
- 节点工作状态(空闲/检测/服务端)
- 节点连接状态和任务执行情况

通过红绿蓝三色指示灯,管理员可以一目了然地了解整个集群的推理工作负载分布。
