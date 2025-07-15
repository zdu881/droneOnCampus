@echo off
REM 启动多场景5G网络控制系统 - Windows版

echo === 5G Campus Network Control - Multi-Scenario ===
echo 启动自动驾驶汽车和无人机双场景支持系统...

REM 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python未安装或未加入PATH，请先安装Python
    pause
    exit /b 1
)

REM 安装Python依赖
echo 检查并安装Python依赖...
pip install flask flask-cors pyyaml requests

REM 启动Python后端服务
echo 启动Agent决策后端服务...
start "Vehicle MEC Agent" python vehicle_mec_agent.py

REM 等待后端启动
timeout /t 5 /nobreak

REM 启动前端服务器
echo 启动前端Web服务器...
start "Frontend Server" python -m http.server 8080

echo.
echo === 系统启动完成 ===
echo 场景1: 无人机配送 - 原有功能
echo 场景2: 自动驾驶汽车MEC切换 - 新增功能
echo.
echo Agent决策后端: http://localhost:5000
echo 前端界面: http://localhost:8080
echo.
echo 请在浏览器中访问 http://localhost:8080
echo 按任意键退出...
pause
