#!/bin/bash

# 端口配置验证脚本
# 用于检查所有服务是否可访问

echo "================================================"
echo "droneOnCampus 端口配置验证"
echo "================================================"
echo ""

TARGET_HOST="10.30.2.11"
TIMEOUT=2

# 定义要检查的服务
declare -A services=(
    ["UE Remote Control"]="30010"
    ["Pixel Streaming"]="80"
    ["Ray/CM-ZSB API"]="8000"
    ["CastRay Backend"]="8001"
    ["Frontend Server"]="8080"
    ["Redis"]="6379"
    ["Redis Dashboard"]="8265"
    ["Vehicle Agent"]="5000"
)

echo "目标主机: $TARGET_HOST"
echo ""
echo "检查服务连接情况..."
echo ""

passed=0
failed=0

for service in "${!services[@]}"; do
    port=${services[$service]}
    url="http://$TARGET_HOST:$port"
    
    # 使用 curl 的 --connect-timeout 选项
    if timeout $TIMEOUT curl -s "$url" > /dev/null 2>&1; then
        echo "✅ $service ($port) - 连接成功"
        ((passed++))
    else
        # 尝试 TCP 连接作为后备
        if timeout $TIMEOUT bash -c "echo > /dev/tcp/$TARGET_HOST/$port" 2>/dev/null; then
            echo "✅ $service ($port) - TCP 连接成功"
            ((passed++))
        else
            echo "❌ $service ($port) - 无法连接"
            ((failed++))
        fi
    fi
done

echo ""
echo "================================================"
echo "总结: $passed 个服务正常，$failed 个服务异常"
echo "================================================"
echo ""

# 额外的验证
echo "详细验证..."
echo ""

# 检查 UE Remote Control
echo "1. UE Remote Control API 详细检查:"
if timeout $TIMEOUT curl -s "http://$TARGET_HOST:30010/remote/info" | grep -q "routes" 2>/dev/null; then
    echo "   ✅ API 响应正常 (含 routes)"
else
    echo "   ⚠️  API 可能未就绪"
fi
echo ""

# 检查 Ray/CM-ZSB
echo "2. Ray/CM-ZSB API 详细检查:"
if timeout $TIMEOUT curl -s "http://$TARGET_HOST:8000/api/status" 2>/dev/null | grep -q "nodes\|status" 2>/dev/null; then
    echo "   ✅ API 响应正常"
else
    echo "   ⚠️  API 可能未就绪或路径不同"
fi
echo ""

# 检查 Pixel Streaming
echo "3. Pixel Streaming 详细检查:"
if timeout $TIMEOUT curl -s -I "http://$TARGET_HOST:80/" | grep -q "200\|302\|301" 2>/dev/null; then
    echo "   ✅ 服务正在运行"
else
    echo "   ⚠️  服务可能未启动"
fi
echo ""

echo "================================================"
echo "验证完成"
echo "================================================"
