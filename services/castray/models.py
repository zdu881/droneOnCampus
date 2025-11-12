from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel
from enum import Enum
import time

class CastType(str, Enum):
    UNICAST = "unicast"
    MULTICAST = "multicast"
    BROADCAST = "broadcast"

class MessageType(str, Enum):
    TEXT = "text"
    FILE = "file"
    JSON = "json"

class CastMessage(BaseModel):
    id: str
    cast_type: CastType
    message_type: MessageType
    content: Union[str, dict]
    sender: str
    recipients: List[str] = []
    group_id: Optional[str] = None
    timestamp: Optional[float] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None

    def __init__(self, **data):
        if data.get('timestamp') is None:
            data['timestamp'] = time.time()
        super().__init__(**data)

class NodeStatus(BaseModel):
    node_id: str
    is_online: bool
    last_seen: float
    address: str
    port: int
    capabilities: List[str] = []


class CastResponse(BaseModel):
    success: bool
    message: str
    recipients_count: int = 0
    failed_recipients: List[str] = []
    delivery_time: Optional[float] = None

class SystemStatus(BaseModel):
    total_nodes: int
    active_nodes: int
    total_messages: int
    messages_per_second: float
    ray_cluster_status: dict
    uptime: float
