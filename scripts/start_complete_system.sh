#!/bin/bash

# 校园无人机系统 - 完整启动脚本
# 按正确顺序启动所有服务

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_HOME="/data/home/sim6g/rayCode"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          🚀 校园无人机系统启动脚本                         ║"
echo "║                                                            ║"
echo "║  此脚本将按正确的顺序启动以下服务：                       ║"
echo "║  1️⃣  像素流信令服务 (Cirrus)                              ║"
echo "║  2️⃣  Web 仪表板服务                                       ║"
echo "║  3️⃣  UE 应用 (含 Remote Control API)                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# 检查进程是否运行
check_process() {
    local name=$1
    local port=$2
    
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        log_success "$name 已在端口 $port 上运行"
        return 0
    else
        return 1
    fi
}

# ============================================
# 第1步: 启动像素流服务
# ============================================
echo ""
echo "════════════════════════════════════════════════════════════"
log_info "第1步: 启动像素流信令服务 (Cirrus)"
echo "════════════════════════════════════════════════════════════"
echo ""

if check_process "Cirrus" "8888"; then
    log_warning "像素流服务已在运行，跳过启动"
else
    log_info "启动 Cirrus 信令服务..."
    cd "$PROJECT_HOME/PixelStreamingInfrastructure/SignallingWebServer/platform_scripts/bash"
    
    # 后台启动
    nohup bash run_local.sh > /tmp/cirrus.log 2>&1 &
    CIRRUS_PID=$!
    
    log_info "Cirrus PID: $CIRRUS_PID"
    log_info "等待服务启动 (5秒)..."
    sleep 5
    
    if check_process "Cirrus" "8888"; then
        log_success "Cirrus 服务启动成功"
        log_info "  • 端口 8888 (WebSocket)"
        log_info "  • 日志: /tmp/cirrus.log"
    else
        log_error "Cirrus 服务启动失败"
        log_warning "继续启动其他服务..."
    fi
fi

echo ""

# ============================================
# 第2步: 启动 Dashboard 服务
# ============================================
echo "════════════════════════════════════════════════════════════"
log_info "第2步: 启动 Web 仪表板服务"
echo "════════════════════════════════════════════════════════════"
echo ""

if check_process "Dashboard" "8001"; then
    log_warning "Dashboard 服务已在运行，跳过启动"
else
    log_info "启动 HTTP 服务器 (端口 8001)..."
    cd "$PROJECT_HOME/droneOnCampus"
    
    # 后台启动
    nohup python3 -m http.server 8001 > /tmp/dashboard.log 2>&1 &
    DASHBOARD_PID=$!
    
    log_info "Dashboard PID: $DASHBOARD_PID"
    log_info "等待服务启动 (2秒)..."
    sleep 2
    
    if check_process "Dashboard" "8001"; then
        log_success "Dashboard 服务启动成功"
        log_info "  • 地址: http://10.30.2.11:8001"
        log_info "  • 日志: /tmp/dashboard.log"
    else
        log_error "Dashboard 服务启动失败"
        log_warning "继续启动其他服务..."
    fi
fi

echo ""

# ============================================
# 第3步: 启动 UE 应用
# ============================================
echo "════════════════════════════════════════════════════════════"
log_info "第3步: 启动 UE 应用 (含 Remote Control API)"
echo "════════════════════════════════════════════════════════════"
echo ""

log_info "准备启动参数..."
PROJECT_DIR="$PROJECT_HOME/Linux/Project/Binaries/Linux"
EXECUTABLE="$PROJECT_DIR/Project"
MAP_NAME="NewMap"
PIXEL_STREAM_URL="ws://127.0.0.1:8888"
RC_WEB_PORT="30010"

# 检查可执行文件
if [ ! -f "$EXECUTABLE" ]; then
    log_error "找不到 UE 可执行文件: $EXECUTABLE"
    log_info "请确保 UE 应用已编译"
    exit 1
fi

log_success "UE 可执行文件已找到"
echo ""

log_info "启动参数："
echo "  • 项目文件: $EXECUTABLE"
echo "  • 加载地图: $MAP_NAME"
echo "  • 像素流: $PIXEL_STREAM_URL"
echo "  • Remote Control API 端口: $RC_WEB_PORT"
echo ""

log_warning "启动 UE 应用（此步骤会占用控制台）"
log_info "要停止应用，请按 Ctrl+C"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

cd "$PROJECT_DIR"

"$EXECUTABLE" \
    "$MAP_NAME" \
    -PixelStreamingURL="$PIXEL_STREAM_URL" \
    -RenderOffScreen \
    -RCWebControlEnable \
    -RCWebInterfaceEnable \
    -HTTPPort="$RC_WEB_PORT" \
    -ResX=1920 \
    -ResY=1080 \
    -VSync=0 \
    -FixedFrameRate=60 \
    -AudioMixer \
    -ForceRes \
    -Game \
    -server \
    -nosound \
    -PixelStreamingEncoderMinQP=20 \
    -PixelStreamingEncoderMaxQP=30 \
    -PixelStreamingWebRTCMaxBitrate=10000 \
    -PixelStreamingWebRTCMinBitrate=2000 \
    -LogCmds="LogRemoteControl Info"

echo ""
echo "════════════════════════════════════════════════════════════"
log_info "UE 应用已停止"
echo ""

# ============================================
# 清理资源
# ============================================
log_info "清理资源..."

if [ ! -z "$CIRRUS_PID" ]; then
    kill $CIRRUS_PID 2>/dev/null || true
    log_success "Cirrus 进程已停止"
fi

if [ ! -z "$DASHBOARD_PID" ]; then
    kill $DASHBOARD_PID 2>/dev/null || true
    log_success "Dashboard 进程已停止"
fi

log_success "系统已关闭"
echo ""
