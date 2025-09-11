#!/bin/bash

# 系统监控脚本 - CastRay + DroneOnCampus
# 实时监控系统状态和性能

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 清屏函数
clear_screen() {
    clear
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}  CastRay + DroneOnCampus 系统监控面板${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo -e "更新时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# 检查服务状态
check_service_status() {
    echo -e "${BLUE}服务状态:${NC}"
    
    # 检查CastRay
    if curl -s http://localhost:8000/api/status >/dev/null 2>&1; then
        local castray_nodes=$(curl -s http://localhost:8000/api/status | jq -r '.total_nodes // 0' 2>/dev/null || echo "0")
        echo -e "  🟢 CastRay后端: ${GREEN}运行中${NC} ($castray_nodes 个节点)"
    else
        echo -e "  🔴 CastRay后端: ${RED}离线${NC}"
    fi
    
    # 检查前端
    if curl -s http://localhost:8080 >/dev/null 2>&1; then
        echo -e "  🟢 前端服务器: ${GREEN}运行中${NC} (端口: 8080)"
    else
        echo -e "  🔴 前端服务器: ${RED}离线${NC}"
    fi
    
    # 检查Ray集群
    if timeout 3 bash -c "</dev/tcp/10.30.2.11/6379" &>/dev/null; then
        echo -e "  🟢 Ray集群: ${GREEN}连接正常${NC} (10.30.2.11:6379)"
    else
        echo -e "  🔴 Ray集群: ${RED}连接失败${NC}"
    fi
    
    echo ""
}

# 检查端口占用
check_ports() {
    echo -e "${BLUE}端口状态:${NC}"
    
    local ports=(8000 8080 6379 8265)
    local services=("CastRay API" "前端服务器" "Ray集群" "Ray Dashboard")
    
    for i in "${!ports[@]}"; do
        local port=${ports[$i]}
        local service=${services[$i]}
        
        if lsof -i :$port >/dev/null 2>&1; then
            local pid=$(lsof -ti :$port 2>/dev/null | head -1)
            echo -e "  🟢 端口 $port ($service): ${GREEN}占用${NC} (PID: $pid)"
        else
            echo -e "  🔴 端口 $port ($service): ${RED}空闲${NC}"
        fi
    done
    
    echo ""
}

# 检查系统资源
check_system_resources() {
    echo -e "${BLUE}系统资源:${NC}"
    
    # CPU使用率
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    echo -e "  📊 CPU使用率: ${YELLOW}$cpu_usage%${NC}"
    
    # 内存使用率
    local memory_info=$(free | grep Mem)
    local total_mem=$(echo $memory_info | awk '{print $2}')
    local used_mem=$(echo $memory_info | awk '{print $3}')
    local mem_percent=$((used_mem * 100 / total_mem))
    echo -e "  📊 内存使用率: ${YELLOW}$mem_percent%${NC} ($used_mem/$total_mem KB)"
    
    # 磁盘使用率
    local disk_usage=$(df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
    echo -e "  📊 磁盘使用率: ${YELLOW}$disk_usage%${NC}"
    
    echo ""
}

# 检查进程状态
check_processes() {
    echo -e "${BLUE}相关进程:${NC}"
    
    # CastRay进程
    local castray_pids=$(pgrep -f "python main.py" 2>/dev/null || echo "")
    if [ ! -z "$castray_pids" ]; then
        echo -e "  🔄 CastRay进程: ${GREEN}$castray_pids${NC}"
    else
        echo -e "  ❌ CastRay进程: ${RED}未运行${NC}"
    fi
    
    # 前端进程
    local frontend_pids=$(pgrep -f "http.server 8080" 2>/dev/null || echo "")
    if [ ! -z "$frontend_pids" ]; then
        echo -e "  🔄 前端进程: ${GREEN}$frontend_pids${NC}"
    else
        echo -e "  ❌ 前端进程: ${RED}未运行${NC}"
    fi
    
    echo ""
}

# 显示日志摘要
show_log_summary() {
    echo -e "${BLUE}日志摘要:${NC}"
    
    # CastRay日志
    if [ -f "/data/home/sim6g/rayCode/CastRay/castray.log" ]; then
        local castray_errors=$(tail -20 "/data/home/sim6g/rayCode/CastRay/castray.log" | grep -i error | wc -l)
        echo -e "  📝 CastRay日志: ${castray_errors} 个错误 (最近20行)"
    fi
    
    # 前端日志
    if [ -f "./frontend.log" ]; then
        local frontend_errors=$(tail -20 "./frontend.log" | grep -i error | wc -l)
        echo -e "  📝 前端日志: ${frontend_errors} 个错误 (最近20行)"
    fi
    
    echo ""
}

# 显示快捷操作
show_quick_actions() {
    echo -e "${CYAN}快捷操作:${NC}"
    echo -e "  ${YELLOW}r${NC} - 重启系统"
    echo -e "  ${YELLOW}s${NC} - 停止系统"
    echo -e "  ${YELLOW}l${NC} - 查看日志"
    echo -e "  ${YELLOW}c${NC} - 清理僵尸进程"
    echo -e "  ${YELLOW}q${NC} - 退出监控"
    echo ""
}

# 主监控循环
main_loop() {
    while true; do
        clear_screen
        check_service_status
        check_ports
        check_system_resources
        check_processes
        show_log_summary
        show_quick_actions
        
        echo -e "${CYAN}访问地址:${NC}"
        echo -e "  Dashboard: ${YELLOW}http://10.30.2.11:8080/dashboard.html${NC}"
        echo -e "  CastRay API: ${YELLOW}http://10.30.2.11:8000/api/status${NC}"
        echo ""
        echo -e "按 ${YELLOW}Ctrl+C${NC} 或 ${YELLOW}q${NC} 退出，${YELLOW}Enter${NC} 手动刷新"
        
        # 等待用户输入或自动刷新
        read -t 10 -n 1 key
        
        case $key in
            'r'|'R')
                echo -e "\n${YELLOW}重启系统...${NC}"
                ./start_castray_system.sh restart
                ;;
            's'|'S')
                echo -e "\n${YELLOW}停止系统...${NC}"
                ./start_castray_system.sh stop
                ;;
            'l'|'L')
                echo -e "\n${YELLOW}显示日志...${NC}"
                tail -f ./logs/*.log 2>/dev/null || echo "日志文件不存在"
                ;;
            'c'|'C')
                echo -e "\n${YELLOW}清理僵尸进程...${NC}"
                pkill -f "python main.py" 2>/dev/null || true
                pkill -f "http.server" 2>/dev/null || true
                ;;
            'q'|'Q')
                echo -e "\n${GREEN}退出监控${NC}"
                exit 0
                ;;
        esac
    done
}

# 检查依赖
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}警告: 未安装jq，JSON解析功能受限${NC}"
fi

# 启动监控
trap 'echo -e "\n${GREEN}监控已停止${NC}"; exit 0' INT
main_loop
