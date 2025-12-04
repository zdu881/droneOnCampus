#!/bin/bash

# 集成测试脚本 - 验证 Campus Drone Digital Twin 系统
# 测试 Remote Control API, 灯光控制, 无人机飞行, 像素流送

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Campus Drone Digital Twin - 系统集成测试                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试计数
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# 配置
UE_HOST="10.30.2.11"
UE_PORT="30010"
UE_API="http://${UE_HOST}:${UE_PORT}/remote/object/call"
STREAMER_PORT="8888"
PLAYER_PORT="80"
DASHBOARD_PORT="8000"

# 关键对象路径
LEVEL_BLUEPRINT="/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3"
LIGHT_1="/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057"
LIGHT_2="/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1321381589"
LIGHT_3="/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1393896590"

# 测试函数
test_port_open() {
    local host=$1
    local port=$2
    local service=$3
    
    echo -e "\n${BLUE}[测试 $TESTS_TOTAL]${NC} 检查 $service 端口 ${host}:${port}..."
    ((TESTS_TOTAL++))
    
    if timeout 2 bash -c "cat < /dev/null > /dev/tcp/${host}/${port}" 2>/dev/null; then
        echo -e "${GREEN}✓ $service 端口开放${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ $service 端口关闭或无响应${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

test_http_endpoint() {
    local url=$1
    local method=$2
    local data=$3
    local description=$4
    
    echo -e "\n${BLUE}[测试 $TESTS_TOTAL]${NC} $description"
    ((TESTS_TOTAL++))
    
    local response=$(curl -s -w "\n%{http_code}" -X "${method}" \
        -H "Content-Type: application/json" \
        -d "${data}" \
        "${url}" 2>/dev/null || echo -e "\n000")
    
    local http_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | head -n -1)
    
    if [[ $http_code == "200" ]] || [[ $http_code == "204" ]]; then
        echo -e "${GREEN}✓ 请求成功 (HTTP $http_code)${NC}"
        echo "  响应: ${body:0:100}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ 请求失败 (HTTP $http_code)${NC}"
        echo "  响应: ${body:0:100}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# ====================================
# 1. 网络连接测试
# ====================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}第 1 阶段: 网络连接测试${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

test_port_open "$UE_HOST" "$UE_PORT" "UE Remote Control API"
test_port_open "$UE_HOST" "$STREAMER_PORT" "Pixel Streaming Streamer (WebSocket)"
test_port_open "$UE_HOST" "$PLAYER_PORT" "Pixel Streaming Players (HTTP)"
test_port_open "localhost" "$DASHBOARD_PORT" "Dashboard Server"

# ====================================
# 2. Remote Control API 测试
# ====================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}第 2 阶段: Remote Control API 功能测试${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}2.1 测试 SetLocation 函数${NC}"
test_http_endpoint "$UE_API" "PUT" \
    "{\"objectPath\": \"$LEVEL_BLUEPRINT\", \"functionName\": \"SetLocation\", \"parameters\": {\"X\": 100, \"Y\": 200, \"Z\": 150}}" \
    "设置无人机目标位置 (100, 200, 150)"

echo -e "\n${BLUE}2.2 测试 Fly 函数${NC}"
test_http_endpoint "$UE_API" "PUT" \
    "{\"objectPath\": \"$LEVEL_BLUEPRINT\", \"functionName\": \"Fly\", \"parameters\": {}}" \
    "执行无人机飞行"

echo -e "\n${BLUE}2.3 测试 ChangeView 函数${NC}"
test_http_endpoint "$UE_API" "PUT" \
    "{\"objectPath\": \"$LEVEL_BLUEPRINT\", \"functionName\": \"ChangeView\", \"parameters\": {}}" \
    "改变摄像头视角"

# ====================================
# 3. 灯光控制测试
# ====================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}第 3 阶段: 灯光控制测试${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}3.1 灯光 1 - 改为红色${NC}"
test_http_endpoint "$UE_API" "PUT" \
    "{\"objectPath\": \"$LIGHT_1\", \"functionName\": \"ChangeColorAPI\", \"parameters\": {\"Active\": 0}}" \
    "灯光 1 改为红色"

echo -e "\n${BLUE}3.2 灯光 2 - 改为绿色${NC}"
test_http_endpoint "$UE_API" "PUT" \
    "{\"objectPath\": \"$LIGHT_2\", \"functionName\": \"ChangeColorAPI\", \"parameters\": {\"Active\": 1}}" \
    "灯光 2 改为绿色"

echo -e "\n${BLUE}3.3 灯光 3 - 改为黄色${NC}"
test_http_endpoint "$UE_API" "PUT" \
    "{\"objectPath\": \"$LIGHT_3\", \"functionName\": \"ChangeColorAPI\", \"parameters\": {\"Active\": 2}}" \
    "灯光 3 改为黄色"

# ====================================
# 4. 完整飞行演示测试
# ====================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}第 4 阶段: 完整飞行演示测试${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

# 预设位置
declare -A locations
locations[warehouse]="0,0,100"
locations[library]="-850,-30,62"
locations[dormitory]="500,400,80"

echo -e "\n${BLUE}4.1 飞行演示: 仓库 → 图书馆${NC}"
IFS=',' read x y z <<< "${locations[warehouse]}"
test_http_endpoint "$UE_API" "PUT" \
    "{\"objectPath\": \"$LEVEL_BLUEPRINT\", \"functionName\": \"SetLocation\", \"parameters\": {\"X\": $x, \"Y\": $y, \"Z\": $z}}" \
    "设置起点: 仓库 ($x, $y, $z)"

sleep 1

IFS=',' read x y z <<< "${locations[library]}"
test_http_endpoint "$UE_API" "PUT" \
    "{\"objectPath\": \"$LEVEL_BLUEPRINT\", \"functionName\": \"SetLocation\", \"parameters\": {\"X\": $x, \"Y\": $y, \"Z\": $z}}" \
    "设置终点: 图书馆 ($x, $y, $z)"

test_http_endpoint "$UE_API" "PUT" \
    "{\"objectPath\": \"$LEVEL_BLUEPRINT\", \"functionName\": \"Fly\", \"parameters\": {}}" \
    "执行飞行"

# ====================================
# 5. 像素流送验证
# ====================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}第 5 阶段: 像素流送验证${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}[测试 $TESTS_TOTAL]${NC} 检查像素流送默认页面"
((TESTS_TOTAL++))

response=$(curl -s -w "\n%{http_code}" "http://${UE_HOST}:${PLAYER_PORT}/" 2>/dev/null || echo -e "\n000")
http_code=$(echo "$response" | tail -n 1)

if [[ $http_code == "200" ]]; then
    echo -e "${GREEN}✓ 像素流送默认页面可访问${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ 像素流送默认页面无响应 (HTTP $http_code)${NC}"
    ((TESTS_FAILED++))
fi

# ====================================
# 测试总结
# ====================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}测试总结${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

echo ""
echo -e "总测试数: ${BLUE}$TESTS_TOTAL${NC}"
echo -e "通过: ${GREEN}$TESTS_PASSED${NC}"
echo -e "失败: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ 所有测试通过！系统集成正常${NC}"
    exit 0
else
    echo -e "\n${RED}✗ 部分测试失败，请检查系统配置${NC}"
    exit 1
fi
