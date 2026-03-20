# API App

当前是新系统 API 的第一阶段骨架。

已落地的最小结构：

- Fastify 入口
- 环境变量解析
- Prisma 插件占位
- `GET /api/health`
- `POST /api/auth/login` 占位
- `POST /api/auth/refresh` 占位
- `GET /api/auth/me` 占位
- `GET /api/tenants` 占位

说明：

- 依赖尚未安装
- 路由当前只是边界占位，不包含真实业务逻辑
- 所有代码仅位于新工程，不影响旧系统
