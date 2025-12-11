#!/bin/bash
# Electron 应用构建脚本 (Linux)

set -e

PROJECT_DIR="/data/home/sim6g/rayCode/droneOnCampus/doc/electron-app-template"
cd "$PROJECT_DIR"

echo "=========================================="
echo "🔨 构建 Electron 像素流接收应用"
echo "=========================================="
echo ""

# 1. 检查 Node.js
echo "📋 Step 1: 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，正在尝试从 conda 使用..."
    eval "$(conda shell.bash hook)"
    conda activate base 2>/dev/null || true
fi

node_ver=$(node --version 2>/dev/null || echo "unknown")
npm_ver=$(npm --version 2>/dev/null || echo "unknown")
echo "   ✓ Node.js: $node_ver"
echo "   ✓ npm: $npm_ver"
echo ""

# 2. 安装依赖
echo "📦 Step 2: 安装依赖..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/electron" ]; then
    echo "   运行 npm install..."
    npm install --prefer-offline --no-audit
else
    echo "   ✓ 依赖已安装"
fi
echo ""

# 3. 验证关键文件
echo "🔍 Step 3: 验证关键文件..."
files=(
    "main.js"
    "src/preload.js"
    "src/drone-monitor.js"
    "src/stream-manager.js"
    "src/renderer.js"
    "src/index.html"
)

all_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✓ $file"
    else
        echo "   ❌ $file (缺失)"
        all_exist=false
    fi
done

if [ "$all_exist" = false ]; then
    echo ""
    echo "❌ 缺少关键文件！"
    exit 1
fi
echo ""

# 4. 启动应用
echo "🚀 Step 4: 启动应用..."
echo "   使用 npm start 启动..."
echo ""
npm start
