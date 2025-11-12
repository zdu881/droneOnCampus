import ray
import asyncio
import socket
import threading
import time
import json
import uuid
import os
import platform
from pathlib import Path
from typing import Dict, List, Optional, Set, Any
from .models import CastMessage, CastType, MessageType, CastResponse, NodeStatus
from .file_transfer import FileTransferManager, FileTransferMessage, FileTransferProtocol
import logging

# 导入集群发现模块（使用相对导入以便本包化）
try:
    from .ray_cluster_discovery import discover_and_connect_external_clusters, cluster_connector
except ImportError:
    # 如果导入失败，提供空的替代函数
    def discover_and_connect_external_clusters():
        return {'discovered_clusters': [], 'external_nodes': {}, 'success': False}
    
    class DummyConnector:
        def get_external_nodes(self):
            return {}
        def is_connected_to_external_cluster(self):
            return False
    
    cluster_connector = DummyConnector()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_MAX_CONNECTION_HISTORY = 30

def _classify_ray_error(err: Exception) -> str:
    """根据异常信息粗略分类错误类型，便于日志过滤与跨集群排障。
    分类标签：network | runtime_env | timeout | auth | interrupt | unknown
    """
    msg = str(err) or ''
    lower = msg.lower()
    if 'connection refused' in lower or 'cannot connect' in lower or 'timeout' in lower or 'timed out' in lower or 'unreachable' in lower:
        return 'network'
    if 'runtime_env' in lower or 'working_dir' in lower or 'packaging' in lower or 'hash_directory' in lower:
        return 'runtime_env'
    if 'auth' in lower or 'permission' in lower or 'denied' in lower:
        return 'auth'
    if isinstance(err, KeyboardInterrupt):
        return 'interrupt'
    if 'cancelled' in lower:
        return 'timeout'
    return 'unknown'

def connect_to_ray_cluster(ray_address: Optional[str] = None, namespace: str = "castray", allow_local_fallback: bool = True):
    """连接到已有的Ray集群或启动新集群。
    记录耗时与错误分类，写入全局 cluster 连接历史（若 cluster 已创建）。
    """
    start_ts = time.time()
    attempt_meta = {
        'ray_address': ray_address,
        'namespace': namespace,
        'allow_local_fallback': allow_local_fallback,
        'phase': 'start',
        'start_time': start_ts,
        'duration': None,
        'success': False,
        'error': None,
        'error_class': None,
    }
    try:
        # 如果Ray已经初始化，先关闭
        if ray.is_initialized():
            ray.shutdown()
        
        # 获取Ray集群地址
        if ray_address is None:
            ray_address = os.environ.get('RAY_ADDRESS', 'local')
        
        # 配置运行时环境：
        # - 对于外部集群连接，不设置 working_dir，避免大目录打包/上传导致超时
        # - 本地/auto 模式可以保留 working_dir，便于在同机环境下加载本地代码
        runtime_env: Dict[str, Any] = {}
        if platform.system() == "Linux":
            if ray_address in ['auto', 'local', None]:
                runtime_env = {
                    "working_dir": os.getcwd(),
                    "env_vars": {
                        "PYTHONPATH": os.getcwd(),
                        "RAY_DISABLE_IMPORT_WARNING": "1"
                    }
                }
            else:
                # 外部地址：仅传入必要 env，避免触发 working_dir 打包
                runtime_env = {
                    "env_vars": {
                        "RAY_DISABLE_IMPORT_WARNING": "1"
                    }
                }
        
        # 简化初始化逻辑，强制使用本地模式避免连接问题
        if ray_address in ['auto', 'local', None]:
            # 启动本地集群
            logger.info("启动本地Ray集群...")
            cpu_count = os.cpu_count() or 2
            num_cpus = max(1, cpu_count // 2)  # 使用一半CPU核心
            
            ray.init(
                namespace=namespace, 
                runtime_env=runtime_env,
                ignore_reinit_error=True,
                dashboard_host='127.0.0.1',  # 改为本地地址
                dashboard_port=8265,
                object_store_memory=100*1024*1024,  # 100MB
                num_cpus=num_cpus,
                _temp_dir=os.path.join(os.getcwd(), "ray_temp")  # 指定临时目录
            )
            logger.info("成功启动本地Ray集群")
            logger.info(f"Ray Dashboard: http://127.0.0.1:8265")
            logger.info(f"Ray集群资源: {ray.cluster_resources()}")
            attempt_meta.update({'success': True, 'phase': 'local_start'})
            return True
        else:
            # 连接到指定地址 - 不提供硬件资源参数
            logger.info(f"尝试连接到指定Ray集群: {ray_address}")
            # 注意：runtime_env 不包含 working_dir，避免对大仓库进行打包
            ray.init(address=ray_address, namespace=namespace, runtime_env=runtime_env)
            logger.info(f"成功连接到Ray集群: {ray_address}")
            logger.info(f"Ray集群资源: {ray.cluster_resources()}")
            attempt_meta.update({'success': True, 'phase': 'external_connect'})
            return True
        
    except Exception as e:
        logger.error(f"Ray集群初始化失败: {e}")
        attempt_meta.update({'error': str(e), 'error_class': _classify_ray_error(e)})
        # 最后的后备方案：仅在允许时尝试最简单的本地初始化
        if not allow_local_fallback:
            logger.info("已禁用本地回退初始化（allow_local_fallback=False）")
            attempt_meta['phase'] = 'external_failed_no_fallback'
            attempt_meta['success'] = False
            attempt_meta['duration'] = time.time() - start_ts
            try:
                from .ray_casting import cluster as _cluster_ref  # circular safe: already in module
                if hasattr(_cluster_ref, 'connection_history'):
                    _cluster_ref.connection_history.append(attempt_meta)
                    if len(_cluster_ref.connection_history) > _MAX_CONNECTION_HISTORY:
                        _cluster_ref.connection_history.pop(0)
            except Exception:
                pass
            return False
        try:
            logger.info("尝试最简单的Ray本地初始化...")
            if ray.is_initialized():
                ray.shutdown()
            ray.init(ignore_reinit_error=True, log_to_driver=False)
            logger.info("使用简化模式成功启动Ray")
            attempt_meta.update({'success': True, 'phase': 'fallback_minimal'})
            return True
        except Exception as fallback_e:
            logger.error(f"最简化Ray初始化也失败: {fallback_e}")
            attempt_meta.update({'error': f"fallback:{fallback_e}", 'error_class': _classify_ray_error(fallback_e), 'phase': 'fallback_failed'})
            return False
    finally:
        attempt_meta['duration'] = time.time() - start_ts
        # 追加结构化日志（INFO 级别便于收集）
        try:
            logger.info(f"connect_attempt meta={json.dumps(attempt_meta, ensure_ascii=False)}")
        except Exception:
            logger.info(f"connect_attempt summary success={attempt_meta['success']} phase={attempt_meta['phase']} duration={attempt_meta['duration']:.3f}s class={attempt_meta.get('error_class')}")
        # 写入全局 cluster 历史（若存在）
        try:
            from .ray_casting import cluster as _cluster_ref  # already loaded
            if hasattr(_cluster_ref, 'connection_history'):
                _cluster_ref.connection_history.append(attempt_meta)
                if len(_cluster_ref.connection_history) > _MAX_CONNECTION_HISTORY:
                    _cluster_ref.connection_history.pop(0)
        except Exception:
            pass

@ray.remote
class CastingNode:
    """Ray远程类，处理单个节点的消息传输和文件传输"""
    
    def __init__(self, node_id: str, port: int = 0):
        self.node_id = node_id
        self.port = port
        self.is_running = False
        self.socket = None
        self.message_handlers = {}
        self.received_messages = []
        self.sent_messages = []
        
        # 文件传输管理器
        self.file_transfer_manager = FileTransferManager(f"downloads/{node_id}")
        self.file_msg_factory = FileTransferMessage()
        
        # 自动传输任务队列
        self.auto_transfer_queue = []
        self.auto_transfer_enabled = True
        
    async def start(self):
        """启动节点"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            if self.port == 0:
                self.socket.bind(('localhost', 0))
                self.port = self.socket.getsockname()[1]
            else:
                self.socket.bind(('localhost', self.port))
            
            self.socket.settimeout(0.1)
            self.is_running = True
            logger.info(f"节点 {self.node_id} 启动在端口 {self.port}")
            return True
        except Exception as e:
            logger.error(f"节点 {self.node_id} 启动失败: {e}")
            return False

    async def stop(self):
        """停止节点"""
        self.is_running = False
        if self.socket:
            self.socket.close()
        logger.info(f"节点 {self.node_id} 已停止")

    async def send_unicast(self, message: dict, target_ip: str, target_port: int):
        """发送单播消息"""
        try:
            if not self.socket:
                return {"success": False, "error": "Socket not initialized"}
            
            message_data = json.dumps(message).encode('utf-8')
            self.socket.sendto(message_data, (target_ip, target_port))
            
            self.sent_messages.append({
                "type": "unicast",
                "target": f"{target_ip}:{target_port}",
                "message": message,
                "timestamp": time.time()
            })
            
            return {"success": True, "target": f"{target_ip}:{target_port}"}
        except Exception as e:
            logger.error(f"单播发送失败: {e}")
            return {"success": False, "error": str(e)}

    async def send_multicast(self, message: dict, group_ip: str, group_port: int):
        """发送组播消息"""
        try:
            multicast_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            multicast_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # 设置TTL
            multicast_socket.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
            
            message_data = json.dumps(message).encode('utf-8')
            multicast_socket.sendto(message_data, (group_ip, group_port))
            multicast_socket.close()
            
            self.sent_messages.append({
                "type": "multicast", 
                "group": f"{group_ip}:{group_port}",
                "message": message,
                "timestamp": time.time()
            })
            
            return {"success": True, "group": f"{group_ip}:{group_port}"}
        except Exception as e:
            logger.error(f"组播发送失败: {e}")
            return {"success": False, "error": str(e)}

    async def send_broadcast(self, message: dict, broadcast_port: int):
        """发送广播消息"""
        try:
            broadcast_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            broadcast_socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            
            message_data = json.dumps(message).encode('utf-8')
            broadcast_socket.sendto(message_data, ('<broadcast>', broadcast_port))
            broadcast_socket.close()
            
            self.sent_messages.append({
                "type": "broadcast",
                "port": broadcast_port,
                "message": message,
                "timestamp": time.time()
            })
            
            return {"success": True, "broadcast_port": broadcast_port}
        except Exception as e:
            logger.error(f"广播发送失败: {e}")
            return {"success": False, "error": str(e)}

    async def listen_for_messages(self):
        """监听接收消息"""
        while self.is_running:
            try:
                if self.socket:
                    data, addr = self.socket.recvfrom(65536)  # 增大缓冲区以支持文件块
                    message = json.loads(data.decode('utf-8'))
                    
                    # 检查是否为文件传输消息
                    if message.get("type", "").startswith("file_"):
                        await self.handle_file_message(message, addr)
                    else:
                        # 普通消息
                        self.received_messages.append({
                            "from": f"{addr[0]}:{addr[1]}",
                            "message": message,
                            "timestamp": time.time()
                        })
                        
                        logger.info(f"节点 {self.node_id} 收到来自 {addr} 的消息: {message}")
                    
            except socket.timeout:
                # 处理自动传输队列
                if self.auto_transfer_enabled:
                    await self.process_auto_transfers()
                continue
            except Exception as e:
                if self.is_running:
                    logger.error(f"接收消息错误: {e}")
            
            await asyncio.sleep(0.01)

    async def initiate_file_transfer(self, file_path: str, recipients: List[str], 
                                   transfer_mode: str = "unicast"):
        """主动发起文件传输"""
        try:
            if not os.path.exists(file_path):
                logger.error(f"文件不存在: {file_path}")
                return {"success": False, "error": "文件不存在"}
            
            # 创建传输会话
            file_id = self.file_transfer_manager.initiate_file_transfer_sync(
                file_path, recipients, transfer_mode, self.node_id
            )
            
            # 发送传输请求
            request_msg = self.file_msg_factory.create_transfer_request(
                file_path, file_id, self.node_id, recipients, transfer_mode
            )
            
            # 根据传输模式发送请求
            success_count = 0
            failed_recipients = []
            
            if transfer_mode == "unicast":
                # 单播到每个接收者
                for recipient in recipients:
                    success = await self._send_message_to_recipient(request_msg, recipient)
                    if success:
                        success_count += 1
                    else:
                        failed_recipients.append(recipient)
            elif transfer_mode == "broadcast":
                # 广播
                success = await self._send_broadcast_message(request_msg)
                if success:
                    success_count = len(recipients)
                else:
                    failed_recipients = recipients.copy()
            
            # 如果有失败的接收者，更新统计
            if failed_recipients:
                self.file_transfer_manager.mark_transfer_failed(file_id, failed_recipients)
            
            logger.info(f"节点 {self.node_id} 发起文件传输: {file_path} -> {recipients}, 成功: {success_count}, 失败: {len(failed_recipients)}")
            
            return {
                "success": success_count > 0,
                "file_id": file_id,
                "recipients_notified": success_count,
                "failed_recipients": failed_recipients,
                "transfer_mode": transfer_mode,
                "message": f"成功通知 {success_count}/{len(recipients)} 个接收者"
            }
            
        except Exception as e:
            logger.error(f"发起文件传输失败: {e}")
            return {"success": False, "error": str(e)}
    
    async def _send_message_to_recipient(self, message: dict, recipient_id: str):
        """向特定接收者发送消息"""
        try:
            # 尝试从Ray shared state获取节点端口映射
            try:
                # 尝试获取集群管理器的端口映射
                cluster_manager = ray.get_actor("cluster_manager")
                node_ports = await cluster_manager.get_node_ports.remote()
                
                if recipient_id in node_ports:
                    recipient_port = node_ports[recipient_id]
                    message_data = json.dumps(message).encode('utf-8')
                    if self.socket:
                        self.socket.sendto(message_data, ('localhost', recipient_port))
                        logger.debug(f"发送消息到 {recipient_id} (端口: {recipient_port})")
                    return True
                else:
                    logger.warning(f"端口映射中未找到接收者: {recipient_id}")
                    self.file_transfer_manager.transfer_stats["failed_transfers"] += 1
                    return False
                    
            except Exception as ray_error:
                logger.debug(f"无法从Ray获取端口映射: {ray_error}")
                # 回退：直接尝试从其他节点获取端口
                if recipient_id in self.get_known_node_ports():
                    recipient_port = self.get_known_node_ports()[recipient_id]
                    message_data = json.dumps(message).encode('utf-8')
                    if self.socket:
                        self.socket.sendto(message_data, ('localhost', recipient_port))
                        logger.debug(f"发送消息到 {recipient_id} (端口: {recipient_port}) [回退模式]")
                    return True
                else:
                    logger.warning(f"未找到接收者地址: {recipient_id}")
                    self.file_transfer_manager.transfer_stats["failed_transfers"] += 1
                    return False
                    
        except Exception as e:
            logger.error(f"发送消息到 {recipient_id} 失败: {e}")
            self.file_transfer_manager.transfer_stats["failed_transfers"] += 1
            return False

    def get_known_node_ports(self):
        """获取已知的节点端口（硬编码作为回退）"""
        # 这是一个回退机制，在无法从Ray获取动态端口时使用
        return {}

    async def _send_broadcast_message(self, message: dict):
        """发送广播消息"""
        try:
            broadcast_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            broadcast_socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            
            message_data = json.dumps(message).encode('utf-8')
            broadcast_socket.sendto(message_data, ('<broadcast>', 9998))
            broadcast_socket.close()
            
            return True
        except Exception as e:
            logger.error(f"广播消息失败: {e}")
            return False

    async def handle_file_message(self, message: dict, sender_addr):
        """处理文件传输相关消息"""
        try:
            msg_type = message.get("type", "")
            
            if msg_type == "file_transfer_request":
                # 处理文件传输请求
                response = self.file_transfer_manager.handle_transfer_request(message, auto_accept=True)
                await self._send_response_to_sender(response, sender_addr)
                
                logger.info(f"节点 {self.node_id} 接收文件传输请求: {message['file_info']['file_name']}")
                
            elif msg_type == "file_chunk":
                # 处理文件块
                ack = self.file_transfer_manager.handle_chunk_message(message)
                await self._send_response_to_sender(ack, sender_addr)
                
                # 检查是否接收完所有块
                file_id = message["file_id"]
                chunks = self.file_transfer_manager.received_chunks.get(file_id, [])
                expected_chunks = message["chunk"].get("total_chunks", 0)
                
                if len(chunks) == expected_chunks:
                    # 完成文件传输
                    file_info = {"file_name": f"received_file_{file_id}", "file_hash": ""}
                    complete_response = self.file_transfer_manager.complete_file_transfer(file_id, file_info)
                    await self._send_response_to_sender(complete_response, sender_addr)
                    
            elif msg_type in ["file_transfer_accept", "file_transfer_reject"]:
                # 处理传输响应
                file_id = message["file_id"]
                transfer = self.file_transfer_manager.get_transfer_status(file_id)
                
                if transfer and msg_type == "file_transfer_accept":
                    # 开始发送文件块
                    await self._start_sending_chunks(file_id, sender_addr)
                    
            elif msg_type == "file_chunk_ack":
                # 处理块确认
                logger.debug(f"收到块确认: {message}")
                
            elif msg_type == "file_transfer_complete":
                # 处理传输完成
                logger.info(f"文件传输完成: {message}")
                
        except Exception as e:
            logger.error(f"处理文件消息失败: {e}")
    
    async def _send_response_to_sender(self, response: dict, sender_addr):
        """向发送者发送响应"""
        try:
            response_data = json.dumps(response).encode('utf-8')
            self.socket.sendto(response_data, sender_addr)
        except Exception as e:
            logger.error(f"发送响应失败: {e}")
    
    async def _start_sending_chunks(self, file_id: str, receiver_addr):
        """开始发送文件块"""
        try:
            transfer = self.file_transfer_manager.get_transfer_status(file_id)
            if not transfer:
                return
            
            chunks = transfer["chunks"]
            for chunk in chunks:
                chunk_msg = self.file_msg_factory.create_chunk_message(
                    file_id, chunk, self.node_id
                )
                
                chunk_data = json.dumps(chunk_msg).encode('utf-8')
                self.socket.sendto(chunk_data, receiver_addr)
                
                # 添加小延迟避免网络拥塞
                await asyncio.sleep(0.01)
                
            logger.info(f"完成发送 {len(chunks)} 个文件块")
            
        except Exception as e:
            logger.error(f"发送文件块失败: {e}")
    
    def schedule_auto_transfer(self, file_path: str, recipients: List[str], 
                             transfer_mode: str = "unicast", delay: float = 0):
        """安排自动文件传输"""
        if self.auto_transfer_enabled:
            transfer_task = {
                "file_path": file_path,
                "recipients": recipients,
                "transfer_mode": transfer_mode,
                "schedule_time": time.time() + delay,
                "attempts": 0,
                "max_attempts": 3
            }
            self.auto_transfer_queue.append(transfer_task)
            logger.info(f"安排自动传输: {file_path} -> {recipients} (延迟: {delay}秒)")
    
    async def process_auto_transfers(self):
        """处理自动传输队列"""
        current_time = time.time()
        completed_tasks = []
        
        for i, task in enumerate(self.auto_transfer_queue):
            if current_time >= task["schedule_time"]:
                try:
                    result = await self.initiate_file_transfer(
                        task["file_path"], 
                        task["recipients"], 
                        task["transfer_mode"]
                    )
                    
                    if result["success"]:
                        logger.info(f"自动传输成功: {task['file_path']}")
                        completed_tasks.append(i)
                    else:
                        task["attempts"] += 1
                        if task["attempts"] >= task["max_attempts"]:
                            logger.error(f"自动传输失败，已达最大重试次数: {task['file_path']}")
                            completed_tasks.append(i)
                        else:
                            # 重新安排
                            task["schedule_time"] = current_time + 10  # 10秒后重试
                            
                except Exception as e:
                    logger.error(f"处理自动传输任务失败: {e}")
                    completed_tasks.append(i)
        
        # 移除已完成的任务
        for i in reversed(completed_tasks):
            del self.auto_transfer_queue[i]
    
    def get_status(self):
        """获取节点状态"""
        file_stats = self.file_transfer_manager.get_statistics()
        
        return {
            "node_id": self.node_id,
            "port": self.port,
            "is_running": self.is_running,
            "received_count": len(self.received_messages),
            "sent_count": len(self.sent_messages),
            "last_activity": max(
                [msg["timestamp"] for msg in self.received_messages] +
                [msg["timestamp"] for msg in self.sent_messages] + [0]
            ),
            "file_transfer_stats": file_stats,
            "active_transfers": len(self.file_transfer_manager.get_all_transfers()),
            "auto_transfer_queue": len(self.auto_transfer_queue),
            "auto_transfer_enabled": self.auto_transfer_enabled
        }
    
    def get_messages(self, count: int = 50):
        """获取最近的消息"""
        all_messages = []
        
        for msg in self.received_messages[-count:]:
            all_messages.append({
                "direction": "received",
                **msg
            })
        
        for msg in self.sent_messages[-count:]:
            all_messages.append({
                "direction": "sent", 
                **msg
            })
        
        return sorted(all_messages, key=lambda x: x["timestamp"], reverse=True)[:count]
    
    async def get_file_transfer_stats(self):
        """获取文件传输统计"""
        return self.file_transfer_manager.get_statistics()
    
    async def get_active_transfers_count(self):
        """获取活跃传输数量"""
        return len(self.file_transfer_manager.get_all_transfers())
    
    async def enable_auto_transfer(self):
        """启用自动传输"""
        self.auto_transfer_enabled = True
        logger.info(f"节点 {self.node_id} 自动传输已启用")
    
    async def disable_auto_transfer(self):
        """禁用自动传输"""
        self.auto_transfer_enabled = False
        logger.info(f"节点 {self.node_id} 自动传输已禁用")
    
    def get_node_context(self):
        """获取当前Actor的上下文信息，包括所在的物理节点ID"""
        try:
            import ray
            runtime_context = ray.get_runtime_context()
            return {
                "actor_id": runtime_context.get_actor_id(),
                "physical_node_id": runtime_context.get_node_id(),
                "ip_address": runtime_context.get_node_ip_address(),
                "worker_id": runtime_context.get_worker_id(),
                "job_id": runtime_context.get_job_id()
            }
        except Exception as e:
            logger.error(f"获取节点上下文失败: {e}")
            return {
                "actor_id": None,
                "physical_node_id": None,
                "ip_address": None,
                "worker_id": None,
                "job_id": None,
                "error": str(e)
            }


class CastingCluster:
    """消息传输集群管理器"""
    
    def __init__(self):
        self.nodes: Dict[str, Any] = {}  # Ray actor handles
        self.node_ports: Dict[str, int] = {}
        self.external_nodes: Dict[str, Dict] = {}  # 外部节点信息
        self.is_initialized = False
        self.connection_history: List[Dict[str, Any]] = []  # 最近连接尝试的元数据
    
    def get_connection_history(self) -> List[Dict[str, Any]]:
        """返回连接历史（浅拷贝），供外部调试或 API 暴露。
        每条包含: ray_address/phase/success/duration/error_class/error。
        """
        return list(self.connection_history)
        
    async def initialize_ray(self, ray_address: Optional[str] = None, namespace: str = "castray", allow_local_start: bool = True):
        """初始化Ray集群连接"""
        try:
            # 如果显式提供了 ray_address（非 'auto'/'local'/None），优先尝试直接连接该地址
            external_discovery_result = None
            if ray_address and ray_address not in ['auto', 'local', None]:
                logger.info(f"尝试直接连接到指定的 Ray 地址: {ray_address}")
                try:
                    direct_success = connect_to_ray_cluster(ray_address, namespace, allow_local_fallback=allow_local_start)
                    if direct_success:
                        self.is_initialized = True
                        logger.info(f"已连接到指定 Ray 地址: {ray_address}")
                        # 如果需要，尝试发现现有的节点/Actors
                        try:
                            await self.discover_existing_nodes()
                        except Exception:
                            pass
                        return True
                    else:
                        logger.info(f"通过指定地址 {ray_address} 连接失败，继续尝试自动发现或本地启动")
                except Exception as e:
                    logger.debug(f"直接连接到 {ray_address} 时出错: {e}")

            # 首先尝试发现外部Ray集群
            external_discovery_result = None
            if ray_address in ['auto', None] or os.environ.get('DISCOVER_EXTERNAL_CLUSTERS', '').lower() == 'true':
                logger.info("🔍 尝试发现外部Ray集群...")
                external_discovery_result = discover_and_connect_external_clusters()
                
                if external_discovery_result.get('success'):
                    logger.info("✅ 已连接到外部Ray集群")
                    self.is_initialized = True
                    
                    # 加载外部节点
                    external_nodes = external_discovery_result.get('external_nodes', {})
                    self.external_nodes.update(external_nodes)
                    
                    logger.info(f"发现 {len(external_nodes)} 个外部节点")
                    return True
                else:
                    logger.info(f"未发现外部集群: {external_discovery_result.get('error', 'unknown')}")

                # 如果发现失败，尝试使用环境变量 RAY_ADDRESS（优先于本地自动启动）
                env_ray_addr = os.environ.get('RAY_ADDRESS')
                if env_ray_addr:
                    logger.info(f"外部发现未成功，检测到环境变量 RAY_ADDRESS={env_ray_addr}，尝试连接该地址")
                    try:
                        success_env = connect_to_ray_cluster(env_ray_addr, namespace, allow_local_fallback=allow_local_start)
                        if success_env:
                            self.is_initialized = True
                            logger.info(f"已通过 RAY_ADDRESS={env_ray_addr} 成功连接到 Ray 集群")
                            return True
                        else:
                            logger.warning(f"通过 RAY_ADDRESS={env_ray_addr} 连接失败")
                    except Exception as ee:
                        logger.debug(f"尝试通过 RAY_ADDRESS 连接时出错: {ee}")

            # 如果没有发现外部集群，决定是否启动本地Ray或直接返回失败
            if not allow_local_start:
                logger.info("allow_local_start=False，跳过本地 Ray 启动；若没有外部集群连接，则初始化视为失败")
                return False

            # 如果允许本地启动，则使用原有的连接逻辑
            success = connect_to_ray_cluster(ray_address, namespace, allow_local_fallback=allow_local_start)
            if success:
                self.is_initialized = True
                logger.info("Ray集群初始化成功")

                # 如果连接到外部集群，尝试发现现有节点
                if ray_address and ray_address not in ['auto', 'local', None]:
                    await self.discover_existing_nodes()

                return True
            else:
                logger.error("Ray集群初始化失败")
                return False
        except Exception as e:
            logger.error(f"Ray集群初始化失败: {e}")
            try:
                ray.init(ignore_reinit_error=True)
                self.is_initialized = True
                logger.info("Ray本地模式初始化成功")
                return True
            except Exception as e2:
                logger.error(f"Ray本地模式初始化也失败: {e2}")
                return False

    async def discover_existing_nodes(self):
        """发现Ray集群中的现有节点和Actor"""
        try:
            logger.info("发现Ray集群中的现有节点...")
            
            # 获取集群信息
            cluster_resources = ray.cluster_resources()
            available_resources = ray.available_resources()
            nodes = ray.nodes()
            
            logger.info(f"Ray集群信息: {len(nodes)} 个节点, CPU: {cluster_resources.get('CPU', 0)}")
            
            # 尝试列出现有的Named Actor
            try:
                # 简化的Actor发现逻辑
                import ray.util.state as state
                actors = state.list_actors()
                logger.info(f"发现 {len(actors)} 个现有Actor")
                
                for i, actor in enumerate(actors):
                    try:
                        # 安全地访问actor属性
                        actor_dict = actor.__dict__ if hasattr(actor, '__dict__') else {}
                        state_val = getattr(actor, 'state', 'UNKNOWN')
                        name_val = getattr(actor, 'name', f'actor_{i}')
                        class_name_val = getattr(actor, 'class_name', 'unknown')
                        
                        if state_val == 'ALIVE' and name_val:
                            # 检查是否为相关的Actor类型
                            if any(keyword in str(class_name_val) for keyword in ['DemoNode', 'CastingNode', 'Node']):
                                logger.info(f"发现可能的传输Actor: {name_val} ({class_name_val})")
                                
                                # 为外部Actor创建代理条目
                                if name_val not in self.nodes:
                                    self.external_nodes[name_val] = {
                                        'actor_id': getattr(actor, 'actor_id', ''),
                                        'class_name': class_name_val,
                                        'state': state_val,
                                        'node_id': getattr(actor, 'node_id', ''),
                                        'is_external': True,
                                        'is_ray_node': False
                                    }
                                    logger.info(f"已记录外部Actor: {name_val}")
                    except Exception as actor_error:
                        logger.debug(f"处理Actor {i} 时出错: {actor_error}")
                        continue
                
            except Exception as e:
                logger.warning(f"无法列出现有Actor: {e}")
            
            # 根据Ray物理节点创建虚拟传输节点
            node_count = 0
            for node in nodes:
                if node.get('Alive', False):
                    node_id = f"ray_node_{node_count + 1}"
                    # 为Ray节点创建虚拟条目（不是真正的CastingNode Actor）
                    self.external_nodes[node_id] = {
                        'ray_node_id': node.get('NodeID', ''),
                        'resources': node.get('Resources', {}),
                        'alive': node.get('Alive', False),
                        'is_ray_node': True,
                        'is_external': True
                    }
                    node_count += 1
                    logger.info(f"映射Ray节点为传输节点: {node_id}")
            
            logger.info(f"发现 {len(self.external_nodes)} 个外部节点")
            
        except Exception as e:
            logger.error(f"发现现有节点失败: {e}")

    async def create_node(self, node_id: str, port: int = 0) -> bool:
        """创建新节点"""
        try:
            if not self.is_initialized:
                await self.initialize_ray()
            
            node_ref = CastingNode.remote(node_id, port)
            success = await node_ref.start.remote()
            
            if success:
                self.nodes[node_id] = node_ref
                if port == 0:
                    # 获取实际分配的端口
                    status = await node_ref.get_status.remote()
                    self.node_ports[node_id] = status["port"]
                else:
                    self.node_ports[node_id] = port
                    
                logger.info(f"节点 {node_id} 创建成功，端口: {self.node_ports[node_id]}")
                return True
            return False
        except Exception as e:
            logger.error(f"创建节点 {node_id} 失败: {e}")
            return False

    async def remove_node(self, node_id: str) -> bool:
        """移除节点"""
        try:
            if node_id in self.nodes:
                await self.nodes[node_id].stop.remote()
                del self.nodes[node_id]
                if node_id in self.node_ports:
                    del self.node_ports[node_id]
                logger.info(f"节点 {node_id} 已移除")
                return True
            return False
        except Exception as e:
            logger.error(f"移除节点 {node_id} 失败: {e}")
            return False

    async def get_node_ports(self) -> Dict[str, int]:
        """获取所有节点的端口映射"""
        return self.node_ports.copy()

    async def send_message(self, cast_message: CastMessage) -> CastResponse:
        """发送消息"""
        start_time = time.time()
        results = []
        failed_recipients = []
        
        try:
            if cast_message.sender not in self.nodes:
                return CastResponse(
                    success=False,
                    message="发送节点不存在",
                    recipients_count=0
                )
            
            sender_node = self.nodes[cast_message.sender]
            message_data = {
                "id": cast_message.id,
                "content": cast_message.content,
                "message_type": cast_message.message_type,
                "timestamp": cast_message.timestamp or time.time()
            }
            
            if cast_message.cast_type == CastType.UNICAST:
                # 单播
                for recipient in cast_message.recipients:
                    if recipient in self.node_ports:
                        result = await sender_node.send_unicast.remote(
                            message_data, 'localhost', self.node_ports[recipient]
                        )
                        results.append(result)
                        if not result.get("success"):
                            failed_recipients.append(recipient)
                    else:
                        failed_recipients.append(recipient)
            
            elif cast_message.cast_type == CastType.MULTICAST:
                # 组播
                group_ip = "224.1.1.1"  # 示例组播地址
                group_port = 9999
                result = await sender_node.send_multicast.remote(
                    message_data, group_ip, group_port
                )
                results.append(result)
                if not result.get("success"):
                    failed_recipients = cast_message.recipients
            
            elif cast_message.cast_type == CastType.BROADCAST:
                # 广播
                broadcast_port = 9998
                result = await sender_node.send_broadcast.remote(
                    message_data, broadcast_port
                )
                results.append(result)
                if not result.get("success"):
                    failed_recipients = list(self.nodes.keys())
            
            delivery_time = time.time() - start_time
            success_count = len([r for r in results if r.get("success")])
            
            return CastResponse(
                success=success_count > 0,
                message=f"消息发送完成，成功: {success_count}, 失败: {len(failed_recipients)}",
                recipients_count=success_count,
                failed_recipients=failed_recipients,
                delivery_time=delivery_time
            )
            
        except Exception as e:
            logger.error(f"发送消息失败: {e}")
            return CastResponse(
                success=False,
                message=f"发送失败: {str(e)}",
                recipients_count=0,
                failed_recipients=cast_message.recipients
            )

    async def get_cluster_status(self) -> dict:
        """获取集群状态"""
        try:
            node_statuses = []
            
            # 获取自建节点状态
            for node_id, node_ref in self.nodes.items():
                try:
                    status = await node_ref.get_status.remote()
                    node_statuses.append(status)
                except:
                    node_statuses.append({
                        "node_id": node_id,
                        "is_running": False,
                        "error": "无法获取状态"
                    })
            
            # 添加外部节点状态
            for node_id, node_info in self.external_nodes.items():
                if node_info.get('is_ray_node'):
                    # Ray物理节点
                    node_statuses.append({
                        "node_id": node_id,
                        "is_running": node_info.get('alive', False),
                        "port": "N/A",
                        "node_type": "Ray节点",
                        "resources": node_info.get('resources', {}),
                        "received_count": 0,
                        "sent_count": 0,
                        "auto_transfer_enabled": False,
                        "auto_transfer_queue": 0,
                        "file_transfer_stats": {
                            "successful_transfers": 0,
                            "failed_transfers": 0,
                            "bytes_transferred": 0
                        }
                    })
                else:
                    # 外部Actor节点
                    node_statuses.append({
                        "node_id": node_id,
                        "is_running": node_info.get('state') == 'ALIVE',
                        "port": "N/A",
                        "node_type": "外部Actor",
                        "class_name": node_info.get('class_name', 'unknown'),
                        "received_count": 0,
                        "sent_count": 0,
                        "auto_transfer_enabled": False,
                        "auto_transfer_queue": 0,
                        "file_transfer_stats": {
                            "successful_transfers": 0,
                            "failed_transfers": 0,
                            "bytes_transferred": 0
                        }
                    })

            ray_status = {}
            try:
                if ray.is_initialized():
                    ray_status = {
                        "cluster_resources": ray.cluster_resources(),
                        "available_resources": ray.available_resources(),
                        "nodes": len(ray.nodes())
                    }
            except:
                ray_status = {"error": "无法获取Ray状态"}

            total_nodes = len(self.nodes) + len(self.external_nodes)
            active_nodes = len([s for s in node_statuses if s.get("is_running", False)])

            return {
                "total_nodes": total_nodes,
                "active_nodes": active_nodes,
                "node_statuses": node_statuses,
                "ray_cluster": ray_status,
                "node_ports": self.node_ports
            }
        except Exception as e:
            logger.error(f"获取集群状态失败: {e}")
            return {"error": str(e)}

    async def get_unified_nodes_status(self, dashboard_address: str = "10.30.2.11:8265"):
        """获取整合了物理和逻辑信息的节点状态列表"""
        try:
            logger.info(f"get_unified_nodes_status called with dashboard_address={dashboard_address}")
            # 1. 获取物理节点信息
            physical_nodes = get_physical_ray_nodes_status(dashboard_address)
            logger.info(f"发现 {len(physical_nodes)} 个物理Ray节点")
            
            # 2. 获取CastRay节点信息并进行映射
            castray_node_tasks = []
            node_contexts = {}
            
            for node_id, actor in self.nodes.items():
                try:
                    # 并行获取所有CastRay节点的状态和上下文
                    status_task = asyncio.create_task(actor.get_status.remote())
                    context_task = asyncio.create_task(actor.get_node_context.remote())
                    castray_node_tasks.append((node_id, status_task, context_task))
                except Exception as e:
                    logger.error(f"创建任务失败 for {node_id}: {e}")
            
            # 3. 等待所有任务完成并收集结果
            for node_id, status_task, context_task in castray_node_tasks:
                try:
                    status = await status_task
                    context = await context_task
                    
                    # CastRay actor 返回的 context 中可能包含 runtime_context.get_node_id()（完整 node id）
                    # 也可能是某些短 id 或空值。为了提高鲁棒性，我们尝试多种匹配策略：
                    # 1) 直接完整匹配 physical_node_id -> physical_nodes keys
                    # 2) 若未命中，尝试对 physical_nodes 的 key 列表进行后缀匹配（last12, last8）
                    # 3) 若仍未命中，则尝试通过 ip/name 映射（context 中的 ip_address 与 physical_nodes 中的 ip_address/name）

                    physical_node_id = context.get("physical_node_id")
                    matched_physical_key = None

                    # 直接使用完整 id
                    if physical_node_id and physical_node_id in physical_nodes:
                        matched_physical_key = physical_node_id
                    else:
                        # 尝试后缀匹配
                        try:
                            if physical_node_id:
                                s = str(physical_node_id)
                                candidates = list(physical_nodes.keys())
                                # 优先尝试 longer suffix
                                for suf_len in (16, 12, 8):
                                    suf = s[-suf_len:]
                                    found = [k for k in candidates if str(k).endswith(suf)]
                                    if len(found) == 1:
                                        matched_physical_key = found[0]
                                        break
                                    elif len(found) > 1:
                                        # 如果有多重匹配，尽量通过 ip 地址再过滤
                                        ip_addr = context.get('ip_address') or context.get('ip')
                                        if ip_addr:
                                            filtered = [k for k in found if physical_nodes.get(k, {}).get('ip_address') == ip_addr or physical_nodes.get(k, {}).get('node_name') == ip_addr]
                                            if len(filtered) == 1:
                                                matched_physical_key = filtered[0]
                                                break
                        except Exception:
                            matched_physical_key = None

                        # 最后尝试通过 ip/name 直接匹配
                        if not matched_physical_key:
                            ip_addr = context.get('ip_address') or context.get('ip') or context.get('ip_address')
                            if ip_addr:
                                for k, v in physical_nodes.items():
                                    if v.get('ip_address') == ip_addr or v.get('node_name') == ip_addr or (isinstance(v.get('labels'), dict) and v.get('labels').get('node_ip') == ip_addr):
                                        matched_physical_key = k
                                        break

                    if matched_physical_key:
                        # 如果物理节点存在，将CastRay信息合并进去
                        if "castray_nodes" not in physical_nodes[matched_physical_key]:
                            physical_nodes[matched_physical_key]["castray_nodes"] = []
                        
                        # 合并状态信息，并保留原始 context
                        enhanced_status = {
                            **status,
                            "context": context,
                            "message_queue_size": len(status.get("received_messages", [])) + len(status.get("sent_messages", []))
                        }
                        physical_nodes[matched_physical_key]["castray_nodes"].append(enhanced_status)
                    else:
                        # 如果找不到对应的物理节点，记录为独立的CastRay节点
                        logger.warning(f"CastRay节点 {node_id} 无法映射到物理节点 {physical_node_id}; 尝试通过 ip/name/calculation 匹配失败")
                        
                except Exception as e:
                    logger.error(f"处理CastRay节点 {node_id} 失败: {e}")
            
            # 4. 添加外部节点信息
            for node_id, node_info in self.external_nodes.items():
                if node_info.get('is_ray_node'):
                    ray_node_id = node_info.get('ray_node_id')
                    if ray_node_id and ray_node_id in physical_nodes:
                        if "external_info" not in physical_nodes[ray_node_id]:
                            physical_nodes[ray_node_id]["external_info"] = []
                        physical_nodes[ray_node_id]["external_info"].append(node_info)
            
            # 5. 确保所有节点都有castray_nodes字段
            for node_id, node_data in physical_nodes.items():
                if "castray_nodes" not in node_data:
                    node_data["castray_nodes"] = []
                
                # 计算节点的综合状态
                node_data["has_castray_nodes"] = len(node_data["castray_nodes"]) > 0
                node_data["total_transfers"] = sum(
                    cn.get("file_transfer_stats", {}).get("successful_transfers", 0) 
                    for cn in node_data["castray_nodes"]
                )
                node_data["total_messages"] = sum(
                    cn.get("message_queue_size", 0) 
                    for cn in node_data["castray_nodes"]
                )

                # 标准化标识字段：ray_node_id（尽可能为完整的 Ray NodeID），short_id（最后8位），canonical_id（用于前端统一键）
                # 1) 如果已有 physical_node_id 字段且看起来是完整id，则使用
                ray_node_id = node_data.get('physical_node_id') or node_data.get('ray_node_id') or None
                # 2) 如果 key 本身像一个完整 id（包含 '-' 或长度大于16），尝试使用它
                if not ray_node_id:
                    if isinstance(node_id, str) and (len(node_id) > 16 or '-' in node_id or node_id.startswith('ray_node_')):
                        ray_node_id = node_id

                # 3) short_id 为最后8位
                short_id = None
                if ray_node_id:
                    try:
                        short_id = str(ray_node_id)[-8:]
                    except Exception:
                        short_id = None

                # 4) canonical_id 优先使用 ray_node_id，否则使用 node_id（map key）
                canonical_id = ray_node_id or node_id

                node_data['ray_node_id'] = ray_node_id
                node_data['short_id'] = short_id
                node_data['canonical_id'] = canonical_id

                # 记录调试日志，帮助定位字段为何可能为 None
                try:
                    logger.info(f"normalize-node: key={node_id} ray_node_id={ray_node_id} short_id={short_id} canonical_id={canonical_id}")
                except Exception:
                    pass
            
            # 6. 返回节点列表
            unified_nodes = list(physical_nodes.values())
            logger.info(f"统一节点状态: {len(unified_nodes)} 个节点，其中 {sum(1 for n in unified_nodes if n['has_castray_nodes'])} 个有CastRay节点")
            
            return unified_nodes
            
        except Exception as e:
            logger.error(f"获取统一节点状态失败: {e}")
            return []
    
    async def get_node_messages(self, node_id: str, count: int = 50) -> list:
        """获取节点消息"""
        try:
            if node_id in self.nodes:
                return await self.nodes[node_id].get_messages.remote(count)
            return []
        except Exception as e:
            logger.error(f"获取节点 {node_id} 消息失败: {e}")
            return []
    
    async def initiate_node_file_transfer(self, sender_id: str, file_path: str, 
                                         recipients: List[str], transfer_mode: str = "unicast") -> CastResponse:
        """通过节点发起文件传输"""
        start_time = time.time()
        
        try:
            if sender_id not in self.nodes:
                return CastResponse(
                    success=False,
                    message="发送节点不存在",
                    recipients_count=0
                )
            
            sender_node = self.nodes[sender_id]
            result = await sender_node.initiate_file_transfer.remote(
                file_path, recipients, transfer_mode
            )
            
            delivery_time = time.time() - start_time
            
            if result["success"]:
                return CastResponse(
                    success=True,
                    message=f"文件传输已发起: {result['file_id']}",
                    recipients_count=result["recipients_notified"],
                    delivery_time=delivery_time
                )
            else:
                return CastResponse(
                    success=False,
                    message=f"文件传输发起失败: {result.get('error', '未知错误')}",
                    recipients_count=0,
                    delivery_time=delivery_time
                )
                
        except Exception as e:
            logger.error(f"发起节点文件传输失败: {e}")
            return CastResponse(
                success=False,
                message=f"发起失败: {str(e)}",
                recipients_count=0
            )
    
    async def schedule_auto_file_transfer(self, sender_id: str, file_path: str, 
                                        recipients: List[str], transfer_mode: str = "unicast",
                                        delay: float = 0) -> bool:
        """安排自动文件传输"""
        try:
            if sender_id not in self.nodes:
                logger.error(f"发送节点不存在: {sender_id}")
                return False
            
            sender_node = self.nodes[sender_id]
            await sender_node.schedule_auto_transfer.remote(
                file_path, recipients, transfer_mode, delay
            )
            
            logger.info(f"已安排节点 {sender_id} 的自动文件传输: {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"安排自动文件传输失败: {e}")
            return False
    
    async def get_file_transfer_status(self, node_id: Optional[str] = None) -> dict:
        """获取文件传输状态"""
        try:
            if node_id:
                # 获取特定节点的状态
                if node_id in self.nodes:
                    status = await self.nodes[node_id].get_status.remote()
                    return {node_id: status}
                else:
                    return {"error": f"节点 {node_id} 不存在"}
            else:
                # 获取所有节点的状态
                all_status = {}
                for nid, node_ref in self.nodes.items():
                    try:
                        status = await node_ref.get_status.remote()
                        all_status[nid] = status
                    except Exception as e:
                        all_status[nid] = {"error": str(e)}
                
                return all_status
                
        except Exception as e:
            logger.error(f"获取文件传输状态失败: {e}")
            return {"error": str(e)}
    
    def shutdown(self):
        """关闭集群"""
        try:
            for node_id in list(self.nodes.keys()):
                asyncio.create_task(self.remove_node(node_id))
            if ray.is_initialized():
                ray.shutdown()
            logger.info("集群已关闭")
        except Exception as e:
            logger.error(f"关闭集群失败: {e}")


class NodeScheduler:
    """节点任务调度器 - 用于演示自动文件传输"""
    
    def __init__(self, cluster: CastingCluster):
        self.cluster = cluster
        self.running = False
        self.demo_files_dir = Path("demo_files")
        self.demo_files_dir.mkdir(exist_ok=True)
        
        # 创建演示文件
        self._create_demo_files()
    
    def _create_demo_files(self):
        """创建演示文件"""
        demo_files = [
            ("config.json", {"server": "localhost", "port": 8080, "timeout": 30}),
            ("data.txt", "这是一个测试文件\n包含多行数据\n用于演示文件传输功能"),
            ("report.md", "# 系统报告\n\n## 状态\n- 系统运行正常\n- 所有节点在线")
        ]
        
        for filename, content in demo_files:
            file_path = self.demo_files_dir / filename
            if not file_path.exists():
                if isinstance(content, dict):
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(content, f, ensure_ascii=False, indent=2)
                else:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                        
                logger.info(f"创建演示文件: {file_path}")
    
    async def start_demo_transfers(self):
        """启动演示传输"""
        self.running = True
        logger.info("开始演示自动文件传输...")
        
        while self.running:
            try:
                # 检查集群状态
                status = await self.cluster.get_cluster_status()
                active_nodes = [node['node_id'] for node in status.get('node_statuses', []) 
                              if node.get('is_running', False)]
                
                if len(active_nodes) >= 2:
                    # 随机选择发送者和接收者
                    import random
                    sender = random.choice(active_nodes)
                    receivers = [node for node in active_nodes if node != sender]
                    
                    if receivers:
                        # 随机选择文件
                        demo_files = list(self.demo_files_dir.glob("*"))
                        if demo_files:
                            file_to_send = random.choice(demo_files)
                            selected_receivers = random.sample(receivers, min(2, len(receivers)))
                            
                            # 发起传输
                            await self.cluster.schedule_auto_file_transfer(
                                sender, str(file_to_send), selected_receivers, "unicast", 0
                            )
                            
                            logger.info(f"演示传输: {sender} -> {selected_receivers} 文件: {file_to_send.name}")
                
                # 等待30秒后进行下一次传输
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"演示传输错误: {e}")
                await asyncio.sleep(10)
    
    def stop_demo_transfers(self):
        """停止演示传输"""
        self.running = False
        logger.info("停止演示传输")


# 物理节点状态获取函数
def get_physical_ray_nodes_status(dashboard_address: str) -> dict:
    """
    从Ray Dashboard API获取物理节点的状态。
    这是从rayoutput.py整合过来的功能。
    """
    import requests
    import json
    
    nodes_info = {}
    try:
        # 尝试连接到Ray Dashboard的API
        response = requests.get(f"http://{dashboard_address}/api/v0/nodes?view=summary", timeout=5)
        response.raise_for_status()
        data = response.json()

        # Ray Dashboard 的 JSON 结构在不同版本中差异较大，常见形式有：
        # - {"data": {"summary": [...]}}
        # - {"result": [...]} 或 {"data": {"result": {"result": [...]}}}
        # 为了鲁棒性，这里递归寻找第一个看起来像节点列表（元素为 dict 且包含 node_id/NodeID/nodeId）的列表。
        def find_nodes_list(obj, depth=0):
            if depth > 6:
                return None
            if isinstance(obj, list):
                if obj and all(isinstance(i, dict) for i in obj):
                    # 判断列表内元素是否是节点 dict（包含 node_id/NodeID/nodeId 等字段）
                    for item in obj:
                        if any(k in item for k in ("node_id", "NodeID", "nodeId")):
                            return obj
                return None
            if isinstance(obj, dict):
                # 优先检查常见键
                for key in ("data", "result", "nodes", "summary"):
                    if key in obj:
                        candidate = obj[key]
                        found = find_nodes_list(candidate, depth + 1)
                        if found:
                            return found
                # 递归遍历字典的值
                for v in obj.values():
                    found = find_nodes_list(v, depth + 1)
                    if found:
                        return found
            return None

        summaries = find_nodes_list(data) or []

        if not summaries:
            logger.error("从Ray Dashboard获取物理节点状态失败: 未能找到节点数组 (unknown structure)")
            return nodes_info

        for node_data in summaries:
            # 安全提取 node id，兼容多种字段命名
            node_id = None
            ip_addr = None
            state = "unknown"
            resources = {}
            labels = {}
            is_head = False

            if isinstance(node_data, dict):
                # 常见嵌套结构
                raylet = node_data.get("raylet") or node_data.get("meta") or {}
                if isinstance(raylet, dict):
                    node_id = raylet.get("nodeId") or raylet.get("NodeID") or raylet.get("node_id")
                    state = raylet.get("state", state)
                    is_head = raylet.get("isHeadNode", is_head) or raylet.get("is_head", is_head)

                # 直接字段的备选
                node_id = node_id or node_data.get("node_id") or node_data.get("NodeID") or node_data.get("nodeId") or node_data.get("raylet_node_id")
                ip_addr = node_data.get("ip") or node_data.get("node_ip") or node_data.get("ip_address")
                resources = node_data.get("resources") or node_data.get("ResourceUsage") or node_data.get("resources_total") or {}
                labels = node_data.get("labels") or node_data.get("meta", {})

            if not node_id:
                # 如果仍未能找到 node id，跳过该条目
                continue

            nodes_info[node_id] = {
                "physical_node_id": node_id,
                "ip_address": ip_addr,
                "status": state,
                "cpu_usage": node_data.get("cpu", 0) if isinstance(node_data, dict) else 0,
                "mem_usage": node_data.get("mem", [0, 1]) if isinstance(node_data, dict) else [0, 1],
                "gpu_usage": node_data.get("gpus", []) if isinstance(node_data, dict) else [],
                "disk_usage": node_data.get("disk", {}) if isinstance(node_data, dict) else {},
                "labels": labels,
                "is_head": is_head,
                "node_name": labels.get("node_name", ip_addr or "unknown") if isinstance(labels, dict) else (ip_addr or "unknown"),
                "resources": resources or {},
                "timestamp": time.time()
            }
    except Exception as e:
        logger.error(f"从Ray Dashboard获取物理节点状态失败: {e}")
    return nodes_info


async def manual_transfer_demo(sender_id: str, file_name: str, recipients: List[str]):
    """手动触发演示传输（顶级辅助函数）

    This helper calls the global `cluster` to initiate a transfer. It is async
    and intended for use by external callers or debugging. It is implemented at
    module level (not bound to NodeScheduler) so it can be awaited when useful.
    """
    demo_files_dir = Path("demo_files")
    file_path = demo_files_dir / file_name
    if file_path.exists():
        result = await cluster.initiate_node_file_transfer(sender_id, str(file_path), recipients, "unicast")
        return result
    else:
        return CastResponse(
            success=False,
            message=f"演示文件不存在: {file_name}",
            recipients_count=0
        )


# 全局集群实例
cluster = CastingCluster()

# 全局调度器实例
scheduler = NodeScheduler(cluster)

