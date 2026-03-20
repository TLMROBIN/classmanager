# ClassManager Multi (班级管理系统 - 多用户版)

这是一个基于 Node.js 和 Express 构建的班级管理系统后端项目。它使用了 SQLite 数据库来存储信息，并支持多用户、权限管理以及完整的数据备份和恢复机制。

## 主要技术栈

- **后端层**: Node.js, Express
- **数据库**: SQLite (`better-sqlite3`)
- **安全性**: 密码哈希 (`bcryptjs`), JWT身份验证 (`jsonwebtoken`)
- **跨域支持**: CORS

## 快速开始

### 1. 环境准备

确保你的系统已安装：
- [Node.js](https://nodejs.org/) (推荐 v16 以上版本)
- npm

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化数据库

初次运行前，需要初始化数据库表结构：

```bash
npm run init-db
```

### 4. 启动服务

使用以下命令启动服务器：

```bash
# 开发模式启动
npm start
```
或者，使用项目中自带的启停脚本：
- `start.bat` / `start.sh`
- `stop.bat` / `stop.sh`

## 内置脚本和工具

项目中包含了一套完整的数据库备份和恢复工具体系：

- **备份数据库 (SQLite)**: `npm run backup:sqlite`
- **清理过期备份**: `npm run backup:prune:apply`
- **每日定时备份计划**: `npm run backup:daily`
- **验证备份有效性**: `npm run backup:verify`
- **检查备份新鲜度**: `npm run backup:check-freshness`
- **从备份恢复数据**: `npm run restore:sqlite`
