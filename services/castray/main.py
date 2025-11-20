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


@app.get("/api/ray-dashboard")
async def get_ray_dashboard(dashboard_url: Optional[str] = None):
    """返回与原 rayoutput.py 兼容的结构，供前端消费。
    优先使用 Ray 原生 API（cluster + available + nodes via Dashboard /api/v0）。
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
        except Exception:
            ray_nodes = []

        # 3) 获取真实的节点资源使用率
        usage_map = _get_real_node_usage(dash)

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
        except Exception:
            ray_nodes = []

        # 获取真实的节点资源使用率
        usage_map = _get_real_node_usage(dash)

        frontend_nodes = _parse_ray_nodes_to_frontend_format(ray_nodes, cluster_resources, available_resources, usage_map)
        return {"nodes": frontend_nodes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def startup_event():
    """初始化 Ray 集群连接并（可选）创建演示节点，启动WebSocket广播任务"""
    try:
        # Start WebSocket broadcast task
        asyncio.create_task(broadcast_cluster_update())
        
        ray_config = config.get("ray_cluster", {})
        # 优先使用环境变量 RAY_ADDRESS（如果设置），否则使用配置文件中的 address
        ray_address = os.environ.get('RAY_ADDRESS', ray_config.get("address", "local"))
        namespace = ray_config.get("namespace", "castray")
        create_demo = ray_config.get("create_demo_nodes", True)

        logger.info(f"启动时使用的 Ray 地址: {ray_address}（env 优先）; namespace={namespace}")

        # 初始化 Ray（cluster.initialize_ray 会进行发现/连接）
        # 不在应用 startup 阶段强制启动本地 Ray（外部集群可能已存在）
        success = await cluster.initialize_ray(ray_address, namespace, allow_local_start=False)
        if not success:
            logger.warning("启动时未能初始化 Ray 集群；服务将以降级模式运行")
            app.state.ready = False
            return

        # Ray 已初始化（或允许本地启动），仅当初始化成功且配置要求时创建演示节点并等待它们就绪
        if success and create_demo:
            max_retries = ray_config.get("max_retries", 3)
            retry_delay = ray_config.get("retry_delay", 2)
            created = 0
            demo_node_ids = [f"demo_node_{i+1}" for i in range(2)]

            for node_id in demo_node_ids:
                attempt = 0
                while attempt < max_retries:
                    try:
                        ok = await cluster.create_node(node_id)
                        if ok:
                            # 等待该节点在 cluster.node_ports 中出现，最多等 10s
                            wait_deadline = time.time() + 10
                            while time.time() < wait_deadline:
                                ports = await cluster.get_node_ports()
                                if node_id in ports and ports[node_id] > 0:
                                    created += 1
                                    logger.info(f"演示节点 {node_id} 已就绪，端口: {ports[node_id]}")
                                    break
                                await asyncio.sleep(0.5)
                            else:
                                logger.warning(f"演示节点 {node_id} 创建成功但未在端口映射中注册（可能尚未启动）")
                            break
                        else:
                            attempt += 1
                            logger.warning(f"创建演示节点 {node_id} 失败，重试 {attempt}/{max_retries}...")
                            await asyncio.sleep(retry_delay)
                    except Exception as e:
                        attempt += 1
                        logger.debug(f"创建演示节点 {node_id} 时发生异常: {e} （重试 {attempt}/{max_retries}）")
                        await asyncio.sleep(retry_delay)

            logger.info(f"已尝试创建 {len(demo_node_ids)} 个演示节点，成功创建 {created} 个")

        # 标记服务为已准备好（即已完成Ray初始化及演示节点创建尝试）
        app.state.ready = True
    except Exception as e:
        logger.error(f"startup_event 错误: {e}")


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
        source_node: 源节点IP
        target_node: 目标节点IP
        file_path: 源文件路径
        transfer_mode: 传输模式 (auto/direct/relay)
    """
    try:
        logger.info(f"Transfer request: {source_node}:{file_path} -> {target_node} (mode: {transfer_mode})")
        
        # TODO: 实现实际的节点间文件传输
        # 可以使用以下方式:
        # 1. Ray的对象存储 (适合小文件)
        # 2. SSH/SCP (适合大文件)
        # 3. HTTP流式传输
        
        # 模拟传输
        transfer_id = f"transfer_{int(time.time() * 1000)}"
        
        return {
            "success": True,
            "transfer_id": transfer_id,
            "source_node": source_node,
            "target_node": target_node,
            "file_path": file_path,
            "transfer_mode": transfer_mode,
            "status": "started"
        }
        
    except Exception as e:
        logger.error(f"Transfer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/file-transfer/status/{transfer_id}")
async def get_transfer_status(transfer_id: str):
    """
    获取传输任务状态
    
    Args:
        transfer_id: 传输ID
    """
    try:
        # TODO: 实现真实的传输状态跟踪
        # 目前返回模拟数据
        
        return {
            "transfer_id": transfer_id,
            "status": "in-progress",
            "progress": 45.5,
            "speed": 125.3,  # MB/s
            "eta": 120  # 秒
        }
        
    except Exception as e:
        logger.error(f"Status query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == '__main__':
    web_config = config.get("web_server", {})
    host = web_config.get("host", "0.0.0.0")
    port = web_config.get("port", 8000)
    uvicorn.run(app, host=host, port=port, log_level=web_config.get('log_level','info'))
