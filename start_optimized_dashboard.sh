#!/bin/bash
# Dashboard 快速启动脚本 - 包含UI优化版本
# 使用方法: ./start_optimized_dashboard.sh

echo "=========================================="
echo "  启动优化版 Dashboard"
echo "=========================================="
echo ""

# 检查当前目录
if [ ! -f "dashboard.html" ]; then
    echo "错误: 请在 droneOnCampus 目录下运行此脚本"
    exit 1
fi

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查CastRay后端
echo -n "检查CastRay后端服务... "
if curl -s -o /dev/null -w "%{http_code}" http://10.30.2.11:8000/api/ray-dashboard | grep -q "200"; then
    echo -e "${GREEN}✓ 运行中${NC}"
else
    echo -e "${YELLOW}⚠ 未运行${NC}"
    echo "提示: CastRay后端未运行，某些功能可能不可用"
    echo "可以运行: python3 -m uvicorn services.castray.main:app --host 0.0.0.0 --port 8000 --reload"
    echo ""
fi

# 检查静态文件服务器
echo -n "检查静态文件服务器... "
if lsof -i :8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 运行中${NC}"
    NEED_START_SERVER=false
else
    echo -e "${YELLOW}⚠ 未运行${NC}"
    NEED_START_SERVER=true
fi

# 启动静态文件服务器
if [ "$NEED_START_SERVER" = true ]; then
    echo ""
    echo "启动静态文件服务器..."
    nohup python3 -m http.server 8080 --bind 0.0.0.0 > /tmp/dashboard_http_server.log 2>&1 &
    SERVER_PID=$!
    echo "服务器PID: $SERVER_PID"
    sleep 2
    
    if ps -p $SERVER_PID > /dev/null; then
        echo -e "${GREEN}✓ 静态文件服务器启动成功${NC}"
    else
        echo -e "${RED}✗ 静态文件服务器启动失败${NC}"
        echo "查看日志: tail -f /tmp/dashboard_http_server.log"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Dashboard 已准备就绪！${NC}"
echo "=========================================="
echo ""
echo "访问地址:"
echo "  主Dashboard: http://10.30.2.11:8080/dashboard.html"
echo ""
echo "新功能亮点:"
echo "  ✨ 文件传输独立标签页（支持拖拽上传）"
echo "  ✨ 优化的节点卡片设计（渐变+发光效果）"
echo "  ✨ 传输历史记录和队列管理"
echo "  ✨ 改进的响应式布局"
echo "  ✨ 统一的配色方案和动画效果"
echo ""
echo "使用提示:"
echo "  1. 点击侧边栏'文件传输'查看新功能"
echo "  2. 悬停在节点卡片上查看详细信息"
echo "  3. 拖拽文件到上传区域快速上传"
echo ""
echo "日志文件:"
echo "  静态服务器: /tmp/dashboard_http_server.log"
echo "  CastRay: /tmp/castray.log (如果使用后台运行)"
echo ""
echo "停止服务:"
echo "  pkill -f 'python3 -m http.server 8080'"
echo ""

# 自动打开浏览器（可选）
read -p "是否自动打开浏览器? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v xdg-open > /dev/null; then
        xdg-open "http://10.30.2.11:8080/dashboard.html"
    elif command -v firefox > /dev/null; then
        firefox "http://10.30.2.11:8080/dashboard.html" &
    elif command -v google-chrome > /dev/null; then
        google-chrome "http://10.30.2.11:8080/dashboard.html" &
    else
        echo "未找到浏览器，请手动打开: http://10.30.2.11:8080/dashboard.html"
    fi
fi

echo ""
echo "按 Ctrl+C 退出..."
echo ""

# 保持脚本运行
if [ "$NEED_START_SERVER" = true ]; then
    tail -f /tmp/dashboard_http_server.log
else
    echo "服务器已在后台运行"
fi
