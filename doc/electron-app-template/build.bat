@echo off
REM Windows 平台 Electron 应用快速构建脚本
REM 用法: build.bat 或 build.bat build-exe 或 build.bat clean

setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ====================================
echo  无人机像素流接收器 - Windows 构建工具
echo ====================================
echo.

set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=build-exe

REM 颜色代码 (Windows 10+)
set GREEN=[92m
set YELLOW=[93m
set RED=[91m
set RESET=[0m

goto %BUILD_TYPE%

:build-exe
echo %YELLOW%[1/4]%RESET% 检查依赖...
if not exist "node_modules" (
    echo %YELLOW%[2/4]%RESET% 安装 npm 包...
    call npm install
    if !errorlevel! neq 0 (
        echo %RED%[错误]%RESET% npm install 失败
        echo.
        echo 解决方案:
        echo   1. npm cache clean --force
        echo   2. npm install --global windows-build-tools
        echo   3. 重新运行此脚本
        pause
        exit /b 1
    )
)

echo %YELLOW%[3/4]%RESET% 构建 Windows EXE 文件...
call npm run build:win-exe
if !errorlevel! neq 0 (
    echo %RED%[错误]%RESET% 构建失败
    pause
    exit /b 1
)

echo %YELLOW%[4/4]%RESET% 构建完成！
echo.
echo %GREEN%[成功]%RESET% 应用已生成
echo.
echo 文件位置:
echo   dist\无人机像素流接收器-1.0.0.exe
echo.
echo 下一步:
echo   1. 直接运行 EXE 文件
echo   2. 或复制到其他目录使用
echo.
pause
exit /b 0

:build-msi
echo %YELLOW%[1/3]%RESET% 检查依赖...
if not exist "node_modules" (
    echo %YELLOW%[2/3]%RESET% 安装 npm 包...
    call npm install
)

echo %YELLOW%[构建 MSI 安装程序...]%RESET%
call npm run build:win
if !errorlevel! neq 0 (
    echo %RED%[错误]%RESET% 构建失败
    pause
    exit /b 1
)

echo %GREEN%[成功]%RESET% MSI 和 EXE 都已生成
echo.
echo 文件位置:
echo   dist\无人机像素流接收器-1.0.0.exe   (便携版)
echo   dist\无人机像素流接收器-1.0.0.msi   (安装版)
echo.
pause
exit /b 0

:clean
echo %YELLOW%清理构建文件...%RESET%
if exist "dist" (
    rmdir /s /q "dist"
    echo %GREEN%[成功]%RESET% 已删除 dist 目录
)
if exist "node_modules" (
    echo %YELLOW%删除 node_modules (可能耗时)...%RESET%
    rmdir /s /q "node_modules"
    echo %GREEN%[成功]%RESET% 已删除 node_modules
)
echo.
echo %YELLOW%清理完成。运行此脚本重新安装依赖。%RESET%
echo.
pause
exit /b 0

:start
echo %YELLOW%启动开发版本...%RESET%
if not exist "node_modules" (
    call npm install
)
call npm start
exit /b 0

:help
echo.
echo 用法: build.bat [选项]
echo.
echo 选项:
echo   build-exe   构建便携 EXE 文件 (默认)
echo   build-msi   构建 MSI 安装程序和 EXE
echo   clean       清理所有构建文件
echo   start       启动开发版本
echo   help        显示此帮助信息
echo.
echo 示例:
echo   build.bat build-exe
echo   build.bat build-msi
echo   build.bat clean
echo.
pause
exit /b 0

:invalid
echo %RED%[错误]%RESET% 无效的选项: %BUILD_TYPE%
echo.
call :help
exit /b 1
