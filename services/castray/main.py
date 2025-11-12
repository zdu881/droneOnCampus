# Copied main.py from CastRay (adjusted imports to local package)
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
import time
import json
import os
from pathlib import Path
from typing import List, Optional
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


def _parse_ray_nodes_to_frontend_format(ray_nodes: list, cluster_resources: dict, available_resources: dict):
    parsed_nodes = []
    for node in ray_nodes:
        node_identifier = _extract_node_identifier(node.get('resources_total', {}))
        connection_type = _get_connection_type(node.get('resources_total', {}))
        cpu_usage = _simulate_usage(20, 80)
        memory_usage = _simulate_usage(15, 75)
        gpu_usage = _simulate_usage(10, 90) if node.get('resources_total', {}).get('GPU', 0) > 0 else 0
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
            "resources": {
                "totalCpu": node.get('resources_total', {}).get('CPU', 0),
                "totalMemory": round((node.get('resources_total', {}).get('memory', 0)) / (1024**3)),
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
        # 确保已连接 Ray；不在此处强制启动本地集群
        if not await cluster.ensure_initialized():
            # 降级：仍尝试使用 Dashboard API 获取原始节点信息
            pass

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

        frontend_nodes = _parse_ray_nodes_to_frontend_format(ray_nodes, cluster_resources, available_resources)
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


@app.on_event("startup")
async def startup_event():
    """初始化 Ray 集群连接并（可选）创建演示节点"""
    try:
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

if __name__ == '__main__':
    web_config = config.get("web_server", {})
    host = web_config.get("host", "0.0.0.0")
    port = web_config.get("port", 8000)
    uvicorn.run(app, host=host, port=port, log_level=web_config.get('log_level','info'))
