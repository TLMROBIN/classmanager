# 目标数据库 Schema 初稿 v1

## 1. 文档目的

本文档用于定义新系统第一版 PostgreSQL 数据库结构草案，作为以下工作的基线：

- Prisma schema 设计
- migration 编写
- 后端模块建模
- 旧系统数据迁移脚本
- API 设计与测试

本文档强调“第一阶段可落地”，因此会区分：

- 第一阶段最小闭环表集
- 第二阶段扩展表集

## 2. 设计原则

### 2.1 总体原则

- 所有核心业务使用结构化表存储
- 所有关键写操作可审计
- 当前状态与历史流水分离
- 配置与业务数据分离
- 多租户从第一版开始内建
- 尽量使用稳定主键，不依赖展示字段

### 2.2 主键策略

推荐统一使用：

- `uuid` 作为主键
- 同时保留 `code` / `slug` / `display_order` 等业务友好字段

如果考虑迁移便利，可在部分表中额外保留：

- `legacy_id`
- `legacy_key`

### 2.3 时间字段规范

所有核心表统一包含：

- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

对可归档或软删除表增加：

- `deleted_at timestamptz null`

### 2.4 审计字段规范

关键业务表建议增加：

- `created_by_user_id`
- `updated_by_user_id`

关键流水与操作表必须增加：

- `actor_user_id`
- `actor_membership_id`

## 3. 第一阶段最小闭环

### 3.1 第一阶段目标

第一阶段必须支撑以下业务闭环：

- 用户登录与租户隔离
- 班级与学生档案
- 组织结构
- 积分流水
- 考勤
- 基础配置
- 审计

### 3.2 第一阶段表清单

#### 平台与权限

- `tenants`
- `users`
- `memberships`
- `roles`
- `membership_roles`

#### 班级与学生

- `classes`
- `students`
- `student_profiles`
- `groups`
- `dormitories`
- `positions`
- `student_group_assignments`
- `student_dorm_assignments`
- `student_position_assignments`

#### 积分系统

- `point_accounts`
- `point_reason_templates`
- `point_transactions`

#### 考勤系统

- `attendance_schedules`
- `attendance_sessions`
- `attendance_records`
- `attendance_policies`

#### 配置与治理

- `class_configs`
- `feature_flags`
- `audit_logs`
- `import_jobs`
- `migration_mappings`

## 4. 核心实体设计

## 4.1 `tenants`

用途：

- 表示一个租户边界，可对应一个班级、学校或机构

主要字段：

- `id uuid pk`
- `name varchar(120) not null`
- `slug varchar(80) not null unique`
- `type varchar(30) not null`
- `status varchar(30) not null default 'active'`
- `plan_code varchar(50) null`
- `owner_user_id uuid null`
- `created_at`
- `updated_at`

约束建议：

- `slug` 全局唯一
- `status` 枚举候选：`active`, `suspended`, `archived`

## 4.2 `users`

用途：

- 平台用户主表

主要字段：

- `id uuid pk`
- `username varchar(50) not null unique`
- `email varchar(255) null unique`
- `password_hash varchar(255) not null`
- `display_name varchar(120) null`
- `status varchar(30) not null default 'active'`
- `last_login_at timestamptz null`
- `created_at`
- `updated_at`

说明：

- 不再存前端全局管理员密码
- 支持邮箱为空，但商业化阶段建议逐步强制

## 4.3 `roles`

用途：

- 角色字典

主要字段：

- `id uuid pk`
- `tenant_id uuid null`
- `code varchar(50) not null`
- `name varchar(120) not null`
- `scope varchar(30) not null`
- `created_at`
- `updated_at`

约束建议：

- `(tenant_id, code)` 唯一
- 平台级角色可允许 `tenant_id is null`

## 4.4 `memberships`

用途：

- 用户与租户关系

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `user_id uuid not null`
- `display_name varchar(120) null`
- `status varchar(30) not null default 'active'`
- `joined_at timestamptz not null default now()`
- `created_at`
- `updated_at`

约束建议：

- `(tenant_id, user_id)` 唯一

## 4.5 `membership_roles`

用途：

- membership 与 role 的多对多

主要字段：

- `membership_id uuid not null`
- `role_id uuid not null`
- `created_at`

主键建议：

- `(membership_id, role_id)`

## 4.6 `classes`

用途：

- 班级主表

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `name varchar(120) not null`
- `code varchar(50) null`
- `status varchar(30) not null default 'active'`
- `grade_label varchar(50) null`
- `academic_year varchar(30) null`
- `timezone varchar(50) not null default 'Asia/Shanghai'`
- `created_at`
- `updated_at`

约束建议：

- `(tenant_id, name)` 可唯一

## 4.7 `students`

用途：

- 学生身份主表

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid not null`
- `legacy_id bigint null`
- `student_no varchar(50) null`
- `name varchar(120) not null`
- `gender varchar(10) null`
- `status varchar(30) not null default 'active'`
- `joined_at date null`
- `left_at date null`
- `sort_order integer not null default 0`
- `created_at`
- `updated_at`

约束建议：

- `(class_id, student_no)` 唯一，允许空
- `(class_id, name, status)` 不建议强唯一，但可建立索引
- `(class_id, legacy_id)` 唯一，便于迁移

## 4.8 `student_profiles`

用途：

- 学生展示信息和扩展档案

主要字段：

- `student_id uuid pk`
- `avatar_asset_id uuid null`
- `avatar_happy_asset_id uuid null`
- `avatar_normal_asset_id uuid null`
- `avatar_sad_asset_id uuid null`
- `title_left varchar(120) null`
- `title_right varchar(120) null`
- `notes text null`
- `created_at`
- `updated_at`

说明：

- 图片应存对象存储，表里只存资产 ID 或 URL

## 4.9 `groups`

用途：

- 班级内小组字典

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid not null`
- `legacy_key varchar(100) null`
- `name varchar(120) not null`
- `color_token varchar(120) null`
- `display_order integer not null default 0`
- `is_active boolean not null default true`
- `created_at`
- `updated_at`

约束建议：

- `(class_id, legacy_key)` 唯一，允许空
- `(class_id, name)` 唯一

## 4.10 `dormitories`

用途：

- 宿舍字典

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid not null`
- `legacy_key varchar(100) null`
- `name varchar(120) not null`
- `building varchar(120) null`
- `gender_scope varchar(20) null`
- `display_order integer not null default 0`
- `is_active boolean not null default true`
- `created_at`
- `updated_at`

## 4.11 `positions`

用途：

- 岗位/班委/专员/科代表等角色字典

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid null`
- `code varchar(80) not null`
- `name varchar(120) not null`
- `category varchar(50) not null`
- `display_order integer not null default 0`
- `is_active boolean not null default true`
- `created_at`
- `updated_at`

约束建议：

- `(class_id, code)` 唯一

## 4.12 `student_group_assignments`

用途：

- 学生与小组关系

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `student_id uuid not null`
- `group_id uuid not null`
- `role_code varchar(50) null`
- `is_primary boolean not null default true`
- `start_date date null`
- `end_date date null`
- `created_at`
- `updated_at`

约束建议：

- 同一时刻仅允许一个有效主小组

## 4.13 `student_dorm_assignments`

用途：

- 学生与宿舍关系

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `student_id uuid not null`
- `dormitory_id uuid not null`
- `is_primary boolean not null default true`
- `start_date date null`
- `end_date date null`
- `created_at`
- `updated_at`

## 4.14 `student_position_assignments`

用途：

- 学生岗位任命

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `student_id uuid not null`
- `position_id uuid not null`
- `start_date date null`
- `end_date date null`
- `created_at`
- `updated_at`

约束建议：

- `(student_id, position_id, start_date)` 可唯一

## 5. 积分系统设计

## 5.1 `point_accounts`

用途：

- 保存学生当前积分账户状态

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `student_id uuid not null unique`
- `total_points numeric(12,2) not null default 0`
- `balance_points numeric(12,2) not null default 0`
- `penalty_points numeric(12,2) not null default 0`
- `version integer not null default 0`
- `created_at`
- `updated_at`

说明：

- 对应旧字段 `zizai`、`balance`、`penalty`

## 5.2 `point_reason_templates`

用途：

- 积分理由模板

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid not null`
- `name varchar(150) not null`
- `value numeric(12,2) not null`
- `transaction_type varchar(30) not null`
- `scene varchar(50) not null`
- `category varchar(50) not null`
- `note text null`
- `is_editable boolean not null default false`
- `is_multiplier boolean not null default false`
- `multiplier numeric(12,2) null`
- `is_active boolean not null default true`
- `display_order integer not null default 0`
- `legacy_name varchar(150) null`
- `created_at`
- `updated_at`

约束建议：

- `(class_id, name)` 可唯一

## 5.3 `point_transactions`

用途：

- 积分事实流水表

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid not null`
- `student_id uuid not null`
- `point_account_id uuid not null`
- `transaction_type varchar(30) not null`
- `value numeric(12,2) not null`
- `reason text not null`
- `scene varchar(50) not null`
- `category varchar(50) not null`
- `source_module varchar(50) not null`
- `source_type varchar(50) null`
- `source_id uuid null`
- `batch_id uuid null`
- `reason_template_id uuid null`
- `actor_user_id uuid null`
- `actor_membership_id uuid null`
- `occurred_at timestamptz not null`
- `is_reverted boolean not null default false`
- `reverted_by_transaction_id uuid null`
- `legacy_numeric_id numeric(20,4) null`
- `legacy_snapshot jsonb null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at`

索引建议：

- `(student_id, occurred_at desc)`
- `(class_id, occurred_at desc)`
- `(source_module, source_id)`

说明：

- 这张表是第一阶段最核心的事实表之一

## 6. 考勤系统设计

## 6.1 `attendance_policies`

用途：

- 班级考勤策略

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid not null unique`
- `late_penalty_value numeric(12,2) not null default -1`
- `absent_penalty_value numeric(12,2) not null default -5`
- `perfect_attendance_bonus_value numeric(12,2) not null default 10`
- `weekend_rules jsonb not null default '{}'::jsonb`
- `special_rules jsonb not null default '{}'::jsonb`
- `is_frozen boolean not null default false`
- `created_at`
- `updated_at`

说明：

- 第一阶段允许用 `jsonb` 保存周末规则和特殊时段规则
- 后续若复杂度上升再进一步拆表

## 6.2 `attendance_schedules`

用途：

- 班级考勤时段配置

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid not null`
- `code varchar(50) not null`
- `name varchar(120) not null`
- `start_time time not null`
- `end_time time not null`
- `late_time time not null`
- `display_order integer not null default 0`
- `is_active boolean not null default true`
- `created_at`
- `updated_at`

约束建议：

- `(class_id, code)` 唯一

## 6.3 `attendance_sessions`

用途：

- 某班级某天某时段的考勤场次

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid not null`
- `schedule_id uuid not null`
- `session_date date not null`
- `session_code varchar(50) not null`
- `planned_start_at timestamptz null`
- `planned_end_at timestamptz null`
- `late_deadline_at timestamptz null`
- `status varchar(30) not null default 'open'`
- `created_at`
- `updated_at`

约束建议：

- `(class_id, session_date, session_code)` 唯一

说明：

- 可以由系统按配置自动生成，也可在首次签到时按需创建

## 6.4 `attendance_records`

用途：

- 学生在某场考勤中的实际记录

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid not null`
- `attendance_session_id uuid not null`
- `student_id uuid not null`
- `status varchar(30) not null`
- `check_in_at timestamptz null`
- `recorded_at timestamptz not null`
- `source varchar(30) not null default 'manual'`
- `note text null`
- `point_transaction_id uuid null`
- `actor_user_id uuid null`
- `actor_membership_id uuid null`
- `legacy_student_name varchar(120) null`
- `legacy_timestamp bigint null`
- `created_at`
- `updated_at`

约束建议：

- `(attendance_session_id, student_id)` 唯一

状态建议：

- `present`
- `late`
- `absent`
- `excused`

## 7. 配置与治理设计

## 7.1 `class_configs`

用途：

- 班级基础配置与非高频结构化配置

主要字段：

- `class_id uuid pk`
- `tenant_id uuid not null`
- `class_name varchar(120) not null`
- `timezone varchar(50) not null default 'Asia/Shanghai'`
- `is_frozen boolean not null default false`
- `schedule_notes jsonb not null default '{}'::jsonb`
- `countdown_events jsonb not null default '[]'::jsonb`
- `extra jsonb not null default '{}'::jsonb`
- `created_at`
- `updated_at`

说明：

- 第一阶段承接部分难以立即标准化的小配置
- 但禁止把主业务数据重新塞回 `extra`

## 7.2 `feature_flags`

用途：

- 功能开关

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid null`
- `code varchar(80) not null`
- `enabled boolean not null default false`
- `config jsonb not null default '{}'::jsonb`
- `created_at`
- `updated_at`

约束建议：

- `(tenant_id, class_id, code)` 唯一

## 7.3 `audit_logs`

用途：

- 平台级审计

主要字段：

- `id uuid pk`
- `tenant_id uuid null`
- `class_id uuid null`
- `actor_user_id uuid null`
- `actor_membership_id uuid null`
- `action varchar(100) not null`
- `target_type varchar(100) not null`
- `target_id uuid null`
- `request_id varchar(120) null`
- `ip inet null`
- `user_agent text null`
- `before_data jsonb null`
- `after_data jsonb null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

索引建议：

- `(tenant_id, created_at desc)`
- `(target_type, target_id, created_at desc)`

## 7.4 `import_jobs`

用途：

- 导入任务记录

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `class_id uuid null`
- `job_type varchar(50) not null`
- `status varchar(30) not null`
- `source_filename varchar(255) null`
- `summary jsonb not null default '{}'::jsonb`
- `error_message text null`
- `triggered_by_user_id uuid null`
- `created_at`
- `updated_at`
- `finished_at timestamptz null`

## 7.5 `migration_mappings`

用途：

- 旧系统 ID 与新系统 ID 对照

主要字段：

- `id uuid pk`
- `tenant_id uuid not null`
- `entity_type varchar(80) not null`
- `legacy_scope varchar(80) not null`
- `legacy_key varchar(255) not null`
- `new_id uuid not null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at`

约束建议：

- `(tenant_id, entity_type, legacy_scope, legacy_key)` 唯一

说明：

- 迁移脚本和回溯核对会高度依赖此表

## 8. 第二阶段扩展表

以下表建议在第一阶段完成稳定后补齐：

### 8.1 作业与任务

- `subjects`
- `homework_tasks`
- `homework_submissions`
- `tasks`
- `task_claims`

### 8.2 商城与库存

- `shop_items`
- `inventory_balances`
- `redemption_orders`
- `item_usage_records`
- `inventory_adjustments`

### 8.3 消息与内容

- `messages`
- `class_quotes`
- `announcement_posts`

### 8.4 对战系统

- `battle_seasons`
- `battle_teams`
- `battle_team_members`
- `battle_squads`
- `battle_matches`
- `battle_settlements`
- `battle_exams`
- `battle_logs`

### 8.5 备份与快照

- `class_snapshots`
- `export_jobs`
- `backup_records`

## 9. 第一阶段最小 ER 关系

核心关系如下：

- `tenant 1 - n memberships`
- `user 1 - n memberships`
- `tenant 1 - n classes`
- `class 1 - n students`
- `student 1 - 1 point_accounts`
- `student 1 - n point_transactions`
- `class 1 - n attendance_schedules`
- `attendance_schedule 1 - n attendance_sessions`
- `attendance_session 1 - n attendance_records`
- `student 1 - n attendance_records`
- `class 1 - n groups`
- `class 1 - n dormitories`
- `class 1 - n positions`
- `student 1 - n student_group_assignments`
- `student 1 - n student_dorm_assignments`
- `student 1 - n student_position_assignments`

## 10. Prisma 建模建议

建议按以下模型优先落地：

1. `Tenant`
2. `User`
3. `Membership`
4. `Role`
5. `Class`
6. `Student`
7. `StudentProfile`
8. `Group`
9. `Dormitory`
10. `Position`
11. `PointAccount`
12. `PointReasonTemplate`
13. `PointTransaction`
14. `AttendancePolicy`
15. `AttendanceSchedule`
16. `AttendanceSession`
17. `AttendanceRecord`
18. `ClassConfig`
19. `FeatureFlag`
20. `AuditLog`
21. `ImportJob`
22. `MigrationMapping`

## 11. 索引与约束重点

第一阶段最关键的索引：

- `users(username)`
- `users(email)`
- `memberships(tenant_id, user_id)`
- `students(class_id, legacy_id)`
- `point_transactions(student_id, occurred_at desc)`
- `point_transactions(class_id, occurred_at desc)`
- `attendance_sessions(class_id, session_date, session_code)`
- `attendance_records(attendance_session_id, student_id)`
- `audit_logs(tenant_id, created_at desc)`
- `migration_mappings(tenant_id, entity_type, legacy_scope, legacy_key)`

第一阶段最关键的唯一约束：

- `tenants.slug`
- `users.username`
- `memberships(tenant_id, user_id)`
- `point_accounts.student_id`
- `attendance_policies.class_id`
- `attendance_schedules(class_id, code)`
- `attendance_sessions(class_id, session_date, session_code)`
- `attendance_records(attendance_session_id, student_id)`

## 12. 迁移落地建议

第一阶段迁移顺序建议：

1. `tenants`
2. `users`
3. `memberships`
4. `classes`
5. `students`
6. `student_profiles`
7. `groups` / `dormitories` / `positions`
8. assignment 系列表
9. `point_accounts`
10. `point_reason_templates`
11. `point_transactions`
12. `attendance_policies`
13. `attendance_schedules`
14. `attendance_sessions`
15. `attendance_records`
16. `class_configs`
17. `feature_flags`
18. `migration_mappings`

原因：

- 先建立身份和组织边界
- 再迁入事实数据
- 最后迁入配置与辅助数据

## 13. 决策结论

### 已确定

- 第一阶段不再使用“单表 JSON 主存储”
- 新系统核心事实表为 `students`、`point_transactions`、`attendance_records`
- 多租户在第一阶段即落地
- 审计与迁移映射在第一阶段必须存在

### 待下一步细化

- Prisma 字段命名最终版
- 枚举常量清单
- 第二阶段商城、任务、对战详细 schema
- 账户与 refresh token 相关表

## 14. 下一份文档

基于本文档，下一步建议输出《迁移实施计划 v1》或直接开始建立新仓的 Prisma schema 初版。

