#!/bin/bash
#
# 完整系统启动脚本 - 正确的启动顺序
# 1. Dashboard API Server (8000)
# 2. Static File Server (8081)  
#

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Campus Drone System - Complete Launch                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
WORK_DIR="/data/home/sim6g/rayCode/droneOnCampus"
API_SERVER_PORT=8000
STATIC_SERVER_PORT=8081
API_SERVER_LOG="/tmp/api_server.log"
STATIC_SERVER_LOG="/tmp/static_server.log"

# 清理旧进程
cleanup_old_processes() {
  echo -e "${BLUE}【清理旧进程】${NC}"
  pkill -f "node server.js" 2>/dev/null || true
  pkill -f "python.*http.server.*8081" 2>/dev/null || true
  sleep 1
  echo -e "${GREEN}✅ 清理完成${NC}"
  echo ""
}

# 启动 Dashboard API Server
start_api_server() {
  echo -e "${BLUE}【1️⃣  启动 Dashboard API Server】${NC}"
  cd "$WORK_DIR"
  
  # 检查端口
  if lsof -i :$API_SERVER_PORT > /dev/null 2>&1; then
    echo -e "${RED}❌ 端口 $API_SERVER_PORT 已被占用${NC}"
    exit 1
  fi
  
  # 启动服务器
  nohup node server.js > "$API_SERVER_LOG" 2>&1 &
  API_PID=$!
  echo -e "✓ 进程启动 (PID: $API_PID)"
  sleep 2
  
  # 验证
  if curl -s http://localhost:$API_SERVER_PORT/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API Server 已启动 (端口 $API_SERVER_PORT)${NC}"
  else
    echo -e "${RED}❌ API Server 启动失败${NC}"
    echo "日志内容:"
    cat "$API_SERVER_LOG"
    exit 1
  fi
  echo ""
}

# 启动静态文件服务器
start_static_server() {
  echo -e "${BLUE}【2️⃣  启动静态文件服务器】${NC}"
  cd "$WORK_DIR"
  
  # 检查端口
  if lsof -i :$STATIC_SERVER_PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  端口 $STATIC_SERVER_PORT 已被占用（跳过）${NC}"
    echo ""
    return
  fi
  
  # 启动服务器
  nohup python3 -m http.server $STATIC_SERVER_PORT > "$STATIC_SERVER_LOG" 2>&1 &
  STATIC_PID=$!
  echo -e "✓ 进程启动 (PID: $STATIC_PID)"
  sleep 1
  
  echo -e "${GREEN}✅ Static Server 已启动 (端口 $STATIC_SERVER_PORT)${NC}"
  echo ""
}

# 显示系统状态
show_system_status() {
  echo -e "${BLUE}【📊 系统状态】${NC}"
  echo ""
  echo -e "${GREEN}✅ 正在运行的服务:${NC}"
  
  if curl -s http://localhost:$API_SERVER_PORT/api/health > /dev/null 2>&1; then
    echo "   🌐 Dashboard API Server: http://localhost:$API_SERVER_PORT"
  else
    echo "   ❌ Dashboard API Server: 未响应"
  fi
  
  if lsof -i :$STATIC_SERVER_PORT > /dev/null 2>&1; then
    echo "   📄 Static File Server: http://localhost:$STATIC_SERVER_PORT"
    echo "   🎨 Dashboard: http://localhost:$STATIC_SERVER_PORT/dashboard.html"
  fi
  
  echo ""
  echo -e "${GREEN}📌 API 端点:${NC}"
  echo "   GET  /api/drone/status    - 获取飞行状态"
  echo "   PUT  /api/drone/status    - 设置飞行状态（30秒自动重置）"
  echo "   GET  /api/health          - 健康检查"
  echo ""
  
  echo -e "${GREEN}🎯 工作流程:${NC}"
  echo "   1. 打开浏览器: http://localhost:$STATIC_SERVER_PORT/dashboard.html"
  echo "   2. 在 Dashboard 中点击「开始飞行」按钮"
  echo "   3. Dashboard 调用 UE Fly() + 更新 API 飞行状态"
  echo "   4. Electron 应用检测状态变化 → 自动启动像素流"
  echo "   5. 30 秒后 API 自动重置 → 流自动停止"
  echo ""
}

# 主流程
main() {
  cleanup_old_processes
  start_api_server
  start_static_server
  show_system_status
  
  echo -e "${GREEN}🎉 系统启动完成！${NC}"
  echo ""
  echo "🛑 按 Ctrl+C 停止系统"
  
  # 保持进程运行
  sleep infinity &
  SLEEP_PID=$!
  
  trap "kill $SLEEP_PID 2>/dev/null; echo ''; echo '停止系统...'; pkill -f 'node server.js' 2>/dev/null; pkill -f 'python.*http.server' 2>/dev/null; exit 0" SIGINT SIGTERM
  
  wait
}

# 执行
main
