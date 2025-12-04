#!/usr/bin/env python3
"""
Ray 集群诊断和故障排查工具
用于诊断 Ray 集群的连接、性能和健康状况
"""

import subprocess
import socket
import sys
import json
import time
import logging
from typing import List, Dict, Tuple

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 颜色定义
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def colored(text, color):
    """返回带颜色的文本"""
    return f"{color}{text}{Colors.END}"


class RayClusterDiagnostics:
    """Ray 集群诊断工具"""
    
    def __init__(self):
        self.head_address = "10.30.2.11"
        self.head_port = 6379
        self.dashboard_port = 8265
        self.workers = [
            {"name": "Jetson_1", "ip": "10.12.133.251", "user": "doit"},
            {"name": "Jetson_2", "ip": "10.7.182.160", "user": "doit"},
            {"name": "Jetson_64G", "ip": "10.7.126.62", "user": "doit"},
        ]
        self.issues = []
    
    def print_header(self, title: str) -> None:
        """打印分段标题"""
        width = 60
        print(f"\n{colored('=' * width, Colors.BLUE)}")
        print(f"{colored(title, Colors.BLUE)}")
        print(f"{colored('=' * width, Colors.BLUE)}")
    
    def print_result(self, check_name: str, passed: bool, message: str = "") -> None:
        """打印检查结果"""
        status = colored("✓ PASS", Colors.GREEN) if passed else colored("✗ FAIL", Colors.RED)
        print(f"  {status} - {check_name}")
        if message:
            print(f"       {message}")
    
    def test_network_connectivity(self) -> bool:
        """测试网络连接"""
        self.print_header("网络连接测试")
        all_passed = True
        
        # 测试主节点
        logger.info(f"测试主节点 {self.head_address}...")
        head_passed = self.ping_host(self.head_address)
        self.print_result("Head Node Ping", head_passed)
        if not head_passed:
            all_passed = False
            self.issues.append(f"无法 ping 主节点 {self.head_address}")
        
        # 测试工作节点
        for worker in self.workers:
            logger.info(f"测试工作节点 {worker['name']} ({worker['ip']})...")
            worker_passed = self.ping_host(worker['ip'])
            self.print_result(
                f"Worker {worker['name']} Ping",
                worker_passed,
                worker['ip']
            )
            if not worker_passed:
                all_passed = False
                self.issues.append(f"无法 ping 工作节点 {worker['name']} ({worker['ip']})")
        
        return all_passed
    
    def test_ssh_connectivity(self) -> bool:
        """测试 SSH 连接"""
        self.print_header("SSH 连接测试")
        all_passed = True
        
        for worker in self.workers:
            ssh_addr = f"{worker['user']}@{worker['ip']}"
            logger.info(f"测试 SSH 连接到 {ssh_addr}...")
            
            try:
                result = subprocess.run(
                    ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
                     ssh_addr, "echo 'SSH OK'"],
                    capture_output=True,
                    timeout=10
                )
                passed = result.returncode == 0
                self.print_result(
                    f"SSH {worker['name']}",
                    passed,
                    ssh_addr
                )
                if not passed:
                    all_passed = False
                    self.issues.append(f"SSH 连接失败: {ssh_addr}")
            
            except Exception as e:
                self.print_result(f"SSH {worker['name']}", False, str(e))
                all_passed = False
                self.issues.append(f"SSH 连接异常: {ssh_addr} - {e}")
        
        return all_passed
    
    def ping_host(self, host: str, timeout: int = 5) -> bool:
        """Ping 主机"""
        try:
            result = subprocess.run(
                ["ping", "-c", "1", "-W", str(timeout), host],
                capture_output=True,
                timeout=timeout + 1
            )
            return result.returncode == 0
        except:
            return False
    
    def test_ray_services(self) -> bool:
        """测试 Ray 服务"""
        self.print_header("Ray 服务测试")
        all_passed = True
        
        # 测试 Redis 端口
        logger.info(f"测试 Ray Redis {self.head_address}:{self.head_port}...")
        redis_passed = self.check_tcp_port(self.head_address, self.head_port)
        self.print_result(
            "Ray Redis Port",
            redis_passed,
            f"{self.head_address}:{self.head_port}"
        )
        if not redis_passed:
            all_passed = False
            self.issues.append(f"Ray Redis 不可达: {self.head_address}:{self.head_port}")
        
        # 测试 Dashboard 端口
        logger.info(f"测试 Dashboard {self.head_address}:{self.dashboard_port}...")
        dashboard_passed = self.check_tcp_port(self.head_address, self.dashboard_port)
        self.print_result(
            "Ray Dashboard Port",
            dashboard_passed,
            f"http://{self.head_address}:{self.dashboard_port}"
        )
        if not dashboard_passed:
            all_passed = False
            self.issues.append(f"Ray Dashboard 不可达: {self.head_address}:{self.dashboard_port}")
        
        return all_passed
    
    def check_tcp_port(self, host: str, port: int) -> bool:
        """检查 TCP 端口"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except:
            return False
    
    def test_ray_cluster_status(self) -> bool:
        """测试 Ray 集群状态"""
        self.print_header("Ray 集群状态")
        
        try:
            import ray
            
            # 连接到集群
            try:
                ray.init(
                    address=f"ray://{self.head_address}:{self.head_port}",
                    ignore_reinit_error=True
                )
            except:
                ray.init(address="auto", ignore_reinit_error=True)
            
            time.sleep(2)
            
            resources = ray.cluster_resources()
            available = ray.available_resources()
            nodes = ray.nodes()
            
            # 检查资源
            if resources:
                self.print_result("Cluster Connection", True, "集群已连接")
            else:
                self.print_result("Cluster Connection", False, "集群无资源")
                return False
            
            # 检查节点数
            node_count = len(nodes)
            expected_nodes = 4  # 1 head + 3 workers
            nodes_ok = node_count >= 3  # 至少有 1 head + 2 workers
            self.print_result(
                "Active Nodes",
                nodes_ok,
                f"{node_count} 个节点 (期望: {expected_nodes} 个)"
            )
            
            if not nodes_ok:
                self.issues.append(f"活跃节点不足: {node_count}/{expected_nodes}")
            
            # 检查 CPU 资源
            total_cpus = int(resources.get('CPU', 0))
            expected_cpus = 48  # 4 nodes * 12 cpus
            cpus_ok = total_cpus >= 36  # 至少 3 * 12
            self.print_result(
                "CPU Resources",
                cpus_ok,
                f"总共 {total_cpus} 个 CPU (期望: {expected_cpus} 个)"
            )
            
            if not cpus_ok:
                self.issues.append(f"CPU 资源不足: {total_cpus}/{expected_cpus}")
            
            # 检查 GPU 资源 (如果有)
            total_gpus = int(resources.get('GPU', 0))
            if total_gpus > 0:
                gpus_ok = total_gpus >= 2
                self.print_result(
                    "GPU Resources",
                    gpus_ok,
                    f"总共 {total_gpus} 个 GPU"
                )
            
            # 打印详细信息
            print(f"\n{colored('详细资源信息:', Colors.BLUE)}")
            for resource, count in sorted(resources.items()):
                print(f"  {resource}: {count}")
            
            ray.shutdown()
            return nodes_ok and cpus_ok
        
        except Exception as e:
            self.print_result("Cluster Connection", False, str(e))
            self.issues.append(f"集群诊断失败: {e}")
            return False
    
    def test_worker_installations(self) -> bool:
        """测试工作节点 Ray 安装"""
        self.print_header("工作节点 Ray 安装检查")
        all_passed = True
        
        for worker in self.workers:
            ssh_addr = f"{worker['user']}@{worker['ip']}"
            logger.info(f"检查 {worker['name']} 上的 Ray 安装...")
            
            try:
                check_cmd = 'python3 -c "import ray; print(ray.__version__)"'
                result = subprocess.run(
                    ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
                     ssh_addr, check_cmd],
                    capture_output=True,
                    timeout=10,
                    text=True
                )
                
                if result.returncode == 0:
                    version = result.stdout.strip()
                    self.print_result(
                        f"Ray Installation {worker['name']}",
                        True,
                        f"Ray {version}"
                    )
                else:
                    self.print_result(
                        f"Ray Installation {worker['name']}",
                        False,
                        "Ray 未安装"
                    )
                    all_passed = False
                    self.issues.append(f"{worker['name']} 上未安装 Ray")
            
            except Exception as e:
                self.print_result(
                    f"Ray Installation {worker['name']}",
                    False,
                    str(e)
                )
                all_passed = False
                self.issues.append(f"检查 {worker['name']} Ray 安装时出错: {e}")
        
        return all_passed
    
    def test_worker_ray_processes(self) -> bool:
        """测试工作节点 Ray 进程"""
        self.print_header("工作节点 Ray 进程检查")
        all_passed = True
        
        for worker in self.workers:
            ssh_addr = f"{worker['user']}@{worker['ip']}"
            logger.info(f"检查 {worker['name']} 上的 Ray 进程...")
            
            try:
                check_cmd = 'ps aux | grep -E "ray|raylet" | grep -v grep | wc -l'
                result = subprocess.run(
                    ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
                     ssh_addr, check_cmd],
                    capture_output=True,
                    timeout=10,
                    text=True
                )
                
                if result.returncode == 0:
                    process_count = int(result.stdout.strip() or "0")
                    processes_ok = process_count > 0
                    self.print_result(
                        f"Ray Process {worker['name']}",
                        processes_ok,
                        f"检测到 {process_count} 个 Ray 进程"
                    )
                    
                    if not processes_ok:
                        self.issues.append(f"{worker['name']} 上没有运行 Ray 进程")
                        all_passed = False
                else:
                    self.print_result(
                        f"Ray Process {worker['name']}",
                        False,
                        "检查失败"
                    )
                    all_passed = False
            
            except Exception as e:
                self.print_result(
                    f"Ray Process {worker['name']}",
                    False,
                    str(e)
                )
                all_passed = False
        
        return all_passed
    
    def test_cluster_task(self) -> bool:
        """测试集群任务执行"""
        self.print_header("集群任务执行测试")
        
        try:
            import ray
            
            try:
                ray.init(
                    address=f"ray://{self.head_address}:{self.head_port}",
                    ignore_reinit_error=True
                )
            except:
                ray.init(address="auto", ignore_reinit_error=True)
            
            time.sleep(2)
            
            @ray.remote
            def simple_task(x):
                return x * 2
            
            # 执行任务
            result = ray.get(simple_task.remote(21))
            task_ok = result == 42
            
            self.print_result("Task Execution", task_ok, f"结果: {result}")
            
            if not task_ok:
                self.issues.append("集群任务执行失败")
            
            ray.shutdown()
            return task_ok
        
        except Exception as e:
            self.print_result("Task Execution", False, str(e))
            self.issues.append(f"任务执行异常: {e}")
            return False
    
    def print_summary(self) -> None:
        """打印诊断总结"""
        self.print_header("诊断总结")
        
        if self.issues:
            print(f"\n{colored('发现的问题:', Colors.RED)}\n")
            for i, issue in enumerate(self.issues, 1):
                print(f"  {i}. {issue}")
            
            print(f"\n{colored('建议的解决步骤:', Colors.YELLOW)}\n")
            
            if any("无法 ping" in issue for issue in self.issues):
                print("  1. 检查网络连接和防火墙设置")
                print("     - 检查所有机器是否在同一网络")
                print("     - 检查防火墙是否阻止了连接")
                print("     - 使用 ping 测试网络连接")
            
            if any("SSH" in issue for issue in self.issues):
                print("  2. 检查 SSH 连接")
                print("     - 验证 SSH 服务是否运行")
                print("     - 检查 SSH 认证")
                print("     - 增加 SSH 连接超时")
            
            if any("Ray" in issue for issue in self.issues):
                print("  3. 安装或修复 Ray")
                print("     - 重新安装 Ray: pip3 install --upgrade ray")
                print("     - 检查 Python 版本 (需要 Python 3.7+)")
                print("     - 查看 Ray 日志了解详细信息")
            
            if any("进程" in issue for issue in self.issues):
                print("  4. 重启 Ray 服务")
                print("     - ray stop --force")
                print("     - ray start --address=10.30.2.11:6379")
        else:
            print(f"\n{colored('✓ 所有检查都通过了!', Colors.GREEN)}\n")
            print("集群健康状态良好，可以正常使用。")
        
        print(f"\n{colored('更多帮助:', Colors.BLUE)}")
        print("  - Ray Dashboard: http://10.30.2.11:8265")
        print("  - 查看日志: tail -f /tmp/ray/session_latest/logs/monitor.log")
        print("  - Ray 文档: https://docs.ray.io/")
    
    def run_all_diagnostics(self) -> bool:
        """运行所有诊断"""
        logger.info("开始 Ray 集群诊断...")
        
        results = []
        
        # 网络连接
        results.append(("网络连接", self.test_network_connectivity()))
        
        # SSH 连接
        results.append(("SSH 连接", self.test_ssh_connectivity()))
        
        # Ray 服务
        results.append(("Ray 服务", self.test_ray_services()))
        
        # 工作节点安装
        results.append(("工作节点安装", self.test_worker_installations()))
        
        # 工作节点进程
        results.append(("工作节点进程", self.test_worker_ray_processes()))
        
        # 集群状态
        results.append(("集群状态", self.test_ray_cluster_status()))
        
        # 集群任务
        results.append(("集群任务", self.test_cluster_task()))
        
        # 打印诊断总结
        self.print_summary()
        
        # 返回整体结果
        all_passed = all(result[1] for result in results)
        return all_passed


def main():
    """主函数"""
    print(colored("\n" + "=" * 60, Colors.BLUE))
    print(colored("Ray 集群诊断和故障排查工具", Colors.BLUE))
    print(colored("=" * 60 + "\n", Colors.BLUE))
    
    diagnostics = RayClusterDiagnostics()
    success = diagnostics.run_all_diagnostics()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
