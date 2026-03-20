@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo   班级管理系统（多用户版）停机脚本
echo ==========================================

:: 查找并终止 Node.js 进程
echo 🛑 正在停止服务器...

taskkill /FI "WINDOWTITLE eq 班级管理系统（多用户版）*" /F >nul 2>nul

:: 也尝试通过端口查找
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>nul
)

echo.
echo ✅ 服务器已停止
echo ==========================================
pause