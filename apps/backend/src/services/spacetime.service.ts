import { prisma } from '../lib/prisma.js';
import { callOpenRouter } from '../lib/openrouter.js';
import { env } from '../config/env.js';

export type SpacetimeAnalysisType = 'crossCulture' | 'sameEra' | 'sameGenre' | 'custom';

export interface SpacetimeAnalysisInput {
  author: string;
  workTitle: string;
  era: string;
  genre: string;
  analysisType: SpacetimeAnalysisType;
  focusScope?: string | null;
  promptNotes?: string | null;
  customInstruction?: string | null;
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const analysisTypeDescriptions: Record<SpacetimeAnalysisType, string> = {
  crossCulture: '中外文学对比分析',
  sameEra: '同时代作者代表作品梳理',
  sameGenre: '同流派中国作家前后对比',
  custom: '自定义对比分析'
};

const buildUserPrompt = (
  sessionAuthor: string,
  sessionWork: string,
  input: SpacetimeAnalysisInput
) => {
  const lines: string[] = [];

  lines.push(`课堂主题：${sessionAuthor}《${sessionWork}》。`);
  lines.push(`学生输入信息如下：`);
  lines.push(`- 作者：${input.author}`);
  lines.push(`- 作品：${input.workTitle}`);
  lines.push(`- 时代：${input.era}`);
  lines.push(`- 流派：${input.genre}`);
  lines.push(`- 任务类型：${analysisTypeDescriptions[input.analysisType]}`);

  if (input.focusScope) {
    lines.push(`- 对比或聚焦范围：${input.focusScope}`);
  }

  if (input.promptNotes) {
    lines.push(`- 特别关注点：${input.promptNotes}`);
  }

  if (input.analysisType === 'custom' && input.customInstruction) {
    lines.push('学生希望你严格按照以下自定义说明组织输出：');
    lines.push(input.customInstruction);
  } else {
    lines.push('请结合中国文学史的专业知识，完成以下任务：');

    if (input.analysisType === 'crossCulture') {
      lines.push(
        `1. 从中国文学与${input.focusScope ?? '目标文化'}的代表作入手，进行背景、主题、美学特征的对比，突出异同点。`
      );
      lines.push('2. 指出两种文学传统在互相影响、文化交流方面的关键节点。');
      lines.push('3. 给出课堂讨论可延伸的提问建议，帮助学生深化理解。');
    } else if (input.analysisType === 'sameEra') {
      lines.push('1. 列出与该作者同一时代的2-3位重要作家，并说明代表作品。');
      lines.push('2. 分析这些作品与课堂作品在主题、风格、社会背景上的联系与差异。');
      lines.push('3. 提供该时代的文学发展线索，帮助学生构建时间坐标。');
    } else if (input.analysisType === 'sameGenre') {
      lines.push('1. 选择同一流派在前辈与后继作者中的代表作品进行对比。');
      lines.push('2. 说明流派核心美学如何在时间中传承与创新。');
      lines.push('3. 提出课堂延伸阅读或创作练习的建议。');
    }
  }

  lines.push('请使用分段和小标题，语言准确、凝练，全文保持中文输出。');

  return lines.join('\n');
};

export const createSpacetimeAnalysis = async (
  studentId: number,
  sessionId: number,
  input: SpacetimeAnalysisInput
) => {
  const student = await prisma.student.findUnique({
    where: { studentId },
    include: {
      session: true
    }
  });

  if (!student || student.sessionId !== sessionId) {
    throw new Error('学生信息不匹配');
  }

  const session = student.session;
  if (!session || session.sessionId !== sessionId) {
    throw new Error('课堂会话不存在');
  }

  await prisma.student.update({
    where: { studentId },
    data: { lastActivityAt: new Date() }
  });

  const response = await callOpenRouter<OpenRouterChatResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: env.OPENROUTER_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            '你是一位擅长跨文化与文学史梳理的资深语文教师，能够根据学生输入生成结构清晰的分析提要。请使用中文回答，输出包括小标题、要点和建议。'
        },
        {
          role: 'user',
          content: buildUserPrompt(session.authorName, session.literatureTitle, input)
        }
      ]
    })
  });

  const generatedContent = response.choices?.[0]?.message?.content?.trim();
  const finalContent = generatedContent && generatedContent.length > 0
    ? generatedContent
    : '抱歉，暂时无法生成分析，请稍后再试。';

  const analysis = await prisma.spacetimeAnalysis.create({
    data: {
      studentId,
      sessionId,
      author: input.author,
      workTitle: input.workTitle,
      era: input.era,
      genre: input.genre,
      analysisType: input.analysisType,
      focusScope: input.focusScope ?? null,
      promptNotes: input.promptNotes ?? null,
      customInstruction: input.customInstruction ?? null,
      generatedContent: finalContent
    }
  });

  return analysis;
};

export const listStudentSpacetimeAnalyses = async (studentId: number, sessionId: number) =>
  prisma.spacetimeAnalysis.findMany({
    where: { studentId, sessionId },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

export const listSessionSpacetimeAnalyses = async (sessionId: number) =>
  prisma.spacetimeAnalysis.findMany({
    where: { sessionId },
    include: {
      student: {
        select: {
          studentId: true,
          username: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

export const getSpacetimeAnalytics = async (sessionId: number) => {
  const analyses = await prisma.spacetimeAnalysis.groupBy({
    by: ['analysisType'],
    where: { sessionId },
    _count: {
      analysisType: true
    }
  });

  const recent = await prisma.spacetimeAnalysis.findMany({
    where: { sessionId },
    include: {
      student: {
        select: { username: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  return {
    counts: {
      crossCulture: analyses.find((item) => item.analysisType === 'crossCulture')?._count.analysisType ?? 0,
      sameEra: analyses.find((item) => item.analysisType === 'sameEra')?._count.analysisType ?? 0,
      sameGenre: analyses.find((item) => item.analysisType === 'sameGenre')?._count.analysisType ?? 0,
      custom: analyses.find((item) => item.analysisType === 'custom')?._count.analysisType ?? 0
    },
    recent: recent.map((item) => ({
      analysisId: item.analysisId,
      username: item.student.username,
      analysisType: item.analysisType,
      createdAt: item.createdAt
    }))
  };
};
