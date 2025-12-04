#!/bin/bash
# setup_ray_cluster.sh - 自动化 Ray 集群配置脚本
# 用于快速将 Jetson AGX Orin 节点加入 Ray 集群

set -e

# 配置变量
HEAD_ADDRESS="10.30.2.11"
HEAD_PORT="6379"
DASHBOARD_PORT="8265"

# 工作节点配置
declare -A WORKER_NODES=(
    ["doit@10.12.133.251"]="Jetson_AGX_Orin_1:doit:doit1234:32GB"
    ["doit@10.7.182.160"]="Jetson_AGX_Orin_2:doit:doit1234:32GB"
    ["doit@10.7.126.62"]="Jetson_AGX_Orin_64G:doit:123456:64GB"
)

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

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 打印使用说明
print_usage() {
    cat << 'EOF'
用法: ./setup_ray_cluster.sh [选项]

选项:
    install     - 在所有工作节点上安装 Ray
    start       - 启动所有工作节点加入集群
    status      - 检查集群状态
    stop        - 停止所有工作节点的 Ray
    verify      - 验证集群连接和健康状况
    full        - 执行完整安装和启动流程 (install + start + verify)
    help        - 显示此帮助信息

示例:
    ./setup_ray_cluster.sh full      # 完整安装
    ./setup_ray_cluster.sh status    # 检查状态
    ./setup_ray_cluster.sh stop      # 停止集群
EOF
}

# 检查主节点连接
check_head_node() {
    log_info "检查主节点连接..."
    
    if ping -c 1 -W 2 "$HEAD_ADDRESS" > /dev/null 2>&1; then
        log_success "主节点 $HEAD_ADDRESS 可达"
        return 0
    else
        log_error "无法连接到主节点 $HEAD_ADDRESS"
        return 1
    fi
}

# 检查主节点 Ray 状态
check_head_ray_status() {
    log_info "检查主节点 Ray 服务..."
    
    # 尝试连接到 Ray Head
    if timeout 5 bash -c "echo > /dev/tcp/$HEAD_ADDRESS/$HEAD_PORT" 2>/dev/null; then
        log_success "Ray Head 服务正在运行 ($HEAD_ADDRESS:$HEAD_PORT)"
        return 0
    else
        log_error "Ray Head 服务未响应"
        return 1
    fi
}

# 在远程节点上执行命令
run_remote_cmd() {
    local user_host=$1
    local cmd=$2
    
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$user_host" "$cmd"
}

# 安装 Ray
install_ray() {
    log_info "在工作节点上安装 Ray..."
    
    local failed_nodes=()
    
    for node_info in "${!WORKER_NODES[@]}"; do
        IFS=':' read -r node_name user password memory <<< "${WORKER_NODES[$node_info]}"
        
        log_info "在 $node_name ($node_info) 上安装 Ray..."
        
        local install_cmd='
            set -e
            echo "更新系统包..."
            sudo apt update -q
            echo "安装 Python 3 和 pip..."
            sudo apt install -y python3-pip python3-venv > /dev/null 2>&1
            echo "安装 Ray..."
            pip3 install --upgrade ray > /dev/null 2>&1
            echo "验证安装..."
            python3 -c "import ray; print(f\"Ray {ray.__version__} 安装成功\")"
        '
        
        if run_remote_cmd "$node_info" "$install_cmd"; then
            log_success "已在 $node_name 上安装 Ray"
        else
            log_error "无法在 $node_name 上安装 Ray"
            failed_nodes+=("$node_info")
        fi
    done
    
    if [ ${#failed_nodes[@]} -eq 0 ]; then
        log_success "所有节点安装成功"
        return 0
    else
        log_warning "以下节点安装失败:"
        printf '%s\n' "${failed_nodes[@]}"
        return 1
    fi
}

# 启动工作节点
start_workers() {
    log_info "启动工作节点加入 Ray 集群..."
    
    local failed_nodes=()
    
    for node_info in "${!WORKER_NODES[@]}"; do
        IFS=':' read -r node_name user password memory <<< "${WORKER_NODES[$node_info]}"
        
        log_info "启动 $node_name..."
        
        # 生成资源名称 (将空格替换为下划线)
        local resource_name=$(echo "$node_name" | tr ' ' '_')
        
        local start_cmd="
            ray stop --force 2>/dev/null || true
            sleep 2
            ray start \
                --address=$HEAD_ADDRESS:$HEAD_PORT \
                --resources='{\"$resource_name\": 1}' \
                --labels='device=jetson_orin,memory=$memory' \
                --num-cpus=12 \
                --num-gpus=1 \
                --object-store-memory=5000000000 \
                --quiet
            sleep 5
        "
        
        if run_remote_cmd "$node_info" "$start_cmd"; then
            log_success "$node_name 已启动并连接到集群"
        else
            log_error "无法启动 $node_name"
            failed_nodes+=("$node_info")
        fi
    done
    
    if [ ${#failed_nodes[@]} -eq 0 ]; then
        log_success "所有工作节点已启动"
        return 0
    else
        log_warning "以下节点启动失败:"
        printf '%s\n' "${failed_nodes[@]}"
        return 1
    fi
}

# 停止工作节点
stop_workers() {
    log_info "停止所有工作节点..."
    
    for node_info in "${!WORKER_NODES[@]}"; do
        IFS=':' read -r node_name _ _ _ <<< "${WORKER_NODES[$node_info]}"
        
        log_info "停止 $node_name..."
        
        if run_remote_cmd "$node_info" "ray stop --force" 2>/dev/null; then
            log_success "$node_name 已停止"
        else
            log_warning "停止 $node_name 时出错"
        fi
    done
    
    log_success "所有工作节点已停止"
}

# 检查集群状态
check_status() {
    log_info "检查集群状态..."
    echo ""
    
    python3 << 'PYTHON_EOF'
import ray
import sys
from time import sleep

try:
    # 尝试连接到集群
    try:
        ray.init(address=f"ray://{sys.argv[1]}:{sys.argv[2]}", ignore_reinit_error=True)
    except:
        ray.init(address="auto", ignore_reinit_error=True)
    
    sleep(2)  # 给集群一些时间响应
    
    # 获取集群信息
    resources = ray.cluster_resources()
    available = ray.available_resources()
    nodes = ray.nodes()
    
    print("=" * 60)
    print("Ray 集群状态")
    print("=" * 60)
    
    print(f"\n📊 集群资源:")
    for resource, count in sorted(resources.items()):
        print(f"  • {resource}: {count}")
    
    print(f"\n🔵 可用资源:")
    for resource, count in sorted(available.items()):
        print(f"  • {resource}: {count}")
    
    print(f"\n🖥️  节点信息 ({len(nodes)} 个节点):")
    for i, node in enumerate(nodes, 1):
        node_id = node['NodeID'][:8] + "..."
        status = "✓ 活跃" if node.get('Alive') else "✗ 离线"
        resources_str = ", ".join(f"{k}={v}" for k, v in node.get('Resources', {}).items())
        print(f"  {i}. {node_id} - {status}")
        if resources_str:
            print(f"     资源: {resources_str}")
    
    print("\n" + "=" * 60)
    
    ray.shutdown()
    sys.exit(0)
    
except Exception as e:
    print(f"❌ 错误: {e}")
    sys.exit(1)
PYTHON_EOF
}

# 验证集群
verify_cluster() {
    log_info "验证集群连接和健康状况..."
    echo ""
    
    python3 << 'PYTHON_EOF'
import ray
import sys
import subprocess
from time import sleep, time

try:
    # 连接到集群
    try:
        ray.init(address=f"ray://{sys.argv[1]}:{sys.argv[2]}", ignore_reinit_error=True)
    except:
        ray.init(address="auto", ignore_reinit_error=True)
    
    sleep(2)
    
    print("=" * 60)
    print("Ray 集群验证报告")
    print("=" * 60)
    
    # 检查连接
    resources = ray.cluster_resources()
    if resources:
        print("\n✅ 集群连接: 成功")
    else:
        print("\n❌ 集群连接: 失败")
        sys.exit(1)
    
    # 检查节点数量
    nodes = ray.nodes()
    node_count = len(nodes)
    print(f"✅ 活跃节点: {node_count} 个")
    
    if node_count < 4:  # Head + 3 workers
        print("⚠️  警告: 节点数量少于预期 (应为 4 个)")
    
    # 检查 CPU
    total_cpus = resources.get('CPU', 0)
    print(f"✅ 总 CPU 核心: {total_cpus}")
    
    if total_cpus < 48:  # 4 nodes * 12 cpus
        print("⚠️  警告: CPU 核心数少于预期")
    
    # 检查 GPU (如果有)
    total_gpus = resources.get('GPU', 0)
    if total_gpus > 0:
        print(f"✅ 总 GPU 数量: {total_gpus}")
    
    # 简单的任务测试
    print("\n执行简单任务测试...")
    
    @ray.remote
    def test_task(x):
        return x * 2
    
    result = ray.get(test_task.remote(21))
    if result == 42:
        print("✅ 任务执行: 成功")
    else:
        print("❌ 任务执行: 失败")
    
    print("\n" + "=" * 60)
    print("验证完成!")
    print("=" * 60)
    
    ray.shutdown()
    sys.exit(0)
    
except Exception as e:
    print(f"\n❌ 验证失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYTHON_EOF
}

# 完整流程
full_setup() {
    log_info "执行完整的 Ray 集群设置流程..."
    echo ""
    
    # 检查主节点
    if ! check_head_node; then
        log_error "主节点不可达，无法继续"
        exit 1
    fi
    
    if ! check_head_ray_status; then
        log_error "Ray Head 服务不运行，无法继续"
        exit 1
    fi
    
    echo ""
    
    # 安装 Ray
    if ! install_ray; then
        log_warning "部分节点安装失败，继续尝试启动..."
    fi
    
    echo ""
    
    # 启动工作节点
    if ! start_workers; then
        log_warning "部分工作节点启动失败"
    fi
    
    echo ""
    
    # 验证集群
    log_info "等待 30 秒让集群稳定..."
    sleep 30
    
    verify_cluster "$HEAD_ADDRESS" "$HEAD_PORT"
}

# 主程序
main() {
    local action=${1:-help}
    
    case "$action" in
        install)
            check_head_node || exit 1
            install_ray
            ;;
        start)
            check_head_node || exit 1
            check_head_ray_status || exit 1
            start_workers
            ;;
        stop)
            stop_workers
            ;;
        status)
            check_head_node || exit 1
            check_status "$HEAD_ADDRESS" "$HEAD_PORT"
            ;;
        verify)
            check_head_node || exit 1
            check_head_ray_status || exit 1
            verify_cluster "$HEAD_ADDRESS" "$HEAD_PORT"
            ;;
        full)
            full_setup
            ;;
        help)
            print_usage
            ;;
        *)
            log_error "未知的命令: $action"
            print_usage
            exit 1
            ;;
    esac
}

# 执行主程序
main "$@"
