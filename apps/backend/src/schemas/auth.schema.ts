import { z } from 'zod';

export const teacherLoginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(6, '密码长度至少6位')
});

export const createSessionSchema = z.object({
  sessionName: z.string().min(1, '请输入会话名称'),
  sessionPin: z.string().regex(/^\d{4,6}$/g, 'PIN码需为4-6位数字'),
  authorName: z.string().min(1, '请输入作者姓名'),
  literatureTitle: z.string().min(1, '请输入文学作品名称')
});

export const studentBatchSchema = z.object({
  quantity: z.number().int().min(1).max(50)
});

export const studentLoginSchema = z.object({
  sessionPin: z.string().regex(/^\d{4,6}$/g, '会话PIN码需为4-6位数字'),
  username: z.string().min(4).max(12),
  password: z.string().min(4).max(12)
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

export const spacetimeAnalysisSchema = z.object({
  author: z.string().min(1, '请输入作者信息'),
  workTitle: z.string().min(1, '请输入作品名称'),
  era: z.string().min(1, '请输入时代信息'),
  genre: z.string().min(1, '请输入流派信息'),
  analysisType: z.enum(['crossCulture', 'sameEra', 'sameGenre']),
  focusScope: z
    .string()
    .min(2, '请至少输入2个字符')
    .max(120, '请将描述控制在120字符内')
    .optional(),
  promptNotes: z
    .string()
    .min(2, '请至少输入2个字符')
    .max(200, '请将描述控制在200字符内')
    .optional()
});
