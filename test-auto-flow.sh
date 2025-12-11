#!/bin/bash
# 端到端测试脚本：模拟 Dashboard → API → Electron 完整流程

echo "=========================================="
echo "🧪 端到端自动流启动测试"
echo "=========================================="
echo ""

API_URL="http://10.30.2.11:8000"
DASHBOARD_API="http://10.30.2.11:8000/api/drone/status"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 检查 API 服务器
echo -e "${BLUE}Step 1: 检查 API 服务器...${NC}"
echo "GET $DASHBOARD_API"
RESPONSE=$(curl -s "$DASHBOARD_API")
if echo "$RESPONSE" | grep -q "isFlying"; then
  echo -e "${GREEN}✅ API 服务器正常${NC}"
  echo "响应: $RESPONSE" | jq .
  INITIAL_STATE=$(echo "$RESPONSE" | jq -r '.isFlying')
  echo "初始状态: isFlying = $INITIAL_STATE"
else
  echo -e "${RED}❌ API 服务器无响应${NC}"
  exit 1
fi

echo ""

# 2. 模拟 Dashboard 更新状态 (就像 api-manager.js 做的)
echo -e "${BLUE}Step 2: 模拟 Dashboard 更新飞行状态...${NC}"
echo "PUT $DASHBOARD_API"
echo "Body: {\"isFlying\": true, \"status\": \"flying\"}"

UPDATE_RESPONSE=$(curl -s -X PUT "$DASHBOARD_API" \
  -H "Content-Type: application/json" \
  -d '{"isFlying": true, "status": "flying"}')
echo "响应: $UPDATE_RESPONSE" | jq .

echo ""

# 3. 验证状态是否已更新
echo -e "${BLUE}Step 3: 验证 API 状态更新...${NC}"
sleep 1
VERIFY_RESPONSE=$(curl -s "$DASHBOARD_API")
CURRENT_STATE=$(echo "$VERIFY_RESPONSE" | jq -r '.isFlying')

if [ "$CURRENT_STATE" = "true" ]; then
  echo -e "${GREEN}✅ 状态已更新为: isFlying = true${NC}"
  echo "完整响应:"
  echo "$VERIFY_RESPONSE" | jq .
else
  echo -e "${RED}❌ 状态未更新，仍为: isFlying = $CURRENT_STATE${NC}"
  echo "完整响应:"
  echo "$VERIFY_RESPONSE" | jq .
fi

echo ""

# 4. 检查 drone-monitor.js 是否会检测到这个变化
echo -e "${BLUE}Step 4: 模拟 Electron 轮询...${NC}"
echo "模拟 drone-monitor.js 的轮询请求..."
for i in {1..3}; do
  echo "轮询 #$i:"
  POLL_RESPONSE=$(curl -s "$DASHBOARD_API")
  FLYING=$(echo "$POLL_RESPONSE" | jq -r '.isFlying')
  echo "  isFlying: $FLYING"
  
  if [ "$FLYING" = "true" ]; then
    echo -e "${GREEN}  → 应该触发 'flight:started' 事件${NC}"
  fi
  
  sleep 0.5
done

echo ""

# 5. 重置状态
echo -e "${BLUE}Step 5: 重置状态...${NC}"
echo "发送 PUT 请求将 isFlying 设置回 false"
curl -s -X PUT "$DASHBOARD_API" \
  -H "Content-Type: application/json" \
  -d '{"isFlying": false, "status": "idle"}' | jq .

echo ""
echo -e "${GREEN}=========================================="
echo "🎯 测试完成"
echo "==========================================${NC}"
echo ""
echo "关键检查点:"
echo "1. ✓ API 服务器是否在 10.30.2.11:8000 运行？"
echo "2. ✓ PUT 请求是否成功更新了 isFlying 状态？"
echo "3. ✓ 轮询请求是否能读取更新后的状态？"
echo "4. ✓ Electron 应用日志中是否出现 'flight:started' 事件？"
echo ""
