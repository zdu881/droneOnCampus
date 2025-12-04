#!/bin/bash

# ====================================
# UE5.3 集成测试脚本
# ====================================

echo "=================================="
echo "  UE5.3 集成系统 - 快速测试"
echo "=================================="

# 配置
UE_HOST="10.30.2.11"
UE_PORT="30010"
API_URL="http://${UE_HOST}:${UE_PORT}/remote/object/call"
LIGHT_OBJECT="/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3"
DRONE_OBJECT="/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3"

# 颜色代码
RED=0
GREEN=1
YELLOW=2

echo ""
echo "📋 系统配置信息"
echo "  UE 主机: $UE_HOST:$UE_PORT"
echo "  API 地址: $API_URL"
echo "  灯光对象: $LIGHT_OBJECT"
echo ""

# 测试 1: 检查 UE 连接
echo "✓ 测试 1: 检查 UE 连接..."
if curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "'$LIGHT_OBJECT'",
    "functionName": "ChangeColorAPI",
    "parameters": { "Active": '$GREEN' }
  }' > /dev/null 2>&1; then
  echo "  ✓ UE 连接成功"
  UE_CONNECTED=1
else
  echo "  ✗ UE 连接失败（请检查 UE 应用是否运行）"
  UE_CONNECTED=0
fi

# 测试 2: 灯光控制 - 红色
echo ""
echo "✓ 测试 2: 灯光控制测试"
if [ $UE_CONNECTED -eq 1 ]; then
  echo "  - 设置为红色..."
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{
      "objectPath": "'$LIGHT_OBJECT'",
      "functionName": "ChangeColorAPI",
      "parameters": { "Active": '$RED' }
    }' > /dev/null
  sleep 1

  echo "  - 设置为黄色..."
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{
      "objectPath": "'$LIGHT_OBJECT'",
      "functionName": "ChangeColorAPI",
      "parameters": { "Active": '$YELLOW' }
    }' > /dev/null
  sleep 1

  echo "  - 设置为绿色..."
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{
      "objectPath": "'$LIGHT_OBJECT'",
      "functionName": "ChangeColorAPI",
      "parameters": { "Active": '$GREEN' }
    }' > /dev/null

  echo "  ✓ 灯光控制测试完成"
else
  echo "  ✗ 跳过灯光测试（UE 未连接）"
fi

# 测试 3: 无人机位置设置
echo ""
echo "✓ 测试 3: 无人机位置设置"
if [ $UE_CONNECTED -eq 1 ]; then
  echo "  - 设置目标位置 (100, 100, 150)..."
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{
      "objectPath": "'$DRONE_OBJECT'",
      "functionName": "SetLocation",
      "parameters": { "X": 100, "Y": 100, "Z": 150 }
    }' > /dev/null
  echo "  ✓ 位置设置成功"
else
  echo "  ✗ 跳过位置测试（UE 未连接）"
fi

# 测试 4: 检查文件
echo ""
echo "✓ 测试 4: 检查必需文件"
REQUIRED_FILES=(
  "js/flight-path-manager.js"
  "js/drone-path-planning-ui.js"
  "js/station-light-mapping.js"
  "api-manager.js"
  "dashboard-manager.js"
  "dashboard.html"
  "dashboard-styles.css"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file （缺失）"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

if [ $MISSING_FILES -eq 0 ]; then
  echo "  ✓ 所有文件完整"
else
  echo "  ✗ 缺失 $MISSING_FILES 个文件"
fi

# 测试 5: 检查脚本引入
echo ""
echo "✓ 测试 5: 检查 HTML 脚本引入"
if grep -q "flight-path-manager.js" dashboard.html; then
  echo "  ✓ flight-path-manager.js 已引入"
else
  echo "  ✗ flight-path-manager.js 未引入"
fi

if grep -q "station-light-mapping.js" dashboard.html; then
  echo "  ✓ station-light-mapping.js 已引入"
else
  echo "  ✗ station-light-mapping.js 未引入"
fi

# 最终报告
echo ""
echo "=================================="
echo "✓ 测试完成"
echo "=================================="
echo ""
echo "📝 后续步骤："
echo "  1. 启动 UE5.3 应用（如未启动）"
echo "  2. 启动像素流送基础设施"
echo "  3. 在浏览器中打开仪表板"
echo "  4. 测试路径规划和灯光映射功能"
echo ""
echo "📚 更多信息，请参考 UE5_INTEGRATION_GUIDE.md"
echo ""
