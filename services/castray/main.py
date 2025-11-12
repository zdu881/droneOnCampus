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
from typing import List
import logging

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
