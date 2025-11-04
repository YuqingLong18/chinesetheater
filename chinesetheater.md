# ChineseTheater 项目学习指南

面向第一次接触本仓库的开发者，本文概述项目的核心功能、模块职责以及关键流程，帮助快速理解整体架构并开展二次开发。

## 系统概览
- **定位**：中文文学课堂互动原型，覆盖教师端课堂筹备与监控、学生端沉浸式学习、AI 辅助创作与分析。
- **整体架构**：前后端分离的单仓双应用结构，后端提供 REST API 与服务器推送，前端以 React SPA 呈现。
- **AI 能力入口**：开放路由（OpenRouter）统一封装，接入对话、图像生成/编辑、对比分析、行迹地图等多种模型输出。

## 目录与技术栈

| 路径 | 描述 | 核心依赖 |
| --- | --- | --- |
| `apps/backend` | Node.js + Express API，Prisma 数据层 | express、prisma、jsonwebtoken、bcryptjs |
| `apps/frontend` | React + Vite 客户端，Tailwind UI | react、zustand、axios、tailwindcss |
| `prisma/schema.prisma` | PostgreSQL 数据模型定义 | Prisma ORM |
| `CONTEXT.md` | 原始产品规格 | — |

前后端均通过工作区脚本在仓库根目录统一管理依赖与启动命令。

## 后端服务（`apps/backend`）

### 应用初始化
- `src/server.ts` 读取 `.env`，启动 HTTP 服务器并加载 `createApp()`。
- `src/app.ts` 挂载全局中间件（CORS、JSON 解析、morgan 日志），注册 `/api/health` 健康检查与业务路由。
- 请求异常统一由末尾的错误处理中间件返回 500。

### 身份认证与安全
- `auth.routes.ts` 提供教师、学生登录接口。
- `controllers/auth.controller.ts` 使用 Zod (`schemas/auth.schema.ts`) 校验参数，调用 `services/auth.service.ts`。
- `auth.service.ts` 验证凭据、返回 JWT（`utils/jwt.ts`），学生首次登录会标记账号已使用并刷新活跃时间。
- 受保护路由通过 `middlewares/auth.ts` 验证 Bearer Token，可限制教师/学生访问。
- 密码使用 `bcryptjs` 哈希（`utils/password.ts`）。

### 核心业务模块
1. **课堂会话 Session（`services/session.service.ts`）**
   - 教师创建课堂：校验 PIN 唯一性，批量写入任务（`task.service.ts`），预生成“人生行迹”数据。
   - 获取教师所有课堂、课堂全量详情（含学生、对话、图像）。

2. **学生账号管理（`services/student.service.ts`）**
   - 生成指定数量的 4 位用户名/密码组合；写入哈希与初始密码。
   - 查询课堂下的学生列表（含首次登录、最近活动时间）。

3. **AI 对话（`services/chat.service.ts`）**
   - 构造作者视角 System Prompt，回放最近 10 条消息。
   - 通过 `lib/openrouter.ts` 调用 `/chat/completions`，保存问答对与统计信息。

4. **图像生成与编辑（`services/image.service.ts`）**
   - 依据配置自动判断使用 `/images` 还是 `/chat/completions` 的多模态接口。
   - 支持两次内的图像编辑、编辑撤销；记录 `imageActivity`、`imageReaction`、`imageComment`。
   - 生成作品可分享至课堂画廊，配合点赞/评论。

5. **任务与提交（`services/task.service.ts`）**
   - 课堂任务按功能类别（chat/writing/workshop/analysis/journey/gallery）配置。
   - 学生端可提交 JSON Payload，多次提交会记录为 `resubmitted`。
   - 教师查看任务汇总与学生提交详情。

6. **空间对比分析（`services/spacetime.service.ts`）**
   - 根据学生输入组合 Prompt，生成结构化分析（默认中文输出）。
   - 提供课堂统计（类型占比、最近分析记录）。

7. **人生行迹地图（`services/journey.service.ts`）**
   - 通过 JSON Schema 严格校验模型输出，失败会抛错。
   - 首次生成后写入 `Session.lifeJourney` 以便缓存。

8. **协作创作工作坊（`services/workshop*.ts`）**
   - 支持“诗歌接龙（relay）”与“改编创作（adaptation）”两种模式。
   - 房间创建、加入、轮转顺序、作品提交、投票、反应、板块版本、AI 建议等均通过 Prisma 事务维护。
   - `workshopEvents.service.ts` 基于 SSE (`EventSource`) 推送成员加入、作品更新、AI 反馈等实时事件。
   - `workshopAi.service.ts` 负责对接 OpenRouter 获取作品点评与改编建议，解析 JSON 并回写数据库。

### 数据模型概览
- `Teacher`、`Session`、`Student` 三大主体通过外键关联。
- 会话下包含 `Conversation`/`Message`、`GeneratedImage` 及其活动、`SessionTask` 及提交、`SpacetimeAnalysis`。
- 工作坊部分包含房间、成员、贡献、聊天、创作板、AI 建议、表态等，参见 `prisma/schema.prisma`。
- 常用枚举（如 `SessionTaskFeature`、`WorkshopMode`）在后端与前端类型中保持一致。

### 典型流程
- **教师筹备课堂**
  1. 登录并获取 JWT。
  2. 创建 session（名称、PIN、作者、作品、任务列表）。
  3. 为课堂批量生成学生账号；可随时查看学生列表、任务完成度、AI 活跃度。
  4. 通过 `GET /teacher/sessions/:id/analytics` 查看在线学生、对话、图像、分析统计；`/activity` 查看实时事件流。

- **学生进入课堂**
  1. 使用课堂 PIN + 临时账号登录，系统首次登录后标记账号已占用。
  2. 获取课堂信息、历史对话、任务清单、画廊内容。
  3. 在不同功能页与后端交互：与作者聊天、生成/编辑图像、提交学习任务、发起空间分析、查看人生行迹地图、参与工作坊。
  4. 所有活跃动作都会刷新 `lastActivityAt` 并在教师面板实时可见。

- **工作坊协作**
  1. 教师/学生创建或加入房间（使用房间码）。
  2. 轮到当前成员时提交诗句；系统自动轮转顺序并广播。
  3. 成员可对作品投票“保留/改写”，超过半数改写将进入 `pending` 状态。
  4. AI 监听新作品生成点评 JSON 并写入；改编模式可请求结构化建议。
  5. 创作板支持版本追踪、AI 建议附着、成员反应。

## 前端应用（`apps/frontend`）

### 应用框架
- Routing：`App.tsx` 定义教师/学生登录与受保护页面（利用 `useAuthStore` 中的 Token 判定）。
- 状态管理：`zustand` 存储登录态、当前学生档案；通过 `api/client.ts` axios 拦截器自动附加 JWT。
- 样式：Tailwind CSS 渐变主题，自定义组件库（Card、GradientButton 等）。

### 教师端界面
- `TeacherLoginPage.tsx`：提交用户名/密码调用 `/teacher/login`。
- `TeacherDashboardPage.tsx`：
  - 左侧表单创建课堂与任务草稿（自动填补 `orderIndex`）。
  - 学生账号生成（1~50 个），展示初始密码与使用状态。
  - Analytics 卡片：在线学生、对话统计、作品概览、空间分析统计。
  - Activity Modal：调用 `/teacher/sessions/:id/activity`，支持按学生过滤消息/图像/分析事件。
  - 任务汇总：`/teacher/sessions/:id/tasks` 返回每项任务的提交详情。

### 学生端学习空间
- `StudentWorkspacePage.tsx` 将功能拆分为六个 Tab（聊天、写作/图像、协作工作坊、对比分析、人生行迹、画廊任务）。
- 聊天：轮询历史消息、发送后渲染 AI 打字状态，再展示返回的问答记录。
- 图像生成/编辑：表单收集风格与场景描述，处理编辑、撤销、分享至画廊、点赞、评论等交互。
- 任务面板：展示课堂任务，支持保存输入并通过 `/student/tasks/:taskId/submission` 提交。
- 对比分析：根据任务类型动态提示，调用 `/student/spacetime` 生成 Markdown，历史记录也在此展示。
- 人生行迹：调用 `/student/life-journey`，利用 `LifeJourneyMap.tsx` 按需加载 Leaflet 脚本，绘制路线与地点弹窗。
- 工作坊：`components/WorkshopPanel.tsx` 集成房间列表、加入/创建、轮次提交、实时 SSE 监听、创作板版本、AI 建议与反应。

### 公共组件与工具
- `MarkdownRenderer`：渲染来自后端的 Markdown（聊天回复、分析结果、任务说明等）。
- `FeatureButton`、`ChatBubble` 等提升学习空间的交互体验。
- `styles` 与 `utils` 目录包含动画、日期格式化等辅助函数。

## OpenRouter 集成要点
- `config/env.ts` 定义所需环境变量，支持指定对话/图像模型。
- `lib/openrouter.ts` 统一设置 HTTP 头，包括 `Authorization` 与标识站点信息。
- 对话、图像、分析、行迹均通过该封装调用，确保错误时返回明确的中文提示。
- 图像接口针对多模态响应做了广泛兼容（URL、Base64、嵌套 JSON 等）。

## 学习与扩展建议
- 从 `README.md` 与 `CONTEXT.md` 了解产品背景，再结合本文快速定位关键模块。
- 使用 Prisma Studio 或 SQL 客户端观测 `Session`、`Student`、`Workshop` 等表结构，有助于理解实体关系。
- 想要扩展新功能时，可参考现有 service/controller/schema 的分层模式：**路由 → 控制器 → 服务层 → Prisma 操作**。
- 前端状态流建议从 `StudentWorkspacePage` 和 `TeacherDashboardPage` 入手，熟悉 axios 封装与 Zustand 状态同步。
- 若计划替换模型或调整 Prompt，可直接修改对应 service 中的 Prompt 构造函数。

> 本指南覆盖 2024-10 止的代码结构。如有新增模块，可在同目录的 `chinesetheater.md` 中补充章节以保持同步。

