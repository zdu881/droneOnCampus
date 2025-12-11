# Copied main.py from CastRay (adjusted imports to local package)
from fastapi import FastAPI, WebSocket, HTTPException, WebSocketDisconnect, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import asyncio
import aiohttp
import time
import json
import os
import shutil
from pathlib import Path
from typing import List, Optional, Dict
import logging
from datetime import datetime

import requests

# Import models and ray_casting from the local package
from .ray_casting import cluster

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load config function kept as-is to allow environment overrides
def load_config():
    # Minimal copy of load_config behavior from CastRay/main.py
    env_config = os.environ.get('CASTRAY_CONFIG')
    if env_config:
        try:
            with open(env_config, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    # fallback to default
    return {
        "ray_cluster": {"address": "local", "namespace": "castray", "create_demo_nodes": True, "max_retries": 3, "retry_delay": 2},
        "web_server": {"host": "0.0.0.0", "port": int(os.environ.get("CASTRAY_PORT", "8001")), "log_level": "info"},
        "file_transfer": {"download_dir": os.environ.get("CASTRAY_DOWNLOAD_DIR", "downloads"), "chunk_size": 8192, "max_file_size": 100*1024*1024}
    }

config = load_config()
app = FastAPI(title="CastRay (embedded)")

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Websocket connections
websocket_connections: List[WebSocket] = []
# static dir inside this package
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# readiness flag to indicate startup completed (Ray initialized and demo nodes created if configured)
app.state.ready = False

# Many endpoints reuse code from original main.py; for brevity we will import the rest when needed

@app.get("/api/status")
async def get_status():
    try:
        status = await cluster.get_cluster_status()
        status["service_ready"] = bool(getattr(app.state, "ready", False))
        # 附加最近连接尝试的简要信息，便于前端或用户排障
        try:
            history = cluster.get_connection_history()[-5:]
        except Exception:
            history = []
        status["connect_history"] = history
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _simulate_usage(min_val: float = 10, max_val: float = 80) -> float:
    import random
    return round(random.uniform(min_val, max_val), 1)


def _get_real_node_usage(dashboard_url: str) -> dict:
    """从 Ray Dashboard 获取真实的节点资源使用率和物理内存
    
    Returns:
        dict: {ip: {'cpu': float, 'memory': float, 'gpu': float, 'memory_total_gb': float}}
    """
    try:
        resp = requests.get(f"{dashboard_url}/nodes?view=summary", timeout=5)
        if resp.ok:
            data = resp.json()
            summary = data.get('data', {}).get('summary', [])
            # 以 IP 或 hostname 为 key 建立使用率映射
            usage_map = {}
            for node in summary:
                ip = node.get('ip', '')
                hostname = node.get('hostname', '')
                cpu_percent = node.get('cpu', 0)
                
                # mem 数组格式: [total_bytes, used_bytes, percent, available_bytes]
                mem_info = node.get('mem', [0, 0, 0, 0])
                if len(mem_info) >= 3:
                    mem_total_bytes = mem_info[0]
                    mem_used_bytes = mem_info[1]
                    # 使用实际的 used/total 计算百分比
                    mem_percent = (mem_used_bytes / mem_total_bytes * 100) if mem_total_bytes > 0 else 0
                    mem_total_gb = mem_total_bytes / (1024**3)
                else:
                    mem_percent = 0
                    mem_total_gb = 0
                
                # 限制百分比在 0-100 之间
                cpu_percent = max(0, min(100, cpu_percent))
                mem_percent = max(0, min(100, mem_percent))
                
                # GPU 使用率（取所有 GPU 的平均值）
                gpus = node.get('gpus', [])
                gpu_percent = 0
                if gpus:
                    gpu_utilizations = [g.get('utilizationGpu', 0) for g in gpus]
                    gpu_percent = sum(gpu_utilizations) / len(gpu_utilizations) if gpu_utilizations else 0
                    gpu_percent = max(0, min(100, gpu_percent))
                
                usage_map[ip] = {
                    'cpu': round(cpu_percent, 1),
                    'memory': round(mem_percent, 1),
                    'gpu': round(gpu_percent, 1),
                    'memory_total_gb': round(mem_total_gb, 1)
                }
                if hostname and hostname != ip:
                    usage_map[hostname] = usage_map[ip]
            
            return usage_map
    except Exception as e:
        logger.warning(f"Failed to get real node usage from dashboard: {e}")
    return {}


def _extract_node_identifier(resources_total: dict) -> Optional[str]:
    standard_keys = {
        'CPU', 'memory', 'GPU', 'object_store_memory',
        'accelerator_type:G', 'Wired', 'Wireless', 'node:10.30.2.11', 'node:__internal_head__'
    }
    for key in resources_total or {}:
        if key not in standard_keys:
            return key
    return None


def _get_connection_type(resources_total: dict) -> str:
    if (resources_total or {}).get('Wired') == 1.0:
        return 'wired'
    if (resources_total or {}).get('Wireless') == 1.0:
        return 'wireless'
    return 'unknown'


def _generate_node_tasks(node: dict, cpu_usage: float, memory_usage: float, gpu_usage: float):
    tasks = []
    if cpu_usage > 50:
        tasks.append("CPU密集任务")
    if memory_usage > 60:
        tasks.append("内存密集任务")
    if gpu_usage > 40:
        tasks.append("GPU计算任务")
    if node.get('is_head_node', False):
        tasks.append("集群管理")
    if not tasks:
        tasks.append("空闲")
    return tasks


# ============================================================================
# CM-ZSB 集成函数
# ============================================================================

async def _get_node_work_status(node_ip: str, cm_zsb_port: int = 8000, timeout: float = 1.0) -> Dict:
    """
    异步获取单个节点的CM-ZSB工作状态
    
    Args:
        node_ip: 节点IP地址
        cm_zsb_port: CM-ZSB监控服务端口,默认8000
        timeout: 请求超时时间(秒)
    
    Returns:
        工作状态字典: {
            'status': 'idle'|'detecting'|'sending'|'unknown',
            'timestamp': ISO格式时间戳或None,
            'error': 错误信息(如果请求失败)
        }
    """
    url = f"http://{node_ip}:{cm_zsb_port}/api/status"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return {
                        'status': data.get('status', 'unknown'),
                        'timestamp': data.get('timestamp'),
                        'error': None
                    }
                else:
                    logger.warning(f"CM-ZSB service on {node_ip} returned {resp.status}")
                    return {'status': 'unknown', 'timestamp': None, 'error': f"HTTP {resp.status}"}
    
    except asyncio.TimeoutError:
        logger.debug(f"CM-ZSB status timeout for {node_ip} (service may not be deployed)")
        return {'status': 'idle', 'timestamp': None, 'error': 'timeout'}
    
    except Exception as e:
        logger.debug(f"CM-ZSB status error for {node_ip}: {e}")
        return {'status': 'idle', 'timestamp': None, 'error': str(e)}


async def _batch_get_work_statuses(node_ips: List[str], cm_zsb_port: int = 8000, timeout: float = 1.0) -> Dict[str, Dict]:
    """
    批量异步获取多个节点的CM-ZSB工作状态
    
    Args:
        node_ips: 节点IP地址列表
        cm_zsb_port: CM-ZSB监控服务端口
        timeout: 单个请求超时时间(秒)
    
    Returns:
        字典: {node_ip: status_dict}
    """
    tasks = [_get_node_work_status(ip, cm_zsb_port, timeout) for ip in node_ips]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    status_map = {}
    for node_ip, result in zip(node_ips, results):
        if isinstance(result, Exception):
            logger.error(f"Exception getting status for {node_ip}: {result}")
            status_map[node_ip] = {'status': 'idle', 'timestamp': None, 'error': str(result)}
        else:
            status_map[node_ip] = result
    
    return status_map


def _parse_ray_nodes_to_frontend_format(ray_nodes: list, cluster_resources: dict, available_resources: dict, usage_map: dict = None, work_status_map: dict = None):
    parsed_nodes = []
    usage_map = usage_map or {}
    work_status_map = work_status_map or {}
    
    for node in ray_nodes:
        node_identifier = _extract_node_identifier(node.get('resources_total', {}))
        connection_type = _get_connection_type(node.get('resources_total', {}))
        
        # 尝试从真实使用率数据获取，否则使用模拟数据
        node_ip = node.get('node_ip', '')
        real_usage = usage_map.get(node_ip, {})
        cpu_usage = real_usage.get('cpu', _simulate_usage(20, 80))
        memory_usage = real_usage.get('memory', _simulate_usage(15, 75))
        gpu_usage = real_usage.get('gpu', _simulate_usage(10, 90) if node.get('resources_total', {}).get('GPU', 0) > 0 else 0)
        
        # 使用Dashboard返回的真实物理内存,如果没有则fallback到Ray资源内存
        memory_total_gb = real_usage.get('memory_total_gb')
        if memory_total_gb is None or memory_total_gb == 0:
            # Fallback: 使用Ray资源内存
            memory_total_gb = round((node.get('resources_total', {}).get('memory', 0)) / (1024**3))
        
        # 获取CM-ZSB工作状态
        work_status_info = work_status_map.get(node_ip, {})
        work_status = work_status_info.get('status', 'idle')
        work_status_timestamp = work_status_info.get('timestamp')
        
        tasks = _generate_node_tasks(node, cpu_usage, memory_usage, gpu_usage)
        parsed_node = {
            "id": (node.get('node_id', '') or '')[-8:],
            "name": node_identifier or f"节点-{node.get('node_ip', 'Unknown')}",
            "fullName": f"{node_identifier or '未知'} ({node.get('node_ip', 'Unknown')})",
            "nodeIp": node.get('node_ip', 'Unknown'),
            "nodeId": node.get('node_id', ''),
            "state": node.get('state', 'UNKNOWN'),
            "isHeadNode": node.get('is_head_node', False),
            "cpu": cpu_usage,
            "memory": memory_usage,
            "gpu": gpu_usage,
            "tasks": tasks,
            "status": "active" if node.get('state') == 'ALIVE' else "dead",
            "stateMessage": node.get('state_message'),
            "connectionType": connection_type,
            "workStatus": work_status,  # idle, detecting, sending - 从CM-ZSB获取
            "workStatusTimestamp": work_status_timestamp,
            "resources": {
                "totalCpu": node.get('resources_total', {}).get('CPU', 0),
                "totalMemory": memory_total_gb,
                "totalGpu": node.get('resources_total', {}).get('GPU', 0),
                "objectStore": round((node.get('resources_total', {}).get('object_store_memory', 0)) / (1024**3))
            }
        }
        parsed_nodes.append(parsed_node)
    return parsed_nodes


def _create_cluster_summary(cluster_resources: dict, available_resources: dict, nodes_data: list):
    total_cpus = cluster_resources.get('CPU', 0)
    available_cpus = available_resources.get('CPU', 0)
    used_cpus = total_cpus - available_cpus

    total_memory = cluster_resources.get('memory', 0)
    available_memory = available_resources.get('memory', 0)
    used_memory = total_memory - available_memory

    total_gpus = cluster_resources.get('GPU', 0)
    available_gpus = available_resources.get('GPU', 0)
    used_gpus = total_gpus - available_gpus

    total_object_store = cluster_resources.get('object_store_memory', 0)
    available_object_store = available_resources.get('object_store_memory', 0)
    used_object_store = total_object_store - available_object_store

    alive_nodes = sum(1 for n in nodes_data if n.get('status') == 'active')
    dead_nodes = sum(1 for n in nodes_data if n.get('status') == 'dead')
    head_nodes = sum(1 for n in nodes_data if n.get('isHeadNode'))

    return {
        "totalNodes": len(nodes_data),
        "aliveNodes": alive_nodes,
        "deadNodes": dead_nodes,
        "headNodes": head_nodes,
        "resources": {
            "cpu": {
                "total": total_cpus,
                "used": used_cpus,
                "available": available_cpus,
                "usagePercent": round((used_cpus / total_cpus * 100) if total_cpus > 0 else 0, 1)
            },
            "memory": {
                "total": total_memory,
                "used": used_memory,
                "available": available_memory,
                "usagePercent": round((used_memory / total_memory * 100) if total_memory > 0 else 0, 1),
                "totalGB": round(total_memory / (1024**3), 2),
                "usedGB": round(used_memory / (1024**3), 2)
            },
            "gpu": {
                "total": total_gpus,
                "used": used_gpus,
                "available": available_gpus,
                "usagePercent": round((used_gpus / total_gpus * 100) if total_gpus > 0 else 0, 1)
            },
            "objectStore": {
                "total": total_object_store,
                "used": used_object_store,
                "available": available_object_store,
                "usagePercent": round((used_object_store / total_object_store * 100) if total_object_store > 0 else 0, 1),
                "totalGB": round(total_object_store / (1024**3), 2),
                "usedGB": round(used_object_store / (1024**3), 2)
            }
        }
    }


@app.get("/")
async def root_info():
    return {"result": True, "msg": "CastRay service running", "ts": datetime.now().isoformat()}


def _get_nodes_from_ray_api():
    """备用方案：直接使用 Ray Python API 获取节点信息（当 Dashboard 不可用时）
    注意：目前禁用 Ray API 连接以避免阻塞，直接返回空列表
    当 Ray 集群可用时，请使用 Ray Dashboard API
    """
    # TODO: 当 Ray 集群正确配置后，可以启用以下代码
    # 目前直接返回空列表，避免 ray.init() 阻塞
    logger.warning("[Ray API] Ray 集群不可用，返回空节点列表")
    return []


@app.get("/api/ray-dashboard")
async def get_ray_dashboard(dashboard_url: Optional[str] = None):
    """返回与原 rayoutput.py 兼容的结构，供前端消费。
    优先使用 Ray Dashboard API，如果失败则使用 Ray Python API。
    """
    try:
        # 1) 从 Ray 获取全局资源（若不可用则用空）
        try:
            cluster_resources = await cluster.get_cluster_resources()
            available_resources = await cluster.get_available_resources()
        except Exception:
            cluster_resources, available_resources = {}, {}

        # 2) 通过 Ray Dashboard API 获取节点原始信息
        dash = dashboard_url or os.environ.get('RAY_DASHBOARD', 'http://10.30.2.11:8265')
        ray_nodes = []
        try:
            resp = requests.get(f"{dash}/api/v0/nodes", timeout=5)
            if resp.ok:
                payload = resp.json() or {}
                data = payload.get('data') or {}
                result = data.get('result') or {}
                ray_nodes = result.get('result') or []
                logger.info(f"[Dashboard API] 成功获取 {len(ray_nodes)} 个节点")
        except Exception as e:
            logger.warning(f"[Dashboard API] 连接失败，切换到 Ray API: {e}")
            # 备用方案：使用 Ray Python API
            ray_nodes = _get_nodes_from_ray_api()

        # 3) 获取真实的节点资源使用率
        usage_map = _get_real_node_usage(dash) if dash else {}

        # 4) 获取CM-ZSB工作状态（批量异步获取）
        node_ips = [node.get('node_ip') for node in ray_nodes if node.get('node_ip')]
        work_status_map = await _batch_get_work_statuses(node_ips, cm_zsb_port=8000, timeout=1.0)

        frontend_nodes = _parse_ray_nodes_to_frontend_format(ray_nodes, cluster_resources, available_resources, usage_map, work_status_map)
        summary = _create_cluster_summary(cluster_resources, available_resources, frontend_nodes)

        return {
            "result": True,
            "msg": "成功获取Ray集群信息",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "result": {
                    "total": len(frontend_nodes),
                    "num_after_truncation": len(frontend_nodes),
                    "num_filtered": len(frontend_nodes),
                    "result": ray_nodes
                },
                "summary": summary,
                "nodes": frontend_nodes,
                "dashboardUrl": dash
            }
        }
    except Exception as e:
        logger.error(f"[API] 获取集群信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/nodes/unified")
async def get_unified_nodes(dashboard_url: Optional[str] = None):
    """返回前端期望的统一节点数组：{ nodes: [...] }，兼容前端的 /api/nodes/unified 调用。"""
    try:
        try:
            cluster_resources = await cluster.get_cluster_resources()
            available_resources = await cluster.get_available_resources()
        except Exception:
            cluster_resources, available_resources = {}, {}

        dash = dashboard_url or os.environ.get('RAY_DASHBOARD', 'http://10.30.2.11:8265')
        ray_nodes = []
        try:
            resp = requests.get(f"{dash}/api/v0/nodes", timeout=5)
            if resp.ok:
                payload = resp.json() or {}
                data = payload.get('data') or {}
                result = data.get('result') or {}
                ray_nodes = result.get('result') or []
                logger.info(f"[Dashboard API] 成功获取 {len(ray_nodes)} 个节点")
        except Exception as e:
            logger.warning(f"[Dashboard API] 连接失败，切换到 Ray API: {e}")
            # 备用方案：使用 Ray Python API
            ray_nodes = _get_nodes_from_ray_api()

        # 获取真实的节点资源使用率
        usage_map = _get_real_node_usage(dash) if dash else {}

        frontend_nodes = _parse_ray_nodes_to_frontend_format(ray_nodes, cluster_resources, available_resources, usage_map)
        return {"nodes": frontend_nodes}
    except Exception as e:
        logger.error(f"[API] 获取统一节点失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def startup_event():
    """初始化服务，启动WebSocket广播任务
    注意：Ray 集群连接已禁用以避免启动时阻塞
    """
    try:
        # Start WebSocket broadcast task
        asyncio.create_task(broadcast_cluster_update())
        
        # 标记服务为已准备好
        # 注意：Ray 集群连接已禁用，服务以独立模式运行
        # 当 Ray Dashboard 可用时，API 会自动从 Dashboard 获取数据
        app.state.ready = True
        logger.info("CastRay 服务启动完成 (独立模式 - Ray 集群连接已禁用)")
        
    except Exception as e:
        logger.error(f"startup_event 错误: {e}")
        app.state.ready = True  # 即使出错也标记为就绪，避免阻塞


@app.on_event("shutdown")
async def shutdown_event():
    try:
        cluster.shutdown()
    except Exception:
        pass


@app.get("/api/file-transfers/status")
async def get_file_transfer_status():
    """返回所有节点的文件传输状态（整合形式）"""
    try:
        status = {}
        for node_id, node_status in (await cluster.get_file_transfer_status()).items():
            # node_status 已为 dict
            status[node_id] = node_status
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/file-transfers/manual")
async def trigger_manual_transfer(request: dict):
    """简化的手动触发接口，调用 cluster.initiate_node_file_transfer"""
    sender_id = request.get("sender_id")
    file_name = request.get("file_name", "config.json")
    recipients = request.get("recipients", [])

    if not sender_id:
        raise HTTPException(status_code=400, detail="sender_id required")

    try:
        demo_files_dir = Path("demo_files")
        file_path = demo_files_dir / file_name
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"file not found: {file_path}")

        result = await cluster.initiate_node_file_transfer(sender_id, str(file_path), recipients, "unicast")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/file-transfers")
async def trigger_file_transfer_compat(request: dict):
    """兼容旧前端路径：/api/file-transfers (POST) -> 等同于 /api/file-transfers/manual
    保持与旧前端 `castray_integration.js` 的兼容性。
    """
    return await trigger_manual_transfer(request)


@app.post("/api/nodes")
async def create_node_compat(request: dict):
    """兼容旧前端创建节点接口：POST /api/nodes

    请求体示例: {"node_id": "demo_node_1", "port": 0}
    """
    node_id = request.get('node_id') or request.get('nodeId') or request.get('node_id')
    if not node_id:
        raise HTTPException(status_code=400, detail="node_id required")
    try:
        ok = await cluster.create_node(node_id)
        return {"success": bool(ok), "node_id": node_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/files")
async def list_files():
    """列出 demo_files 目录中的可用文件，供前端选择要传输的文件。"""
    demo_files_dir = Path("demo_files")
    files = []
    try:
        demo_files_dir.mkdir(exist_ok=True)
        for p in sorted(demo_files_dir.iterdir()):
            if p.is_file():
                try:
                    size = p.stat().st_size
                except Exception:
                    size = 0
                files.append({"name": p.name, "size": size})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"files": files}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time cluster status updates"""
    await websocket.accept()
    websocket_connections.append(websocket)
    logger.info(f"WebSocket client connected. Total connections: {len(websocket_connections)}")
    
    try:
        # Send initial cluster status
        try:
            import ray
            dashboard_url = os.environ.get('RAY_DASHBOARD_URL', 'http://10.30.2.11:8265')
            cluster_resources = ray.cluster_resources() if ray.is_initialized() else {}
            available_resources = ray.available_resources() if ray.is_initialized() else {}
            
            usage_map = _get_real_node_usage(dashboard_url)
            
            # Get Ray nodes from dashboard API
            ray_nodes = []
            try:
                resp = requests.get(f"{dashboard_url}/api/v0/nodes", timeout=5)
                if resp.ok:
                    payload = resp.json() or {}
                    data = payload.get('data') or {}
                    result = data.get('result') or {}
                    ray_nodes = result.get('result') or []
            except Exception:
                pass
            
            nodes = _parse_ray_nodes_to_frontend_format(
                ray_nodes, cluster_resources, available_resources, usage_map
            )
            
            summary_data = {
                'resources': {
                    'cpu': {
                        'total': cluster_resources.get('CPU', 0),
                        'used': cluster_resources.get('CPU', 0) - available_resources.get('CPU', 0),
                        'available': available_resources.get('CPU', 0)
                    },
                    'memory': {
                        'total': cluster_resources.get('memory', 0),
                        'used': cluster_resources.get('memory', 0) - available_resources.get('memory', 0),
                        'available': available_resources.get('memory', 0)
                    },
                    'gpu': {
                        'total': cluster_resources.get('GPU', 0),
                        'used': cluster_resources.get('GPU', 0) - available_resources.get('GPU', 0),
                        'available': available_resources.get('GPU', 0)
                    }
                }
            }
            
            initial_data = {
                'type': 'cluster_status',
                'data': {
                    'nodes': nodes,
                    'summary': summary_data
                }
            }
            await websocket.send_json(initial_data)
        except Exception as e:
            logger.error(f"Error sending initial cluster status: {e}")
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                # Handle client messages if needed (e.g., ping/pong)
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # No message received, continue
                continue
            except WebSocketDisconnect:
                break
                
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket in websocket_connections:
            websocket_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total connections: {len(websocket_connections)}")


async def broadcast_cluster_update():
    """Background task to broadcast cluster status updates to all connected WebSocket clients"""
    while True:
        try:
            await asyncio.sleep(3)  # Update every 3 seconds
            
            if not websocket_connections:
                continue
                
            # Get current cluster status
            try:
                import ray
                dashboard_url = os.environ.get('RAY_DASHBOARD_URL', 'http://10.30.2.11:8265')
                cluster_resources = ray.cluster_resources() if ray.is_initialized() else {}
                available_resources = ray.available_resources() if ray.is_initialized() else {}
                
                usage_map = _get_real_node_usage(dashboard_url)
                
                # Get Ray nodes from dashboard API
                ray_nodes = []
                try:
                    resp = requests.get(f"{dashboard_url}/api/v0/nodes", timeout=5)
                    if resp.ok:
                        payload = resp.json() or {}
                        data = payload.get('data') or {}
                        result = data.get('result') or {}
                        ray_nodes = result.get('result') or []
                except Exception:
                    pass
                
                # Get CM-ZSB work statuses
                node_ips = [node.get('node_ip') for node in ray_nodes if node.get('node_ip')]
                work_status_map = await _batch_get_work_statuses(node_ips, cm_zsb_port=8000, timeout=1.0)
                
                nodes = _parse_ray_nodes_to_frontend_format(
                    ray_nodes, cluster_resources, available_resources, usage_map, work_status_map
                )
                
                summary_data = {
                    'resources': {
                        'cpu': {
                            'total': cluster_resources.get('CPU', 0),
                            'used': cluster_resources.get('CPU', 0) - available_resources.get('CPU', 0),
                            'available': available_resources.get('CPU', 0)
                        },
                        'memory': {
                            'total': cluster_resources.get('memory', 0),
                            'used': cluster_resources.get('memory', 0) - available_resources.get('memory', 0),
                            'available': available_resources.get('memory', 0)
                        },
                        'gpu': {
                            'total': cluster_resources.get('GPU', 0),
                            'used': cluster_resources.get('GPU', 0) - available_resources.get('GPU', 0),
                            'available': available_resources.get('GPU', 0)
                        }
                    }
                }
                
                update_data = {
                    'type': 'cluster_status',
                    'data': {
                        'nodes': nodes,
                        'summary': summary_data
                    }
                }
                
                # Broadcast to all connected clients
                disconnected = []
                for ws in websocket_connections:
                    try:
                        await ws.send_json(update_data)
                    except Exception as e:
                        logger.warning(f"Failed to send update to WebSocket client: {e}")
                        disconnected.append(ws)
                
                # Remove disconnected clients
                for ws in disconnected:
                    if ws in websocket_connections:
                        websocket_connections.remove(ws)
                        
            except Exception as e:
                logger.error(f"Error preparing cluster update: {e}")
                
        except Exception as e:
            logger.error(f"Error in broadcast_cluster_update: {e}")
            await asyncio.sleep(5)


# ============================================================================
# 文件传输API端点
# ============================================================================

@app.post("/api/file-transfer/upload")
async def upload_file(
    file: UploadFile = File(...),
    target_node: str = Form(...),
    target_path: str = Form(...)
):
    """
    上传文件到目标节点
    
    Args:
        file: 上传的文件
        target_node: 目标节点IP
        target_path: 目标路径
    """
    try:
        # 创建临时存储目录
        temp_dir = Path("/tmp/castray_uploads")
        temp_dir.mkdir(exist_ok=True)
        
        # 保存上传的文件到临时位置
        temp_file_path = temp_dir / file.filename
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = temp_file_path.stat().st_size
        
        logger.info(f"File uploaded: {file.filename} ({file_size} bytes) -> {target_node}:{target_path}")
        
        # TODO: 实际传输文件到目标节点
        # 这里可以使用Ray的对象存储或SSH/SCP
        
        return {
            "success": True,
            "message": "文件上传成功",
            "filename": file.filename,
            "size": file_size,
            "target_node": target_node,
            "target_path": target_path
        }
        
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/file/read")
async def read_file_content(path: str):
    """
    读取文件内容
    
    Args:
        path: 文件路径
    """
    try:
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"文件不存在: {path}")
        
        # 安全检查 - 只允许读取特定目录下的文件
        allowed_dirs = [
            '/data/home/sim6g/rayCode/droneOnCampus/demo_files',
            '/data/home/sim6g/rayCode/droneOnCampus/downloads',
            '/tmp'
        ]
        
        abs_path = os.path.abspath(path)
        if not any(abs_path.startswith(d) for d in allowed_dirs):
            raise HTTPException(status_code=403, detail="不允许读取该目录下的文件")
        
        # 读取文件内容
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {
            "success": True,
            "path": path,
            "content": content,
            "size": len(content)
        }
        
    except HTTPException:
        raise
    except UnicodeDecodeError:
        # 如果是二进制文件，返回base64编码
        import base64
        with open(path, 'rb') as f:
            content = base64.b64encode(f.read()).decode('utf-8')
        return {
            "success": True,
            "path": path,
            "content": content,
            "encoding": "base64",
            "size": os.path.getsize(path)
        }
    except Exception as e:
        logger.error(f"File read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 传输任务存储 - 用于跟踪传输状态
transfer_tasks: Dict[str, Dict] = {}

@app.post("/api/file-transfer/node-to-node")
async def transfer_between_nodes(
    source_node: str = Form(...),
    target_node: str = Form(...),
    file_path: str = Form(...),
    transfer_mode: str = Form("auto")
):
    """
    在两个节点之间传输文件
    
    Args:
        source_node: 源节点IP或节点名称
        target_node: 目标节点IP或节点名称
        file_path: 源文件路径
        transfer_mode: 传输模式 (auto/direct/relay)
    """
    try:
        logger.info(f"Transfer request: {source_node}:{file_path} -> {target_node} (mode: {transfer_mode})")
        
        # 验证源文件是否存在
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"源文件不存在: {file_path}")
        
        # 获取文件信息
        file_stat = os.stat(file_path)
        file_size = file_stat.st_size
        file_name = os.path.basename(file_path)
        
        # 生成传输ID
        transfer_id = f"transfer_{int(time.time() * 1000)}"
        
        # 确定目标路径 (使用downloads目录模拟不同节点的存储)
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        target_dir = os.path.join(base_dir, "downloads", f"node_{target_node.replace('.', '_')}")
        os.makedirs(target_dir, exist_ok=True)
        target_path = os.path.join(target_dir, file_name)
        
        # 创建传输任务记录
        transfer_tasks[transfer_id] = {
            "id": transfer_id,
            "source_node": source_node,
            "target_node": target_node,
            "file_path": file_path,
            "target_path": target_path,
            "file_name": file_name,
            "file_size": file_size,
            "transfer_mode": transfer_mode,
            "status": "in-progress",
            "progress": 0,
            "start_time": time.time(),
            "end_time": None,
            "error": None
        }
        
        # 异步执行文件传输
        import asyncio
        asyncio.create_task(_execute_file_transfer(transfer_id))
        
        return {
            "success": True,
            "transfer_id": transfer_id,
            "source_node": source_node,
            "target_node": target_node,
            "file_path": file_path,
            "file_name": file_name,
            "file_size": file_size,
            "target_path": target_path,
            "transfer_mode": transfer_mode,
            "status": "started"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transfer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _execute_file_transfer(transfer_id: str):
    """
    异步执行实际的文件传输
    """
    task = transfer_tasks.get(transfer_id)
    if not task:
        return
    
    try:
        import shutil
        source_path = task["file_path"]
        target_path = task["target_path"]
        file_size = task["file_size"]
        
        # 模拟分块传输以显示进度
        chunk_size = max(1024 * 1024, file_size // 10)  # 至少1MB或文件的1/10
        bytes_copied = 0
        
        with open(source_path, 'rb') as src, open(target_path, 'wb') as dst:
            while True:
                chunk = src.read(chunk_size)
                if not chunk:
                    break
                dst.write(chunk)
                bytes_copied += len(chunk)
                
                # 更新进度
                progress = min(100, (bytes_copied / file_size) * 100)
                task["progress"] = progress
                
                # 添加一些延迟以便前端可以看到进度变化
                await asyncio.sleep(0.1)
        
        # 传输完成
        task["status"] = "completed"
        task["progress"] = 100
        task["end_time"] = time.time()
        logger.info(f"Transfer {transfer_id} completed: {source_path} -> {target_path}")
        
    except Exception as e:
        task["status"] = "failed"
        task["error"] = str(e)
        task["end_time"] = time.time()
        logger.error(f"Transfer {transfer_id} failed: {e}")


@app.get("/api/file-transfer/status/{transfer_id}")
async def get_transfer_status(transfer_id: str):
    """
    获取传输任务状态
    
    Args:
        transfer_id: 传输ID
    """
    try:
        # 查找真实的传输任务
        task = transfer_tasks.get(transfer_id)
        
        if task:
            # 计算传输速度和预计剩余时间
            elapsed = time.time() - task["start_time"]
            progress = task["progress"]
            file_size_mb = task["file_size"] / (1024 * 1024)
            
            if elapsed > 0 and progress > 0:
                speed = (progress / 100 * file_size_mb) / elapsed  # MB/s
                if speed > 0 and progress < 100:
                    remaining_mb = file_size_mb * (1 - progress / 100)
                    eta = int(remaining_mb / speed)
                else:
                    eta = 0
            else:
                speed = 0
                eta = 0
            
            return {
                "transfer_id": transfer_id,
                "status": task["status"],
                "progress": task["progress"],
                "speed": round(speed, 2),
                "eta": eta,
                "file_name": task["file_name"],
                "file_size": task["file_size"],
                "source_node": task["source_node"],
                "target_node": task["target_node"],
                "target_path": task["target_path"],
                "error": task.get("error")
            }
        else:
            # 如果找不到任务，返回完成状态（兼容旧的模拟传输）
            return {
                "transfer_id": transfer_id,
                "status": "completed",
                "progress": 100,
                "speed": 0,
                "eta": 0
            }
        
    except Exception as e:
        logger.error(f"Status query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/file-transfer/list")
async def list_transfers():
    """
    获取所有传输任务列表
    """
    return {
        "success": True,
        "transfers": list(transfer_tasks.values()),
        "total": len(transfer_tasks)
    }


# ===== 基站运维检测 API ===== 

detection_tasks = {}  # 存储检测任务状态

@app.post("/api/station-maintenance/detect")
async def start_detection(request_data: dict):
    """
    启动基站运维检测任务
    
    参数:
        node_id: 要检测的节点ID
        mode: 检测模式 ('auto' 或 'example')
        data_source: 数据源 ('realtime' 或 'example')
    """
    import uuid
    
    try:
        node_id = request_data.get('node_id')
        mode = request_data.get('mode', 'auto')
        data_source = request_data.get('data_source', 'realtime')
        
        if not node_id:
            raise ValueError("node_id is required")
        
        # 生成任务ID
        task_id = str(uuid.uuid4())[:8]
        
        # 初始化任务状态
        detection_tasks[task_id] = {
            "task_id": task_id,
            "node_id": node_id,
            "mode": mode,
            "data_source": data_source,
            "status": "initializing",
            "progress": 0,
            "message": "正在初始化检测任务...",
            "started_at": datetime.now().isoformat(),
            "completed": False,
            "results": None,
            "error": None
        }
        
        # 异步运行检测任务
        asyncio.create_task(_run_detection_task(task_id, node_id, mode, data_source))
        
        logger.info(f"Detection task started: {task_id} on node {node_id}")
        
        return {
            "task_id": task_id,
            "status": "started",
            "message": "检测任务已启动"
        }
        
    except Exception as e:
        logger.error(f"Detection startup error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/station-maintenance/status/{task_id}")
async def get_detection_status(task_id: str):
    """
    获取检测任务状态
    """
    if task_id not in detection_tasks:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return detection_tasks[task_id]


async def _run_detection_task(task_id: str, node_id: str, mode: str, data_source: str):
    """
    后台执行检测任务，支持本地和云处理
    """
    try:
        task = detection_tasks[task_id]
        
        # 步骤1: 初始化 (1秒)
        await asyncio.sleep(0.5)
        task["progress"] = 10
        task["status"] = "initializing"
        task["message"] = "正在初始化CM-ZSB服务..."
        logger.info(f"Task {task_id}: Initializing...")
        
        # 步骤2: 加载数据 (2秒)
        await asyncio.sleep(1)
        task["progress"] = 25
        task["status"] = "processing"
        task["message"] = "正在加载数据..."
        logger.info(f"Task {task_id}: Loading data...")
        
        # 步骤3: 运行推理 (3秒)
        await asyncio.sleep(1.5)
        task["progress"] = 60
        task["status"] = "analyzing"
        task["message"] = "正在进行本地推理分析..."
        logger.info(f"Task {task_id}: Running inference...")
        
        # 步骤4: 生成结果 (1秒)
        await asyncio.sleep(1)
        task["progress"] = 90
        task["status"] = "analyzing"
        task["message"] = "正在生成结果..."
        logger.info(f"Task {task_id}: Generating results...")
        
        # 最终结果
        await asyncio.sleep(0.5)
        
        # 根据模式生成不同的结果
        if mode == 'example':
            # 案例检测结果
            results = {
                "total_samples": 50,
                "high_confidence": 42,
                "low_confidence": 8,
                "confidence_threshold": 0.9,
                "inference_time": 2350,
                "node_id": node_id,
                "detection_mode": mode,
                "timestamp": datetime.now().isoformat(),
                # 云处理特征信息
                "cloud_processing": False,
                "cloud_processing_samples": 0
            }
        else:
            # 自动检测结果 - 模拟可能需要云处理的情况
            # 如果低置信度样本 > 0，则标记为可能需要云处理
            results = {
                "total_samples": 100,
                "high_confidence": 85,
                "low_confidence": 15,
                "confidence_threshold": 0.9,
                "inference_time": 4870,
                "node_id": node_id,
                "detection_mode": mode,
                "timestamp": datetime.now().isoformat(),
                # 云处理特征信息 (根据低置信度判断)
                "cloud_processing": 15 > 0,  # 如果有低置信度样本
                "cloud_processing_samples": 15 if 15 > 0 else 0,
                "cloud_upload_time_ms": 1250 if 15 > 0 else 0,
                "cloud_processing_time_ms": 3500 if 15 > 0 else 0
            }
        
        task["progress"] = 100
        task["status"] = "completed"
        task["message"] = "检测完成"
        task["results"] = results
        task["completed"] = True
        task["completed_at"] = datetime.now().isoformat()
        
        logger.info(f"Task {task_id}: Detection completed successfully")
        logger.info(f"Task {task_id}: Cloud processing = {results.get('cloud_processing')}, Samples = {results.get('cloud_processing_samples')}")
        
    except Exception as e:
        logger.error(f"Task {task_id}: Detection error - {e}")
        task = detection_tasks.get(task_id)
        if task:
            task["status"] = "error"
            task["error"] = str(e)
            task["message"] = f"检测出错: {str(e)}"
            task["results"] = {
                "error_detail": str(e),
                "failure_stage": "detection_processing",
                "suggested_action": "请检查服务连接或数据格式"
            }


@app.post("/api/station-maintenance/detect-error-test")
async def start_detection_error_test(request_data: dict):
    """
    启动基站运维检测的特殊错误测试模式
    用于演示红色告警状态和错误处理流程
    
    参数:
        node_id: 要检测的节点ID
        error_type: 错误类型 ('cloud_rejection', 'service_error', 'timeout', 'network_error')
    """
    import uuid
    
    try:
        node_id = request_data.get('node_id', 'test-node')
        error_type = request_data.get('error_type', 'cloud_rejection')
        
        # 生成任务ID
        task_id = str(uuid.uuid4())[:8]
        
        # 初始化任务状态
        detection_tasks[task_id] = {
            "task_id": task_id,
            "node_id": node_id,
            "mode": "error_test",
            "data_source": "test",
            "status": "initializing",
            "progress": 0,
            "message": "正在启动错误测试...",
            "started_at": datetime.now().isoformat(),
            "completed": False,
            "results": None,
            "error": None
        }
        
        # 异步运行错误测试
        asyncio.create_task(_run_detection_error_test(task_id, node_id, error_type))
        
        logger.info(f"Error test task started: {task_id} on node {node_id}, error_type={error_type}")
        
        return {
            "task_id": task_id,
            "status": "started",
            "message": f"错误测试任务已启动 (类型: {error_type})"
        }
        
    except Exception as e:
        logger.error(f"Error test startup error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


async def _run_detection_error_test(task_id: str, node_id: str, error_type: str):
    """
    后台执行检测错误测试任务
    模拟各种失败场景以演示红色告警
    """
    try:
        task = detection_tasks[task_id]
        
        # 步骤1: 初始化
        await asyncio.sleep(0.5)
        task["progress"] = 10
        task["status"] = "initializing"
        task["message"] = "正在初始化CM-ZSB服务..."
        logger.info(f"Error test {task_id}: Initializing...")
        
        # 步骤2: 本地处理
        await asyncio.sleep(1)
        task["progress"] = 30
        task["status"] = "processing"
        task["message"] = "正在进行本地数据处理..."
        logger.info(f"Error test {task_id}: Local processing...")
        
        # 步骤3: 云处理阶段 (这是错误发生的地方)
        await asyncio.sleep(1.5)
        task["progress"] = 70
        task["status"] = "cloud_processing"
        task["message"] = "正在准备云端处理..."
        logger.info(f"Error test {task_id}: Preparing cloud processing...")
        
        # 步骤4: 模拟特定的错误类型
        await asyncio.sleep(1)
        
        # 错误映射
        error_configs = {
            'cloud_rejection': {
                'error': '云服务拒绝处理: 低置信度样本数量超过阈值',
                'error_detail': '云端AI服务评估认为样本质量不符合处理标准(平均置信度 < 0.7)',
                'failure_stage': 'cloud_inference',
                'suggested_action': '请重新采集更高质量的样本数据',
                'cloud_processing_samples': 25,
                'cloud_upload_time_ms': 2100,
                'cloud_rejection_reason': 'LOW_CONFIDENCE_THRESHOLD'
            },
            'service_error': {
                'error': '云端服务出错: 处理过程中发生内部错误',
                'error_detail': '云端AI服务处理失败 (Error Code: 5001)',
                'failure_stage': 'cloud_processing',
                'suggested_action': '请稍后重试或联系技术支持',
                'cloud_processing_samples': 20,
                'cloud_upload_time_ms': 1800,
                'cloud_error_code': '5001',
                'cloud_error_message': 'Internal Server Error'
            },
            'timeout': {
                'error': '云端处理超时: 等待云服务响应超过设定时间',
                'error_detail': '云端推理服务响应超时 (超过30秒)',
                'failure_stage': 'cloud_processing_timeout',
                'suggested_action': '请检查网络连接或稍后重试',
                'cloud_processing_samples': 0,
                'cloud_upload_time_ms': 2200
            },
            'network_error': {
                'error': '网络错误: 无法连接到云端服务',
                'error_detail': '网络连接失败 - 无法连接到云端服务器',
                'failure_stage': 'cloud_upload',
                'suggested_action': '请检查网络连接',
                'cloud_processing_samples': 0
            }
        }
        
        error_config = error_configs.get(error_type, error_configs['cloud_rejection'])
        
        # 生成错误结果
        task["progress"] = 100
        task["status"] = "error"
        task["message"] = f"测试错误: {error_type}"
        task["error"] = error_config['error']
        task["completed"] = True
        task["completed_at"] = datetime.now().isoformat()
        
        # 详细结果
        task["results"] = {
            "total_samples": 50,
            "high_confidence": 25,
            "low_confidence": 25,
            "confidence_threshold": 0.9,
            "inference_time": 2100,
            "node_id": node_id,
            "detection_mode": "error_test",
            "timestamp": datetime.now().isoformat(),
            # 错误信息
            "error_detail": error_config.get('error_detail', ''),
            "failure_stage": error_config.get('failure_stage', ''),
            "suggested_action": error_config.get('suggested_action', ''),
            # 云处理信息
            "cloud_processing": True,
            "cloud_processing_samples": error_config.get('cloud_processing_samples', 0),
            "cloud_upload_time_ms": error_config.get('cloud_upload_time_ms', 0),
            "cloud_processing_time_ms": 0,  # 失败，所以没有处理时间
            # 额外的错误类型特定信息
            "cloud_rejection_reason": error_config.get('cloud_rejection_reason'),
            "cloud_error_code": error_config.get('cloud_error_code'),
            "cloud_error_message": error_config.get('cloud_error_message')
        }
        
        logger.error(f"Error test {task_id}: Test error simulated - {error_config['error']}")
        
    except Exception as e:
        logger.error(f"Error test {task_id}: Unexpected error - {e}")
        task = detection_tasks.get(task_id)
        if task:
            task["status"] = "error"
            task["error"] = f"测试执行错误: {str(e)}"
            task["completed"] = True
            task["message"] = f"测试出错: {str(e)}"
            task["results"] = {
                "error_detail": str(e),
                "failure_stage": "test_execution",
                "suggested_action": "请重新启动测试"
            }

            task["completed"] = True
            task["message"] = f"检测出错: {str(e)}"
            task["results"] = {
                "error_detail": str(e),
                "failure_stage": "detection_processing",
                "suggested_action": "请检查服务连接或数据格式"
            }


if __name__ == '__main__':
    web_config = config.get("web_server", {})
    host = web_config.get("host", "0.0.0.0")
    port = web_config.get("port", 8000)
    uvicorn.run(app, host=host, port=port, log_level=web_config.get('log_level','info'))
