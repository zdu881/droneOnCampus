#!/bin/bash
# 
# 无人机飞行自动化完整启动指南
# Campus Drone Digital Twin - Electron 自动流检测系统
#

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Campus Drone Digital Twin - 飞行自动化完整启动              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 设置颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}【第 1 步】启动 Dashboard API Server${NC}"
echo "启动 Dashboard API Server（监听 8000 端口）"
cd /data/home/sim6g/rayCode/droneOnCampus

# 杀死旧进程
pkill -f "node server.js" 2>/dev/null || true
sleep 1

# 启动新服务器
nohup node server.js > /tmp/api_server.log 2>&1 &
sleep 2

# 验证
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Dashboard API Server 已启动${NC}"
else
  echo -e "${YELLOW}⚠️ API Server 启动失败，查看日志:${NC}"
  cat /tmp/api_server.log
  exit 1
fi

echo ""
echo -e "${BLUE}【第 2 步】启动 Dashboard 前端${NC}"
echo "前端地址: http://localhost:8081/dashboard.html"
echo "（确保 Python HTTP Server 在端口 8081 运行）"

echo ""
echo -e "${BLUE}【第 3 步】飞行流程${NC}"
echo ""
echo "1️⃣ 在 Dashboard 中点击「开始飞行」按钮"
echo "   - Dashboard 调用 UE API 执行 Fly() 函数"
echo "   - 同时更新 Dashboard API: PUT /api/drone/status { isFlying: true }"
echo ""
echo "2️⃣ Electron 应用自动检测飞行状态变化"
echo "   - 每 500ms 轮询一次 /api/drone/status"
echo "   - 检测到 isFlying: false → true 时自动启动像素流"
echo ""
echo "3️⃣ API Server 自动停止飞行"
echo "   - 30 秒后自动重置: isFlying: false"
echo "   - Electron 检测到状态变化并停止流"
echo ""

echo -e "${BLUE}【系统状态】${NC}"
echo ""
echo "📊 API 端点:"
echo "   🌐 GET  /api/drone/status   - 获取飞行状态"
echo "   🌐 PUT  /api/drone/status   - 设置飞行状态（30秒自动重置）"
echo "   🌐 GET  /api/health         - 健康检查"
echo ""
echo "📍 服务地址:"
echo "   Dashboard API: http://localhost:8000"
echo "   Frontend:      http://localhost:8081"
echo "   UE Remote:     http://10.30.2.11:30010"
echo "   Pixel Stream:  http://10.30.2.11:80"
echo ""

echo -e "${GREEN}🎉 系统启动完成，开始测试！${NC}"
echo ""
echo "测试命令:"
echo "  curl -s http://localhost:8000/api/health | jq ."
echo "  curl -s http://localhost:8000/api/drone/status | jq ."
echo ""
