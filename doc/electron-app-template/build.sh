#!/bin/bash
# Linux 平台 - 构建 Windows Electron 应用
# 用法: ./build.sh 或 bash build.sh
# 构建 Windows EXE: ./build.sh win
# 构建 Windows MSI + EXE: ./build.sh win-msi
# 清理: ./build.sh clean

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 检查环境
check_environment() {
    print_header "环境检查"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        echo "请安装 Node.js v16+: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v)
    print_success "Node.js 已安装: $NODE_VERSION"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        exit 1
    fi
    
    NPM_VERSION=$(npm -v)
    print_success "npm 已安装: $NPM_VERSION"
    
    # 检查 Python (wine 可能需要)
    if command -v python3 &> /dev/null; then
        print_success "Python3 已安装"
    fi
    
    echo ""
}

# 安装依赖
install_dependencies() {
    if [ ! -d "node_modules" ]; then
        print_header "安装依赖"
        npm install
        if [ $? -eq 0 ]; then
            print_success "依赖安装完成"
        else
            print_error "npm install 失败"
            exit 1
        fi
    else
        print_success "依赖已存在"
    fi
    echo ""
}

# 构建 Windows EXE
build_windows_exe() {
    print_header "构建 Windows EXE 便携版"
    
    print_warning "这可能需要 5-10 分钟..."
    START_TIME=$(date +%s)
    
    npm run build:win-exe
    
    if [ $? -eq 0 ]; then
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))
        print_success "EXE 构建完成 (耗时: ${DURATION}s)"
        
        # 显示输出文件信息
        if [ -f "dist/"*.exe ]; then
            SIZE=$(ls -lh dist/*.exe | awk '{print $5}')
            print_success "输出文件: dist/$(ls dist/*.exe | xargs basename) ($SIZE)"
        fi
    else
        print_error "EXE 构建失败"
        exit 1
    fi
    echo ""
}

# 构建 Windows MSI + EXE
build_windows_msi() {
    print_header "构建 Windows MSI + EXE"
    
    print_warning "这可能需要 10-15 分钟..."
    START_TIME=$(date +%s)
    
    npm run build:win
    
    if [ $? -eq 0 ]; then
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))
        print_success "MSI + EXE 构建完成 (耗时: ${DURATION}s)"
        
        # 显示输出文件信息
        echo ""
        print_success "生成的文件:"
        ls -lh dist/*.exe dist/*.msi 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
    else
        print_error "构建失败"
        exit 1
    fi
    echo ""
}

# 清理构建文件
clean_build() {
    print_header "清理构建文件"
    
    if [ -d "dist" ]; then
        rm -rf dist
        print_success "已删除 dist 目录"
    fi
    
    if [ -d "node_modules" ]; then
        print_warning "删除 node_modules (这可能需要一段时间)..."
        rm -rf node_modules
        print_success "已删除 node_modules 目录"
    fi
    
    echo ""
}

# 显示帮助
show_help() {
    echo ""
    echo -e "${BLUE}用法: ./build.sh [选项]${NC}"
    echo ""
    echo "选项:"
    echo "  win              构建 Windows EXE 便携版 (默认)"
    echo "  win-msi          构建 Windows MSI + EXE"
    echo "  clean            清理构建文件"
    echo "  help             显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./build.sh win"
    echo "  ./build.sh win-msi"
    echo "  ./build.sh clean"
    echo ""
}

# 主程序
main() {
    BUILD_TYPE="${1:-win}"
    
    echo ""
    print_header "无人机像素流接收器 - Linux 构建脚本"
    
    case $BUILD_TYPE in
        win)
            check_environment
            install_dependencies
            build_windows_exe
            ;;
        win-msi)
            check_environment
            install_dependencies
            build_windows_msi
            ;;
        clean)
            clean_build
            ;;
        help)
            show_help
            ;;
        *)
            print_error "未知选项: $BUILD_TYPE"
            show_help
            exit 1
            ;;
    esac
    
    print_header "操作完成"
    echo ""
    
    if [ "$BUILD_TYPE" != "clean" ]; then
        echo "生成的文件位置:"
        echo "  dist/"
        echo ""
        echo "后续步骤:"
        echo "  1. 将 dist/ 目录下的 .exe 或 .msi 文件复制到 Windows 机器"
        echo "  2. 双击 .exe 文件运行，或双击 .msi 文件安装"
        echo ""
    fi
}

# 执行主程序
main "$@"
