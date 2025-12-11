#!/bin/bash

echo "🛑 Killing existing processes..."
pkill -9 -f "node server" 2>/dev/null || true
pkill -9 -f "python.*http.server.*8081" 2>/dev/null || true
sleep 1

echo "✅ Cleaned up"
echo ""
echo "🚀 Starting Dashboard API Server on port 8000..."
cd /data/home/sim6g/rayCode/droneOnCampus

# Start server in background
nohup node server.js > /tmp/api_server.log 2>&1 &
API_PID=$!
echo "✅ API Server started (PID: $API_PID)"

sleep 2

# Verify it's running
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
  echo "✅ API Server responding"
else
  echo "❌ API Server not responding, check log:"
  cat /tmp/api_server.log
  exit 1
fi

echo ""
echo "📊 System ready:"
echo "   🌐 Dashboard API: http://localhost:8000"
echo "   📍 Health check: http://localhost:8000/api/health"
echo "   ✈️ Flight status: http://localhost:8000/api/drone/status"
echo ""
echo "🛑 Press Ctrl+C to stop"

# Keep running
wait
