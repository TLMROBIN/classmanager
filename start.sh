#!/bin/bash

# 班级管理系统（多用户版）启动脚本

cd "$(dirname "$0")"

echo "=========================================="
echo "  班级管理系统（多用户版）启动脚本"
echo "=========================================="

if [ -f ".env.runtime" ]; then
    set -a
    . ".env.runtime"
    set +a
fi

DB_PATH="${CLASSMANAGER_DB_PATH:-$(pwd)/database/classmanager.db}"
BACKUP_DIR="${CLASSMANAGER_BACKUP_DIR:-$(pwd)/backups/sqlite}"
PORT="${PORT:-3002}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

# 检查数据库是否存在，不存在则初始化
mkdir -p "$(dirname "$DB_PATH")"
mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
    echo "🗄️  初始化数据库..."
    node database/init.js
fi

if [ -z "${JWT_SECRET:-}" ]; then
    echo "❌ 错误: 未设置 JWT_SECRET"
    echo "   请先在环境变量或 .env.runtime 中配置 JWT_SECRET"
    exit 1
fi

# 检查是否已在运行
if [ -f "server.pid" ]; then
    PID=$(cat server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "⚠️  服务器已在运行中 (PID: $PID)"
        echo "   如需重启，请先运行 stop.sh"
        exit 0
    fi
fi

# 启动服务器
echo "🚀 启动服务器..."
nohup node server.js > server.log 2>&1 &
PID=$!
echo $PID > server.pid

sleep 2

# 检查是否启动成功
if ps -p $PID > /dev/null 2>&1; then
    echo ""
    echo "✅ 服务器启动成功！"
    echo ""
    echo "   访问地址: http://localhost:$PORT"
    echo "   管理后台: http://localhost:$PORT/admin.html"
    echo "   首个管理员请使用: npm run bootstrap-admin"
    echo "   数据库文件: $DB_PATH"
    echo "   备份目录: $BACKUP_DIR"
    echo ""
    echo "   日志文件: $(pwd)/server.log"
    echo "   进程 PID: $PID"
    echo ""
    echo "   停止服务: ./stop.sh"
    echo "=========================================="
else
    echo "❌ 服务器启动失败，请查看 server.log"
    rm -f server.pid
    exit 1
fi
