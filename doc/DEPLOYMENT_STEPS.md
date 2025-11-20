# CM-ZSB集成部署步骤

## 概述

本文档提供将CM-ZSB监控服务集成到droneOnCampus Ray集群监控系统的详细部署步骤。

## 前置条件

- Ray集群已部署并运行（当前配置: 10.30.2.11:6379）
- CM-ZSB项目位于 `/data/home/sim6g/rayCode/CM-ZSB`
- 拥有所有Ray节点的SSH访问权限
- Python 3.7+ 已安装在所有节点

## 部署架构

```
┌─────────────────┐
│  Ray Head Node  │
│  10.30.2.11     │
│  ┌───────────┐  │      ┌──────────────────┐
│  │ CastRay   │  │◄─────┤  浏览器客户端      │
│  │ :8000     │  │      │  dashboard.html  │
│  └─────┬─────┘  │      └──────────────────┘
│        │        │
│  ┌─────▼─────┐  │
│  │ CM-ZSB    │  │
│  │ :8000     │  │
│  └───────────┘  │
└─────────────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼──┐   ┌──▼───┐
│Worker│   │Worker│  (22 worker nodes)
│Node 1│   │Node N│
│      │   │      │
│┌────┐│   │┌────┐│
││CM- ││   ││CM- ││
││ZSB ││   ││ZSB ││
│└────┘│   │└────┘│
└──────┘   └──────┘
```

## 第一步: 安装aiohttp依赖

在CastRay服务器上安装异步HTTP客户端库:

```bash
# 进入droneOnCampus目录
cd /data/home/sim6g/rayCode/droneOnCampus/services/castray

# 安装aiohttp
pip3 install aiohttp

# 验证安装
python3 -c "import aiohttp; print(f'aiohttp {aiohttp.__version__} installed')"
```

## 第二步: 重启CastRay服务

重启后端服务以加载新的CM-ZSB集成代码:

```bash
# 停止现有服务
pkill -f "uvicorn.*castray"

# 启动服务
cd /data/home/sim6g/rayCode/droneOnCampus
python3 -m uvicorn services.castray.main:app --host 0.0.0.0 --port 8000 --reload
```

或使用系统服务管理:

```bash
sudo systemctl restart castray
# 或
./start_server.bat  # 如果使用的是批处理脚本
```

验证CastRay正常运行:

```bash
curl http://10.30.2.11:8000/api/ray-dashboard | jq '.data.nodes[0].workStatus'
# 应返回: "idle" (默认状态)
```

## 第三步: 部署CM-ZSB监控服务

### 3.1 准备部署脚本

部署脚本已创建: `scripts/deploy_cm_zsb_monitor.sh`

```bash
cd /data/home/sim6g/rayCode/droneOnCampus/scripts
chmod +x deploy_cm_zsb_monitor.sh
```

### 3.2 在Head节点部署

首先在head节点测试部署:

```bash
# 在10.30.2.11上执行
./deploy_cm_zsb_monitor.sh

# 按提示操作:
# 1. 确认安装路径: /data/home/sim6g/rayCode/CM-ZSB/experiment/scripts
# 2. 选择创建systemd服务 (y/n)
# 3. 选择立即启动服务 (y/n)
```

验证部署:

```bash
# 检查服务状态
systemctl status cm-zsb-monitor

# 测试API端点
curl http://10.30.2.11:8000/api/health
# 预期: {"status":"healthy","service":"CM-ZSB Monitor"}

curl http://10.30.2.11:8000/api/status
# 预期: {"status":"idle","timestamp":"..."}
```

### 3.3 批量部署到Worker节点

创建批量部署脚本:

```bash
cat > /data/home/sim6g/rayCode/droneOnCampus/scripts/deploy_to_all_nodes.sh << 'EOF'
#!/bin/bash
# 批量部署CM-ZSB监控服务到所有Ray节点

# 获取所有Ray节点IP
NODES=$(ray status | grep -oP '\d+\.\d+\.\d+\.\d+' | sort -u)

echo "发现以下节点:"
echo "$NODES"
echo ""

for NODE in $NODES; do
    echo "========================================"
    echo "部署到节点: $NODE"
    echo "========================================"
    
    # 复制部署脚本到节点
    scp deploy_cm_zsb_monitor.sh $NODE:/tmp/
    
    # 在节点上执行部署
    ssh $NODE "cd /tmp && chmod +x deploy_cm_zsb_monitor.sh && ./deploy_cm_zsb_monitor.sh --auto-yes"
    
    if [ $? -eq 0 ]; then
        echo "✓ 节点 $NODE 部署成功"
    else
        echo "✗ 节点 $NODE 部署失败"
    fi
    
    echo ""
done

echo "========================================"
echo "部署完成! 验证所有节点..."
echo "========================================"

for NODE in $NODES; do
    STATUS=$(curl -s -m 2 http://$NODE:8000/api/health 2>/dev/null | jq -r '.status' 2>/dev/null)
    if [ "$STATUS" = "healthy" ]; then
        echo "✓ $NODE - 运行正常"
    else
        echo "✗ $NODE - 服务未响应"
    fi
done
EOF

chmod +x deploy_to_all_nodes.sh
```

执行批量部署:

```bash
./deploy_to_all_nodes.sh
```

## 第四步: 测试集成

### 4.1 运行集成测试脚本

```bash
cd /data/home/sim6g/rayCode/droneOnCampus/scripts
python3 test_cm_zsb_integration.py
```

测试脚本会:
1. 检查CM-ZSB服务健康状态
2. 验证CastRay能正确获取并展示工作状态
3. 可选: 模拟状态切换并验证前端同步

### 4.2 手动测试状态切换

在任一节点上运行CM-ZSB预测脚本:

```bash
# SSH到某个worker节点
ssh <worker-node-ip>

# 启动AI推理任务
cd /data/home/sim6g/rayCode/CM-ZSB/experiment/scripts
python3 predict_and_send.py --model-path <model-path> --data-path <data-path>
```

观察状态变化:
- **检测中 (detecting)**: 蓝灯亮起 - 本地AI推理运行中
- **服务端检测 (sending)**: 红灯亮起 - 置信度低,发送到服务器
- **空闲 (idle)**: 绿灯亮起 - 任务完成或无任务

### 4.3 前端验证

打开浏览器访问:
```
http://10.30.2.11:8080/droneOnCampus/dashboard.html
```

检查:
- ✅ Ray节点卡片显示3个状态指示灯
- ✅ 每个节点卡片底部有 "空闲/检测中/服务端" 标签
- ✅ 运行推理任务时对应灯会亮起并脉动
- ✅ WebSocket每3秒更新一次状态

## 第五步: 监控与维护

### 5.1 查看CM-ZSB服务日志

```bash
# 查看systemd服务日志
journalctl -u cm-zsb-monitor -f

# 或查看直接输出
tail -f /var/log/cm-zsb-monitor.log  # 如果配置了日志文件
```

### 5.2 查看CastRay日志

```bash
# 查看uvicorn输出
cd /data/home/sim6g/rayCode/droneOnCampus
tail -f logs/castray.log
```

### 5.3 性能监控

CM-ZSB状态查询使用异步HTTP,超时时间为1秒:

```python
# 在main.py中的配置
work_status_map = await _batch_get_work_statuses(
    node_ips, 
    cm_zsb_port=8000, 
    timeout=1.0  # 1秒超时
)
```

对于23个节点,并行查询总耗时约1-2秒。如需优化:

```python
# 增加超时时间
timeout=2.0  # 延长到2秒

# 或减少查询频率
await asyncio.sleep(5)  # broadcast间隔改为5秒
```

## 第六步: 故障排查

### 问题1: CM-ZSB服务端口冲突

**症状**: 服务启动失败,提示端口8000被占用

**解决**:
```bash
# 检查端口占用
lsof -i :8000
netstat -tulpn | grep :8000

# 修改CM-ZSB端口 (在monitoring_service_extended.py)
uvicorn.run(app, host="0.0.0.0", port=8001)  # 改为8001

# 同步修改CastRay调用
# 在main.py中: cm_zsb_port=8001
```

### 问题2: aiohttp导入失败

**症状**: CastRay启动报错 `ModuleNotFoundError: No module named 'aiohttp'`

**解决**:
```bash
pip3 install aiohttp

# 如果使用conda环境
conda activate <env-name>
pip install aiohttp
```

### 问题3: 状态未更新

**症状**: 前端指示灯不变化,始终显示绿灯(idle)

**检查步骤**:
```bash
# 1. 验证CM-ZSB服务响应
curl http://<node-ip>:8000/api/status

# 2. 检查CastRay日志
# 应该看到类似: "CM-ZSB status timeout for 10.30.2.x"

# 3. 手动触发状态更新
curl -X POST http://<node-ip>:8000/api/update_status \
  -H "Content-Type: application/json" \
  -d '{"status": "detecting", "message": "test"}'

# 4. 刷新浏览器,检查对应节点是否变蓝灯
```

### 问题4: WebSocket断开

**症状**: 浏览器控制台显示 "WebSocket disconnected"

**解决**:
```bash
# 1. 检查CastRay服务运行
curl http://10.30.2.11:8000/api/ray-dashboard

# 2. 检查防火墙
sudo ufw status
sudo ufw allow 8000/tcp

# 3. 重启CastRay服务
sudo systemctl restart castray
```

### 问题5: 前端指示灯不显示

**症状**: 节点卡片缺少状态指示灯

**检查步骤**:
```bash
# 1. 清除浏览器缓存 (Ctrl+Shift+R)

# 2. 检查文件是否更新
ls -lh /data/home/sim6g/rayCode/droneOnCampus/ray-cluster-manager.js
ls -lh /data/home/sim6g/rayCode/droneOnCampus/dashboard-styles.css

# 3. 查看浏览器控制台是否有JS错误

# 4. 检查API响应包含workStatus字段
curl -s http://10.30.2.11:8000/api/ray-dashboard | jq '.data.nodes[0] | {nodeIp, workStatus}'
```

## 第七步: 扩展与定制

### 自定义状态类型

在CM-ZSB中添加新状态:

```python
# monitoring_service_extended.py
VALID_STATUSES = ['idle', 'detecting', 'sending', 'training', 'error']
```

前端添加对应样式:

```css
/* dashboard-styles.css */
.status-light.training.active {
    background-color: #f59e0b;  /* 橙色 */
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);
    animation: pulse-orange 1.2s ease-in-out infinite;
}
```

### 添加状态历史记录

修改`_get_node_work_status()`:

```python
async def _get_node_work_status(node_ip: str, ...):
    # ... 现有代码 ...
    
    # 获取历史记录
    history_url = f"http://{node_ip}:{cm_zsb_port}/api/alerts"
    async with session.get(history_url, timeout=...) as resp:
        if resp.status == 200:
            alerts = await resp.json()
            return {
                'status': current_status,
                'timestamp': current_timestamp,
                'history': alerts.get('alerts', [])[:5]  # 最近5条
            }
```

### 添加状态统计

在前端显示状态分布:

```javascript
// ray-cluster-manager.js
updateStatusSummary(nodes) {
    const statusCount = {idle: 0, detecting: 0, sending: 0};
    nodes.forEach(node => {
        statusCount[node.workStatus] = (statusCount[node.workStatus] || 0) + 1;
    });
    
    document.getElementById('status-summary').innerHTML = `
        <div class="status-stats">
            <span class="idle">空闲: ${statusCount.idle}</span>
            <span class="detecting">检测: ${statusCount.detecting}</span>
            <span class="sending">服务端: ${statusCount.sending}</span>
        </div>
    `;
}
```

## 附录A: 完整架构图

```
浏览器 (dashboard.html)
    │
    ├─── HTTP GET /api/ray-dashboard (初始加载)
    │
    └─── WebSocket ws://10.30.2.11:8000/ws (实时更新)
         │
         ▼
CastRay Backend (main.py :8000)
    │
    ├─── Ray Dashboard API (10.30.2.11:8265)
    │    └─── GET /api/v0/nodes (Ray节点信息)
    │
    ├─── Ray Python API
    │    ├─── ray.cluster_resources()
    │    └─── ray.available_resources()
    │
    └─── CM-ZSB API (每个节点:8000)
         └─── GET /api/status (工作状态)
              │
              ▼
         CM-ZSB Monitor (monitoring_service_extended.py)
              │
              └─── StateManager
                   ├─── idle
                   ├─── detecting
                   └─── sending
```

## 附录B: API端点清单

### CastRay API

| 端点 | 方法 | 描述 | 返回 |
|------|------|------|------|
| `/api/ray-dashboard` | GET | 获取Ray集群完整状态 | 包含nodes(含workStatus)和summary |
| `/ws` | WebSocket | 实时推送集群更新 | 每3秒广播cluster_status消息 |

### CM-ZSB API

| 端点 | 方法 | 描述 | 返回 |
|------|------|------|------|
| `/api/health` | GET | 健康检查 | `{"status":"healthy"}` |
| `/api/status` | GET | 获取当前工作状态 | `{"status":"idle","timestamp":"..."}` |
| `/api/update_status` | POST | 更新工作状态 | `{"success":true}` |
| `/api/alerts` | GET | 获取告警历史 | `{"alerts":[...]}` |
| `/api/errors` | GET | 获取错误日志 | `{"errors":[...]}` |

## 附录C: 配置文件参考

### systemd服务文件

```ini
# /etc/systemd/system/cm-zsb-monitor.service
[Unit]
Description=CM-ZSB Monitoring Service
After=network.target

[Service]
Type=simple
User=sim6g
WorkingDirectory=/data/home/sim6g/rayCode/CM-ZSB/experiment/scripts
ExecStart=/usr/bin/python3 monitoring_service_extended.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 环境变量配置

```bash
# ~/.bashrc or /etc/environment
export RAY_DASHBOARD=http://10.30.2.11:8265
export RAY_ADDRESS=10.30.2.11:6379
export CM_ZSB_PORT=8000
export CASTRAY_PORT=8000
```

---

## 部署检查清单

部署完成后,请确认以下所有项目:

- [ ] aiohttp已安装在CastRay服务器
- [ ] CastRay服务已重启并正常运行
- [ ] CM-ZSB监控服务已部署到所有23个节点
- [ ] 所有节点的CM-ZSB服务响应 `/api/health`
- [ ] 测试脚本 `test_cm_zsb_integration.py` 运行通过
- [ ] 前端dashboard显示状态指示灯
- [ ] 手动触发状态变化可在前端看到对应灯亮起
- [ ] WebSocket连接正常,状态每3秒更新
- [ ] 浏览器控制台无错误信息
- [ ] systemd服务设置为开机自启动

完成以上检查后,CM-ZSB集成部署完毕! 🎉
