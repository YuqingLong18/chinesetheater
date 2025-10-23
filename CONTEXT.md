# 中文课堂互动平台（更新版）

## 1. 项目定位与核心价值
- 为语文教师提供围绕文学作品的互动课堂工具，强调 **与作者对话、描述性写作、协作创作、人生行迹探索、课堂画廊** 等多种学习活动。
- 支持教师集中管理课堂，会话内可批量生成学生账号、实时观测活动数据，并通过 **任务清单** 引导学生完成指定练习。
- 学生端整合 AI 对话、图像生成、协作写作等功能，所有界面与提示均为中文，风格简洁，按钮使用渐变色强化操作感。

## 2. 仓库结构
```
chinesetheater/
├─ apps/
│  ├─ backend/      # Node.js + Express + Prisma，API 与业务逻辑
│  └─ frontend/     # React + TypeScript + Tailwind，Vite 构建
├─ prisma/ (legacy) # 旧版迁移目录，已弃用
├─ generated/       # Prisma Client 输出（指向 apps/backend/generated）
├─ node_modules/    # 顶层 deps（同时采用 workspace）
├─ package.json     # npm workspace 配置
└─ CONTEXT.md       # 本文件
```

### 2.1 前端 key 目录
- `src/pages/teacher/TeacherDashboardPage.tsx`：教师控制面板
- `src/pages/student/StudentWorkspacePage.tsx`：学生学习界面
- `src/components/WorkshopPanel.tsx`：协作创作面板
- `src/types/index.ts`：前端共享类型定义
- `src/components/Card/GradientButton/TextArea/...`：通用 UI 组件

### 2.2 后端 key 目录
- `src/app.ts`：Express 应用初始化，挂载 routers、middlewares
- `src/routes/*.routes.ts`：教师、学生、协作等模块化路由
- `src/controllers/*.controller.ts`：路由层请求处理
- `src/services/*.service.ts`：业务逻辑（聊天、图像、任务、会话等）
- `src/schemas/auth.schema.ts`：Zod 请求体验证
- `prisma/schema.prisma`：数据库模型定义

## 3. 技术栈与依赖
| 层 | 技术 | 说明 |
| --- | --- | --- |
| 前端 | React 18, TypeScript, Vite, Tailwind CSS, Axios, Zustand | 单页应用，中文 UI，组件化布局 |
| 后端 | Node.js (ESM), Express, Prisma, Zod, JWT | REST API + 数据访问层 |
| 数据库 | PostgreSQL | 通过 Prisma 管理 schema 与迁移 |
| AI 接入 | OpenRouter (chat & image endpoints) | 统一封装在 `lib/openrouter.ts` |

## 4. 数据模型概览（Prisma）
```
Teacher ──< Session ──< Student ──< { Conversation, GeneratedImage, SessionTaskSubmission }
                           │
                           ├─< SessionTask ──< SessionTaskSubmission
                           ├─< Conversation ──< Message
                           ├─< GeneratedImage ──< { ImageActivity, ImageReaction, ImageComment }
                           └─< SpacetimeAnalysis
WorkshopRoom ... （协作创作相关一系列模型，略）
```

### 4.1 新增任务相关模型
- `SessionTask`
  - `sessionId`：所属课堂
  - `title/description`：任务标题与说明
  - `feature`：关联功能（`chat`、`writing`、`workshop`、`analysis`、`journey`、`gallery`）
  - `config`：保留 JSON 字段（留待扩展，例如目标字数、附件等）
  - `isRequired`：是否必做
  - `orderIndex`：显示排序
- `SessionTaskSubmission`
  - `taskId/studentId` 组合唯一
  - `status`：`submitted` / `resubmitted`
  - `payload`：提交内容（JSON）
  - `createdAt/updatedAt`

### 4.2 其他核心模型
- `Session`：新增 `lifeJourney`（缓存老师预生成的行迹 JSON）与 `lifeJourneyGeneratedAt`
- `GeneratedImage`：关联 `ImageReaction`、`ImageComment`
- `WorkshopBoard`：新增 `finalDraft` 枚举值，用于改编创作最终稿

## 5. 后端 API 概览

### 5.1 教师端
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/teacher/login` | 教师登录，返回 JWT |
| GET | `/teacher/sessions` | 获取教师名下课堂列表 |
| POST | `/teacher/sessions` | 创建课堂（含任务清单）；自动写入 `SessionTask` |
| POST | `/teacher/sessions/:id/students` | 批量生成学生账号 |
| GET | `/teacher/sessions/:id/students` | 查看学生帐号状态 |
| GET | `/teacher/sessions/:id/analytics` | 课堂数据统计（对话、图像、画廊预览等） |
| GET | `/teacher/sessions/:id/activity` | 课堂详情（实时 SSE + 轮询组合） |
| GET | `/teacher/sessions/:id/tasks` | 查看任务完成情况汇总 |

### 5.2 学生端
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/student/login` | 学生登录，需要 `sessionPin + username + password` |
| GET | `/student/session` | 课堂信息（作者、作品） |
| POST | `/student/chat` / GET `/student/chat/history` | 与“作者”对话、查看历史 |
| POST | `/student/generate-image` | 描述性写作生成图像 |
| POST | `/student/images/:id/edit|revert|share` | 图像编辑、撤销、分享 |
| GET | `/student/gallery` | 课堂画廊（含点赞/评论计数） |
| POST | `/student/gallery/:imageId/like` | 点赞/取消点赞 |
| POST | `/student/gallery/:imageId/comments` | 发表评论 |
| GET | `/student/gallery/:imageId/comments` | 拉取评论列表 |
| POST | `/student/spacetime` / GET `/student/spacetime` | 生成/读取对比分析提纲 |
| GET | `/student/life-journey` | 获取预生成的人生行迹（首次自动生成缓存） |
| GET | `/student/tasks` | 拉取任务清单（包含提交记录） |
| POST | `/student/tasks/:taskId/submission` | 提交/重新提交任务（payload 为 JSON） |

### 5.3 协作创作（学生）
- `/student/workshops/...`：包含创作房间、成员、接龙/改编、意见板、多播事件、点赞等完整 API（详见 `routes/student.routes.ts` 和 `services/workshop.service.ts`）。

## 6. 前端页面与交互

### 6.1 教师控制面板 `TeacherDashboardPage`
- **会话创建表单**：支持填写任务清单（多条，可指定功能和“必做/选做”）。
- **课堂列表**：选择课堂后显示学生表格、统计数据，顶部按钮新增“刷新数据”可一次性拉取最新会话、学生、分析、任务情况。
- **任务完成情况面板**：展示每个任务的完成数量及学生提交时间，便于课后汇总。
- **课堂详情（Modal）**：包含聊天摘录、图像生成记录、对比分析记录等历史轨迹。

### 6.2 学生学习界面 `StudentWorkspacePage`
功能模块通过顶部按钮切换，均支持任务提交。

1. **任务清单卡片**（顶部，默认展开）
   - 可折叠/展开，显示任务状态（待完成/已提交/已重新提交），支持点击“前往完成”切换 tab。
   - 描述性写作与协作创作任务提供快捷按钮一键提交。

2. **与作者对话**
   - 聊天气泡布局，AI 身份固定为作者（system prompt 在后端生成）。
   - 下方嵌入任务输入框，可提交与对话相关的文字作业。

3. **描述性写作（图像生成）**
   - 输入风格 + 描述，调用 OpenRouter 图像模型生成图片。
   - 允许两次“重新编辑”。
   - 可分享至课堂画廊。
   - 若任务关联此功能，可直接提交当前图像。

4. **协作创作**（`WorkshopPanel`）
   - 展示房间列表、成员、接龙/改编流程、AI 建议、点赞。
   - 当存在协作任务时，顶部会提醒并可一键提交当前板块或最新接龙稿。

5. **对比分析**
   - 表单化输入作者、作品、时代、流派等，支持预设分析类型（跨文化/同代/同流派/自定义）。
   - 生成 Markdown 内容，可下载 HTML。
   - 下部增加任务提交文本框。

6. **人生行迹**
   - 地图采用 Leaflet 按需加载，使用教师提前生成的 JSON 数据。
   - 任务输入框用于反思/心得提交。

7. **课堂画廊**
   - 展示所有共享图片，支持点赞、评论（即时刷新）。
   - 模态框查看详情。
   - 任务提交框用于评论总结。

### 6.3 通用组件
- **Card**：圆角 + 阴影容器。
- **GradientButton**：统一渐变色按钮，支持 `primary/secondary/tertiary` 等变体。
- **TextArea/TextInput**：统一的 Label + 提示文案。
- **FeatureButton**：顶部功能切换按钮。
- **WorkshopPanel**：封装协作创作 UI，透传任务提交回调。

## 7. AI 集成
- `services/chat.service.ts`：与作者对话
  - system prompt 通过 session 的 `authorName`、`literatureTitle` 生成。
- `services/image.service.ts`：描述性写作图像生成、编辑、分享
  - 处理 OpenRouter 图像响应解析。
- `services/journey.service.ts`：人生行迹
  - 首次调用时向 OpenRouter 请求文本返回 JSON；缓存于 `Session.lifeJourney`。
- `services/workshopAi.service.ts`：协作创作 AI 建议、点评。

## 8. 任务清单逻辑详解
1. **教师端创建**
   - 表单收集任务草稿，通过 `tasks` 数组提交给 `/teacher/sessions`。
   - 后端事务中先创建 Session，再批量写入 `SessionTask`。

2. **学生端显示与刷新**
   - 登录后 `GET /student/tasks`，得到任务及最新提交状态。
   - 卡片可折叠；每个任务根据 `feature` 定位到对应 tab。

3. **提交/重新提交**
   - 写作、协作任务调用专用按钮提交结构化 payload；其他任务通过输入框提交文本。
   - 后端 `submitTaskForStudent` 使用 upsert，当已有记录时将状态置为 `resubmitted`。
   - 提交成功后刷新任务列表并更新“最近提交”时间。

4. **教师端汇总**
   - `GET /teacher/sessions/:id/tasks` 返回 `studentCount`、`tasks[].submittedCount` 及每位学生的最新 payload。
   - 控制面板任务卡片展示完成度与提交详情。

## 9. 运行与开发提示
- **环境变量**：`apps/backend/.env` 内配置数据库连接、OpenRouter API Key、JWT 密钥等。
- **数据库迁移**：
  ```bash
  cd apps/backend
  npx prisma migrate dev   # 应用迁移
  npx prisma generate      # 生成 Prisma Client
  ```
- **本地启动**：
  ```bash
  # 后端
  cd apps/backend
  npm run dev

  # 前端
  cd apps/frontend
  npm run dev
  ```
- **打包验证**：使用 `npm run build`（前端/后端）确保 TypeScript 无错误。

## 10. 后续扩展建议
- `SessionTask.config` 可用于扩展任务模板（如限定字数、上传附件）。
- 给教师端任务汇总增加导出 CSV/Excel 功能。
- 在学生端任务提交成功后加入轻提示 + 引导下一任务。
- 支持课堂画廊、协作创作的 WebSocket 实时同步。

> 本文档为当前代码库的权威概览，后续功能变更请同步更新以保持团队认知一致。
