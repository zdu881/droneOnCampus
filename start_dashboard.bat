@echo off
echo ====================================
echo  Campus Drone Management System
echo ====================================
echo.
echo Please select interface mode:
echo.
echo 1. Dashboard Interface (dashboard.html)
echo 2. Professional Dashboard (dashboard.html) [NEW]
echo 3. Exit
echo.
set /p choice=Enter your choice (1-3): 

if "%choice%"=="1" (
    echo Starting Legacy Interface...
    start "" "http://localhost:8080/src/frontend/dashboard.html"
    goto end
)

if "%choice%"=="2" (
    echo Starting Professional Dashboard...
    start "" "http://localhost:8080/dashboard.html"
    goto end
)

if "%choice%"=="3" (
    echo Exiting...
    goto end
)

echo Invalid choice. Please try again.
pause
goto start

:end
echo.
echo Interface started. Check your browser.
pause
