#!/bin/bash

# 班级管理系统（多用户版）停机脚本

cd "$(dirname "$0")"

echo "=========================================="
echo "  班级管理系统（多用户版）停机脚本"
echo "=========================================="

# 检查 PID 文件是否存在
if [ ! -f "server.pid" ]; then
    echo "⚠️  未找到 server.pid 文件"
    echo "   服务器可能未运行"
    
    # 尝试查找并终止进程
    PID=$(pgrep -f "node server.js" | head -1)
    if [ ! -z "$PID" ]; then
        echo "   发现运行中的进程 (PID: $PID)，正在终止..."
        kill $PID 2>/dev/null
        sleep 1
        if ps -p $PID > /dev/null 2>&1; then
            kill -9 $PID 2>/dev/null
        fi
        echo "✅ 进程已终止"
    fi
    exit 0
fi

PID=$(cat server.pid)

# 检查进程是否存在
if ! ps -p $PID > /dev/null 2>&1; then
    echo "⚠️  进程不存在 (PID: $PID)"
    echo "   清理 server.pid 文件"
    rm -f server.pid
    exit 0
fi

# 终止进程
echo "🛑 正在停止服务器 (PID: $PID)..."
kill $PID 2>/dev/null

# 等待进程结束
for i in {1..10}; do
    if ! ps -p $PID > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# 强制终止
if ps -p $PID > /dev/null 2>&1; then
    echo "⚠️  进程未响应，强制终止..."
    kill -9 $PID 2>/dev/null
fi

# 清理
rm -f server.pid

echo ""
echo "✅ 服务器已停止"
echo "=========================================="