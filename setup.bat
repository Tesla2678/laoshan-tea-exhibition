@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ==========================================
echo   崂山茶展陈顾问 · 首次配置向导
echo ==========================================
echo.
echo 本工具将帮你创建 .env 配置文件
echo 请准备好以下密钥:
echo   1. 腾讯云 SecretId / SecretKey
echo   2. Google API Key
echo.

set /p TENCENT_ID="请输入腾讯 SecretId (直接回车跳过，使用默认密钥): "
set /p TENCENT_KEY="请输入腾讯 SecretKey (直接回车跳过，使用默认密钥): "
set /p GOOGLE_KEY="请输入 Google API Key (直接回车跳过，使用默认密钥): "

echo.

if exist .env copy /Y .env .env.backup >nul

(
  echo # ============================================================
  echo # 崂山茶展陈顾问 · 环境变量配置
  echo # ============================================================
  echo.
  echo VITE_BACKEND_PORT=3001
  echo VITE_FRONTEND_PORT=3000
  echo.
  echo # --- 腾讯云密钥 ---
  echo VITE_SECRET_ID=%TENCENT_ID%
  echo VITE_SECRET_KEY=%TENCENT_KEY%
  echo.
  echo # --- Google API Key ---
  echo VITE_GOOGLE_API_KEY=%GOOGLE_KEY%
  echo.
  echo PORT=3001
  echo FRONTEND_PORT=3000
) > .env

echo [.env] created successfully!
echo.
echo now run start.bat to launch the app.
echo.
pause
