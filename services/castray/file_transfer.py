import os
import hashlib
import base64
import json
import time
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

class FileTransferProtocol:
    """文件传输协议"""
    
    CHUNK_SIZE = 8192  # 8KB chunks
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    @staticmethod
    def calculate_file_hash(file_path: str) -> str:
        """计算文件MD5哈希"""
        hash_md5 = hashlib.md5()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception as e:
            logger.error(f"计算文件哈希失败: {e}")
            return ""
    
    @staticmethod
    def split_file_to_chunks(file_path: str) -> List[Dict[str, Any]]:
        """将文件分割为块"""
        chunks = []
        try:
            file_size = os.path.getsize(file_path)
            if file_size > FileTransferProtocol.MAX_FILE_SIZE:
                raise ValueError(f"文件大小超过限制: {file_size} > {FileTransferProtocol.MAX_FILE_SIZE}")
            
            with open(file_path, "rb") as f:
                chunk_index = 0
                while True:
                    chunk_data = f.read(FileTransferProtocol.CHUNK_SIZE)
                    if not chunk_data:
                        break
                    
                    chunk = {
                        "index": chunk_index,
                        "data": base64.b64encode(chunk_data).decode('utf-8'),
                        "size": len(chunk_data),
                        "total_chunks": None  # 将在最后设置
                    }
                    chunks.append(chunk)
                    chunk_index += 1
            
            # 设置总块数
            for chunk in chunks:
                chunk["total_chunks"] = len(chunks)
                
            return chunks
        except Exception as e:
            logger.error(f"分割文件失败: {e}")
            return []
    
    @staticmethod
    def reassemble_file_from_chunks(chunks: List[Dict[str, Any]], output_path: str) -> bool:
        """从块重组文件"""
        try:
            # 按索引排序
            sorted_chunks = sorted(chunks, key=lambda x: x["index"])
            
            # 验证块的完整性
            expected_chunks = sorted_chunks[0]["total_chunks"] if sorted_chunks else 0
            if len(sorted_chunks) != expected_chunks:
                logger.error(f"块数量不匹配: {len(sorted_chunks)} != {expected_chunks}")
                return False
            
            # 确保输出目录存在
            output_dir = Path(output_path).parent
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # 重组文件
            with open(output_path, "wb") as f:
                for chunk in sorted_chunks:
                    chunk_data = base64.b64decode(chunk["data"])
                    f.write(chunk_data)
            
            return True
        except Exception as e:
            logger.error(f"重组文件失败: {e}")
            return False


class FileTransferMessage:
    """文件传输消息类型"""
    
    def __init__(self):
        self.MESSAGE_TYPES = {
            "FILE_TRANSFER_REQUEST": "file_transfer_request",
            "FILE_TRANSFER_ACCEPT": "file_transfer_accept", 
            "FILE_TRANSFER_REJECT": "file_transfer_reject",
            "FILE_CHUNK": "file_chunk",
            "FILE_CHUNK_ACK": "file_chunk_ack",
            "FILE_TRANSFER_COMPLETE": "file_transfer_complete",
            "FILE_TRANSFER_ERROR": "file_transfer_error"
        }
    
    def create_transfer_request(self, file_path: str, file_id: str, sender_id: str, 
                              recipients: List[str], transfer_mode: str = "unicast") -> Dict[str, Any]:
        """创建文件传输请求"""
        file_info = {
            "file_id": file_id,
            "file_name": Path(file_path).name,
            "file_size": os.path.getsize(file_path),
            "file_hash": FileTransferProtocol.calculate_file_hash(file_path),
            "timestamp": time.time(),
            "sender_id": sender_id,
            "recipients": recipients,
            "transfer_mode": transfer_mode
        }
        
        return {
            "type": self.MESSAGE_TYPES["FILE_TRANSFER_REQUEST"],
            "file_info": file_info
        }
    
    def create_transfer_response(self, file_id: str, accepted: bool, 
                               receiver_id: str, reason: str = "") -> Dict[str, Any]:
        """创建文件传输响应"""
        message_type = (self.MESSAGE_TYPES["FILE_TRANSFER_ACCEPT"] if accepted 
                       else self.MESSAGE_TYPES["FILE_TRANSFER_REJECT"])
        
        return {
            "type": message_type,
            "file_id": file_id,
            "receiver_id": receiver_id,
            "reason": reason,
            "timestamp": time.time()
        }
    
    def create_chunk_message(self, file_id: str, chunk: Dict[str, Any], 
                           sender_id: str) -> Dict[str, Any]:
        """创建文件块消息"""
        return {
            "type": self.MESSAGE_TYPES["FILE_CHUNK"],
            "file_id": file_id,
            "sender_id": sender_id,
            "chunk": chunk,
            "timestamp": time.time()
        }
    
    def create_chunk_ack(self, file_id: str, chunk_index: int, 
                        receiver_id: str, success: bool) -> Dict[str, Any]:
        """创建块确认消息"""
        return {
            "type": self.MESSAGE_TYPES["FILE_CHUNK_ACK"],
            "file_id": file_id,
            "chunk_index": chunk_index,
            "receiver_id": receiver_id,
            "success": success,
            "timestamp": time.time()
        }
    
    def create_transfer_complete(self, file_id: str, receiver_id: str, 
                               success: bool, file_path: str = "") -> Dict[str, Any]:
        """创建传输完成消息"""
        return {
            "type": self.MESSAGE_TYPES["FILE_TRANSFER_COMPLETE"],
            "file_id": file_id,
            "receiver_id": receiver_id,
            "success": success,
            "file_path": file_path,
            "timestamp": time.time()
        }


class FileTransferManager:
    """文件传输管理器"""
    
    def __init__(self, download_dir: str = "downloads"):
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)  # 使用parents=True创建父目录
        
        # 活跃的传输会话
        self.active_transfers: Dict[str, Dict[str, Any]] = {}
        
        # 接收到的文件块
        self.received_chunks: Dict[str, List[Dict[str, Any]]] = {}
        
        # 传输统计
        self.transfer_stats = {
            "total_transfers": 0,
            "successful_transfers": 0,
            "failed_transfers": 0,
            "bytes_transferred": 0
        }
        
        self.msg_factory = FileTransferMessage()
    
    async def initiate_file_transfer(self, file_path: str, recipients: List[str], 
                                   transfer_mode: str, sender_id: str) -> str:
        """发起文件传输（异步版本）"""
        return self.initiate_file_transfer_sync(file_path, recipients, transfer_mode, sender_id)
    
    def initiate_file_transfer_sync(self, file_path: str, recipients: List[str], 
                                  transfer_mode: str, sender_id: str) -> str:
        """发起文件传输（同步版本）"""
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"文件不存在: {file_path}")
            
            file_id = f"transfer_{int(time.time() * 1000)}_{sender_id}"
            
            # 创建传输会话
            self.active_transfers[file_id] = {
                "file_path": file_path,
                "recipients": recipients,
                "transfer_mode": transfer_mode,
                "sender_id": sender_id,
                "status": "initiated",
                "chunks": FileTransferProtocol.split_file_to_chunks(file_path),
                "accepted_by": [],
                "completed_by": [],
                "failed_by": [],
                "start_time": time.time(),
                "file_size": os.path.getsize(file_path)
            }
            
            # 立即更新统计 - 增加总传输数
            self.transfer_stats["total_transfers"] += 1
            # 注意：不要在此处预先增加 successful_transfers 或 bytes_transferred
            # 成功/失败的计数应在实际完成或标记时调整，避免在传输尚未发生时膨胀统计
            
            file_size = self.active_transfers[file_id].get("file_size")
            logger.info(f"发起文件传输: {file_path} -> {recipients} (ID: {file_id}, 大小: {file_size} bytes)")
            return file_id
            
        except Exception as e:
            # 如果发起失败，记录失败
            self.transfer_stats["failed_transfers"] += len(recipients) if isinstance(recipients, list) else 1
            logger.error(f"发起文件传输失败: {e}")
            raise
    
    def handle_transfer_request(self, message: Dict[str, Any], auto_accept: bool = True) -> Dict[str, Any]:
        """处理文件传输请求"""
        file_info = message["file_info"]
        file_id = file_info["file_id"]
        
        if auto_accept:
            # 自动接受传输
            response = self.msg_factory.create_transfer_response(
                file_id, True, "auto", "自动接受"
            )
            
            # 准备接收文件块
            self.received_chunks[file_id] = []
            
            logger.info(f"自动接受文件传输: {file_info['file_name']} (ID: {file_id})")
        else:
            # 拒绝传输
            response = self.msg_factory.create_transfer_response(
                file_id, False, "manual", "手动拒绝"
            )
            
            logger.info(f"拒绝文件传输: {file_info['file_name']} (ID: {file_id})")
        
        return response
    
    def handle_chunk_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """处理文件块消息"""
        file_id = message["file_id"]
        chunk = message["chunk"]
        chunk_index = chunk["index"]
        
        try:
            if file_id not in self.received_chunks:
                self.received_chunks[file_id] = []
            
            # 存储块
            self.received_chunks[file_id].append(chunk)
            
            # 发送确认
            ack = self.msg_factory.create_chunk_ack(file_id, chunk_index, "receiver", True)
            
            logger.debug(f"接收文件块: {file_id} 块 {chunk_index}")
            return ack
            
        except Exception as e:
            logger.error(f"处理文件块失败: {e}")
            return self.msg_factory.create_chunk_ack(file_id, chunk_index, "receiver", False)
    
    def complete_file_transfer(self, file_id: str, expected_file_info: Dict[str, Any]) -> Dict[str, Any]:
        """完成文件传输"""
        try:
            if file_id not in self.received_chunks:
                raise ValueError(f"未找到文件块: {file_id}")
            
            chunks = self.received_chunks[file_id]
            file_name = expected_file_info["file_name"]
            output_path = self.download_dir / file_name
            
            # 重组文件
            success = FileTransferProtocol.reassemble_file_from_chunks(chunks, str(output_path))
            
            if success:
                # 验证文件哈希
                received_hash = FileTransferProtocol.calculate_file_hash(str(output_path))
                expected_hash = expected_file_info.get("file_hash", "")
                
                if received_hash == expected_hash:
                    # 接收端成功完成一次接收，统计中增加一次成功计数和相应的字节数
                    self.transfer_stats["successful_transfers"] += 1
                    try:
                        self.transfer_stats["bytes_transferred"] += os.path.getsize(output_path)
                    except Exception:
                        # 如果无法读取文件大小则忽略字节累加
                        pass
                    
                    logger.info(f"文件传输完成: {file_name} -> {output_path}")
                    
                    response = self.msg_factory.create_transfer_complete(
                        file_id, "receiver", True, str(output_path)
                    )
                else:
                    logger.error(f"文件哈希验证失败: {received_hash} != {expected_hash}")
                    self.transfer_stats["failed_transfers"] += 1
                    response = self.msg_factory.create_transfer_complete(
                        file_id, "receiver", False, "哈希验证失败"
                    )
            else:
                self.transfer_stats["failed_transfers"] += 1
                response = self.msg_factory.create_transfer_complete(
                    file_id, "receiver", False, "文件重组失败"
                )
            
            # 清理
            del self.received_chunks[file_id]
            return response
            
        except Exception as e:
            logger.error(f"完成文件传输失败: {e}")
            self.transfer_stats["failed_transfers"] += 1
            return self.msg_factory.create_transfer_complete(
                file_id, "receiver", False, str(e)
            )
    
    def get_transfer_status(self, file_id: str) -> Optional[Dict[str, Any]]:
        """获取传输状态"""
        return self.active_transfers.get(file_id)
    
    def get_all_transfers(self) -> Dict[str, Dict[str, Any]]:
        """获取所有传输"""
        return self.active_transfers.copy()
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取传输统计"""
        return self.transfer_stats.copy()
    
    def mark_transfer_failed(self, file_id: str, failed_recipients: List[str]):
        """标记传输失败并调整统计"""
        try:
            if file_id in self.active_transfers:
                transfer = self.active_transfers[file_id]
                
                # 调整统计：从成功转移到失败
                failed_count = len(failed_recipients)
                self.transfer_stats["successful_transfers"] = max(0, 
                    self.transfer_stats["successful_transfers"] - failed_count)
                self.transfer_stats["failed_transfers"] += failed_count
                
                # 更新传输状态
                transfer["failed_by"].extend(failed_recipients)
                transfer["status"] = "partially_failed" if len(transfer["failed_by"]) < len(transfer["recipients"]) else "failed"
                
                logger.info(f"标记传输失败: {file_id}, 失败接收者: {failed_recipients}")
                
        except Exception as e:
            logger.error(f"标记传输失败时出错: {e}")
    
    def mark_transfer_success(self, file_id: str, successful_recipients: List[str]):
        """标记传输成功（如果之前被标记为失败）"""
        try:
            if file_id in self.active_transfers:
                transfer = self.active_transfers[file_id]
                transfer["completed_by"].extend(successful_recipients)
                
                # 检查是否所有接收者都完成了
                if len(transfer["completed_by"]) >= len(transfer["recipients"]):
                    transfer["status"] = "completed"
                # 增加统计：每个成功接收者计为一次成功传输
                succ_count = len(successful_recipients)
                self.transfer_stats["successful_transfers"] += succ_count
                # 增加字节计数（如果知道文件大小）
                try:
                    file_size = transfer.get("file_size") or os.path.getsize(transfer.get("file_path"))
                    self.transfer_stats["bytes_transferred"] += file_size * succ_count
                except Exception:
                    pass
        except Exception as e:
            logger.error(f"标记传输成功时出错: {e}")



