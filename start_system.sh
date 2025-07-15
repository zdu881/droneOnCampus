#!/bin/bash
# 启动多场景5G网络控制系统

echo "=== 5G Campus Network Control - Multi-Scenario ==="
echo "启动自动驾驶汽车和无人机双场景支持系统..."

# 检查Python依赖
echo "检查Python依赖..."
pip install flask flask-cors pyyaml requests

# 启动Python后端服务
echo "启动Agent决策后端服务..."
python3 vehicle_mec_agent.py &
PYTHON_PID=$!

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if curl -s http://localhost:5000/api/vehicle/status > /dev/null; then
    echo "✓ 后端服务启动成功 (PID: $PYTHON_PID)"
else
    echo "✗ 后端服务启动失败"
    kill $PYTHON_PID 2>/dev/null
    exit 1
fi

# 启动前端服务器
echo "启动前端Web服务器..."
if command -v python3 -m http.server &>/dev/null; then
    python3 -m http.server 8080 &
    HTTP_PID=$!
    echo "✓ 前端服务启动成功 (PID: $HTTP_PID)"
    echo "✓ 访问地址: http://localhost:8080"
elif command -v python -m SimpleHTTPServer &>/dev/null; then
    python -m SimpleHTTPServer 8080 &
    HTTP_PID=$!
    echo "✓ 前端服务启动成功 (PID: $HTTP_PID)"
    echo "✓ 访问地址: http://localhost:8080"
else
    echo "✗ 无法启动HTTP服务器，请手动启动"
fi

echo ""
echo "=== 系统启动完成 ==="
echo "场景1: 无人机配送 - 原有功能"
echo "场景2: 自动驾驶汽车MEC切换 - 新增功能"
echo ""
echo "Agent决策后端: http://localhost:5000"
echo "前端界面: http://localhost:8080"
echo ""
echo "按 Ctrl+C 停止所有服务..."

# 等待中断信号
trap 'echo "正在停止服务..."; kill $PYTHON_PID $HTTP_PID 2>/dev/null; exit 0' INT

# 保持脚本运行
wait
