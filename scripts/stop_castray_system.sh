#!/bin/bash

# 停止CastRay + DroneOnCampus系统

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LOG_DIR="./logs"

echo -e "${BLUE}[INFO]${NC} 正在停止CastRay + DroneOnCampus系统..."

# 停止进程
stop_service() {
    local service_name=$1
    local pid_file="$LOG_DIR/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}[STOP]${NC} 停止$service_name (PID: $pid)..."
            kill -TERM $pid 2>/dev/null || kill -9 $pid 2>/dev/null
            rm -f "$pid_file"
            echo -e "${GREEN}[OK]${NC} $service_name已停止"
        else
            echo -e "${YELLOW}[WARN]${NC} $service_name进程不存在"
            rm -f "$pid_file"
        fi
    else
        echo -e "${YELLOW}[WARN]${NC} 未找到$service_name的PID文件"
    fi
}

stop_service "rayoutput"
stop_service "castray"
stop_service "frontend"

# 清理端口
pkill -f "python src/backend/python/rayoutput.py" 2>/dev/null || true
pkill -f "python rayoutput.py" 2>/dev/null || true
pkill -f "python main.py" 2>/dev/null || true
pkill -f "http.server 8080" 2>/dev/null || true

echo -e "${GREEN}[OK]${NC} 系统已停止"
