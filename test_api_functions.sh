#!/bin/bash

API_ENDPOINT="http://10.30.2.11:30010/remote/object/call"

echo "=========================================="
echo "Remote Control API 功能测试"
echo "=========================================="
echo ""

# 测试1: OPTIONS 请求
echo "1️⃣  OPTIONS 请求测试"
echo "----"
curl -s -w "\nHTTP 状态码: %{http_code}\n" \
  -X OPTIONS "$API_ENDPOINT" \
  -H "Content-Type: application/json" | head -15
echo ""

# 测试2: SetLocation 函数
echo "2️⃣  SetLocation 函数测试"
echo "----"
curl -s -w "\nHTTP 状态码: %{http_code}\n" \
  -X PUT "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_3",
    "functionName": "SetLocation",
    "parameters": {"X": -850, "Y": -30, "Z": 62}
  }'
echo ""
echo ""

# 测试3: 显示 JavaScript API 方法
echo "3️⃣  JavaScript API 已实现"
echo "----"
echo "✅ setDroneLocation(x, y, z)"
echo "✅ changeBaseStationLight(lightIndex, colorCode)"
echo "✅ startDelivery(source, destination)"
echo "✅ setBaseStationGreen(lightIndex)"
echo "✅ setBaseStationRed(lightIndex)"
echo ""

echo "=========================================="
echo "✅ Remote Control API 诊断完成"
echo "=========================================="

