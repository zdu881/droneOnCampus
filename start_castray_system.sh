#!/bin/bash

# CastRay + DroneOnCampus 统一启动脚本
# 作者: AI Assistant
# 日期: 2025-08-29

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置变量
CASTRAY_DIR="/data/home/sim6g/rayCode/CastRay"
FRONTEND_DIR="/data/home/sim6g/rayCode/droneOnCampus"
CASTRAY_PORT=8000
FRONTEND_PORT=8080
# rayoutput服务配置
RAYOUTPUT_PORT=9999
RAY_CLUSTER_URL="10.30.2.11:6379"

# 日志文件
LOG_DIR="$FRONTEND_DIR/logs"
CASTRAY_LOG="$LOG_DIR/castray.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
RAYOUTPUT_LOG="$LOG_DIR/rayoutput.log"

# 创建日志目录
mkdir -p "$LOG_DIR"

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}    CastRay + DroneOnCampus 统一启动系统${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

# 检查依赖
check_dependencies() {
    echo -e "${BLUE}[INFO]${NC} 检查系统依赖..."
    
    # 检查conda环境
    if ! command -v conda &> /dev/null; then
        echo -e "${RED}[ERROR]${NC} Conda 未安装或未在PATH中"
        exit 1
    fi
    
    # 检查Ray集群连接
    echo -e "${BLUE}[INFO]${NC} 检查Ray集群连接: $RAY_CLUSTER_URL"
    if ! timeout 5 bash -c "</dev/tcp/10.30.2.11/6379" &>/dev/null; then
        echo -e "${YELLOW}[WARN]${NC} 无法连接到Ray集群，CastRay可能无法正常工作"
    else
        echo -e "${GREEN}[OK]${NC} Ray集群连接正常"
    fi
    
    # 检查端口占用
    check_port() {
        local port=$1
        local service=$2
        if lsof -i :$port >/dev/null 2>&1; then
            echo -e "${YELLOW}[WARN]${NC} 端口 $port 已被占用，正在尝试释放..."
            local pid=$(lsof -ti :$port)
            if [ ! -z "$pid" ]; then
                kill -9 $pid 2>/dev/null || true
                sleep 2
                if lsof -i :$port >/dev/null 2>&1; then
                    echo -e "${RED}[ERROR]${NC} 无法释放端口 $port"
                    return 1
                else
                    echo -e "${GREEN}[OK]${NC} 端口 $port 已释放"
                fi
            fi
        fi
        return 0
    }
    
    check_port $CASTRAY_PORT "CastRay后端"
    check_port $FRONTEND_PORT "前端服务器"
    check_port $RAYOUTPUT_PORT "Ray数据API"
    
    echo -e "${GREEN}[OK]${NC} 依赖检查完成"
    echo ""
}

# 启动Ray数据API服务
start_rayoutput() {
    echo -e "${BLUE}[INFO]${NC} 启动Ray集群数据API服务..."
    
    cd "$FRONTEND_DIR"
    
    # 检查文件存在
    if [ ! -f "rayoutput.py" ]; then
        echo -e "${RED}[ERROR]${NC} rayoutput.py文件不存在"
        exit 1
    fi
    
    # 启动rayoutput.py
    echo -e "${BLUE}[INFO]${NC} 正在激活ray环境并启动Ray数据API..."
    echo -e "${BLUE}[INFO]${NC} 日志文件: $RAYOUTPUT_LOG"
    
    nohup bash -c "
        source ~/miniconda3/etc/profile.d/conda.sh
        conda activate ray
        python rayoutput.py
    " > "$RAYOUTPUT_LOG" 2>&1 &
    
    RAYOUTPUT_PID=$!
    echo $RAYOUTPUT_PID > "$LOG_DIR/rayoutput.pid"
    
    # 等待Ray数据API启动
    echo -e "${YELLOW}[WAIT]${NC} 等待Ray数据API启动..."
    for i in {1..20}; do
        if curl -s http://localhost:$RAYOUTPUT_PORT >/dev/null 2>&1; then
            echo -e "${GREEN}[OK]${NC} Ray数据API启动成功 (PID: $RAYOUTPUT_PID)"
            echo -e "${GREEN}[OK]${NC} Ray数据API: http://10.30.2.11:$RAYOUTPUT_PORT"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    
    echo ""
    echo -e "${RED}[ERROR]${NC} Ray数据API启动失败，请检查日志: $RAYOUTPUT_LOG"
    return 1
}

# 启动CastRay后端
start_castray() {
    echo -e "${BLUE}[INFO]${NC} 启动CastRay分布式消息系统..."
    
    if [ ! -d "$CASTRAY_DIR" ]; then
        echo -e "${RED}[ERROR]${NC} CastRay目录不存在: $CASTRAY_DIR"
        exit 1
    fi
    
    cd "$CASTRAY_DIR"
    
    # 检查配置文件
    if [ ! -f "config_linux.json" ]; then
        echo -e "${RED}[ERROR]${NC} CastRay配置文件不存在: config_linux.json"
        exit 1
    fi
    
    # 启动CastRay后端
    echo -e "${BLUE}[INFO]${NC} 正在激活ray环境并启动CastRay..."
    echo -e "${BLUE}[INFO]${NC} 日志文件: $CASTRAY_LOG"
    
    nohup bash -c "
        source ~/miniconda3/etc/profile.d/conda.sh
        conda activate ray
        python main.py
    " > "$CASTRAY_LOG" 2>&1 &
    
    CASTRAY_PID=$!
    echo $CASTRAY_PID > "$LOG_DIR/castray.pid"
    
    # 等待CastRay启动
    echo -e "${YELLOW}[WAIT]${NC} 等待CastRay启动..."
    for i in {1..30}; do
        if curl -s http://localhost:$CASTRAY_PORT/api/status >/dev/null 2>&1; then
            echo -e "${GREEN}[OK]${NC} CastRay后端启动成功 (PID: $CASTRAY_PID)"
            echo -e "${GREEN}[OK]${NC} CastRay API: http://10.30.2.11:$CASTRAY_PORT"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    
    echo ""
    echo -e "${RED}[ERROR]${NC} CastRay启动失败，请检查日志: $CASTRAY_LOG"
    return 1
}

# 启动前端服务器
start_frontend() {
    echo -e "${BLUE}[INFO]${NC} 启动DroneOnCampus前端服务器..."
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        echo -e "${RED}[ERROR]${NC} 前端目录不存在: $FRONTEND_DIR"
        exit 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # 检查必要文件
    if [ ! -f "dashboard.html" ]; then
        echo -e "${RED}[ERROR]${NC} Dashboard文件不存在: dashboard.html"
        exit 1
    fi
    
    # 启动HTTP服务器
    echo -e "${BLUE}[INFO]${NC} 正在启动HTTP服务器..."
    echo -e "${BLUE}[INFO]${NC} 日志文件: $FRONTEND_LOG"
    
    nohup python -m http.server $FRONTEND_PORT > "$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
    
    # 等待前端启动
    echo -e "${YELLOW}[WAIT]${NC} 等待前端服务器启动..."
    for i in {1..10}; do
        if curl -s http://localhost:$FRONTEND_PORT >/dev/null 2>&1; then
            echo -e "${GREEN}[OK]${NC} 前端服务器启动成功 (PID: $FRONTEND_PID)"
            echo -e "${GREEN}[OK]${NC} Dashboard URL: http://10.30.2.11:$FRONTEND_PORT/dashboard.html"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    
    echo ""
    echo -e "${RED}[ERROR]${NC} 前端服务器启动失败，请检查日志: $FRONTEND_LOG"
    return 1
}

# 显示状态信息
show_status() {
    echo ""
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}           系统启动完成！${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo ""
    echo -e "${GREEN}服务状态:${NC}"
    echo -e "  • Ray数据API: ${GREEN}运行中${NC} (http://10.30.2.11:$RAYOUTPUT_PORT)"
    echo -e "  • CastRay后端: ${GREEN}运行中${NC} (http://10.30.2.11:$CASTRAY_PORT)"
    echo -e "  • 前端服务器: ${GREEN}运行中${NC} (http://10.30.2.11:$FRONTEND_PORT)"
    echo ""
    echo -e "${BLUE}访问地址:${NC}"
    echo -e "  • Dashboard: ${CYAN}http://10.30.2.11:$FRONTEND_PORT/dashboard.html${NC}"
    echo -e "  • Ray数据API: ${CYAN}http://10.30.2.11:$RAYOUTPUT_PORT${NC}"
    echo -e "  • CastRay API: ${CYAN}http://10.30.2.11:$CASTRAY_PORT/api/status${NC}"
    echo -e "  • Ray集群监控: ${CYAN}http://10.30.2.11:8265${NC}"
    echo ""
    echo -e "${BLUE}功能特性:${NC}"
    echo -e "  • Ray集群监控 (23个节点, 120个GPU)"
    echo -e "  • CastRay分布式消息传输"
    echo -e "  • 实时文件传输控制"
    echo -e "  • 无人机校园配送仿真"
    echo ""
    echo -e "${YELLOW}日志文件:${NC}"
    echo -e "  • Ray数据API: $RAYOUTPUT_LOG"
    echo -e "  • CastRay: $CASTRAY_LOG"
    echo -e "  • Frontend: $FRONTEND_LOG"
    echo ""
    echo -e "${PURPLE}停止服务: ${NC}./stop_castray_system.sh"
    echo -e "${PURPLE}查看日志: ${NC}tail -f $LOG_DIR/*.log"
    echo ""
}

# 创建停止脚本
create_stop_script() {
    cat > "$FRONTEND_DIR/stop_castray_system.sh" << 'EOF'
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
pkill -f "python rayoutput.py" 2>/dev/null || true
pkill -f "python main.py" 2>/dev/null || true
pkill -f "http.server 8080" 2>/dev/null || true

echo -e "${GREEN}[OK]${NC} 系统已停止"
EOF

    chmod +x "$FRONTEND_DIR/stop_castray_system.sh"
}

# 主函数
main() {
    # 检查参数
    case "${1:-start}" in
        "start")
            check_dependencies
            
            if start_rayoutput && start_castray && start_frontend; then
                create_stop_script
                show_status
            else
                echo -e "${RED}[ERROR]${NC} 系统启动失败"
                exit 1
            fi
            ;;
        "stop")
            echo -e "${BLUE}[INFO]${NC} 停止系统..."
            if [ -f "$FRONTEND_DIR/stop_castray_system.sh" ]; then
                bash "$FRONTEND_DIR/stop_castray_system.sh"
            else
                echo -e "${YELLOW}[WARN]${NC} 停止脚本不存在，手动清理进程..."
                pkill -f "python main.py" 2>/dev/null || true
                pkill -f "http.server" 2>/dev/null || true
            fi
            ;;
        "restart")
            $0 stop
            sleep 3
            $0 start
            ;;
        "status")
            echo -e "${BLUE}[INFO]${NC} 检查系统状态..."
            
            if curl -s http://localhost:$RAYOUTPUT_PORT >/dev/null 2>&1; then
                echo -e "${GREEN}[OK]${NC} Ray数据API: 运行中"
            else
                echo -e "${RED}[ERROR]${NC} Ray数据API: 未运行"
            fi
            
            if curl -s http://localhost:$CASTRAY_PORT/api/status >/dev/null 2>&1; then
                echo -e "${GREEN}[OK]${NC} CastRay后端: 运行中"
            else
                echo -e "${RED}[ERROR]${NC} CastRay后端: 未运行"
            fi
            
            if curl -s http://localhost:$FRONTEND_PORT >/dev/null 2>&1; then
                echo -e "${GREEN}[OK]${NC} 前端服务器: 运行中"
            else
                echo -e "${RED}[ERROR]${NC} 前端服务器: 未运行"
            fi
            ;;
        "logs")
            if [ -d "$LOG_DIR" ]; then
                echo -e "${BLUE}[INFO]${NC} 显示系统日志..."
                tail -f "$LOG_DIR"/*.log
            else
                echo -e "${RED}[ERROR]${NC} 日志目录不存在"
            fi
            ;;
        *)
            echo "用法: $0 {start|stop|restart|status|logs}"
            echo ""
            echo "命令说明:"
            echo "  start   - 启动CastRay和前端服务"
            echo "  stop    - 停止所有服务"
            echo "  restart - 重启所有服务"
            echo "  status  - 检查服务状态"
            echo "  logs    - 查看实时日志"
            exit 1
            ;;
    esac
}

# 捕获Ctrl+C信号
trap 'echo -e "\n${YELLOW}[WARN]${NC} 接收到中断信号，请使用 $0 stop 来正确停止服务"; exit 130' INT

# 执行主函数
main "$@"
