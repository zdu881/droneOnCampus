# 🚀 Ray 集群 Jetson AGX Orin 接入方案

> 为三台 Jetson AGX Orin 机器接入现有 Ray 集群的完整解决方案

## 📱 机器信息

| 机器 | IP | 用户 | 密码 | 规格 |
|------|-----|------|------|------|
| Jetson AGX Orin 1 | 10.12.133.251 | doit | doit1234 | 12核, 32GB |
| Jetson AGX Orin 2 | 10.7.182.160 | doit | doit1234 | 12核, 32GB |
| AGX Orin 64G | 10.7.126.62 | doit | 123456 | 12核, 64GB |

**主节点**: 10.30.2.11:6379

---

## ⚡ 快速开始（5分钟）

### 一键启动

```bash
cd /data/home/sim6g/rayCode/droneOnCampus/scripts
chmod +x setup_ray_cluster.sh
./setup_ray_cluster.sh full
```

**完成后验证**:
```bash
ray status  # 应显示 4 个节点
```

---

## 📚 完整文档

| 文档 | 说明 |
|------|------|
| [完整设置指南](./RAY_CLUSTER_SETUP_GUIDE.md) | 详细的部署步骤和原理 |
| [快速参考](./RAY_CLUSTER_QUICK_REF.md) | 常用命令和常见问题 |
| [集成总结](./RAY_CLUSTER_INTEGRATION.md) | 集成方案概述 |
| [本方案总结](./RAY_CLUSTER_SOLUTION_SUMMARY.md) | 解决方案总结 |

---

## 🛠️ 可用脚本

### 1. Bash 脚本（推荐新手）

```bash
./setup_ray_cluster.sh [command]
```

**命令**:
- `full` - 完整安装和启动
- `install` - 只安装 Ray
- `start` - 启动工作节点
- `stop` - 停止工作节点
- `status` - 检查状态
- `verify` - 验证集群
- `help` - 显示帮助

**例**:
```bash
./setup_ray_cluster.sh full     # 一键安装
./setup_ray_cluster.sh status   # 检查状态
```

### 2. Python 脚本（更灵活）

```bash
python3 ray_cluster_manager.py [command] [options]
```

**命令**:
- `full` - 完整流程
- `install` - 安装 Ray
- `start` - 启动工作节点
- `stop` - 停止工作节点
- `status` - 检查状态
- `verify` - 验证集群

**例**:
```bash
python3 ray_cluster_manager.py full        # 完整流程
python3 ray_cluster_manager.py status -v   # 详细状态
```

### 3. 诊断工具

```bash
python3 ray_cluster_diagnose.py
```

**自动检查**:
- ✓ 网络连接
- ✓ SSH 访问
- ✓ Ray 安装
- ✓ 集群资源
- ✓ 任务执行

---

## 📋 使用流程

### 步骤 1: 自动安装（推荐）

```bash
cd /data/home/sim6g/rayCode/droneOnCampus/scripts
./setup_ray_cluster.sh full
```

等待 5-10 分钟，脚本会自动完成：
- ✅ 安装 Ray
- ✅ 启动工作节点
- ✅ 验证连接

### 步骤 2: 验证部署

```bash
# 检查集群状态
ray status

# 运行诊断
python3 ray_cluster_diagnose.py

# 打开 Dashboard
# 浏览器访问: http://10.30.2.11:8265
```

### 步骤 3: 使用集群

```python
import ray

# 连接到集群
ray.init(address="ray://10.30.2.11:6379")

# 定义任务
@ray.remote
def task(x):
    return x * 2

# 执行任务
result = ray.get(task.remote(21))
print(result)  # 42

ray.shutdown()
```

---

## ❓ 常见问题

### Q: 脚本卡住了怎么办？

```bash
# Ctrl+C 中断，然后检查诊断
python3 ray_cluster_diagnose.py

# 查看哪里出问题，手动修复后再运行
```

### Q: SSH 连接失败？

```bash
# 测试单个节点的 SSH
ssh doit@10.12.133.251 'echo OK'

# 如果失败，检查网络
ping 10.12.133.251

# 手动在该节点安装 Ray
ssh doit@10.12.133.251 'pip3 install ray'
```

### Q: Ray 无法启动？

```bash
# 在该节点重试
ssh doit@10.12.133.251 << 'EOF'
ray stop --force
sleep 2
ray start --address=10.30.2.11:6379 --verbose
EOF
```

### Q: 集群没有显示所有节点？

```bash
# 运行诊断工具找出问题
python3 ray_cluster_diagnose.py

# 查看节点日志
ssh doit@10.12.133.251 'tail -f ~/ray_results/*/logs/worker*.log'
```

---

## 📊 部署后的集群

```
Head Node: 10.30.2.11:6379
├── Worker 1: 10.12.133.251 (12 CPU, 32GB RAM)
├── Worker 2: 10.7.182.160  (12 CPU, 32GB RAM)
└── Worker 3: 10.7.126.62   (12 CPU, 64GB RAM)

总计: 36+ CPU, 128GB+ RAM
```

---

## 🔧 管理集群

### 检查状态

```bash
ray status
ray dashboard  # 打开 Dashboard
```

### 停止集群

```bash
# 停止工作节点
./setup_ray_cluster.sh stop

# 或逐个停止
ssh doit@10.12.133.251 'ray stop --force'
ssh doit@10.7.182.160 'ray stop --force'
ssh doit@10.7.126.62 'ray stop --force'
```

### 重启集群

```bash
./setup_ray_cluster.sh stop
./setup_ray_cluster.sh start
```

---

## 📌 文件位置

```
/data/home/sim6g/rayCode/droneOnCampus/
├── doc/
│   ├── RAY_CLUSTER_SETUP_GUIDE.md        # 完整指南
│   ├── RAY_CLUSTER_QUICK_REF.md          # 快速参考
│   ├── RAY_CLUSTER_INTEGRATION.md        # 集成方案
│   └── RAY_CLUSTER_SOLUTION_SUMMARY.md   # 方案总结
└── scripts/
    ├── setup_ray_cluster.sh              # Bash 脚本
    ├── ray_cluster_manager.py            # Python 脚本
    └── ray_cluster_diagnose.py           # 诊断工具
```

---

## 💡 提示

- 🔹 **首次使用**: 使用 `setup_ray_cluster.sh full` 一键安装
- 🔹 **有问题**: 运行 `ray_cluster_diagnose.py` 找出原因
- 🔹 **查看状态**: 打开 http://10.30.2.11:8265 Dashboard
- 🔹 **需要帮助**: 查看 `RAY_CLUSTER_SETUP_GUIDE.md` 详细说明

---

## ✅ 成功标志

集群部署成功，如果您看到：

```bash
$ ray status
======== Ray cluster status ========
Node ID     ... Status  Workers
node_xxx    ... alive   1
node_yyy    ... alive   0
node_zzz    ... alive   0
node_head   ... alive   1

Resources
cpu: 49.0
memory: 136000000000.0
```

✨ **恭喜！集群已成功部署** ✨

---

**最后更新**: 2025-12-04  
**维护者**: Ray 集群管理团队  
**状态**: ✅ 生产就绪

👉 **立即开始**: `./setup_ray_cluster.sh full`
