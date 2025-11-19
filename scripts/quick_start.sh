#!/bin/bash

# 快速启动脚本 - CastRay + DroneOnCampus
# 简化版本，适合日常使用

echo "🚀 启动CastRay + DroneOnCampus系统..."

# 停止可能运行的旧进程
pkill -f "python src/backend/python/rayoutput.py" 2>/dev/null || true
pkill -f "python rayoutput.py" 2>/dev/null || true
pkill -f "python main.py" 2>/dev/null || true
pkill -f "http.server 8080" 2>/dev/null || true

# 启动Ray数据API
echo "📊 启动Ray数据API..."
cd /data/home/sim6g/rayCode/droneOnCampus
nohup bash -c "source ~/anaconda3/etc/profile.d/conda.sh && conda activate ray && python src/backend/python/rayoutput.py" > logs/rayoutput.log 2>&1 &

# 等待Ray数据API启动
sleep 3

# 启动CastRay后端
echo "📡 启动CastRay后端..."
cd /data/home/sim6g/rayCode/CastRay
nohup bash -c "source ~/anaconda3/etc/profile.d/conda.sh && conda activate ray && python main.py" > /data/home/sim6g/rayCode/droneOnCampus/logs/castray.log 2>&1 &

# 等待CastRay启动
sleep 5

# 启动前端服务器
echo "🌐 启动前端服务器..."
cd /data/home/sim6g/rayCode/droneOnCampus/src/frontend
nohup python -m http.server 8080 > ../../logs/frontend.log 2>&1 &

# 等待前端启动
sleep 2

echo ""
echo "✅ 系统启动完成！"
echo ""
echo "🔗 访问地址:"
echo "   Dashboard: http://10.30.2.11:8080/dashboard.html"
echo "   Index页面: http://10.30.2.11:8080/src/frontend/dashboard.html"
echo "   Ray数据API: http://10.30.2.11:9999"
echo "   CastRay API: http://10.30.2.11:8000/api/status"
echo "   Ray集群: http://10.30.2.11:8265"
echo ""
echo "📝 日志文件:"
echo "   Ray数据API: /data/home/sim6g/rayCode/droneOnCampus/logs/rayoutput.log"
echo "   CastRay: /data/home/sim6g/rayCode/CastRay/castray.log"
echo "   Frontend: /data/home/sim6g/rayCode/droneOnCampus/logs/frontend.log"
echo ""
echo "🛑 停止系统: pkill -f 'python src/backend/python/rayoutput.py'; pkill -f 'python main.py'; pkill -f 'http.server'"
