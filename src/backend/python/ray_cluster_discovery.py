#!/usr/bin/env python3
"""
Ray集群发现和连接模块
用于发现和连接由其他进程创建的Ray集群
"""

import ray
import time
import json
import logging
import subprocess
import socket
from typing import Dict, List, Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)

class RayClusterDiscovery:
    """Ray集群发现器"""
    
    def __init__(self):
        self.discovered_clusters = {}
        self.current_cluster_info = None
        
    def scan_local_ray_clusters(self) -> List[Dict]:
        """扫描本地运行的Ray集群"""
        clusters = []
        
        try:
            # 方法1: 通过ray status命令发现
            result = subprocess.run(
                ['ray', 'status'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode == 0:
                output = result.stdout
                logger.info("发现Ray状态输出:")
                logger.info(output)
                
                # 解析ray status输出
                cluster_info = self._parse_ray_status(output)
                if cluster_info:
                    clusters.append(cluster_info)
                    
        except subprocess.TimeoutExpired:
            logger.warning("ray status命令超时")
        except FileNotFoundError:
            logger.info("ray命令不在PATH中，尝试其他方法")
        except Exception as e:
            logger.warning(f"扫描Ray集群失败: {e}")
        
        # 方法2: 通过端口扫描发现Ray Dashboard
        dashboard_clusters = self._scan_ray_dashboards()
        clusters.extend(dashboard_clusters)
        
        # 方法3: 检查已知的临时目录
        temp_clusters = self._scan_ray_temp_dirs()
        clusters.extend(temp_clusters)
        
        return clusters
    
    def _parse_ray_status(self, status_output: str) -> Optional[Dict]:
        """解析ray status命令输出"""
        try:
            cluster_info = {
                'source': 'ray_status',
                'nodes': 0,
                'resources': {},
                'address': None,
                'dashboard_url': None
            }
            
            lines = status_output.split('\n')
            for line in lines:
                line = line.strip()
                
                # 查找节点信息
                if 'node' in line.lower() and 'alive' in line.lower():
                    cluster_info['nodes'] += 1
                
                # 查找资源信息
                if 'cpu' in line.lower():
                    # 尝试提取CPU信息
                    if ':' in line:
                        try:
                            cpu_count = float(line.split(':')[1].strip().split()[0])
                            cluster_info['resources']['CPU'] = cpu_count
                        except:
                            pass
                
                # 查找Dashboard URL
                if 'dashboard' in line.lower() and 'http' in line.lower():
                    import re
                    url_match = re.search(r'(http://[^\s]+)', line)
                    if url_match:
                        cluster_info['dashboard_url'] = url_match.group(1)
            
            return cluster_info if cluster_info['nodes'] > 0 else None
            
        except Exception as e:
            logger.error(f"解析ray status输出失败: {e}")
            return None
    
    def _scan_ray_dashboards(self) -> List[Dict]:
        """通过端口扫描发现Ray Dashboard"""
        clusters = []
        common_dashboard_ports = [8265, 8266, 8267, 8268, 8269]
        
        for port in common_dashboard_ports:
            try:
                # 检查端口是否开放
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex(('127.0.0.1', port))
                sock.close()
                
                if result == 0:
                    # 端口开放，尝试访问Dashboard API
                    import requests
                    
                    try:
                        response = requests.get(
                            f'http://127.0.0.1:{port}/api/cluster_status',
                            timeout=3
                        )
                        
                        if response.status_code == 200:
                            data = response.json()
                            
                            cluster_info = {
                                'source': 'dashboard_scan',
                                'dashboard_url': f'http://127.0.0.1:{port}',
                                'dashboard_port': port,
                                'nodes': len(data.get('nodes', [])),
                                'resources': data.get('cluster_resources', {}),
                                'status': 'active'
                            }
                            
                            clusters.append(cluster_info)
                            logger.info(f"发现Ray Dashboard: http://127.0.0.1:{port}")
                            
                    except requests.RequestException:
                        # 端口开放但不是Ray Dashboard
                        pass
                        
            except Exception as e:
                logger.debug(f"扫描端口 {port} 失败: {e}")
        
        return clusters
    
    def _scan_ray_temp_dirs(self) -> List[Dict]:
        """扫描Ray临时目录寻找集群信息"""
        clusters = []
        
        # 常见的Ray临时目录位置
        temp_dirs = [
            Path.home() / "ray_tmp",
            Path("/tmp") / "ray",
            Path.cwd() / "ray_temp",
            Path.cwd() / "ray_tmp"
        ]
        
        for temp_dir in temp_dirs:
            if temp_dir.exists():
                try:
                    # 查找session目录
                    for session_dir in temp_dir.iterdir():
                        if session_dir.is_dir() and session_dir.name.startswith('session_'):
                            cluster_info = self._analyze_ray_session(session_dir)
                            if cluster_info:
                                clusters.append(cluster_info)
                                
                except Exception as e:
                    logger.debug(f"扫描Ray临时目录 {temp_dir} 失败: {e}")
        
        return clusters
    
    def _analyze_ray_session(self, session_dir: Path) -> Optional[Dict]:
        """分析Ray会话目录"""
        try:
            # 查找logs目录
            logs_dir = session_dir / "logs"
            if not logs_dir.exists():
                return None
            
            cluster_info = {
                'source': 'temp_dir',
                'session_dir': str(session_dir),
                'session_id': session_dir.name,
                'logs_dir': str(logs_dir),
                'status': 'unknown'
            }
            
            # 检查是否有活跃的进程
            if self._check_ray_processes_active(session_dir):
                cluster_info['status'] = 'active'
            else:
                cluster_info['status'] = 'inactive'
            
            return cluster_info
            
        except Exception as e:
            logger.debug(f"分析Ray会话目录 {session_dir} 失败: {e}")
            return None
    
    def _check_ray_processes_active(self, session_dir: Path) -> bool:
        """检查Ray进程是否活跃"""
        try:
            # 在Windows上检查ray相关进程
            import psutil
            
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    if proc.info['name'] and 'ray' in proc.info['name'].lower():
                        if proc.info['cmdline']:
                            cmdline = ' '.join(proc.info['cmdline'])
                            if str(session_dir) in cmdline:
                                return True
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                    
            return False
            
        except ImportError:
            # 如果没有psutil，使用简单的检查
            return session_dir.exists()
        except Exception as e:
            logger.debug(f"检查Ray进程状态失败: {e}")
            return False

class RayClusterConnector:
    """Ray集群连接器"""
    
    def __init__(self):
        self.connected_cluster = None
        self.external_nodes = {}
        
    def connect_to_external_cluster(self, cluster_info: Dict) -> bool:
        """连接到外部Ray集群"""
        try:
            logger.info(f"尝试连接到外部Ray集群: {cluster_info}")
            
            # 如果已经连接到Ray，先断开
            if ray.is_initialized():
                ray.shutdown()
            
            # 尝试不同的连接方式
            success = False
            
            # 方法1: 如果有Dashboard URL，尝试推断GCS地址
            if cluster_info.get('dashboard_url'):
                dashboard_port = cluster_info.get('dashboard_port', 8265)
                # Ray GCS通常在Dashboard端口-1或者特定端口
                possible_gcs_ports = [10001, 6379, dashboard_port - 1]
                
                for gcs_port in possible_gcs_ports:
                    try:
                        ray.init(
                            address=f"ray://127.0.0.1:{gcs_port}",
                            ignore_reinit_error=True,
                            log_to_driver=False
                        )
                        
                        # 测试连接
                        ray.cluster_resources()
                        success = True
                        logger.info(f"成功连接到Ray集群 (端口 {gcs_port})")
                        break
                        
                    except Exception as e:
                        logger.debug(f"连接端口 {gcs_port} 失败: {e}")
                        if ray.is_initialized():
                            ray.shutdown()
            
            # 方法2: 尝试自动发现
            if not success:
                try:
                    ray.init(address='auto', ignore_reinit_error=True, log_to_driver=False)
                    ray.cluster_resources()
                    success = True
                    logger.info("通过auto模式成功连接到Ray集群")
                    
                except Exception as e:
                    logger.debug(f"auto模式连接失败: {e}")
                    if ray.is_initialized():
                        ray.shutdown()
            
            if success:
                self.connected_cluster = cluster_info
                self._discover_cluster_nodes()
                return True
            else:
                logger.warning("无法连接到外部Ray集群")
                return False
                
        except Exception as e:
            logger.error(f"连接外部Ray集群失败: {e}")
            return False
    
    def _discover_cluster_nodes(self):
        """发现集群中的节点"""
        try:
            if not ray.is_initialized():
                return
            
            # 获取集群信息
            cluster_resources = ray.cluster_resources()
            available_resources = ray.available_resources()
            nodes = ray.nodes()
            
            logger.info(f"发现Ray集群: {len(nodes)} 个节点")
            logger.info(f"集群资源: {cluster_resources}")
            
            # 为每个物理节点创建虚拟传输节点
            self.external_nodes = {}
            
            for i, node in enumerate(nodes):
                if node.get('Alive', False):
                    node_id = f"external_ray_node_{i+1}"
                    
                    self.external_nodes[node_id] = {
                        'ray_node_id': node.get('NodeID', ''),
                        'node_id': node_id,
                        'resources': node.get('Resources', {}),
                        'alive': node.get('Alive', False),
                        'is_external': True,
                        'is_ray_node': True,
                        'source': 'external_cluster',
                        'node_ip': node.get('NodeManagerAddress', ''),
                        'node_port': node.get('NodeManagerPort', 0)
                    }
                    
                    logger.info(f"映射外部Ray节点: {node_id}")
            
            # 尝试发现现有Actor
            self._discover_cluster_actors()
            
        except Exception as e:
            logger.error(f"发现集群节点失败: {e}")
    
    def _discover_cluster_actors(self):
        """发现集群中的Actor"""
        try:
            import ray.util.state as state
            actors = state.list_actors()
            
            logger.info(f"发现 {len(actors)} 个Actor")
            
            for i, actor in enumerate(actors):
                try:
                    # 安全地访问actor属性
                    state_val = getattr(actor, 'state', 'UNKNOWN')
                    name_val = getattr(actor, 'name', f'external_actor_{i}')
                    class_name_val = getattr(actor, 'class_name', 'unknown')
                    
                    if state_val == 'ALIVE' and name_val:
                        # 检查是否为传输相关的Actor
                        if any(keyword in str(class_name_val) for keyword in ['Node', 'Worker', 'Demo']):
                            
                            actor_node_id = f"external_actor_{name_val}"
                            
                            self.external_nodes[actor_node_id] = {
                                'actor_id': getattr(actor, 'actor_id', ''),
                                'node_id': actor_node_id,
                                'name': name_val,
                                'class_name': class_name_val,
                                'state': state_val,
                                'is_external': True,
                                'is_ray_node': False,
                                'is_actor': True,
                                'source': 'external_cluster'
                            }
                            
                            logger.info(f"发现外部Actor: {actor_node_id} ({class_name_val})")
                            
                except Exception as actor_error:
                    logger.debug(f"处理Actor {i} 时出错: {actor_error}")
                    continue
                    
        except Exception as e:
            logger.warning(f"发现集群Actor失败: {e}")
    
    def get_external_nodes(self) -> Dict[str, Dict]:
        """获取外部节点信息"""
        return self.external_nodes.copy()
    
    def is_connected_to_external_cluster(self) -> bool:
        """检查是否已连接到外部集群"""
        return self.connected_cluster is not None and ray.is_initialized()

# 全局实例
cluster_discovery = RayClusterDiscovery()
cluster_connector = RayClusterConnector()

def discover_and_connect_external_clusters() -> Dict[str, Any]:
    """发现并连接外部Ray集群"""
    result = {
        'discovered_clusters': [],
        'connected_cluster': None,
        'external_nodes': {},
        'success': False,
        'error': None
    }
    
    try:
        # 1. 发现本地Ray集群
        logger.info("🔍 开始扫描本地Ray集群...")
        clusters = cluster_discovery.scan_local_ray_clusters()
        result['discovered_clusters'] = clusters
        
        logger.info(f"发现 {len(clusters)} 个Ray集群")
        
        # 2. 尝试连接到最合适的集群
        if clusters:
            # 优先选择active状态的集群
            active_clusters = [c for c in clusters if c.get('status') == 'active']
            target_cluster = active_clusters[0] if active_clusters else clusters[0]
            
            logger.info(f"尝试连接到集群: {target_cluster}")
            
            if cluster_connector.connect_to_external_cluster(target_cluster):
                result['connected_cluster'] = target_cluster
                result['external_nodes'] = cluster_connector.get_external_nodes()
                result['success'] = True
                logger.info("✅ 成功连接到外部Ray集群")
            else:
                result['error'] = "无法连接到发现的Ray集群"
                logger.warning("⚠️ 无法连接到发现的Ray集群")
        else:
            result['error'] = "未发现任何Ray集群"
            logger.info("ℹ️ 未发现任何外部Ray集群")
        
        return result
        
    except Exception as e:
        result['error'] = str(e)
        logger.error(f"❌ 发现和连接外部集群失败: {e}")
        return result
