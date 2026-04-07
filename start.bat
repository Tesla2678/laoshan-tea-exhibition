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

echo [INFO] Detected LAN IP: %LAN_IP%
echo.

:: Start backend
echo [1/2] Starting backend (port 3001) ...
start /b cmd /c "npm run server > server.log 2>&1"

:: Wait for backend to be ready
timeout /t 3 /nobreak >nul

:: Start frontend
echo [2/2] Starting frontend (port 3000) ...
start /b cmd /c "npm run dev > dev.log 2>&1"

:: Wait for frontend to be ready
timeout /t 4 /nobreak >nul

:: Auto-open browser with LAN IP
echo.
echo [OK] Launching browser...
start http://%LAN_IP%:3000

echo.
echo ==========================================
echo   Started!
echo   Local:    http://localhost:3000
echo   LAN:      http://%LAN_IP%:3000
echo   Backend:  http://localhost:3001
echo   Close this window to stop all services
echo ==========================================
echo.
pause
