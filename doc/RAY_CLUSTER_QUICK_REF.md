# Ray 集群快速参考

## 三台 Jetson AGX Orin 机器配置

| 机器 | IP | 用户 | 密码 | 内存 |
|------|-----|------|------|------|
| Jetson AGX Orin 1 | 10.12.133.251 | doit | doit1234 | 32GB |
| Jetson AGX Orin 2 | 10.7.182.160 | doit | doit1234 | 32GB |
| AGX Orin 64G | 10.7.126.62 | doit | 123456 | 64GB |

## 快速命令

### 1️⃣ 一键安装和启动（推荐）

```bash
# 进入脚本目录
cd /data/home/sim6g/rayCode/droneOnCampus/scripts

# 方法 A: 使用 Bash 脚本
chmod +x setup_ray_cluster.sh
./setup_ray_cluster.sh full

# 方法 B: 使用 Python 脚本
python3 ray_cluster_manager.py full
```

### 2️⃣ 分步骤执行

```bash
# 只安装 Ray
./setup_ray_cluster.sh install

# 启动工作节点
./setup_ray_cluster.sh start

# 检查集群状态
./setup_ray_cluster.sh status

# 验证集群
./setup_ray_cluster.sh verify

# 停止所有工作节点
./setup_ray_cluster.sh stop
```

### 3️⃣ 手动连接单个节点

```bash
# 连接到 Jetson 1
ssh doit@10.12.133.251

# 在节点上启动 Ray worker
ray start --address=10.30.2.11:6379 \
    --resources='{"jetson_1": 1}' \
    --labels='model=AGX_Orin,memory=32GB'

# 验证
ray status
```

## 常见问题

### Q: 无法连接到主节点

```bash
# 测试网络连接
ping 10.30.2.11

# 检查防火墙规则
sudo ufw status

# 允许 Ray 端口
sudo ufw allow 6379/tcp  # Redis
sudo ufw allow 8265/tcp  # Dashboard
sudo ufw allow 8000:9000/tcp  # Worker communication
```

### Q: SSH 连接超时

```bash
# 检查 SSH 连接
ssh -v doit@10.12.133.251

# 增加超时时间
ssh -o ConnectTimeout=30 doit@10.12.133.251
```

### Q: Ray 安装失败

```bash
# 手动安装
ssh doit@10.12.133.251 << 'EOF'
sudo apt update
sudo apt install -y python3-pip
pip3 install ray
python3 -c "import ray; print(ray.__version__)"
EOF
```

### Q: 无法加入集群

```bash
# 检查主节点 Ray 状态
ssh user@10.30.2.11 'ray status'

# 查看集群日志
ssh user@10.30.2.11 'tail -f /tmp/ray/session_latest/logs/monitor.log'

# 在工作节点重新启动
ray stop --force
ray start --address=10.30.2.11:6379
```

### Q: 集群资源不足

```bash
# 减少 object store 内存
ray start --address=10.30.2.11:6379 \
    --object-store-memory=2000000000 \
    --num-cpus=8

# 查看资源使用
python3 << 'EOF'
import ray
ray.init(address="auto")
print("Resources:", ray.cluster_resources())
print("Available:", ray.available_resources())
ray.shutdown()
EOF
```

## 集群验证清单

```bash
# 1. 检查网络
ping 10.30.2.11
ping 10.12.133.251
ping 10.7.182.160
ping 10.7.126.62

# 2. 检查 SSH 连接
ssh doit@10.12.133.251 'echo OK'
ssh doit@10.7.182.160 'echo OK'
ssh doit@10.7.126.62 'echo OK'

# 3. 检查 Ray 安装
ssh doit@10.12.133.251 'python3 -c "import ray; print(ray.__version__)"'

# 4. 检查集群状态
ray status

# 5. 在 Dashboard 中验证
# 打开浏览器: http://10.30.2.11:8265
```

## 文件位置

```
/data/home/sim6g/rayCode/droneOnCampus/
├── scripts/
│   ├── setup_ray_cluster.sh       # Bash 自动化脚本
│   ├── ray_cluster_manager.py     # Python 管理脚本
├── doc/
│   ├── RAY_CLUSTER_SETUP_GUIDE.md # 详细指南
│   └── RAY_CLUSTER_QUICK_REF.md   # 本文件
└── config/
    └── system_config.json         # 系统配置
```

## 更多帮助

### 查看完整文档
```bash
cat /data/home/sim6g/rayCode/droneOnCampus/doc/RAY_CLUSTER_SETUP_GUIDE.md
```

### Ray 官方文档
- https://docs.ray.io/
- https://docs.ray.io/en/latest/cluster/getting-started.html

### 获取实时帮助
```bash
# 脚本帮助
./setup_ray_cluster.sh help

# Python 脚本帮助
python3 ray_cluster_manager.py -h
```

---

**最后更新**: 2025-12-04  
**维护者**: Ray 集群管理团队
