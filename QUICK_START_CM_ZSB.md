# 快速开始: CM-ZSB集成

本指南提供3条命令快速部署CM-ZSB状态指示灯功能。

## 前提条件

- Ray集群运行中 (10.30.2.11:6379)
- SSH访问所有节点
- CM-ZSB项目在 `/data/home/sim6g/rayCode/CM-ZSB`

## 快速部署 (3步)

### 步骤1: 安装依赖并重启后端

```bash
cd /data/home/sim6g/rayCode/droneOnCampus
pip3 install aiohttp
pkill -f "uvicorn.*castray" && python3 -m uvicorn services.castray.main:app --host 0.0.0.0 --port 8000 --reload &
```

### 步骤2: 部署CM-ZSB到所有节点

```bash
cd /data/home/sim6g/rayCode/droneOnCampus/scripts
./deploy_cm_zsb_monitor.sh --auto-yes  # Head节点
# 然后批量部署worker节点 (可选脚本见DEPLOYMENT_STEPS.md)
```

### 步骤3: 测试集成

```bash
python3 test_cm_zsb_integration.py
# 打开浏览器: http://10.30.2.11:8080/droneOnCampus/dashboard.html
```

## 验证部署

检查一切正常:

```bash
# 1. CastRay响应
curl -s http://10.30.2.11:8000/api/ray-dashboard | jq '.data.nodes[0].workStatus'
# 预期: "idle"

# 2. CM-ZSB服务
curl -s http://10.30.2.11:8000/api/health
# 预期: {"status":"healthy","service":"CM-ZSB Monitor"}

# 3. 前端状态灯
# 打开浏览器,每个节点卡片底部应显示3个状态灯
```

## 状态说明

| 灯颜色 | 状态 | 含义 |
|--------|------|------|
| 🟢 绿灯 | idle | 空闲,无任务运行 |
| 🔵 蓝灯 | detecting | 本地AI推理中 |
| 🔴 红灯 | sending | 发送服务端检测 |

## 测试状态切换

手动触发状态变化:

```bash
# 切换到检测中
curl -X POST http://10.30.2.11:8000/api/update_status \
  -H "Content-Type: application/json" \
  -d '{"status": "detecting", "message": "Testing"}'

# 等待3秒,刷新浏览器观察蓝灯亮起

# 切换到服务端
curl -X POST http://10.30.2.11:8000/api/update_status \
  -H "Content-Type: application/json" \
  -d '{"status": "sending", "message": "Testing"}'

# 恢复空闲
curl -X POST http://10.30.2.11:8000/api/update_status \
  -H "Content-Type: application/json" \
  -d '{"status": "idle", "message": "Testing"}'
```

## 故障排查

### 问题: 前端不显示状态灯

**解决**: 清除浏览器缓存 (Ctrl+Shift+R)

### 问题: 状态始终为idle

**检查**: CM-ZSB服务是否运行
```bash
systemctl status cm-zsb-monitor
curl http://10.30.2.11:8000/api/status
```

### 问题: aiohttp导入错误

**解决**: 
```bash
pip3 install aiohttp
# 或在conda环境中
conda activate <env> && pip install aiohttp
```

## 文档索引

- 完整部署步骤: `doc/DEPLOYMENT_STEPS.md`
- 集成架构设计: `doc/CM-ZSB_INTEGRATION_GUIDE.md`
- 部署脚本: `scripts/deploy_cm_zsb_monitor.sh`
- 测试脚本: `scripts/test_cm_zsb_integration.py`

## 下一步

- [ ] 部署到所有worker节点
- [ ] 运行真实AI推理任务测试
- [ ] 配置systemd自动启动
- [ ] 监控日志和性能

---

**需要帮助?** 查看完整文档 `doc/DEPLOYMENT_STEPS.md` 第六步"故障排查"
