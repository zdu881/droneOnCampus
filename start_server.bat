@echo off
title Campus Drone Management System - Server
echo ====================================
echo  Starting Local Development Server
echo ====================================
echo.
echo Checking Python installation...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found. Please install Python 3.6+ and try again.
    pause
    exit /b 1
)

echo Python found. Starting server...
echo.
echo Available interfaces:
echo - Professional Dashboard: http://localhost:8080/src/frontend/dashboard.html
echo - Professional Dashboard: http://localhost:8080/dashboard.html
echo.
echo Press Ctrl+C to stop the server
echo ====================================
echo.

cd /d "%~dp0"
python -m http.server 8080
