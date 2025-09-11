#!/bin/bash

# 路径验证脚本
# 检查项目重构后所有关键文件是否存在

echo "🔍 检查项目文件路径..."

# 项目根目录
PROJECT_ROOT="/data/home/sim6g/rayCode/droneOnCampus"
cd "$PROJECT_ROOT"

echo ""
echo "📁 检查目录结构..."

# 检查主要目录
directories=(
    "src"
    "src/frontend"
    "src/frontend/js"
    "src/frontend/css"
    "src/backend"
    "src/backend/python"
    "scripts"
    "config"
    "docs"
    "logs"
)

for dir in "${directories[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir"
    else
        echo "❌ $dir"
    fi
done

echo ""
echo "📄 检查关键文件..."

# 检查关键文件
files=(
    "src/frontend/index.html"
    "src/frontend/dashboard.html"
    "src/frontend/css/styles.css"
    "src/frontend/css/dashboard-styles.css"
    "src/frontend/js/app.js"
    "src/frontend/js/api-manager.js"
    "src/frontend/js/dashboard-manager.js"
    "src/backend/python/rayoutput.py"
    "src/backend/python/castray_backend.py"
    "scripts/quick_start.sh"
    "scripts/start_castray_system.sh"
    "config/system_config.json"
    "config/config_external_cluster.json"
    ".gitignore"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file"
    fi
done

echo ""
echo "🔧 检查脚本权限..."

scripts=(
    "scripts/quick_start.sh"
    "scripts/start_castray_system.sh"
    "scripts/stop_castray_system.sh"
    "scripts/monitor_system.sh"
)

for script in "${scripts[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            echo "✅ $script (可执行)"
        else
            echo "⚠️  $script (需要执行权限)"
            chmod +x "$script"
            echo "   已添加执行权限"
        fi
    else
        echo "❌ $script (文件不存在)"
    fi
done

echo ""
echo "🎯 测试前端HTTP服务器启动目录..."

cd "$PROJECT_ROOT/src/frontend"
if [ -f "index.html" ] && [ -f "dashboard.html" ]; then
    echo "✅ 前端文件可访问"
    echo "   - index.html: http://localhost:8080/index.html"
    echo "   - dashboard.html: http://localhost:8080/dashboard.html"
else
    echo "❌ 前端文件缺失"
fi

echo ""
echo "📊 检查日志目录..."
if [ -d "$PROJECT_ROOT/logs" ]; then
    echo "✅ logs目录存在"
else
    echo "⚠️  创建logs目录"
    mkdir -p "$PROJECT_ROOT/logs"
fi

echo ""
echo "🎉 路径检查完成！"
echo ""
echo "🚀 使用以下命令启动系统:"
echo "   快速启动: ./scripts/quick_start.sh"
echo "   完整启动: ./scripts/start_castray_system.sh"
