@echo off
REM Electron 应用构建和启动脚本 (Windows)
REM 使用方法: build-and-run.bat

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo 🔨 构建 Electron 像素流接收应用
echo ==========================================
echo.

cd /d "%~dp0"
set PROJECT_DIR=%cd%

REM 1. 检查 Node.js
echo 📋 Step 1: 检查环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未找到！请先安装 Node.js
    echo    https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VER=%%i
echo    ✓ Node.js: %NODE_VER%
echo    ✓ npm: %NPM_VER%
echo.

REM 2. 安装依赖
echo 📦 Step 2: 安装依赖...
if not exist "node_modules\.bin\electron.cmd" (
    echo    运行 npm install...
    call npm install --prefer-offline --no-audit
    if errorlevel 1 (
        echo ❌ npm install 失败
        pause
        exit /b 1
    )
) else (
    echo    ✓ 依赖已安装
)
echo.

REM 3. 验证关键文件
echo 🔍 Step 3: 验证关键文件...
setlocal enabledelayedexpansion
set "all_exist=true"

for %%F in (
    "main.js"
    "src\preload.js"
    "src\drone-monitor.js"
    "src\stream-manager.js"
    "src\renderer.js"
    "src\index.html"
) do (
    if exist "%%F" (
        echo    ✓ %%F
    ) else (
        echo    ❌ %%F (缺失)
        set "all_exist=false"
    )
)

if "!all_exist!"=="false" (
    echo.
    echo ❌ 缺少关键文件！
    pause
    exit /b 1
)
echo.

REM 4. 启动应用
echo 🚀 Step 4: 启动应用...
echo    使用 npm start 启动...
echo.

call npm start

endlocal
