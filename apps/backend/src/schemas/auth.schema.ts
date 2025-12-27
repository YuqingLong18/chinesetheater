import { z } from 'zod';

export const teacherLoginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(6, '密码长度至少6位')
});

const sessionTaskInputSchema = z.object({
  title: z.string().min(1, '任务名称不能为空'),
  description: z
    .string()
    .min(1, '任务描述至少1个字符')
    .max(300, '任务描述请控制在300字符内')
    .optional(),
  feature: z.enum(['chat', 'writing', 'workshop', 'analysis', 'journey', 'gallery']),
  isRequired: z.boolean().optional(),
  config: z.record(z.any()).optional(),
  orderIndex: z.number().int().min(0).optional()
});

export type SessionTaskInputSchema = z.infer<typeof sessionTaskInputSchema>;

export const createSessionSchema = z.object({
  sessionName: z.string().min(1, '请输入会话名称'),
  authorName: z.string().min(1, '请输入作者姓名'),
  literatureTitle: z.string().min(1, '请输入文学作品名称'),
  tasks: z
    .array(sessionTaskInputSchema)
    .max(10, '任务数量请控制在10个以内')
    .optional()
});

export const studentBatchSchema = z.object({
  quantity: z.number().int().min(1).max(50)
});

export const studentLoginSchema = z.object({
  sessionPin: z.string().min(4, '请输入有效的课堂PIN码'),
  username: z.string().min(2, '昵称至少2个字符').max(20, '昵称过长')
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, '请输入消息内容')
});

export const imageGenerationSchema = z.object({
  style: z.string().min(1, '请输入图像风格'),
  sceneDescription: z.string().min(10, '请输入至少10个字符的场景描述')
});

export const imageEditSchema = z.object({
  instruction: z.string().min(4, '请输入至少4个字符的编辑描述')
});

export const imageRevertSchema = z.object({
  previousImageUrl: z.string().min(1, '缺少原始图像'),
  previousSceneDescription: z.string().min(1, '缺少原始描述'),
  previousStyle: z.string().min(1, '缺少原始风格'),
  previousEditCount: z.number().int().min(0),
  currentImageUrl: z.string().min(1, '缺少当前图像信息')
});

export const taskSubmissionSchema = z.object({
  payload: z.record(z.any())
});

export const spacetimeAnalysisSchema = z.object({
  author: z.string().min(1, '请输入作者信息'),
  workTitle: z.string().min(1, '请输入作品名称'),
  era: z.string().min(1, '请输入时代信息'),
  genre: z.string().min(1, '请输入流派信息'),
  analysisType: z.enum(['crossCulture', 'sameEra', 'sameGenre', 'custom']),
  focusScope: z
    .string()
    .min(2, '请至少输入2个字符')
    .max(120, '请将描述控制在120字符内')
    .optional(),
  promptNotes: z
    .string()
    .min(2, '请至少输入2个字符')
    .max(200, '请将描述控制在200字符内')
    .optional(),
  customInstruction: z
    .string()
    .min(10, '请详细描述你的自定义分析要求，至少10个字符')
    .max(1000, '自定义内容请控制在1000字符内')
    .optional()
}).superRefine((value, ctx) => {
  if (value.analysisType === 'custom') {
    if (!value.customInstruction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请输入自定义分析的详细要求',
        path: ['customInstruction']
      });
    }
  } else {
    if (!value.author.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '请输入作者信息', path: ['author'] });
    }
    if (!value.workTitle.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '请输入作品名称', path: ['workTitle'] });
    }
    if (!value.era.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '请输入时代信息', path: ['era'] });
    }
    if (!value.genre.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '请输入流派信息', path: ['genre'] });
    }
  }
});
