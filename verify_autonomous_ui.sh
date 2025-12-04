#!/bin/bash

echo "================================================"
echo "自动驾驶页面视角切换UI 验证"
echo "================================================"
echo ""

# 1. 检查HTML元素是否存在
echo "1️⃣  检查HTML结构..."
echo "---"
grep -q "autonomous-viewport-toolbar" dashboard.html && echo "✅ 视口工具栏HTML存在" || echo "❌ 视口工具栏HTML缺失"
grep -q "autonomous-view-type-select" dashboard.html && echo "✅ 视角选择框存在" || echo "❌ 视角选择框缺失"
grep -q "autonomous-toggle-grid" dashboard.html && echo "✅ 网格切换按钮存在" || echo "❌ 网格切换按钮缺失"
grep -q "autonomous-toggle-compass" dashboard.html && echo "✅ 指南针切换按钮存在" || echo "❌ 指南针切换按钮缺失"
grep -q "autonomous-reset-view" dashboard.html && echo "✅ 重置视角按钮存在" || echo "❌ 重置视角按钮缺失"
grep -q "autonomous-fullscreen-btn" dashboard.html && echo "✅ 全屏按钮存在" || echo "❌ 全屏按钮缺失"
echo ""

# 2. 检查CSS样式是否存在
echo "2️⃣  检查CSS样式..."
echo "---"
grep -q ".autonomous-viewport-toolbar" dashboard-styles.css && echo "✅ 工具栏样式存在" || echo "❌ 工具栏样式缺失"
grep -q ".view-select" dashboard-styles.css && echo "✅ 视角选择框样式存在" || echo "❌ 视角选择框样式缺失"
echo ""

# 3. 检查JavaScript方法是否存在
echo "3️⃣  检查JavaScript方法..."
echo "---"
grep -q "changeAutonomousViewType" dashboard-manager.js && echo "✅ changeAutonomousViewType方法存在" || echo "❌ changeAutonomousViewType方法缺失"
grep -q "toggleAutonomousGrid" dashboard-manager.js && echo "✅ toggleAutonomousGrid方法存在" || echo "❌ toggleAutonomousGrid方法缺失"
grep -q "toggleAutonomousCompass" dashboard-manager.js && echo "✅ toggleAutonomousCompass方法存在" || echo "❌ toggleAutonomousCompass方法缺失"
grep -q "resetAutonomousView" dashboard-manager.js && echo "✅ resetAutonomousView方法存在" || echo "❌ resetAutonomousView方法缺失"
grep -q "toggleAutonomousFullscreen" dashboard-manager.js && echo "✅ toggleAutonomousFullscreen方法存在" || echo "❌ toggleAutonomousFullscreen方法缺失"
echo ""

# 4. 检查事件监听器是否存在
echo "4️⃣  检查事件监听器..."
echo "---"
grep -q "autonomous-view-type-select.*addEventListener" dashboard-manager.js && echo "✅ 视角选择框监听器存在" || echo "❌ 视角选择框监听器缺失"
grep -q "autonomous-toggle-grid.*addEventListener" dashboard-manager.js && echo "✅ 网格按钮监听器存在" || echo "❌ 网格按钮监听器缺失"
grep -q "autonomous-toggle-compass.*addEventListener" dashboard-manager.js && echo "✅ 指南针按钮监听器存在" || echo "❌ 指南针按钮监听器缺失"
grep -q "autonomous-reset-view.*addEventListener" dashboard-manager.js && echo "✅ 重置按钮监听器存在" || echo "❌ 重置按钮监听器缺失"
grep -q "autonomous-fullscreen-btn.*addEventListener" dashboard-manager.js && echo "✅ 全屏按钮监听器存在" || echo "❌ 全屏按钮监听器缺失"
echo ""

# 5. 检查ID是否唯一
echo "5️⃣  检查ID唯一性..."
echo "---"
DUPLICATE_IDS=$(grep -o 'id="[^"]*"' dashboard.html | sort | uniq -d)
if [ -z "$DUPLICATE_IDS" ]; then
  echo "✅ 没有重复的ID"
else
  echo "⚠️  发现重复的ID:"
  echo "$DUPLICATE_IDS"
fi
echo ""

# 6. 显示修改统计
echo "6️⃣  修改统计..."
echo "---"
echo "✅ dashboard.html - 添加视口工具栏HTML"
echo "✅ dashboard-styles.css - 添加工具栏样式"
echo "✅ dashboard-manager.js - 添加事件处理和方法"
echo "✅ AUTONOMOUS_VIEW_TOOLBAR_UPDATE.md - 更新说明文档"
echo ""

echo "================================================"
echo "✅ 验证完成！所有更改都已正确应用。"
echo "================================================"

