# Ray 集群扩展指南 - Jetson AGX Orin 节点接入

## 📋 节点信息

### 现有节点
- **主节点 (Head Node)**: `10.30.2.11:6379`
- **Dashboard**: `http://10.30.2.11:8265`

### 待接入的工作节点 (Worker Nodes)
| 节点名称 | IP 地址 | 用户名 | 密码 | 规格 |
|---------|--------|--------|--------|------|
| Jetson AGX Orin 1 | 10.12.133.251 | doit | doit1234 | 12-core ARM |
| Jetson AGX Orin 2 | 10.7.182.160 | doit | doit1234 | 12-core ARM |
| AGX Orin 64G | 10.7.126.62 | doit | 123456 | 12-core ARM, 64GB RAM |

---

## 🚀 快速开始 (5分钟)

### 步骤 1: 在主节点上验证 Ray 集群状态

```bash
# 登录主节点
ssh user@10.30.2.11

# 检查 Ray 集群状态
ray status
# 或通过 Python 检查
python3 -c "import ray; print(ray.cluster_resources())"

# 检查 Dashboard
curl http://10.30.2.11:8265
```

### 步骤 2: 在每个工作节点上安装 Ray

```bash
# SSH 连接到第一个节点
ssh doit@10.12.133.251

# 安装 Python 和依赖
sudo apt update
sudo apt install -y python3 python3-pip python3-venv

# 安装 Ray
pip3 install ray[default]

# 验证 Ray 安装
python3 -c "import ray; print(ray.__version__)"
```

**重复以上步骤连接到其他两个节点**

### 步骤 3: 启动工作节点加入集群

在 `10.12.133.251` 上执行：
```bash
ray start --address=10.30.2.11:6379 --resources='{"jetson_orin_1": 1}' --labels='model=AGX_Orin,gpu=A100,memory=32GB'
```

在 `10.7.182.160` 上执行：
```bash
ray start --address=10.30.2.11:6379 --resources='{"jetson_orin_2": 1}' --labels='model=AGX_Orin,gpu=A100,memory=32GB'
```

在 `10.7.126.62` 上执行：
```bash
ray start --address=10.30.2.11:6379 --resources='{"jetson_orin_64g": 1}' --labels='model=AGX_Orin,gpu=A100,memory=64GB'
```

### 步骤 4: 验证集群连接

在主节点或任何客户端运行：
```bash
ray status
```

预期输出应显示 3 个新的工作节点已连接。

---

## 📖 详细说明

### Ray 集群架构

```
┌─────────────────────────────────────────────────────────┐
│                   Ray 集群系统                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Head Node (主节点): 10.30.2.11             │  │
│  │  - Ray Head Process                             │  │
│  │  - Scheduler & Monitor                          │  │
│  │  - Dashboard: 8265                              │  │
│  │  - Redis: 6379                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                    ↑                                     │
│        ┌───────────┼───────────┐                        │
│        ↓           ↓           ↓                        │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐               │
│  │Worker1  │  │Worker2  │  │Worker3   │               │
│  │10.12... │  │10.7.18..│  │10.7.126..│               │
│  │AGX Orin │  │AGX Orin │  │AGX Orin  │               │
│  │1 (32GB) │  │2 (32GB) │  │(64GB)    │               │
│  └─────────┘  └─────────┘  └──────────┘               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 安装步骤详解

#### 2.1 环境准备

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装必要的开发工具
sudo apt install -y build-essential python3-dev

# 创建 Python 虚拟环境 (可选，但推荐)
python3 -m venv ~/ray_env
source ~/ray_env/bin/activate
```

#### 2.2 安装 Ray

```bash
# 基础安装
pip3 install ray

# 或安装完整版 (包含 Tune, Serve 等)
pip3 install "ray[tune,serve,air]"

# 对于 GPU 支持 (如果有 GPU)
pip3 install "ray[all]"
```

#### 2.3 验证安装

```bash
# 检查 Ray 版本
python3 -c "import ray; print(f'Ray version: {ray.__version__}')"

# 检查可用资源
python3 -c "import ray; ray.init(); print(ray.available_resources()); ray.shutdown()"
```

### 启动工作节点详解

#### 3.1 基本命令

```bash
# 最简单的方式 - 连接到已有的集群
ray start --address=<HEAD_IP>:<HEAD_PORT>

# 完整例子 (带资源和标签)
ray start \
  --address=10.30.2.11:6379 \
  --resources='{"custom_resource": 1}' \
  --labels='zone=us_west,gpu_type=A100' \
  --num-cpus=12 \
  --num-gpus=1 \
  --object-store-memory=10000000000
```

#### 3.2 参数说明

| 参数 | 说明 | 例子 |
|------|------|------|
| `--address` | 主节点地址和端口 | `10.30.2.11:6379` |
| `--resources` | 自定义资源 | `'{"jetson_1": 1}'` |
| `--labels` | 节点标签 | `'model=AGX_Orin'` |
| `--num-cpus` | CPU 核心数 | `12` |
| `--num-gpus` | GPU 数量 | `1` |
| `--object-store-memory` | 对象存储内存 | `10GB` |
| `--redis-password` | Redis 密码 (如果有) | `your_password` |

#### 3.3 针对 Jetson AGX Orin 的优化

```bash
# 对于内存有限的 Jetson 设备
ray start \
  --address=10.30.2.11:6379 \
  --num-cpus=8 \
  --num-gpus=1 \
  --object-store-memory=5000000000 \
  --resources='{"jetson_orin": 1}' \
  --labels='device_type=jetson,memory=32GB'
```

---

## 🔍 验证和故障排查

### 验证连接

```bash
# 在任何节点上检查集群状态
ray status

# 预期输出示例:
# ======== Ray cluster status ========
# Node ID                                         State  ... Workers
# 0ff0d36ac5a6872ef521f8c36f06f4c7e85c2f68  alive  ...       0
# 3b2da15f6ba2b1c3a3e1b23b8f8e8c5b5f5a5b1c  alive  ...       0
# ...
# Resources
# cpu: 48.0
# memory: 128000000000.0
# ...
```

### 常见问题

#### 问题 1: 无法连接到主节点

```bash
# 检查网络连接
ping 10.30.2.11

# 检查防火墙
sudo ufw allow 6379/tcp
sudo ufw allow 8265/tcp
sudo ufw allow 8000:8999/tcp

# 检查主节点 Ray 是否运行
ssh user@10.30.2.11 'ray status'
```

#### 问题 2: 权限问题

```bash
# 确保用户有访问权限
sudo usermod -aG docker $USER  # 如果使用 Docker
newgrp docker

# 检查文件权限
ls -la ~/.ray/
```

#### 问题 3: 内存不足

```bash
# 减少 object store 内存
ray start \
  --address=10.30.2.11:6379 \
  --object-store-memory=2000000000 \
  --resources='{"jetson": 1}'
```

#### 问题 4: 连接超时

```bash
# 增加超时时间
export RAY_memory_monitor_refresh_ms=10000
export RAY_TIMEOUT_MILLIS=30000
ray start --address=10.30.2.11:6379
```

### 调试命令

```bash
# 查看 Ray 日志
tail -f ~/ray_results/*/session_latest/logs/worker*.log

# 查看详细状态
python3 << 'EOF'
import ray
ray.init(address="auto")
print("Cluster Resources:", ray.cluster_resources())
print("Available Resources:", ray.available_resources())
print("Nodes:", ray.nodes())
ray.shutdown()
EOF

# 查看正在运行的进程
ps aux | grep ray
```

---

## 📝 自动化脚本

### 脚本 1: 自动安装所有工作节点

```bash
#!/bin/bash
# install_ray_workers.sh

NODES=(
  "doit@10.12.133.251"
  "doit@10.7.182.160"
  "doit@10.7.126.62"
)

HEAD_ADDRESS="10.30.2.11:6379"

for node in "${NODES[@]}"; do
  echo "Installing Ray on $node..."
  ssh "$node" << 'ENDSSH'
    sudo apt update
    sudo apt install -y python3-pip
    pip3 install ray
    echo "Installation complete on $node"
ENDSSH
done

echo "All nodes have Ray installed"
```

### 脚本 2: 启动所有工作节点

```bash
#!/bin/bash
# start_ray_workers.sh

HEAD_ADDRESS="10.30.2.11:6379"

# 节点配置
declare -A NODES=(
  ["doit@10.12.133.251"]="jetson_orin_1"
  ["doit@10.7.182.160"]="jetson_orin_2"
  ["doit@10.7.126.62"]="jetson_orin_64g"
)

for node in "${!NODES[@]}"; do
  resource_name="${NODES[$node]}"
  echo "Starting Ray worker on $node..."
  ssh "$node" << ENDSSH
    ray start --address=$HEAD_ADDRESS \
      --resources='{\"$resource_name\": 1}' \
      --labels='device=jetson_orin' \
      --num-cpus=12 \
      --num-gpus=1
ENDSSH
done

echo "All workers started"
```

### 脚本 3: 检查集群健康状态

```bash
#!/bin/bash
# check_cluster_health.sh

python3 << 'EOF'
import ray
import subprocess
import json

# 连接到集群
try:
    ray.init(address="auto")
except:
    ray.init(address="ray://10.30.2.11:6379")

print("=" * 50)
print("Ray Cluster Health Report")
print("=" * 50)

# 集群资源
resources = ray.cluster_resources()
print(f"\n✓ Cluster Resources:")
for resource, count in resources.items():
    print(f"  - {resource}: {count}")

# 可用资源
available = ray.available_resources()
print(f"\n✓ Available Resources:")
for resource, count in available.items():
    print(f"  - {resource}: {count}")

# 节点信息
nodes = ray.nodes()
print(f"\n✓ Nodes ({len(nodes)} total):")
for node in nodes:
    print(f"  - {node['NodeID']}")
    print(f"    Resources: {node.get('Resources', {})}")
    print(f"    Status: {'alive' if node.get('Alive') else 'dead'}")

# 工作进程
actors = ray.list_actors()
print(f"\n✓ Actors: {len(actors)}")

ray.shutdown()
print("\n" + "=" * 50)
EOF
```

---

## 🔐 安全建议

### 1. 配置 Redis 密码 (可选但推荐)

```bash
# 在主节点上
ray start --head --port=6379 --redis-password=your_secure_password

# 在工作节点上
ray start --address=10.30.2.11:6379 --redis-password=your_secure_password
```

### 2. 网络隔离

```bash
# 仅允许特定 IP 连接
sudo iptables -A INPUT -p tcp --dport 6379 -s 10.0.0.0/8 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 6379 -j DROP
```

### 3. 定期备份

```bash
# 备份 Ray 配置
sudo cp -r ~/.ray ~/ray_backup_$(date +%Y%m%d)
```

---

## 📚 相关资源

- [Ray 官方文档](https://docs.ray.io/)
- [Ray 集群部署指南](https://docs.ray.io/en/latest/cluster/getting-started.html)
- [Jetson 官方文档](https://docs.nvidia.com/jetson/)
- 本项目 Dashboard: `http://10.30.2.11:8265`

---

## ✅ 完整清单

- [ ] 主节点 Ray 集群已启动 (`10.30.2.11:6379`)
- [ ] 三个工作节点已安装 Python 3 和 pip
- [ ] 三个工作节点已安装 Ray
- [ ] Jetson 1 (`10.12.133.251`) 已连接到集群
- [ ] Jetson 2 (`10.7.182.160`) 已连接到集群
- [ ] AGX Orin 64G (`10.7.126.62`) 已连接到集群
- [ ] 运行 `ray status` 确认所有节点在线
- [ ] Dashboard 显示 3 个新节点
- [ ] 网络连接已验证
- [ ] 安全策略已配置 (可选)

---

## 🆘 获取帮助

如遇问题，请检查以下日志文件：

```bash
# 主节点日志
tail -f /tmp/ray/session_latest/logs/monitor.log
tail -f /tmp/ray/session_latest/logs/redis.log

# 工作节点日志
tail -f ~/ray_results/session_latest/logs/worker*.log

# 查看详细调试信息
export RAY_LOG_LEVEL=DEBUG
ray start --address=10.30.2.11:6379
```
