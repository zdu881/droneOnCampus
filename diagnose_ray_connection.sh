#!/bin/bash

# Ray Cluster 连接诊断脚本
# 用于诊断 WebSocket 和 API 连接问题

echo "════════════════════════════════════════════════════════════"
echo "           Ray Cluster WebSocket 连接诊断"
echo "════════════════════════════════════════════════════════════"
echo

# 配置项
HOSTS=("localhost" "127.0.0.1" "10.30.2.11")
RAY_API_PORT=8000
CASTRAY_API_PORT=8001

echo "🔍 第一步: 检查服务是否在监听端口"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# 检查端口是否监听
for port in $RAY_API_PORT $CASTRAY_API_PORT; do
    echo "检查端口 $port..."
    if ss -tuln | grep -q ":$port "; then
        echo "  ✓ 端口 $port 在监听"
        ss -tuln | grep ":$port "
    else
        echo "  ✗ 端口 $port 没有在监听"
    fi
    echo
done

echo "🔍 第二步: 测试 HTTP 连接"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

for host in "${HOSTS[@]}"; do
    echo "测试 $host:$RAY_API_PORT/api/ray-dashboard"
    if timeout 2 curl -s "http://$host:$RAY_API_PORT/api/ray-dashboard" > /dev/null 2>&1; then
        echo "  ✓ 可连接"
        curl -s "http://$host:$RAY_API_PORT/api/ray-dashboard" | head -c 100
        echo "  ..."
    else
        echo "  ✗ 无法连接"
    fi
    echo
done

echo "🔍 第三步: 检查防火墙规则"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

if command -v ufw &> /dev/null; then
    echo "UFW 状态:"
    sudo ufw status | head -5
else
    echo "UFW 未安装，尝试检查 iptables..."
    sudo iptables -L -n 2>/dev/null | grep -E "8000|8001" || echo "  (iptables 规则复杂，手动检查)"
fi
echo

echo "🔍 第四步: 检查正在运行的 Ray/CM-ZSB 进程"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

if ps aux | grep -v grep | grep -E 'ray|cm_zsb' > /dev/null; then
    echo "找到正在运行的进程:"
    ps aux | grep -E 'ray|cm_zsb' | grep -v grep
else
    echo "✗ 未找到 Ray 或 CM-ZSB 进程"
    echo ""
    echo "要启动 Ray 集群，请运行:"
    echo "  ray start --head --port=8000"
    echo ""
    echo "或启动 CM-ZSB:"
    echo "  python -m cm_zsb.server --port 8000"
fi
echo

echo "🔍 第五步: 网络配置信息"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo "本机 IP 地址:"
hostname -I
echo

echo "所有监听的端口:"
ss -tuln | grep LISTEN | awk '{print $4}' | sort -u
echo

echo "════════════════════════════════════════════════════════════"
echo "📋 诊断结果总结"
echo "════════════════════════════════════════════════════════════"
echo

# 最后的总结
if ss -tuln | grep -q ":$RAY_API_PORT "; then
    echo "✓ Ray API 端口在监听"
else
    echo "✗ Ray API 端口未监听 - 需要启动服务"
fi

if ss -tuln | grep -q ":$CASTRAY_API_PORT "; then
    echo "✓ CastRay API 端口在监听"
else
    echo "  CastRay API 端口未监听（可选）"
fi

echo
echo "🔧 建议的下一步:"
echo "1. 如果没有进程运行，请启动 Ray 或 CM-ZSB 服务"
echo "2. 确保客户端 IP 配置正确（localhost 或 10.30.2.11）"
echo "3. 在浏览器控制台验证连接:"
echo "   fetch('http://localhost:8000/api/ray-dashboard')"
echo "4. 如果仍然无法连接，检查防火墙设置"
echo

echo "════════════════════════════════════════════════════════════"
