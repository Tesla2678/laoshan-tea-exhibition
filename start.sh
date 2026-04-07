#!/bin/bash
# ============================================================
# 崂山茶展陈顾问 · 一键启动脚本 (Linux / macOS)
# 
# 用法: 
#   chmod +x start.sh      # 首次运行赋予执行权限
#   ./start.sh             # 双击或终端运行
# ============================================================

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo ""
echo "=========================================="
echo "  崂山茶展陈顾问 · 启动中..."
echo "=========================================="
echo ""

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 未找到 npm，请先安装 Node.js"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
fi

# 启动后端 + 前端
echo "🚀 正在启动后端服务 (端口 3001) 和前端 (端口 3000)..."
echo ""
npm run start
