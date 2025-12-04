# Ray 集群 - Jetson AGX Orin 接入完整解决方案

## 📋 概述

本文档提供了将三台 Jetson AGX Orin 机器接入现有 Ray 集群的完整解决方案，包括详细的步骤指南、自动化脚本和故障排查工具。

## 🎯 目标

将以下三台 Jetson AGX Orin 机器成功接入 Ray 集群：

| 节点 | IP | 规格 |
|-----|----|----|
| Jetson AGX Orin 1 | 10.12.133.251 | 12-core ARM, 32GB RAM |
| Jetson AGX Orin 2 | 10.7.182.160 | 12-core ARM, 32GB RAM |
| AGX Orin 64G | 10.7.126.62 | 12-core ARM, 64GB RAM |

现有主节点：`10.30.2.11:6379`

## 📚 文档结构

```
/data/home/sim6g/rayCode/droneOnCampus/
├── doc/
│   ├── RAY_CLUSTER_SETUP_GUIDE.md      # 完整部署指南
│   ├── RAY_CLUSTER_QUICK_REF.md        # 快速参考
│   └── RAY_CLUSTER_INTEGRATION.md      # 本文件 - 集成总结
├── scripts/
│   ├── setup_ray_cluster.sh            # Bash 自动化脚本
│   ├── ray_cluster_manager.py          # Python 管理脚本
│   └── ray_cluster_diagnose.py         # 诊断工具
└── config/
    └── system_config.json              # 系统配置
```

## 🚀 快速开始（5分钟）

### 方法 1: 自动化脚本（推荐）

```bash
# 进入脚本目录
cd /data/home/sim6g/rayCode/droneOnCampus/scripts

# 执行完整安装和启动
chmod +x setup_ray_cluster.sh
./setup_ray_cluster.sh full
```

### 方法 2: Python 脚本

```bash
# 执行完整流程
python3 ray_cluster_manager.py full

# 查看配置
python3 ray_cluster_manager.py status

# 验证集群
python3 ray_cluster_manager.py verify
```

### 方法 3: 手动步骤

```bash
# 1. 在每个工作节点上安装 Ray
ssh doit@10.12.133.251 'pip3 install ray'
ssh doit@10.7.182.160 'pip3 install ray'
ssh doit@10.7.126.62 'pip3 install ray'

# 2. 在每个工作节点上启动 Ray worker
ssh doit@10.12.133.251 'ray start --address=10.30.2.11:6379'
ssh doit@10.7.182.160 'ray start --address=10.30.2.11:6379'
ssh doit@10.7.126.62 'ray start --address=10.30.2.11:6379'

# 3. 验证集群
ray status
```

## 🔍 验证部署

### 步骤 1: 检查集群状态

```bash
# 显示集群中的所有节点
ray status

# 预期输出：应显示 4 个节点（1 个 head + 3 个 worker）
```

### 步骤 2: 使用诊断工具

```bash
python3 /data/home/sim6g/rayCode/droneOnCampus/scripts/ray_cluster_diagnose.py
```

### 步骤 3: 检查 Dashboard

在浏览器中打开：
```
http://10.30.2.11:8265
```

应该能看到 4 个活跃节点和相应的资源。

### 步骤 4: 执行测试任务

```python
import ray

# 连接到集群
ray.init(address="ray://10.30.2.11:6379")

# 定义任务
@ray.remote
def test_task(x):
    import platform
    return {
        "result": x * 2,
        "node": platform.node(),
        "platform": platform.platform()
    }

# 执行任务
result = ray.get(test_task.remote(21))
print(result)

ray.shutdown()
```

## 🛠️ 脚本说明

### setup_ray_cluster.sh

**功能**: Bash 自动化脚本，用于快速部署和管理 Ray 集群

**用法**:
```bash
./setup_ray_cluster.sh [command]
```

**命令**:
| 命令 | 说明 |
|------|------|
| `full` | 完整安装、启动和验证（推荐） |
| `install` | 只在工作节点上安装 Ray |
| `start` | 启动所有工作节点加入集群 |
| `stop` | 停止所有工作节点 |
| `status` | 检查集群状态 |
| `verify` | 验证集群连接和功能 |
| `help` | 显示帮助信息 |

**示例**:
```bash
# 完整安装
./setup_ray_cluster.sh full

# 检查状态
./setup_ray_cluster.sh status

# 停止集群
./setup_ray_cluster.sh stop
```

### ray_cluster_manager.py

**功能**: Python 管理脚本，提供更灵活的集群管理

**用法**:
```bash
python3 ray_cluster_manager.py [command] [options]
```

**命令**:
| 命令 | 说明 |
|------|------|
| `full` | 完整安装和启动 |
| `install` | 安装 Ray |
| `start` | 启动工作节点 |
| `stop` | 停止工作节点 |
| `status` | 检查状态 |
| `verify` | 验证功能 |

**选项**:
```bash
-c, --config FILE    # 指定配置文件
-s, --save-config FILE  # 保存配置到文件
-v, --verbose       # 详细输出
```

**示例**:
```bash
# 完整安装和验证
python3 ray_cluster_manager.py full

# 检查状态并保存配置
python3 ray_cluster_manager.py status -s cluster_config.json

# 使用自定义配置
python3 ray_cluster_manager.py full -c custom_config.json
```

### ray_cluster_diagnose.py

**功能**: 诊断和故障排查工具

**用法**:
```bash
python3 ray_cluster_diagnose.py
```

**检查项**:
- ✓ 网络连接 (ping)
- ✓ SSH 连接
- ✓ Ray 服务 (Redis, Dashboard)
- ✓ 工作节点 Ray 安装
- ✓ 工作节点 Ray 进程
- ✓ 集群状态和资源
- ✓ 集群任务执行

**输出**: 详细的诊断报告和解决建议

## 🆘 故障排查

### 问题 1: 无法连接主节点

**症状**: 网络连接失败，无法 ping 到 `10.30.2.11`

**解决步骤**:
```bash
# 检查网络
ping 10.30.2.11
traceroute 10.30.2.11

# 检查防火墙
sudo ufw status
sudo ufw allow 6379/tcp
sudo ufw allow 8265/tcp

# 检查主节点 Ray 状态
ssh user@10.30.2.11 'ray status'
```

### 问题 2: SSH 连接超时

**症状**: SSH 连接超时或被拒绝

**解决步骤**:
```bash
# 测试 SSH
ssh -v doit@10.12.133.251 'echo OK'

# 检查 SSH 服务
ssh doit@10.12.133.251 'sudo systemctl status ssh'

# 增加超时时间
ssh -o ConnectTimeout=30 doit@10.12.133.251

# 检查网络延迟
ping -c 10 10.12.133.251 | grep avg
```

### 问题 3: Ray 安装失败

**症状**: Ray 导入错误或版本不匹配

**解决步骤**:
```bash
# 重新安装 Ray
ssh doit@10.12.133.251 << 'EOF'
pip3 install --upgrade ray
python3 -c "import ray; print(f'Ray {ray.__version__}')"
EOF

# 检查 Python 版本
ssh doit@10.12.133.251 'python3 --version'

# 如果 Python 版本过旧，升级
ssh doit@10.12.133.251 << 'EOF'
sudo apt update
sudo apt install -y python3.9 python3.9-venv
python3.9 -m pip install ray
EOF
```

### 问题 4: 工作节点无法加入集群

**症状**: `ray status` 显示节点未连接

**解决步骤**:
```bash
# 检查工作节点日志
ssh doit@10.12.133.251 'tail -f ~/ray_results/session_latest/logs/worker*.log'

# 尝试手动连接
ssh doit@10.12.133.251 << 'EOF'
ray stop --force
sleep 2
ray start --address=10.30.2.11:6379 --verbose
EOF

# 检查防火墙
ssh doit@10.12.133.251 'sudo ufw status'
ssh doit@10.12.133.251 'sudo ufw allow 8000:9999/tcp'

# 检查主节点地址是否可达
ssh doit@10.12.133.251 'ping 10.30.2.11'
```

### 问题 5: 内存或 CPU 不足

**症状**: 任务执行缓慢或失败

**解决步骤**:
```bash
# 查看节点资源
ray status

# 查看可用资源
python3 << 'EOF'
import ray
ray.init(address="auto")
print("Available:", ray.available_resources())
ray.shutdown()
EOF

# 减少 object store 内存
ssh doit@10.12.133.251 << 'EOF'
ray stop --force
ray start --address=10.30.2.11:6379 \
    --object-store-memory=2000000000 \
    --num-cpus=8
EOF
```

## 📊 集群架构

```
┌─────────────────────────────────────────────────────────┐
│                   Ray 集群 (10.30.2.11)                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Head Node (主节点): 10.30.2.11             │  │
│  │  - Ray Head Process                             │  │
│  │  - GCS (Global Control Service)                 │  │
│  │  - Redis (6379)                                 │  │
│  │  - Dashboard (8265)                             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│    ┌─────────────────────────────────────────────────┐  │
│    │         Network: 10.0.0.0/8                    │  │
│    │  - Head ↔ Worker Communication (Ray Protocol)  │  │
│    │  - SSH Access (Port 22)                         │  │
│    │  - Task Distribution & Scheduling               │  │
│    └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐         │
│  │ Worker 1 │  │ Worker 2 │  │ Worker 3     │         │
│  │ Jetson 1 │  │ Jetson 2 │  │ Jetson 64G   │         │
│  │ 10.12... │  │ 10.7.18..│  │ 10.7.126..   │         │
│  │ 12 CPUs  │  │ 12 CPUs  │  │ 12 CPUs      │         │
│  │ 32GB RAM │  │ 32GB RAM │  │ 64GB RAM     │         │
│  └──────────┘  └──────────┘  └──────────────┘         │
│                                                         │
│  总资源: 36 CPU, 128GB RAM (可用于任务执行)            │
└─────────────────────────────────────────────────────────┘
```

## 🔐 安全建议

1. **网络隔离**: 仅允许信任的 IP 连接到 Ray 端口
   ```bash
   sudo ufw default deny incoming
   sudo ufw allow 22/tcp
   sudo ufw allow from 10.0.0.0/8 to any port 6379
   sudo ufw allow from 10.0.0.0/8 to any port 8265
   ```

2. **Redis 密码**: 为 Redis 配置密码
   ```bash
   # 在主节点上
   ray start --head --redis-password=your_secure_password
   
   # 在工作节点上
   ray start --address=10.30.2.11:6379 --redis-password=your_secure_password
   ```

3. **定期备份**: 备份 Ray 配置和数据

4. **监控和日志**: 定期检查集群日志
   ```bash
   tail -f /tmp/ray/session_latest/logs/monitor.log
   ```

## 📈 性能优化

### 针对 Jetson AGX Orin 的优化建议

1. **GPU 使用**:
   ```bash
   # 启用 GPU 支持
   ray start --address=10.30.2.11:6379 \
       --num-gpus=1 \
       --gpu-memory=8000
   ```

2. **内存管理**:
   ```bash
   # 对于内存受限的设备
   ray start --address=10.30.2.11:6379 \
       --object-store-memory=4000000000 \
       --memory=8000000000
   ```

3. **CPU 调度**:
   ```bash
   # 使用固定的 CPU 核心
   ray start --address=10.30.2.11:6379 \
       --num-cpus=10 \
       --resources='{"nvidia_jetson": 1}'
   ```

## 📞 技术支持

### 查看日志

```bash
# 主节点日志
tail -f /tmp/ray/session_latest/logs/monitor.log
tail -f /tmp/ray/session_latest/logs/redis.log

# 工作节点日志
tail -f ~/ray_results/session_latest/logs/worker*.log

# 完整日志目录
ls -la /tmp/ray/session_latest/logs/
```

### 获取集群信息

```bash
# Ray 集群信息
ray status

# 节点详细信息
python3 << 'EOF'
import ray
ray.init(address="auto")
for node in ray.nodes():
    print(f"Node {node['NodeID']}: {node['Resources']}")
ray.shutdown()
EOF

# 监听集群事件
python3 << 'EOF'
import ray
from ray.experimental import client
print(ray.list_nodes())
EOF
```

### 常用 Ray 命令

```bash
# 集群状态
ray status

# 启动 Head 节点
ray start --head

# 启动 Worker 节点
ray start --address=localhost:6379

# 停止节点
ray stop

# 强制停止
ray stop --force

# 查看 Dashboard
# 打开浏览器: http://localhost:8265
```

## ✅ 部署检查清单

- [ ] 三个工作节点网络可达
- [ ] SSH 连接正常
- [ ] Ray 已在三个工作节点上安装
- [ ] Ray 版本一致
- [ ] 三个工作节点已加入集群
- [ ] `ray status` 显示 4 个活跃节点
- [ ] Dashboard 显示所有节点
- [ ] 集群可以执行测试任务
- [ ] 网络防火墙已配置
- [ ] 日志正常

## 📚 相关资源

- [Ray 官方文档](https://docs.ray.io/)
- [Ray 集群部署](https://docs.ray.io/en/latest/cluster/getting-started.html)
- [Jetson AGX Orin 文档](https://docs.nvidia.com/jetson/jetson-agx-orin-developer-kit/)
- [Ray Dashboard](http://10.30.2.11:8265)

## 🎓 示例代码

### 简单的分布式任务

```python
import ray

ray.init(address="ray://10.30.2.11:6379")

@ray.remote
def expensive_function(x):
    import math
    return math.sqrt(x)

# 并行执行任务
futures = [expensive_function.remote(i) for i in range(100)]
results = ray.get(futures)

print(f"Results: {results}")

ray.shutdown()
```

### 使用自定义资源

```python
import ray

ray.init(address="ray://10.30.2.11:6379")

@ray.remote(resources={"jetson_orin": 1})
def jetson_task():
    return "Running on Jetson AGX Orin"

result = ray.get(jetson_task.remote())
print(result)

ray.shutdown()
```

### Actor 示例

```python
import ray

ray.init(address="ray://10.30.2.11:6379")

@ray.remote
class Counter:
    def __init__(self):
        self.count = 0
    
    def increment(self):
        self.count += 1
        return self.count

counter = Counter.remote()
for _ in range(10):
    count = ray.get(counter.increment.remote())
    print(f"Count: {count}")

ray.shutdown()
```

---

## 📝 更新日志

### v1.0 (2025-12-04)
- 初始版本
- 完整的部署指南
- 自动化脚本
- 诊断工具
- 故障排查指南

---

**最后更新**: 2025-12-04  
**维护者**: Ray 集群管理团队  
**状态**: ✓ 生产就绪
