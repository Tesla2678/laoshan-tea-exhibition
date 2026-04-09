@echo off
cd /d "%~dp0"

echo.
echo ==========================================
echo   Laoshan Tea Exhibition - Starting...
echo ==========================================
echo.

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found. Please install Node.js.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] First run, installing dependencies...
    call npm install
    echo.
)

:: Get LAN IP dynamically
for /f "delims=[] tokens=2" %%a in ('ping -4 -n 1 %COMPUTERNAME% ^| findstr /r "[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*"') do (
    set LAN_IP=%%a
)
if not defined LAN_IP set LAN_IP=127.0.0.1

echo [INFO] LAN IP: %LAN_IP%
echo.

:: Start backend and frontend in background using npm-run-all
echo [OK] Starting backend (port 3001) and frontend (port 3000)...
echo.
start /b cmd /c "npm run start > start.log 2>&1"

:: Wait for services to be ready
echo [INFO] Waiting for services to start...
timeout /t 5 /nobreak >nul

:: Auto-open browser
echo [OK] Launching browser...
start http://%LAN_IP%:3000

echo.
echo ==========================================
echo   Laoshan Tea Exhibition - Started!
echo.
echo   Local:    http://localhost:3000
echo   LAN:      http://%LAN_IP%:3000
echo   Backend:  http://localhost:3001
echo.
echo   Logs:     start.log  (in project folder)
echo   Close this window to stop all services
echo ==========================================
echo.
pause
