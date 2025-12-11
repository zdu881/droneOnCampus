#!/bin/bash
# Electron 自动流启动诊断脚本
# 用法: bash diagnose-auto-flow.sh

echo "=========================================="
echo "🔍 Electron 自动流启动诊断"
echo "=========================================="
echo ""

# 1. 检查 Dashboard API 服务器
echo "1️⃣ 检查 Dashboard API 服务器..."
if curl -s http://10.30.2.11:8000/api/drone/status | grep -q isFlying; then
  echo "   ✅ API 服务器运行正常"
  echo "   📊 当前状态:"
  curl -s http://10.30.2.11:8000/api/drone/status | jq .
else
  echo "   ❌ API 服务器无响应或不可达"
  echo "   尝试检查 localhost..."
  if curl -s http://localhost:8000/api/drone/status | grep -q isFlying; then
    echo "   ⚠️ API 仅在 localhost 可访问，需要修复网络配置"
  fi
fi

echo ""

# 2. 测试状态更新
echo "2️⃣ 测试 API 状态更新..."
echo "   发送 PUT 请求设置 isFlying=true..."
curl -X PUT http://10.30.2.11:8000/api/drone/status \
  -H "Content-Type: application/json" \
  -d '{"isFlying": true, "status": "flying"}' \
  -s | jq .

sleep 1

echo ""
echo "   验证状态是否更新..."
curl -s http://10.30.2.11:8000/api/drone/status | jq .

echo ""

# 3. 检查网络接口
echo "3️⃣ 检查网络接口..."
if ifconfig 2>/dev/null | grep -q "10.30.2.11"; then
  echo "   ✅ 10.30.2.11 是本机地址"
  ifconfig | grep -A 1 "10.30.2.11" || ip addr | grep "10.30.2.11"
else
  echo "   ℹ️ 10.30.2.11 不是本机地址（这是正常的如果这是远程连接）"
  echo "   本机 IP 地址:"
  hostname -I
fi

echo ""

# 4. 检查端口绑定
echo "4️⃣ 检查端口绑定..."
echo "   Port 8000 (Dashboard API):"
netstat -tlnp 2>/dev/null | grep 8000 || ss -tlnp 2>/dev/null | grep 8000 || echo "   (无法检查，尝试 lsof)"

echo "   Port 80 (像素流):"
netstat -tlnp 2>/dev/null | grep :80 || ss -tlnp 2>/dev/null | grep :80 || echo "   (无法检查)"

echo ""

# 5. 建议
echo "5️⃣ 诊断建议:"
echo "   ✓ 确认 API 服务器在 0.0.0.0:8000 上运行"
echo "   ✓ 确认 Dashboard 的 api-manager.js 更新了 API 状态"
echo "   ✓ 确认 Electron 应用能连接到 10.30.2.11:8000"
echo "   ✓ 检查 drone-monitor.js 是否正确发送了 'flight:started' 事件"
echo ""

echo "=========================================="
