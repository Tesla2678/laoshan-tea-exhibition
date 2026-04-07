@echo off
chcp 65001 >nul
:: ============================================================
:: 崂山茶展陈顾问 · 一键启动脚本 (Windows)
:: 双击运行即可
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

:: 首次安装依赖
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖（仅一次）...
    call npm install
    echo.
)

:: 先启动后端
echo [1/2] 启动后端服务 (端口 3001) ...
start /b cmd /c "npm run server > server.log 2>&1"

:: 等待后端就绪
timeout /t 3 /nobreak >nul

:: 再启动前端
echo [2/2] 启动前端服务 (端口 3000) ...
start /b cmd /c "npm run dev > dev.log 2>&1"

echo.
echo ==========================================
echo   已启动！
echo   前端: http://localhost:3000
echo   后端: http://localhost:3001
echo   关闭请关闭此窗口
echo ==========================================
echo.
pause
