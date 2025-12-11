# Windows 环境检查脚本
# 用法: .\check-env.ps1

Write-Host "`n" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Windows 环境检查工具" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

$issues = @()
$warnings = @()

# 1. 检查 OS 版本
Write-Host "📋 系统检查..."
$os = [System.Environment]::OSVersion
$win_version = (Get-WmiObject -Class Win32_OperatingSystem).Caption

if ($os.Platform -eq "Win32NT") {
    Write-Host "  ✓ Windows 系统: $win_version" -ForegroundColor Green
} else {
    Write-Host "  ✗ 非 Windows 系统" -ForegroundColor Red
    $issues += "此脚本仅支持 Windows"
}

# 2. 检查 Node.js
Write-Host "`n📦 Node.js 检查..."
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $node_version = & node --version
    Write-Host "  ✓ Node.js 已安装: $node_version" -ForegroundColor Green
    
    # 检查版本
    $version_number = $node_version -replace 'v', '' -split '\.' | Select-Object -First 1
    if ([int]$version_number -lt 16) {
        Write-Host "  ⚠ 版本较低，建议升级到 v16+" -ForegroundColor Yellow
        $warnings += "Node.js 版本为 v$version_number，建议升级"
    }
} else {
    Write-Host "  ✗ Node.js 未安装" -ForegroundColor Red
    $issues += "需要安装 Node.js (https://nodejs.org/)"
}

# 3. 检查 npm
Write-Host "`n📚 npm 检查..."
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($npm) {
    $npm_version = & npm --version
    Write-Host "  ✓ npm 已安装: $npm_version" -ForegroundColor Green
    
    # 检查版本
    $npm_major = $npm_version -split '\.' | Select-Object -First 1
    if ([int]$npm_major -lt 8) {
        Write-Host "  ⚠ npm 版本较低，建议升级" -ForegroundColor Yellow
        $warnings += "npm 版本较低，建议运行: npm install -g npm"
    }
} else {
    Write-Host "  ✗ npm 未找到" -ForegroundColor Red
    $issues += "Node.js 未正确安装"
}

# 4. 检查 Python (可选)
Write-Host "`n🐍 Python 检查 (可选)..."
$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    $python_version = & python --version
    Write-Host "  ✓ Python 已安装: $python_version" -ForegroundColor Green
} else {
    Write-Host "  ℹ Python 未安装 (大多数情况下不需要)" -ForegroundColor Gray
}

# 5. 检查 Visual Studio Build Tools
Write-Host "`n🔨 Visual Studio Build Tools 检查..."
$vsbuild = Get-Command cl.exe -ErrorAction SilentlyContinue
if ($vsbuild) {
    Write-Host "  ✓ C++ 编译工具已安装" -ForegroundColor Green
} else {
    Write-Host "  ℹ 编译工具未检测到" -ForegroundColor Yellow
    $warnings += "可能需要安装: npm install -g windows-build-tools"
}

# 6. 检查磁盘空间
Write-Host "`n💾 磁盘空间检查..."
$drive = Get-Item -Path "."
$disk = Get-PSDrive -Name $drive.PSDrive.Name
$free_gb = [math]::Round($disk.Free / 1GB, 2)
Write-Host "  ✓ 可用空间: $free_gb GB" -ForegroundColor Green

if ($disk.Free -lt 1GB) {
    Write-Host "  ⚠ 可用空间不足 1GB" -ForegroundColor Yellow
    $warnings += "建议清理磁盘，至少预留 500MB"
}

# 7. 检查网络连接
Write-Host "`n🌐 网络连接检查..."
try {
    $test = Test-Connection 8.8.8.8 -Count 1 -ErrorAction SilentlyContinue
    if ($test) {
        Write-Host "  ✓ 网络连接正常" -ForegroundColor Green
    }
} catch {
    Write-Host "  ℹ 无法测试外网连接" -ForegroundColor Gray
}

# 测试 Linux 服务器连接
Write-Host "`n🖥️ 服务器连接检查..."
try {
    $test = Test-Connection 10.30.2.11 -Count 1 -ErrorAction SilentlyContinue
    if ($test) {
        Write-Host "  ✓ 可连接 10.30.2.11 (Dashboard 服务器)" -ForegroundColor Green
        
        # 测试 API
        try {
            $response = Invoke-WebRequest -Uri "http://10.30.2.11:8000" -TimeoutSec 5 -ErrorAction SilentlyContinue
            Write-Host "  ✓ Dashboard API 服务运行中" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠ Dashboard API 无响应 (8000 端口)" -ForegroundColor Yellow
            $warnings += "Dashboard 服务可能未运行"
        }
        
        # 测试像素流
        try {
            $response = Invoke-WebRequest -Uri "http://10.30.2.11:80" -TimeoutSec 5 -ErrorAction SilentlyContinue
            Write-Host "  ✓ Pixel Streaming 服务运行中" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠ Pixel Streaming 无响应 (80 端口)" -ForegroundColor Yellow
            $warnings += "像素流服务可能未运行"
        }
    } else {
        Write-Host "  ✗ 无法连接 10.30.2.11" -ForegroundColor Red
        $issues += "网络无法连接到 Dashboard 服务器"
    }
} catch {
    Write-Host "  ⚠ 网络检查失败" -ForegroundColor Yellow
    $warnings += "无法连接到 Linux 服务器，检查网络设置"
}

# 8. 检查项目结构
Write-Host "`n📁 项目结构检查..."
$files = @(
    "main.js",
    "package.json",
    "preload.js",
    "src/index.html",
    "src/drone-monitor.js",
    "src/stream-manager.js",
    "src/renderer.js"
)

$missing = @()
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (缺失)" -ForegroundColor Red
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    $issues += "缺失文件: $($missing -join ', ')"
}

# 汇总报告
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "  检查结果汇总" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

if ($issues.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "✓ 环境检查通过！可以开始构建" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步:"
    Write-Host "  1. 运行: npm install"
    Write-Host "  2. 运行: npm run build:win-exe"
    Write-Host "  3. 或运行: .\build.ps1"
} else {
    if ($issues.Count -gt 0) {
        Write-Host "❌ 致命问题 ($($issues.Count)):" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "  • $issue" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "⚠️ 警告 ($($warnings.Count)):" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "  • $warning" -ForegroundColor Yellow
        }
        Write-Host ""
    }
    
    if ($issues.Count -gt 0) {
        Write-Host "请先解决上述问题再继续构建" -ForegroundColor Red
    } else {
        Write-Host "警告不影响构建，但建议处理" -ForegroundColor Yellow
    }
}

# 显示系统信息
Write-Host "`n📊 系统信息:" -ForegroundColor Cyan
Write-Host "  OS: $win_version"
Write-Host "  PowerShell: $($PSVersionTable.PSVersion.Major).$($PSVersionTable.PSVersion.Minor)"
Write-Host "  当前目录: $(Get-Location)"
Write-Host ""

# 提供帮助链接
if ($issues.Count -gt 0) {
    Write-Host "📖 常见问题解决:" -ForegroundColor Cyan
    Write-Host "  Node.js: https://nodejs.org/en/download/"
    Write-Host "  npm: npm install -g npm"
    Write-Host "  Build Tools: npm install -g windows-build-tools"
    Write-Host ""
}

# 保存结果到文件
$report = @"
Windows 环境检查报告
生成时间: $(Get-Date)

系统信息:
  OS: $win_version
  Node.js: $(if ($node) { & node --version } else { '未安装' })
  npm: $(if ($npm) { & npm --version } else { '未安装' })

问题数: $($issues.Count)
警告数: $($warnings.Count)

$(if ($issues.Count -gt 0) { "致命问题:`n$($issues | ForEach-Object { "  - $_" })`n" })
$(if ($warnings.Count -gt 0) { "警告:`n$($warnings | ForEach-Object { "  - $_" })`n" })

结论:
$(if ($issues.Count -eq 0 -and $warnings.Count -eq 0) { "✓ 环境检查通过" } else { "✗ 需要处理上述问题" })
"@

$report | Out-File -FilePath "check-env-report.txt" -Encoding UTF8
Write-Host "✓ 检查结果已保存到: check-env-report.txt" -ForegroundColor Green

Write-Host ""
Read-Host "按 Enter 键关闭此窗口"
