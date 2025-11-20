#!/bin/bash
# 部署CM-ZSB监控服务到Ray节点的脚本

set -e

echo "========================================"
echo "CM-ZSB监控服务部署脚本"
echo "========================================"

# 配置
CM_ZSB_DIR="/data/home/sim6g/rayCode/CM-ZSB"
SCRIPTS_DIR="$CM_ZSB_DIR/experiment/scripts"
SERVICE_NAME="cm-zsb-monitor"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 函数: 打印成功消息
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# 函数: 打印错误消息
error() {
    echo -e "${RED}✗${NC} $1"
}

# 函数: 打印警告消息
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 检查项目目录
if [ ! -d "$CM_ZSB_DIR" ]; then
    error "CM-ZSB项目目录不存在: $CM_ZSB_DIR"
    exit 1
fi

success "找到CM-ZSB项目目录"

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    error "未找到python3"
    exit 1
fi

success "Python3环境检查通过"

# 检查依赖包
echo "检查Python依赖包..."
python3 -c "import fastapi, uvicorn, requests" 2>/dev/null || {
    warning "缺少依赖包,正在安装..."
    pip3 install fastapi uvicorn requests
}

success "依赖包检查通过"

# 修改monitoring_service.py添加新API端点
echo "扩展监控服务API..."

cat > "$SCRIPTS_DIR/monitoring_service_extended.py" << 'PYTHON_CODE'
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
扩展的边缘节点状态监控服务 - 添加节点状态查询API
"""

import sys
import os

# 导入原始监控服务
sys.path.insert(0, os.path.dirname(__file__))
from monitoring_service import app, state_manager

# 添加新端点
@app.get("/api/nodes/{node_identifier}/status")
async def get_node_status(node_identifier: str):
    """
    获取特定节点的工作状态
    
    参数:
        node_identifier: 节点标识符(IP或节点名称)
    
    返回:
        {
            "node_id": str,
            "status": str,  # idle, detecting, sending
            "timestamp": str,
            "details": dict
        }
    """
    current_state = state_manager.get_current_state()
    return {
        "node_id": node_identifier,
        "status": current_state["status"],
        "timestamp": current_state["timestamp"],
        "details": current_state.get("latest_state")
    }

@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "service": "CM-ZSB监控",
        "version": "1.1.0"
    }

if __name__ == "__main__":
    import uvicorn
    
    print("="*80)
    print("CM-ZSB边缘节点监控服务 (扩展版)")
    print("="*80)
    print("服务地址: http://0.0.0.0:8000")
    print("API文档: http://0.0.0.0:8000/docs")
    print("新增端点:")
    print("  - GET /api/health")
    print("  - GET /api/nodes/{node_id}/status")
    print("="*80)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
PYTHON_CODE

chmod +x "$SCRIPTS_DIR/monitoring_service_extended.py"
success "创建扩展监控服务"

# 创建systemd服务文件
echo "创建systemd服务..."

SYSTEMD_FILE="/tmp/${SERVICE_NAME}.service"
cat > "$SYSTEMD_FILE" << EOF
[Unit]
Description=CM-ZSB Edge Node Monitoring Service
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$SCRIPTS_DIR
ExecStart=$(which python3) $SCRIPTS_DIR/monitoring_service_extended.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

success "生成systemd服务文件: $SYSTEMD_FILE"

# 提示安装systemd服务
echo ""
echo "========================================"
echo "下一步操作 (需要sudo权限):"
echo "========================================"
echo ""
echo "1. 安装systemd服务:"
echo "   sudo cp $SYSTEMD_FILE /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable $SERVICE_NAME"
echo "   sudo systemctl start $SERVICE_NAME"
echo ""
echo "2. 查看服务状态:"
echo "   sudo systemctl status $SERVICE_NAME"
echo ""
echo "3. 查看服务日志:"
echo "   sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "或者,手动启动服务(不使用systemd):"
echo "   cd $SCRIPTS_DIR"
echo "   python3 monitoring_service_extended.py"
echo ""
echo "========================================"
echo "验证服务:"
echo "========================================"
echo ""
echo "   curl http://localhost:8000/api/health"
echo "   curl http://localhost:8000/api/status"
echo ""

# 询问是否立即安装
read -p "是否立即安装systemd服务? (需要sudo权限) [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "安装systemd服务..."
    sudo cp "$SYSTEMD_FILE" /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
    sudo systemctl start "$SERVICE_NAME"
    
    sleep 2
    
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        success "服务启动成功!"
        echo ""
        sudo systemctl status "$SERVICE_NAME"
    else
        error "服务启动失败,请检查日志:"
        echo "   sudo journalctl -u $SERVICE_NAME -n 50"
    fi
else
    warning "跳过systemd安装,请手动启动服务"
fi

echo ""
success "部署完成!"
