"""Ray 集群发现与连接（简化版，适用于迁移包）。

这个模块在迁移到 `droneOnCampus.services.castray` 时被精简以保持可用性和独立性。
它提供两个导出：`discover_and_connect_external_clusters()` 和 `cluster_connector`。
"""

from typing import Dict, List, Optional, Any
import logging
from pathlib import Path
import subprocess
import socket
import json

logger = logging.getLogger(__name__)

try:
    import ray
except Exception:
    ray = None


class RayClusterDiscovery:
    """简化的本地 Ray 集群发现器，使用多种 heuristics 搜索本地集群。"""

    def scan_local_ray_clusters(self) -> List[Dict[str, Any]]:
        clusters: List[Dict[str, Any]] = []
        # 尝试通过 `ray status`（如果可用）解析
        try:
            result = subprocess.run(["ray", "status"], capture_output=True, text=True, timeout=5)
            if result.returncode == 0 and result.stdout:
                clusters.append({"source": "ray_status", "summary": result.stdout})
        except Exception:
            pass

        # 扫描常见 dashboard 端口
        for port in (8265, 8266, 8267):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.5)
                if sock.connect_ex(("127.0.0.1", port)) == 0:
                    clusters.append({"source": "dashboard_scan", "dashboard_url": f"http://127.0.0.1:{port}", "dashboard_port": port})
                sock.close()
            except Exception:
                pass

        # 检查临时目录作为备选
        for d in (Path.cwd() / "ray_temp", Path("/tmp") / "ray"):
            if d.exists():
                clusters.append({"source": "temp_dir", "path": str(d)})

        return clusters


class RayClusterConnector:
    """简化的外部集群连接器，保持 minimal API。"""

    def __init__(self):
        self.connected_cluster: Optional[Dict[str, Any]] = None
        self.external_nodes: Dict[str, Dict[str, Any]] = {}

    def connect_to_external_cluster(self, cluster_info: Dict[str, Any]) -> bool:
        """尝试连接到指定集群（最佳努力）。

        返回 True/False 并在成功时填充 `external_nodes`。
        """
        if ray is None:
            logger.warning("ray not available in this environment; cannot connect to external cluster")
            return False

        try:
            # 最简单尝试：如果提供 dashboard_url，尝试 ray.init(address='auto')
            ray.init(address="auto", ignore_reinit_error=True)
            # 填充一些占位外部节点信息
            nodes = ray.nodes() if hasattr(ray, "nodes") else []
            for i, n in enumerate(nodes):
                self.external_nodes[f"external_{i}"] = {"is_ray_node": True, "info": n}

            self.connected_cluster = cluster_info
            return True
        except Exception as e:
            logger.debug(f"connect_to_external_cluster failed: {e}")
            try:
                if ray and ray.is_initialized():
                    ray.shutdown()
            except Exception:
                pass
            return False

    def get_external_nodes(self) -> Dict[str, Dict[str, Any]]:
        return self.external_nodes.copy()

    def is_connected_to_external_cluster(self) -> bool:
        return self.connected_cluster is not None


# module-level helpers
_discovery = RayClusterDiscovery()
cluster_connector = RayClusterConnector()


def discover_and_connect_external_clusters() -> Dict[str, Any]:
    """发现并尝试连接到本地可见的 Ray 集群（简单、最佳努力）。"""
    result = {"discovered_clusters": [], "external_nodes": {}, "success": False, "error": None}
    try:
        clusters = _discovery.scan_local_ray_clusters()
        result["discovered_clusters"] = clusters
        if clusters:
            target = clusters[0]
            ok = cluster_connector.connect_to_external_cluster(target)
            result["success"] = ok
            if ok:
                result["external_nodes"] = cluster_connector.get_external_nodes()
        return result
    except Exception as e:
        result["error"] = str(e)
        return result
        
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

