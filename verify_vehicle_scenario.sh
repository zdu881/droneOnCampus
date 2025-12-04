#!/bin/bash

# 集成测试脚本 - 验证车辆场景功能

echo "=========================================="
echo "🚗 校园无人机车辆场景测试"
echo "=========================================="
echo ""

# 验证HTML文件存在
echo "📋 检查文件..."
if [ -f "/data/home/sim6g/rayCode/droneOnCampus/dashboard.html" ]; then
    echo "✅ dashboard.html 存在"
else
    echo "❌ dashboard.html 不存在"
    exit 1
fi

if [ -f "/data/home/sim6g/rayCode/droneOnCampus/dashboard-manager.js" ]; then
    echo "✅ dashboard-manager.js 存在"
else
    echo "❌ dashboard-manager.js 不存在"
    exit 1
fi

if [ -f "/data/home/sim6g/rayCode/droneOnCampus/js/drone-simple-flight.js" ]; then
    echo "✅ drone-simple-flight.js 存在"
else
    echo "❌ drone-simple-flight.js 不存在"
    exit 1
fi

echo ""
echo "🔍 检查HTML结构..."

# 检查vehicle-scenario-content个数
VEHICLE_COUNT=$(grep -c 'vehicle-scenario-content' /data/home/sim6g/rayCode/droneOnCampus/dashboard.html)
echo "vehicle-scenario-content出现次数: $VEHICLE_COUNT"
if [ "$VEHICLE_COUNT" -eq 1 ]; then
    echo "✅ 只有一个vehicle-scenario-content（正确）"
else
    echo "⚠️  vehicle-scenario-content出现$VEHICLE_COUNT次（应该只有1次）"
fi

# 检查main-content-panel
if grep -q 'class="main-content-panel"' /data/home/sim6g/rayCode/droneOnCampus/dashboard.html; then
    echo "✅ main-content-panel 存在"
else
    echo "❌ main-content-panel 不存在"
fi

# 检查properties-panel
if grep -q 'class="properties-panel"' /data/home/sim6g/rayCode/droneOnCampus/dashboard.html; then
    echo "✅ properties-panel 存在"
else
    echo "❌ properties-panel 不存在"
fi

# 检查飞行控制卡片
if grep -q 'flight-control-card' /data/home/sim6g/rayCode/droneOnCampus/dashboard.html; then
    echo "✅ flight-control-card 存在"
else
    echo "❌ flight-control-card 不存在"
fi

# 检查基站运维卡片
if grep -q 'station-maintenance-card' /data/home/sim6g/rayCode/droneOnCampus/dashboard.html; then
    echo "✅ station-maintenance-card 存在"
else
    echo "❌ station-maintenance-card 不存在"
fi

# 检查灯光控制卡片
if grep -q 'light-control-card' /data/home/sim6g/rayCode/droneOnCampus/dashboard.html; then
    echo "✅ light-control-card 存在"
else
    echo "❌ light-control-card 不存在"
fi

echo ""
echo "🎯 检查JavaScript功能..."

# 检查delivery-btn
DELIVERY_COUNT=$(grep -c 'delivery-btn' /data/home/sim6g/rayCode/droneOnCampus/dashboard.html)
echo "delivery-btn按钮数: $DELIVERY_COUNT"
if [ "$DELIVERY_COUNT" -ge 3 ]; then
    echo "✅ 至少有3个delivery-btn按钮"
else
    echo "⚠️  只找到$DELIVERY_COUNT个delivery-btn按钮"
fi

# 检查drone-simple-flight.js脚本引用
if grep -q 'drone-simple-flight.js' /data/home/sim6g/rayCode/droneOnCampus/dashboard.html; then
    echo "✅ drone-simple-flight.js 已被引用"
else
    echo "❌ drone-simple-flight.js 未被引用"
fi

# 检查DroneSimpleFlightUI类
if grep -q 'class DroneSimpleFlightUI' /data/home/sim6g/rayCode/droneOnCampus/js/drone-simple-flight.js; then
    echo "✅ DroneSimpleFlightUI 类已定义"
else
    echo "❌ DroneSimpleFlightUI 类未定义"
fi

echo ""
echo "⚙️  检查switchScenario方法..."

# 检查switchScenario方法中的修复
if grep -A20 'switchScenario(scenario)' /data/home/sim6g/rayCode/droneOnCampus/dashboard-manager.js | grep -q 'vehicleContent.style.display'; then
    echo "✅ switchScenario包含vehicleContent.style.display更新"
else
    echo "❌ switchScenario缺少vehicleContent.style.display更新"
fi

if grep -A20 'switchScenario(scenario)' /data/home/sim6g/rayCode/droneOnCampus/dashboard-manager.js | grep -q 'viewport-content-page'; then
    echo "✅ switchScenario使用#viewport-content-page标识符"
else
    echo "❌ switchScenario不使用#viewport-content-page标识符"
fi

echo ""
echo "✅ 基础集成测试完成"
echo ""
echo "=========================================="
echo "下一步: 在浏览器中测试"
echo "  1. 访问 http://10.30.2.11:8001/dashboard.html"
echo "  2. 检查控制台是否有错误 (F12)"
echo "  3. 点击'自动驾驶'按钮切换到车辆场景"
echo "  4. 验证三个卡片是否都显示"
echo "=========================================="
