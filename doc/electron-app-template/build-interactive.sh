#!/bin/bash
# Linux 快速构建脚本 - 无网络依赖版本
# 用于在 Linux 系统上构建 Windows Electron 应用

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 打印函数
print_step() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}➤ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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

# 检查前置环境
check_prerequisites() {
    print_step "检查前置环境"
    
    local missing=0
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        missing=$((missing + 1))
    else
        local version=$(node --version)
        print_success "Node.js $version"
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        missing=$((missing + 1))
    else
        local version=$(npm --version)
        print_success "npm $version"
    fi
    
    if [ $missing -gt 0 ]; then
        echo ""
        print_error "缺少必需的工具，请先安装:"
        echo ""
        echo "Ubuntu/Debian:"
        echo "  sudo apt-get update"
        echo "  sudo apt-get install nodejs npm"
        echo ""
        echo "CentOS/RHEL:"
        echo "  sudo yum install nodejs npm"
        echo ""
        echo "或访问: https://nodejs.org/"
        exit 1
    fi
    
    echo ""
}

# 显示构建选项
show_options() {
    echo ""
    echo -e "${CYAN}请选择构建目标:${NC}"
    echo ""
    echo "  1) 构建 Windows EXE (便携版) - 推荐"
    echo "  2) 构建 Windows MSI + EXE (安装版)"
    echo "  3) 仅安装依赖"
    echo "  4) 清理缓存和依赖"
    echo "  5) 退出"
    echo ""
}

# 安装依赖
install_deps() {
    if [ -d "node_modules" ]; then
        print_warning "node_modules 已存在，跳过安装"
        return 0
    fi
    
    print_step "安装依赖包"
    
    print_warning "这可能需要 3-5 分钟，请耐心等待..."
    echo ""
    
    if npm install; then
        print_success "依赖安装完成"
    else
        print_error "依赖安装失败"
        return 1
    fi
    
    return 0
}

# 构建 Windows EXE
build_exe() {
    if ! [ -d "node_modules" ]; then
        print_warning "依赖不存在，正在安装..."
        if ! install_deps; then
            return 1
        fi
    fi
    
    print_step "构建 Windows EXE"
    
    print_warning "这可能需要 5-10 分钟，请耐心等待..."
    echo ""
    
    local start=$(date +%s)
    
    if npm run build:win-exe; then
        local end=$(date +%s)
        local duration=$((end - start))
        
        print_success "EXE 构建完成！(耗时: ${duration}s)"
        echo ""
        
        if [ -f "dist/"*.exe ]; then
            echo -e "${GREEN}生成文件:${NC}"
            ls -lh dist/*.exe | awk '{printf "  %s (%s)\n", $9, $5}'
        fi
    else
        print_error "构建失败"
        return 1
    fi
    
    return 0
}

# 构建 Windows MSI + EXE
build_msi() {
    if ! [ -d "node_modules" ]; then
        print_warning "依赖不存在，正在安装..."
        if ! install_deps; then
            return 1
        fi
    fi
    
    print_step "构建 Windows MSI + EXE"
    
    print_warning "这可能需要 10-15 分钟，请耐心等待..."
    echo ""
    
    local start=$(date +%s)
    
    if npm run build:win; then
        local end=$(date +%s)
        local duration=$((end - start))
        
        print_success "构建完成！(耗时: ${duration}s)"
        echo ""
        
        echo -e "${GREEN}生成文件:${NC}"
        if [ -f "dist/"*.exe ]; then
            ls -lh dist/*.exe | awk '{printf "  %s (%s)\n", $9, $5}'
        fi
        if [ -f "dist/"*.msi ]; then
            ls -lh dist/*.msi | awk '{printf "  %s (%s)\n", $9, $5}'
        fi
    else
        print_error "构建失败"
        return 1
    fi
    
    return 0
}

# 清理缓存
clean() {
    print_step "清理缓存"
    
    if [ -d "dist" ]; then
        print_warning "删除 dist 目录..."
        rm -rf dist
        print_success "已删除 dist"
    fi
    
    if [ -d "node_modules" ]; then
        print_warning "删除 node_modules (这可能需要一段时间)..."
        rm -rf node_modules
        print_success "已删除 node_modules"
    fi
    
    print_success "清理完成"
    echo ""
}

# 显示下一步
show_next_steps() {
    echo ""
    print_step "后续步骤"
    
    echo "1. 生成的文件在 dist/ 目录"
    echo ""
    echo "2. 将文件复制到 Windows 机器:"
    echo ""
    echo "   # 使用 SCP"
    echo "   scp dist/*.exe user@windows-ip:/path/"
    echo ""
    echo "   # 或使用 U 盘"
    echo "   cp dist/*.exe /mnt/usb/"
    echo ""
    echo "3. 在 Windows 上运行:"
    echo ""
    echo "   # EXE - 直接双击运行"
    echo "   # MSI - 双击或使用 msiexec /i"
    echo ""
}

# 主菜单
main_menu() {
    while true; do
        show_options
        
        read -p "请输入选项 (1-5): " choice
        
        case $choice in
            1)
                build_exe
                show_next_steps
                ;;
            2)
                build_msi
                show_next_steps
                ;;
            3)
                install_deps
                ;;
            4)
                clean
                ;;
            5)
                echo -e "${GREEN}再见！${NC}"
                exit 0
                ;;
            *)
                print_error "无效选项，请重试"
                ;;
        esac
        
        echo ""
        read -p "按 Enter 继续..."
        clear
    done
}

# 非交互模式
non_interactive_mode() {
    case "${1:-win}" in
        win)
            build_exe
            ;;
        msi)
            build_msi
            ;;
        clean)
            clean
            ;;
        *)
            echo "用法: $0 [win|msi|clean]"
            exit 1
            ;;
    esac
}

# 主程序
main() {
    clear
    
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════╗"
    echo "║  无人机像素流接收器 - Windows 构建工具  ║"
    echo "║   Linux 平台跨平台编译                  ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_prerequisites
    
    # 判断是否为交互模式或非交互模式
    if [ -z "$1" ]; then
        main_menu
    else
        non_interactive_mode "$1"
    fi
}

# 执行主程序
main "$@"
