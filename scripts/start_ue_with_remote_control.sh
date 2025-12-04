#!/bin/bash

# UE5 应用启动脚本 - 包含 Remote Control API 支持

set -e

PROJECT_DIR="/data/home/sim6g/rayCode/Linux/Project/Binaries/Linux"
EXECUTABLE="$PROJECT_DIR/Project"
MAP_NAME="NewMap"
PIXEL_STREAM_URL="ws://127.0.0.1:8888"
RC_WEB_PORT="30010"

echo "=========================================="
echo "🚀 启动 UE5 应用（含 Remote Control API）"
echo "=========================================="
echo ""
echo "📋 启动参数："
echo "  项目: $PROJECT_DIR"
echo "  地图: $MAP_NAME"
echo "  像素流: $PIXEL_STREAM_URL"
echo "  Remote Control API 端口: $RC_WEB_PORT"
echo ""

# 检查可执行文件是否存在
if [ ! -f "$EXECUTABLE" ]; then
    echo "❌ 错误: 找不到可执行文件 $EXECUTABLE"
    exit 1
fi

echo "✅ 可执行文件已找到"
echo ""
echo "启动中..."
echo ""

# 启动命令 - 包含所有必要参数
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
echo "✅ UE5 应用已启动"
echo ""
echo "📊 服务状态："
echo "  • 像素流: ws://127.0.0.1:8888"
echo "  • Remote Control API: http://10.30.2.11:30010"
echo "  • 地图: $MAP_NAME"
