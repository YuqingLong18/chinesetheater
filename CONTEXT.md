# 中文课堂互动平台 - 产品规格文档

## 项目概述

一个现代化的中文教学互动平台，支持教师创建课堂会话，学生通过AI对话和图像生成功能进行文学学习。全中文界面，简约现代设计风格，采用渐变色按钮。

## 技术栈

- **前端框架**: React + TypeScript
- **样式**: Tailwind CSS (渐变色按钮、现代简约设计)
- **后端**: Node.js + Express
- **数据库**: PostgreSQL 或 SQLite
- **AI集成**: OpenRouter API (对话模型 + 图像生成模型)
- **身份验证**: JWT

## 核心功能模块

### 1. 双入口登录系统

#### 1.1 教师登录
- 路径: `/teacher-login`
- 用户名/密码认证
- 登录后进入教师控制面板

#### 1.2 学生登录
- 路径: `/student-login`
- 使用会话PIN码 + 4字符用户名/密码组合
- 登录后进入学生学习界面

### 2. 教师控制面板功能

#### 2.1 会话管理
**创建新会话**
- 输入字段:
  - 会话名称 (session_name)
  - 会话PIN码 (session_pin, 4-6位数字)
  - 课堂主题:
    - 作者姓名 (author_name)
    - 文学作品名称 (literature_title)
- 提交后生成唯一会话ID

#### 2.2 学生账号生成器
- 功能: 批量生成随机4字符用户名和密码组合
- 界面元素:
  - 数量选择器 (1-50个组合)
  - "生成账号"按钮 (渐变色)
  - 展示生成结果的表格:
    ```
    | 序号 | 用户名 | 密码 | 状态 |
    | 1    | 春花23 | 秋月56 | 未使用 |
    | 2    | 雨声78 | 风云12 | 已登录 |
    ```
- "打印分发"按钮: 生成适合打印的PDF格式凭条
  - 每个凭条包含: 会话PIN、用户名、密码
  - 可剪裁格式

#### 2.3 课堂活动监控面板
显示实时数据:
- **在线学生列表**
  - 用户名
  - 登录时间
  - 当前活动状态
  
- **对话统计**
  - 每个学生与"作者"的对话轮数
  - 对话时长
  - 最后活动时间
  
- **图像生成统计**
  - 每个学生生成的图像数量
  - 已分享到课堂画廊的图像数
  - 编辑次数统计

- **课堂画廊预览**
  - 所有学生分享的图像缩略图
  - 点击查看详情(图像+描述性文字)

### 3. 学生学习界面

#### 3.1 界面布局
```
┌─────────────────────────────────────────┐
│  顶部栏: [会话名称显示]     [用户: 春花23] │
├─────────────────────────────────────────┤
│                                         │
│  功能选择区域:                            │
│  ┌──────────────┐  ┌──────────────┐    │
│  │ 与作者对话      │  │ 描述性写作     │    │
│  │ (渐变按钮1)    │  │ (渐变按钮2)    │    │
│  └──────────────┘  └──────────────┘    │
│                                         │
│  ┌──────────────┐                      │
│  │ 课堂画廊       │                      │
│  │ (渐变按钮3)    │                      │
│  └──────────────┘                      │
│                                         │
│  [动态内容展示区域]                        │
│                                         │
└─────────────────────────────────────────┘
```

#### 3.2 功能一: 与作者对话

**触发方式**: 点击"与作者对话"按钮

**界面变化**: 在功能选择区域下方展开聊天窗口

**聊天窗口特性**:
- 现代化对话气泡设计
- 学生消息: 右对齐，浅色背景
- "作者"回复: 左对齐，带渐变色边框
- 输入框: 底部固定，带"发送"按钮(渐变色)
- 显示打字指示器

**AI行为要求**:
```
System Prompt 模板:
你是{author_name}，{literature_title}的作者。请基于以下要求与学生对话:
1. 使用第一人称,以作者身份回答问题
2. 结合你的生平经历和创作背景
3. 体现作品中的核心思想和主题
4. 适时引用原作中的经典段落或名句
5. 语言风格符合作者的时代和个人特色
6. 对学生保持鼓励和启发性
7. 所有回复使用中文

学生现在想与你交流,请开始对话。
```

**技术实现**:
- 调用 OpenRouter API (推荐模型: GPT-4, Claude)
- 保存对话历史到数据库
- 实时统计对话轮数

#### 3.3 功能二: 描述性写作 (图像生成)

**触发方式**: 点击"描述性写作"按钮

**界面布局**:
```
┌─────────────────────────────────────┐
│  描述性写作 - 用文字描绘你的想象         │
├─────────────────────────────────────┤
│  图像风格:                            │
│  [__________________________]       │
│  (提示: 如"水墨画"、"油画"、"写实主义") │
│                                     │
│  场景描述:                            │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │  (大文本框, 至少4-5行高度)        │
│  │  提示: 详细描述场景中的人物、环境、  │
│  │  氛围、色彩、动作等元素             │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  [生成图像] (渐变按钮, 居中)            │
└─────────────────────────────────────┘
```

**图像生成流程**:

1. **初次生成**
   - 用户填写"风格"和"场景描述"
   - 点击"生成图像"
   - 显示加载动画
   - 生成后显示图像

2. **查看生成结果界面**
   ```
   ┌─────────────────────────────────────┐
   │  [生成的图像居中显示]                   │
   ├─────────────────────────────────────┤
   │  你的描述:                            │
   │  风格: 水墨画                         │
   │  场景: [用户输入的描述文字]             │
   ├─────────────────────────────────────┤
   │  剩余编辑次数: 2/2                    │
   │  [重新编辑描述] [分享到课堂画廊]        │
   └─────────────────────────────────────┘
   ```

3. **编辑功能** (最多2次)
   - 点击"重新编辑描述"返回编辑界面
   - 用户修改风格或场景描述
   - 重新生成,编辑次数-1
   - 编辑次数用尽后禁用编辑按钮

4. **分享到课堂画廊**
   - 点击"分享到课堂画廊"按钮
   - 确认对话框: "确定要分享这幅作品吗?"
   - 确认后,图像+描述文字保存到课堂画廊
   - 显示成功提示

**技术实现**:
- 构建图像生成Prompt:
  ```
  A {style} style image depicting: {scene_description}
  High quality, detailed, Chinese aesthetic
  ```
- 调用 OpenRouter API 图像生成模型 (推荐: DALL-E 3, Stable Diffusion)
- 存储图像URL和元数据
- 追踪编辑次数 (edit_count字段)

#### 3.4 功能三: 课堂画廊

**触发方式**: 点击"课堂画廊"按钮

**界面布局**: 瀑布流或网格展示

```
┌─────────────────────────────────────┐
│  课堂画廊 - 本节课学生作品展示           │
├─────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ 图像1   │ │ 图像2   │ │ 图像3   │  │
│  │ 作者:XX │ │ 作者:XX │ │ 作者:XX │  │
│  └────────┘ └────────┘ └────────┘  │
│  ┌────────┐ ┌────────┐             │
│  │ 图像4   │ │ 图像5   │             │
│  │ 作者:XX │ │ 作者:XX │             │
│  └────────┘ └────────┘             │
└─────────────────────────────────────┘
```

**点击图像后**: 模态框显示
- 完整图像
- 创作者用户名
- 风格标签
- 完整场景描述
- 创作时间

## 数据模型设计

### Teachers 表
```sql
- teacher_id (Primary Key)
- username
- password_hash
- created_at
```

### Sessions 表
```sql
- session_id (Primary Key)
- teacher_id (Foreign Key)
- session_name
- session_pin
- author_name
- literature_title
- created_at
- is_active
```

### Students 表
```sql
- student_id (Primary Key)
- session_id (Foreign Key)
- username (4 characters)
- password_hash
- is_used (boolean)
- first_login_at
- last_activity_at
```

### Conversations 表
```sql
- conversation_id (Primary Key)
- student_id (Foreign Key)
- session_id (Foreign Key)
- message_count
- total_duration (seconds)
- created_at
- updated_at
```

### Messages 表
```sql
- message_id (Primary Key)
- conversation_id (Foreign Key)
- sender_type (enum: 'student', 'ai')
- content (text)
- timestamp
```

### GeneratedImages 表
```sql
- image_id (Primary Key)
- student_id (Foreign Key)
- session_id (Foreign Key)
- style
- scene_description
- image_url
- edit_count
- is_shared (boolean)
- created_at
```

## UI/UX 设计规范

### 色彩方案
- **主要渐变色**: 
  - 按钮1: `bg-gradient-to-r from-blue-500 to-purple-600`
  - 按钮2: `bg-gradient-to-r from-green-400 to-blue-500`
  - 按钮3: `bg-gradient-to-r from-pink-500 to-orange-400`
  
- **背景**: 浅灰或白色 (`bg-gray-50`)
- **卡片**: 白色带阴影 (`bg-white shadow-lg`)
- **文字**: 深灰 (`text-gray-800`)

### 字体
- 使用系统中文字体栈:
  ```css
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  ```

### 间距与圆角
- 按钮圆角: `rounded-lg` (8px)
- 卡片圆角: `rounded-xl` (12px)
- 标准间距: `p-6`, `m-4`

### 响应式设计
- 移动端优先
- 平板和桌面适配

## API端点规划

### 认证相关
- `POST /api/teacher/login` - 教师登录
- `POST /api/student/login` - 学生登录
- `POST /api/logout` - 登出

### 教师功能
- `POST /api/teacher/sessions` - 创建会话
- `GET /api/teacher/sessions/:id` - 获取会话详情
- `POST /api/teacher/sessions/:id/students` - 生成学生账号
- `GET /api/teacher/sessions/:id/analytics` - 获取课堂分析数据
- `GET /api/teacher/sessions/:id/gallery` - 查看课堂画廊

### 学生功能
- `GET /api/student/session` - 获取当前会话信息
- `POST /api/student/chat` - 发送对话消息
- `GET /api/student/chat/history` - 获取对话历史
- `POST /api/student/generate-image` - 生成图像
- `POST /api/student/images/:id/share` - 分享图像到画廊
- `GET /api/student/gallery` - 查看课堂画廊

### OpenRouter 集成
- 封装对话API调用
- 封装图像生成API调用
- 错误处理和重试机制

## 开发优先级

### Phase 1: 核心认证与会话管理
1. 数据库schema搭建
2. 教师登录系统
3. 会话创建功能
4. 学生账号生成器

### Phase 2: 学生功能 - 对话
1. 学生登录系统
2. "与作者对话"功能
3. OpenRouter对话API集成
4. 对话历史保存

### Phase 3: 学生功能 - 图像生成
1. 描述性写作界面
2. OpenRouter图像生成API集成
3. 编辑次数限制逻辑
4. 图像存储

### Phase 4: 社交功能
1. 课堂画廊展示
2. 图像分享功能
3. 画廊浏览界面

### Phase 5: 教师分析面板
1. 实时活动监控
2. 统计数据展示
3. 课堂画廊管理

### Phase 6: 优化与打磨
1. UI/UX细节优化
2. 性能优化
3. 错误处理完善
4. 打印功能实现

## 环境变量配置

```env
# 数据库
DATABASE_URL=

# JWT密钥
JWT_SECRET=

# OpenRouter API
OPENROUTER_API_KEY=
OPENROUTER_CHAT_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_IMAGE_MODEL=openai/dall-e-3

# 应用配置
PORT=3000
NODE_ENV=development
```

## 下一步行动

1. 初始化项目结构 (React + Node.js)
2. 设置数据库连接
3. 实现教师认证和会话管理
4. 开始Phase 1开发

---

**注意事项**:
- 所有用户界面文字必须使用简体中文
- 确保OpenRouter API调用包含适当的错误处理
- 学生隐私保护:不收集真实姓名和敏感信息
- 图像内容审核:集成OpenRouter的安全过滤功能