@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo   班级管理系统（多用户版）启动脚本
echo ==========================================

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: 检查依赖是否安装
if not exist "node_modules" (
    echo 📦 正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)

:: 检查数据库是否存在
if not exist "database\classmanager.db" (
    echo 🗄️  初始化数据库...
    node database\init.js
)

:: 启动服务器
echo 🚀 启动服务器...
echo.
echo ==========================================
start "班级管理系统（多用户版）" node server.js

timeout /t 2 >nul

echo.
echo ✅ 服务器已在新窗口启动！
echo.
echo    访问地址: http://localhost:3002
echo    管理后台: http://localhost:3002/admin.html
echo    默认账户: admin / admin123
echo.
echo    停止服务: 关闭服务器窗口 或 运行 stop.bat
echo ==========================================
echo.
pause