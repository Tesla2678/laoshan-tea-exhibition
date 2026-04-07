@echo off
:: ============================================================
:: 崂山茶展陈顾问 · 一键启动脚本 (Windows)
:: 
:: 用法: 双击 start.bat
:: ============================================================

cd /d "%~dp0"

echo.
echo ==========================================
echo   崂山茶展陈顾问 · 启动中...
echo ==========================================
echo.

:: 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 npm，请先安装 Node.js
    pause
    exit /b 1
)

:: 检查依赖
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖...
    call npm install
)

:: 启动后端 + 前端
echo [启动] 后端 (端口 3001) 和前端 (端口 3000)...
echo.
npm run start

pause
