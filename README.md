# 中文课堂互动平台 - 原型项目

本仓库基于产品规格文档实现了前后端分离的原型工程，涵盖教师端教学管理、学生端学习体验以及 OpenRouter AI 对话/图像生成集成的基础骨架。

## 项目结构

```
chinesetheater/
├─ package.json           # 顶层工作区配置
├─ apps/
│  ├─ backend/           # Node.js + Express + Prisma API 服务
│  └─ frontend/          # React + Vite + Tailwind 学习平台界面
├─ CONTEXT.md             # 规格说明（原始需求）
└─ README.md              # 当前说明文档
```

## 环境准备

- Node.js 18+
- npm 9+
- PostgreSQL / SQLite（通过 `DATABASE_PROVIDER` 控制）
- OpenRouter API Key

## 快速开始

1. **安装依赖**
   ```bash
   npm install
   npm install --workspace backend
   npm install --workspace frontend
   ```

2. **配置环境变量**
   - 复制 `apps/backend/.env.example` 为 `apps/backend/.env`
   - 更新数据库、JWT、OpenRouter 等变量

3. **数据库迁移（可选）**
   ```bash
   cd apps/backend
   npx prisma migrate dev
   ```

4. **启动后端**
   ```bash
   npm run dev:backend
   ```

5. **启动前端**
   ```bash
   npm run dev:frontend
   ```

6. 浏览器访问 `http://localhost:5173`

## 功能概览

### 后端 API

- `POST /api/teacher/login` 教师登录
- `POST /api/student/login` 学生登录
- `POST /api/teacher/sessions` 创建课堂
- `POST /api/teacher/sessions/:id/students` 批量生成学生账号
- `GET /api/teacher/sessions/:id/analytics` 课堂监控数据
- `POST /api/student/chat` 学生与“作者”对话
- `POST /api/student/generate-image` 描述生成图像
- `POST /api/student/images/:id/share` 分享作品

所有接口均返回中文文案，采用 JWT 认证。

### 前端界面

- **教师入口**：课堂创建、学生账号生成、实时监控可视化、课堂详情日志查看
- **学生入口**：作者对话、描述性写作（AI 图像）、课堂画廊
- Tailwind CSS 渐变色风格、移动优先布局

## 后续方向

- 增补自动化测试（单元/端到端）
- 完善错误处理与国际化提示
- 集成打印凭条与 PDF 导出
- 增强课堂实时性（WebSocket/实时消息）

> 提示：本原型聚焦架构与流程，调用 OpenRouter 时请注意 API 费用及速率限制，可在 `.env` 中调整模型。

- 图像生成默认支持 OpenAI DALL·E 及 Gemini 等基于 `/chat/completions` 的模型，只需在 `apps/backend/.env` 中设置 `OPENROUTER_IMAGE_MODEL` 为对应 ID。


## 开发辅助脚本

- `npm run create:teacher -- <用户名> <密码>`：在数据库中创建教师账号，便于首次登录后端控制面板。
  - 该命令会调用 `apps/backend/scripts/create-teacher.ts`，自动加载 `.env` 中的数据库连接配置。

