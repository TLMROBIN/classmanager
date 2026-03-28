#!/bin/bash

# 班级管理系统（多用户版）停机脚本

cd "$(dirname "$0")"

if [ -f ".env.runtime" ]; then
    set -a
    . ".env.runtime"
    set +a
fi

if [ -n "${XDG_STATE_HOME:-}" ]; then
    DEFAULT_STATE_ROOT="$XDG_STATE_HOME/classmanager-multi"
elif [ -n "${HOME:-}" ]; then
    DEFAULT_STATE_ROOT="$HOME/.local/state/classmanager-multi"
else
    DEFAULT_STATE_ROOT="$(pwd)/.runtime"
fi

STATE_ROOT="${CLASSMANAGER_STATE_ROOT:-$DEFAULT_STATE_ROOT}"
RUNTIME_DIR="${CLASSMANAGER_RUNTIME_DIR:-$STATE_ROOT/runtime}"
PID_FILE="${CLASSMANAGER_PID_FILE:-$RUNTIME_DIR/server.pid}"

echo "=========================================="
echo "  班级管理系统（多用户版）停机脚本"
echo "=========================================="

# 检查 PID 文件是否存在
if [ ! -f "$PID_FILE" ]; then
    echo "⚠️  未找到 PID 文件: $PID_FILE"
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

PID=$(cat "$PID_FILE")

# 检查进程是否存在
if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  进程不存在 (PID: $PID)"
    echo "   清理 PID 文件"
    rm -f "$PID_FILE"
    exit 0
fi

# 终止进程
echo "🛑 正在停止服务器 (PID: $PID)..."
kill "$PID" 2>/dev/null

# 等待进程结束
for i in {1..10}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# 强制终止
if ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  进程未响应，强制终止..."
    kill -9 "$PID" 2>/dev/null
fi

# 清理
rm -f "$PID_FILE"

echo ""
echo "✅ 服务器已停止"
echo "=========================================="
