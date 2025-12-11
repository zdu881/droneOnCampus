# Windows PowerShell 构建脚本
# 用法: .\build.ps1 -Type exe
#       .\build.ps1 -Type msi
#       .\build.ps1 -Type clean

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('exe', 'msi', 'all', 'clean', 'start')]
    [string]$Type = 'exe'
)

# 颜色输出辅助函数
function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

# 检查 Node.js
function Check-NodeInstalled {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Error-Custom "Node.js 未安装"
        Write-Info "请从 https://nodejs.org/ 下载安装 Node.js"
        exit 1
    }
    $version = & node --version
    Write-Success "检测到 Node.js $version"
}

# 安装依赖
function Install-Dependencies {
    if (-not (Test-Path "node_modules")) {
        Write-Warning "node_modules 不存在，正在安装..."
        
        # 检查 npm 版本
        $npm_version = & npm --version
        Write-Info "npm 版本: $npm_version"
        
        # 安装
        & npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "npm install 失败"
            Write-Info "可能的解决方案:"
            Write-Info "  1. npm cache clean --force"
            Write-Info "  2. npm install --global windows-build-tools"
            Write-Info "  3. 重新运行此脚本"
            exit 1
        }
        Write-Success "依赖安装完成"
    } else {
        Write-Success "依赖已存在"
    }
}

# 构建 EXE
function Build-Exe {
    Write-Info "开始构建便携 EXE 文件..."
    Write-Warning "这可能需要 2-5 分钟..."
    
    $start_time = Get-Date
    & npm run build:win-exe
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "构建失败"
        exit 1
    }
    
    $end_time = Get-Date
    $duration = $end_time - $start_time
    Write-Success "EXE 构建完成 (耗时: $([int]$duration.TotalSeconds) 秒)"
    
    $exe_file = Get-Item "dist\无人机像素流接收器-*.exe" -ErrorAction SilentlyContinue
    if ($exe_file) {
        $size_mb = [math]::Round($exe_file.Length / 1MB, 2)
        Write-Info "文件大小: $size_mb MB"
        Write-Info "位置: $($exe_file.FullName)"
    }
}

# 构建 MSI
function Build-Msi {
    Write-Info "开始构建 MSI 安装程序和 EXE..."
    Write-Warning "这可能需要 5-10 分钟..."
    
    $start_time = Get-Date
    & npm run build:win
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "构建失败"
        exit 1
    }
    
    $end_time = Get-Date
    $duration = $end_time - $start_time
    Write-Success "构建完成 (耗时: $([int]$duration.TotalSeconds) 秒)"
    
    Get-ChildItem "dist\*" -Include "*.exe", "*.msi" | ForEach-Object {
        $size_mb = [math]::Round($_.Length / 1MB, 2)
        Write-Info "$($_.Name) - $size_mb MB"
    }
}

# 清理
function Clean-Build {
    Write-Warning "正在删除构建文件..."
    
    if (Test-Path "dist") {
        Remove-Item "dist" -Recurse -Force
        Write-Success "已删除 dist 目录"
    }
    
    if (Test-Path "node_modules") {
        Write-Warning "删除 node_modules (可能耗时)..."
        Remove-Item "node_modules" -Recurse -Force
        Write-Success "已删除 node_modules"
    }
    
    Write-Success "清理完成"
}

# 启动开发版本
function Start-Dev {
    Write-Info "启动开发版本..."
    & npm start
}

# 主程序
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "  无人机像素流接收器 - Windows 构建工具" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# 前置检查
Check-NodeInstalled
Install-Dependencies

# 执行相应操作
switch ($Type) {
    'exe' {
        Build-Exe
    }
    'msi' {
        Build-Msi
    }
    'all' {
        Build-Exe
        Write-Info ""
        Build-Msi
    }
    'clean' {
        Clean-Build
    }
    'start' {
        Start-Dev
    }
}

Write-Host "`n================================" -ForegroundColor Green
Write-Host "  操作完成！" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Green

# 显示后续步骤
if ($Type -in 'exe', 'msi', 'all') {
    Write-Info "后续步骤:"
    Write-Info "  1. 打开 dist 目录"
    Write-Info "  2. 双击 .exe 文件运行"
    Write-Info "  3. 或使用 .msi 安装到自定义位置"
    Write-Info ""
    Write-Info "配置文件: main.js (第 ~47-48 行)"
    Write-Info "  - DASHBOARD_API_URL = 'http://10.30.2.11:8000'"
    Write-Info "  - streamManager URL = 'http://10.30.2.11:80'"
}
