#!/bin/bash
# 项目启动状态检查脚本

echo "════════════════════════════════════════════════════════════"
echo "           🔍 系统启动状态检查"
echo "════════════════════════════════════════════════════════════"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_port() {
    local port=$1
    local name=$2
    
    if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
        echo -e "${GREEN}✓${NC} $name (端口 $port) - 运行中"
        return 0
    else
        echo -e "${RED}✗${NC} $name (端口 $port) - 未运行"
        return 1
    fi
}

echo "📡 核心服务状态:"
echo ""
check_port 30010 "UE Program v1.2"
check_port 8888 "Cirrus 信令服务"
check_port 28823 "CastRay 后端"
check_port 8080 "前端仪表板"
check_port 9999 "Ray 输出 API"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "🌐 访问地址:"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "主仪表板:       http://localhost:8080/dashboard.html"
echo "UE 诊断工具:    http://localhost:8080/ue_api_diagnostic.html"
echo "LED 演示:       http://localhost:8080/diagnostic-demo.html"
echo "CastRay API:    http://10.30.2.11:28823/docs"
echo ""
