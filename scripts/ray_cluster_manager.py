#!/usr/bin/env python3
"""
Ray 集群自动配置工具
用于简化 Jetson AGX Orin 节点加入 Ray 集群的过程
"""

import os
import sys
import json
import subprocess
import argparse
import time
import logging
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional
import socket

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class WorkerNode:
    """工作节点配置"""
    name: str
    ip: str
    user: str
    password: str
    memory: str
    cpu_cores: int = 12
    gpu_count: int = 1
    
    @property
    def ssh_address(self) -> str:
        """SSH 地址"""
        return f"{self.user}@{self.ip}"
    
    @property
    def resource_name(self) -> str:
        """资源名称 (用于 Ray)"""
        return self.name.replace(' ', '_').lower()


@dataclass
class RayClusterConfig:
    """Ray 集群配置"""
    head_address: str = "10.30.2.11"
    head_port: int = 6379
    dashboard_port: int = 8265
    workers: List[WorkerNode] = None
    
    def __post_init__(self):
        if self.workers is None:
            self.workers = [
                WorkerNode(
                    name="Jetson_AGX_Orin_1",
                    ip="10.12.133.251",
                    user="doit",
                    password="doit1234",
                    memory="32GB"
                ),
                WorkerNode(
                    name="Jetson_AGX_Orin_2",
                    ip="10.7.182.160",
                    user="doit",
                    password="doit1234",
                    memory="32GB"
                ),
                WorkerNode(
                    name="Jetson_AGX_Orin_64G",
                    ip="10.7.126.62",
                    user="doit",
                    password="123456",
                    memory="64GB"
                ),
            ]


class RayClusterManager:
    """Ray 集群管理器"""
    
    def __init__(self, config: RayClusterConfig):
        self.config = config
    
    def ping_host(self, host: str, timeout: int = 5) -> bool:
        """检查主机是否可达"""
        try:
            result = subprocess.run(
                ["ping", "-c", "1", "-W", str(timeout), host],
                capture_output=True,
                timeout=timeout + 1
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"Ping {host} 失败: {e}")
            return False
    
    def check_tcp_port(self, host: str, port: int, timeout: int = 3) -> bool:
        """检查 TCP 端口是否开放"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except Exception as e:
            logger.error(f"检查 {host}:{port} 失败: {e}")
            return False
    
    def check_head_node(self) -> bool:
        """检查主节点连接"""
        logger.info(f"检查主节点 {self.config.head_address}...")
        
        if not self.ping_host(self.config.head_address):
            logger.error(f"无法 ping 到主节点 {self.config.head_address}")
            return False
        
        logger.info("✓ 主节点网络可达")
        return True
    
    def check_head_ray_status(self) -> bool:
        """检查 Ray Head 服务"""
        logger.info(f"检查 Ray Head 服务 {self.config.head_address}:{self.config.head_port}...")
        
        if self.check_tcp_port(self.config.head_address, self.config.head_port):
            logger.info("✓ Ray Head 服务运行正常")
            return True
        else:
            logger.error(f"Ray Head 服务 {self.config.head_address}:{self.config.head_port} 不响应")
            return False
    
    def ssh_command(self, node: WorkerNode, cmd: str) -> tuple[bool, str]:
        """在远程节点执行 SSH 命令"""
        try:
            ssh_cmd = [
                "ssh",
                "-o", "ConnectTimeout=10",
                "-o", "StrictHostKeyChecking=no",
                node.ssh_address,
                cmd
            ]
            
            result = subprocess.run(
                ssh_cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            return result.returncode == 0, result.stdout + result.stderr
        
        except Exception as e:
            logger.error(f"SSH 命令执行失败: {e}")
            return False, str(e)
    
    def install_ray(self, nodes: Optional[List[WorkerNode]] = None) -> bool:
        """在节点上安装 Ray"""
        if nodes is None:
            nodes = self.config.workers
        
        logger.info(f"在 {len(nodes)} 个节点上安装 Ray...")
        failed_nodes = []
        
        for node in nodes:
            logger.info(f"  在 {node.name} ({node.ssh_address}) 上安装 Ray...")
            
            install_script = """
set -e
echo '更新系统包...'
sudo apt update -q
echo '安装 Python 3 和 pip...'
sudo apt install -y python3-pip python3-venv > /dev/null 2>&1
echo '安装 Ray...'
pip3 install --upgrade ray > /dev/null 2>&1
echo '验证安装...'
python3 -c "import ray; print(f'Ray {ray.__version__} 安装成功')"
            """
            
            success, output = self.ssh_command(node, install_script)
            
            if success:
                logger.info(f"  ✓ 已在 {node.name} 上安装 Ray")
            else:
                logger.error(f"  ✗ 无法在 {node.name} 上安装 Ray")
                logger.debug(f"  输出: {output}")
                failed_nodes.append(node.name)
        
        if failed_nodes:
            logger.warning(f"以下节点安装失败: {', '.join(failed_nodes)}")
            return False
        
        logger.info("✓ 所有节点安装成功")
        return True
    
    def start_workers(self, nodes: Optional[List[WorkerNode]] = None) -> bool:
        """启动工作节点加入集群"""
        if nodes is None:
            nodes = self.config.workers
        
        logger.info(f"启动 {len(nodes)} 个工作节点...")
        failed_nodes = []
        
        for node in nodes:
            logger.info(f"  启动 {node.name} ({node.ip})...")
            
            start_script = f"""
ray stop --force 2>/dev/null || true
sleep 2
ray start \\
    --address={self.config.head_address}:{self.config.head_port} \\
    --resources='{{"resource_name": 1}}' \\
    --labels='device=jetson_orin,memory={node.memory}' \\
    --num-cpus={node.cpu_cores} \\
    --num-gpus={node.gpu_count} \\
    --object-store-memory=5000000000 \\
    --quiet
sleep 5
            """.replace("resource_name", node.resource_name)
            
            success, output = self.ssh_command(node, start_script)
            
            if success:
                logger.info(f"  ✓ {node.name} 已启动并连接到集群")
            else:
                logger.error(f"  ✗ 无法启动 {node.name}")
                logger.debug(f"  输出: {output}")
                failed_nodes.append(node.name)
        
        if failed_nodes:
            logger.warning(f"以下节点启动失败: {', '.join(failed_nodes)}")
            return False
        
        logger.info("✓ 所有工作节点已启动")
        return True
    
    def stop_workers(self, nodes: Optional[List[WorkerNode]] = None) -> bool:
        """停止所有工作节点"""
        if nodes is None:
            nodes = self.config.workers
        
        logger.info(f"停止 {len(nodes)} 个工作节点...")
        
        for node in nodes:
            logger.info(f"  停止 {node.name}...")
            success, _ = self.ssh_command(node, "ray stop --force")
            
            if success:
                logger.info(f"  ✓ {node.name} 已停止")
            else:
                logger.warning(f"  ⚠ 停止 {node.name} 时出错")
        
        logger.info("✓ 所有工作节点已停止")
        return True
    
    def check_status(self) -> Optional[Dict]:
        """检查集群状态"""
        logger.info("检查集群状态...")
        
        try:
            import ray
            
            # 连接到集群
            try:
                ray.init(
                    address=f"ray://{self.config.head_address}:{self.config.head_port}",
                    ignore_reinit_error=True
                )
            except:
                ray.init(address="auto", ignore_reinit_error=True)
            
            time.sleep(2)
            
            resources = ray.cluster_resources()
            available = ray.available_resources()
            nodes = ray.nodes()
            
            status = {
                'resources': dict(resources),
                'available': dict(available),
                'nodes': len(nodes),
                'is_healthy': len(nodes) >= 4
            }
            
            logger.info("=" * 60)
            logger.info("Ray 集群状态")
            logger.info("=" * 60)
            logger.info(f"\n📊 集群资源:")
            for resource, count in sorted(resources.items()):
                logger.info(f"  • {resource}: {count}")
            
            logger.info(f"\n🔵 可用资源:")
            for resource, count in sorted(available.items()):
                logger.info(f"  • {resource}: {count}")
            
            logger.info(f"\n🖥️  活跃节点: {len(nodes)}")
            
            ray.shutdown()
            return status
        
        except Exception as e:
            logger.error(f"检查集群状态失败: {e}")
            return None
    
    def verify_cluster(self) -> bool:
        """验证集群功能"""
        logger.info("验证集群连接和健康状况...")
        
        try:
            import ray
            
            # 连接到集群
            try:
                ray.init(
                    address=f"ray://{self.config.head_address}:{self.config.head_port}",
                    ignore_reinit_error=True
                )
            except:
                ray.init(address="auto", ignore_reinit_error=True)
            
            time.sleep(2)
            
            logger.info("=" * 60)
            logger.info("Ray 集群验证报告")
            logger.info("=" * 60)
            
            # 检查连接
            resources = ray.cluster_resources()
            if not resources:
                logger.error("✗ 集群连接失败")
                return False
            
            logger.info("✓ 集群连接: 成功")
            
            # 检查节点数量
            nodes = ray.nodes()
            node_count = len(nodes)
            logger.info(f"✓ 活跃节点: {node_count} 个")
            
            if node_count < 4:
                logger.warning(f"⚠ 节点数少于预期 (应为 4 个)")
            
            # 检查 CPU
            total_cpus = resources.get('CPU', 0)
            logger.info(f"✓ 总 CPU 核心: {int(total_cpus)}")
            
            # 检查 GPU
            total_gpus = resources.get('GPU', 0)
            if total_gpus > 0:
                logger.info(f"✓ 总 GPU 数量: {int(total_gpus)}")
            
            # 任务测试
            logger.info("\n执行简单任务测试...")
            
            @ray.remote
            def test_task(x):
                return x * 2
            
            result = ray.get(test_task.remote(21))
            if result == 42:
                logger.info("✓ 任务执行: 成功")
            else:
                logger.error("✗ 任务执行: 失败")
                return False
            
            logger.info("\n" + "=" * 60)
            logger.info("✓ 验证完成 - 集群正常运行")
            logger.info("=" * 60)
            
            ray.shutdown()
            return True
        
        except Exception as e:
            logger.error(f"✗ 验证失败: {e}")
            return False
    
    def full_setup(self) -> bool:
        """执行完整安装流程"""
        logger.info("执行完整的 Ray 集群设置流程...")
        logger.info("")
        
        # 检查主节点
        if not self.check_head_node():
            logger.error("主节点不可达，无法继续")
            return False
        
        if not self.check_head_ray_status():
            logger.error("Ray Head 服务不运行，无法继续")
            return False
        
        logger.info("")
        
        # 安装 Ray
        if not self.install_ray():
            logger.warning("部分节点安装失败，继续尝试启动...")
        
        logger.info("")
        
        # 启动工作节点
        if not self.start_workers():
            logger.warning("部分工作节点启动失败")
        
        logger.info("")
        
        # 等待集群稳定
        logger.info("等待 30 秒让集群稳定...")
        for i in range(30, 0, -1):
            print(f"\r剩余: {i} 秒", end="", flush=True)
            time.sleep(1)
        print("\r", end="")
        
        # 验证集群
        return self.verify_cluster()


def load_config(config_file: Optional[str] = None) -> RayClusterConfig:
    """加载配置文件"""
    if config_file and os.path.exists(config_file):
        logger.info(f"从 {config_file} 加载配置...")
        with open(config_file, 'r') as f:
            config_data = json.load(f)
            return RayClusterConfig(**config_data)
    
    return RayClusterConfig()


def save_config(config: RayClusterConfig, config_file: str) -> None:
    """保存配置文件"""
    config_data = {
        'head_address': config.head_address,
        'head_port': config.head_port,
        'dashboard_port': config.dashboard_port,
        'workers': [asdict(w) for w in config.workers]
    }
    
    with open(config_file, 'w') as f:
        json.dump(config_data, f, indent=2)
    
    logger.info(f"配置已保存到 {config_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Ray 集群自动配置工具"
    )
    
    parser.add_argument(
        "action",
        choices=["install", "start", "stop", "status", "verify", "full"],
        help="执行的操作"
    )
    
    parser.add_argument(
        "-c", "--config",
        type=str,
        help="配置文件路径"
    )
    
    parser.add_argument(
        "-s", "--save-config",
        type=str,
        help="保存当前配置到文件"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="详细输出"
    )
    
    args = parser.parse_args()
    
    # 设置日志级别
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # 加载配置
    config = load_config(args.config)
    
    # 保存配置
    if args.save_config:
        save_config(config, args.save_config)
    
    # 创建管理器
    manager = RayClusterManager(config)
    
    # 执行操作
    if args.action == "install":
        success = manager.install_ray()
    elif args.action == "start":
        manager.check_head_node()
        manager.check_head_ray_status()
        success = manager.start_workers()
    elif args.action == "stop":
        success = manager.stop_workers()
    elif args.action == "status":
        manager.check_head_node()
        status = manager.check_status()
        success = status is not None
    elif args.action == "verify":
        manager.check_head_node()
        manager.check_head_ray_status()
        success = manager.verify_cluster()
    elif args.action == "full":
        success = manager.full_setup()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
