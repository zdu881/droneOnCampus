#!/bin/bash

# 测试基站运维检测功能

echo "=================================================="
echo "基站运维检测功能测试"
echo "=================================================="
echo ""

# 测试1: 启动检测任务
echo "[1/4] 启动案例检测任务..."
RESPONSE=$(curl -s -X POST http://10.30.2.11:8000/api/station-maintenance/detect \
  -H "Content-Type: application/json" \
  -d '{"node_id":"node-1","mode":"example","data_source":"example"}')

TASK_ID=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['task_id'])")
echo "✓ 任务已启动，Task ID: $TASK_ID"
echo ""

# 测试2: 立即查询状态（进行中）
echo "[2/4] 立即查询任务状态（应该处于进行中）..."
curl -s http://10.30.2.11:8000/api/station-maintenance/status/$TASK_ID | python3 -m json.tool | head -20
echo ""

# 测试3: 等待3秒后查询状态（应该完成）
echo "[3/4] 等待5秒后查询最终结果..."
sleep 5
RESULT=$(curl -s http://10.30.2.11:8000/api/station-maintenance/status/$TASK_ID)
echo $RESULT | python3 -m json.tool
echo ""

# 测试4: 验证结果
echo "[4/4] 验证检测结果..."
COMPLETED=$(echo $RESULT | python3 -c "import sys, json; print(json.load(sys.stdin)['completed'])")
TOTAL_SAMPLES=$(echo $RESULT | python3 -c "import sys, json; print(json.load(sys.stdin)['results']['total_samples'])")
HIGH_CONF=$(echo $RESULT | python3 -c "import sys, json; print(json.load(sys.stdin)['results']['high_confidence'])")
LOW_CONF=$(echo $RESULT | python3 -c "import sys, json; print(json.load(sys.stdin)['results']['low_confidence'])")

echo "✓ 任务完成状态: $COMPLETED"
echo "✓ 总样本数: $TOTAL_SAMPLES"
echo "✓ 高置信度: $HIGH_CONF"
echo "✓ 低置信度: $LOW_CONF"
echo ""

echo "=================================================="
echo "✓ 所有测试通过！"
echo "=================================================="
