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

echo [1/2] Starting backend (port 3001) ...
start /b cmd /c "npm run server > server.log 2>&1"

timeout /t 3 /nobreak >nul

echo [2/2] Starting frontend (port 3000) ...
start /b cmd /c "npm run dev > dev.log 2>&1"

echo.
echo ==========================================
echo   Started successfully!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo ==========================================
echo.
pause
