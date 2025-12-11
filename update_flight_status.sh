#!/bin/bash
# 更新无人机飞行状态脚本
# 用于测试 Dashboard API Server

API_URL="${1:-http://localhost:8000}"
ACTION="${2:-status}"

case "$ACTION" in
  start)
    echo "🚀 Starting drone flight..."
    curl -s -X PUT "$API_URL/api/drone/status" \
      -H "Content-Type: application/json" \
      -d '{
        "isFlying": true,
        "status": "flying",
        "position": { "x": 100, "y": 200, "z": 500 }
      }' | jq .
    echo ""
    echo "✈️ Drone is now flying!"
    ;;
    
  stop)
    echo "🛬 Stopping drone flight..."
    curl -s -X PUT "$API_URL/api/drone/status" \
      -H "Content-Type: application/json" \
      -d '{ "isFlying": false, "status": "idle" }' | jq .
    echo ""
    echo "🛑 Drone stopped!"
    ;;
    
  status)
    echo "📊 Checking drone status..."
    curl -s -X GET "$API_URL/api/drone/status" | jq .
    ;;
    
  health)
    echo "🏥 Checking API health..."
    curl -s -X GET "$API_URL/api/health" | jq .
    ;;
    
  config)
    echo "⚙️ Getting configuration..."
    curl -s -X GET "$API_URL/api/config" | jq .
    ;;
    
  *)
    echo "Usage: $0 [API_URL] <action>"
    echo ""
    echo "Actions:"
    echo "  start   - Start drone flight"
    echo "  stop    - Stop drone flight"
    echo "  status  - Get current drone status (default)"
    echo "  health  - Check API server health"
    echo "  config  - Get API configuration"
    echo ""
    echo "Examples:"
    echo "  $0 http://localhost:8000 start"
    echo "  $0 http://localhost:8000 stop"
    echo "  $0 http://localhost:8000 status"
    echo "  $0 http://10.30.2.11:8000 start"
    ;;
esac
